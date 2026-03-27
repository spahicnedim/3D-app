'use client';

import { useRef, useState, useCallback, useEffect, FC, Suspense } from 'react';
import { Canvas, useThree, useFrame, ThreeEvent } from '@react-three/fiber';
import { useGLTF, Grid, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { ModelState, Vector3Tuple } from '@/types';

interface DraggableModelProps {
    modelId: string;
    url: string;
    position: Vector3Tuple;
    rotation: Vector3Tuple;
    otherModelPosition: Vector3Tuple | undefined;
    onPositionChange: (id: string, pos: Vector3Tuple, save?: boolean) => void;
    onRotationChange: (id: string, rot: Vector3Tuple, save?: boolean) => void;
    onDragStart: () => void;
    onDragEnd: () => void;
}

interface Scene3DProps {
    models: ModelState[];
    isTopDown: boolean;
    onPositionChange: (id: string, pos: Vector3Tuple, save?: boolean) => void;
    onRotationChange: (id: string, rot: Vector3Tuple, save?: boolean) => void;
}

const MIN_DISTANCE = 1.6;
const SCENE_BOUNDS = 8;
const FLOOR_PLANE  = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);



interface CameraState {
    theta: number;   // horizontal angle
    phi: number;     // vertical angle
    radius: number;  // zoom distance
    target: THREE.Vector3;
}

const CustomCamera: FC<{ isTopDown: boolean; isDraggingModel: React.RefObject<boolean> }> = ({
                                                                                                 isTopDown,
                                                                                                 isDraggingModel,
                                                                                             }) => {
    const { camera, gl } = useThree();

    const cam = useRef<CameraState>({
        theta:  Math.PI / 4,
        phi:    Math.PI / 4,
        radius: 18,
        target: new THREE.Vector3(0, 0, 0),
    });

    const pointerState = useRef({
        down: false,
        button: -1,
        lastX: 0,
        lastY: 0,
    });


    const targetTheta  = useRef(cam.current.theta);
    const targetPhi    = useRef(cam.current.phi);
    const targetRadius = useRef(cam.current.radius);
    const targetLookAt = useRef(cam.current.target.clone());
    const isAnimating  = useRef(false);


    useFrame(() => {
        const c = cam.current;


        c.theta  += (targetTheta.current  - c.theta)  * 0.12;
        c.phi    += (targetPhi.current    - c.phi)    * 0.12;
        c.radius += (targetRadius.current - c.radius) * 0.12;
        c.target.lerp(targetLookAt.current, 0.12);

        const x = c.target.x + c.radius * Math.sin(c.phi) * Math.sin(c.theta);
        const y = c.target.y + c.radius * Math.cos(c.phi);
        const z = c.target.z + c.radius * Math.sin(c.phi) * Math.cos(c.theta);

        camera.position.set(x, y, z);
        camera.lookAt(c.target);
    });


    useEffect(() => {
        if (isTopDown) {
            targetPhi.current    = 0.01;
            targetRadius.current = 20;
        } else {
            targetPhi.current    = Math.PI / 4;
            targetRadius.current = 18;
        }
    }, [isTopDown]);

    useEffect(() => {
        const el = gl.domElement;

        const onPointerDown = (e: PointerEvent) => {
            if (isDraggingModel.current) return;
            pointerState.current = {
                down: true,
                button: e.button,
                lastX: e.clientX,
                lastY: e.clientY,
            };
            el.setPointerCapture(e.pointerId);
        };

        const onPointerMove = (e: PointerEvent) => {
            if (!pointerState.current.down || isDraggingModel.current) return;

            const dx = e.clientX - pointerState.current.lastX;
            const dy = e.clientY - pointerState.current.lastY;
            pointerState.current.lastX = e.clientX;
            pointerState.current.lastY = e.clientY;

            if (pointerState.current.button === 0 && !isTopDown) {

                targetTheta.current -= dx * 0.008;
                targetPhi.current    = Math.max(0.1, Math.min(Math.PI / 2.1, targetPhi.current + dy * 0.008));
            } else if (pointerState.current.button === 2 || (pointerState.current.button === 0 && isTopDown)) {

                const panSpeed = cam.current.radius * 0.001;
                const right = new THREE.Vector3();
                const up    = new THREE.Vector3();
                camera.getWorldDirection(up);
                right.crossVectors(up, camera.up).normalize();

                right.set(Math.cos(cam.current.theta), 0, -Math.sin(cam.current.theta));
                const forward = new THREE.Vector3(-Math.sin(cam.current.theta), 0, -Math.cos(cam.current.theta));

                targetLookAt.current.addScaledVector(right,   -dx * panSpeed);
                targetLookAt.current.addScaledVector(forward,  dy * panSpeed);
            }
        };

        const onPointerUp = (e: PointerEvent) => {
            pointerState.current.down = false;
            el.releasePointerCapture(e.pointerId);
        };

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1.1 : 0.9;
            targetRadius.current = Math.max(3, Math.min(30, targetRadius.current * delta));
        };

        const onContextMenu = (e: Event) => e.preventDefault();

        el.addEventListener('pointerdown',  onPointerDown);
        el.addEventListener('pointermove',  onPointerMove);
        el.addEventListener('pointerup',    onPointerUp);
        el.addEventListener('wheel',        onWheel, { passive: false });
        el.addEventListener('contextmenu',  onContextMenu);

        return () => {
            el.removeEventListener('pointerdown',  onPointerDown);
            el.removeEventListener('pointermove',  onPointerMove);
            el.removeEventListener('pointerup',    onPointerUp);
            el.removeEventListener('wheel',        onWheel);
            el.removeEventListener('contextmenu',  onContextMenu);
        };
    }, [gl, camera, isTopDown, isDraggingModel]);

    return null;
};


const DraggableModel: FC<DraggableModelProps> = ({
                                                     modelId, url, position, rotation,
                                                     otherModelPosition, onPositionChange,
                                                     onDragStart, onDragEnd,
                                                 }) => {
    const { scene }                 = useGLTF(url);
    const groupRef                  = useRef<THREE.Group>(null);
    const { camera, gl, raycaster } = useThree();
    const [isHovered, setIsHovered] = useState(false);
    const isDragging                = useRef(false);
    const dragOffset                = useRef(new THREE.Vector3());
    const positionRef               = useRef(position);

    useEffect(() => { positionRef.current = position; }, [position]);

    const clonedScene = useRef<THREE.Group | null>(null);
    if (!clonedScene.current) {
        const clone = scene.clone(true) as THREE.Group;
        clone.traverse(child => {
            if ((child as THREE.Mesh).isMesh) {
                (child as THREE.Mesh).castShadow    = true;
                (child as THREE.Mesh).receiveShadow = true;
            }
        });
        clonedScene.current = clone;
    }

    useEffect(() => { groupRef.current?.position.set(...position); }, [position]);
    useEffect(() => { groupRef.current?.rotation.set(...rotation); }, [rotation]);

    const getFloorPoint = useCallback((clientX: number, clientY: number): THREE.Vector3 | null => {
        const rect = gl.domElement.getBoundingClientRect();
        const x    =  ((clientX - rect.left) / rect.width)  * 2 - 1;
        const y    = -((clientY - rect.top)  / rect.height) * 2 + 1;
        raycaster.setFromCamera({ x, y }, camera);
        const hit = new THREE.Vector3();
        return raycaster.ray.intersectPlane(FLOOR_PLANE, hit) ? hit : null;
    }, [camera, gl, raycaster]);

    const wouldOverlap = useCallback((p: Vector3Tuple): boolean => {
        if (!otherModelPosition) return false;
        const dx = p[0] - otherModelPosition[0];
        const dz = p[2] - otherModelPosition[2];
        return Math.sqrt(dx * dx + dz * dz) < MIN_DISTANCE;
    }, [otherModelPosition]);

    const handlePointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
        if (e.button !== 0) return;
        e.stopPropagation();

        isDragging.current = true;
        onDragStart();
        gl.domElement.style.cursor = 'grabbing';

        const pt = getFloorPoint(e.clientX, e.clientY);
        if (pt && groupRef.current) {
            dragOffset.current.set(
                groupRef.current.position.x - pt.x,
                0,
                groupRef.current.position.z - pt.z,
            );
        }

        const onMove = (ev: PointerEvent) => {
            const pt2 = getFloorPoint(ev.clientX, ev.clientY);
            if (!pt2) return;
            const nx  = Math.max(-SCENE_BOUNDS, Math.min(SCENE_BOUNDS, pt2.x + dragOffset.current.x));
            const nz  = Math.max(-SCENE_BOUNDS, Math.min(SCENE_BOUNDS, pt2.z + dragOffset.current.z));
            const np: Vector3Tuple = [nx, positionRef.current[1], nz];
            if (!wouldOverlap(np)) onPositionChange(modelId, np, false);
        };

        const onUp = () => {
            isDragging.current = false;
            onDragEnd();
            gl.domElement.style.cursor = 'grab';
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup',   onUp);
            if (groupRef.current) {
                const { x, y, z } = groupRef.current.position;
                onPositionChange(modelId, [x, y, z], true);
            }
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup',   onUp);
    }, [gl, getFloorPoint, wouldOverlap, onPositionChange, modelId, onDragStart, onDragEnd]);

    return (
        <group
            ref={groupRef}
            onPointerDown={handlePointerDown}
            onPointerEnter={() => { setIsHovered(true);  gl.domElement.style.cursor = 'grab'; }}
            onPointerLeave={() => { if (!isDragging.current) { setIsHovered(false); gl.domElement.style.cursor = 'auto'; } }}
        >
            <primitive object={clonedScene.current} />
            {isHovered && (
                <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                    <circleGeometry args={[1.0, 32]} />
                    <meshBasicMaterial color="#c8a96e" transparent opacity={0.15} />
                </mesh>
            )}
        </group>
    );
};


const Scene3D: FC<Scene3DProps> = ({ models, isTopDown, onPositionChange, onRotationChange }) => {
    const isDraggingModel = useRef(false);

    const handleDragStart = useCallback(() => { isDraggingModel.current = true;  }, []);
    const handleDragEnd   = useCallback(() => { isDraggingModel.current = false; }, []);

    return (
        <Canvas
            shadows={{ type: THREE.PCFShadowMap }}
            style={{ width: '100%', height: '100%', touchAction: 'none' }}
            gl={{ antialias: true, powerPreference: 'high-performance' }}
            camera={{ fov: 45, near: 0.1, far: 300 }}
        >
            <CustomCamera isTopDown={isTopDown} isDraggingModel={isDraggingModel} />

            <ambientLight intensity={0.5} />
            <directionalLight
                castShadow
                position={[10, 20, 10]}
                intensity={1.5}
                shadow-mapSize-width={1024}
                shadow-mapSize-height={1024}
                shadow-camera-far={50}
                shadow-camera-left={-15}
                shadow-camera-right={15}
                shadow-camera-top={15}
                shadow-camera-bottom={-15}
            />
            <directionalLight position={[-5, 5, -5]} intensity={0.3} />

            <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[20, 20]} />
                <meshStandardMaterial color="#e8e0d8" roughness={0.8} metalness={0.05} />
            </mesh>

            <Grid
                position={[0, 0.01, 0]}
                args={[20, 20]}
                cellSize={1}
                cellThickness={0.5}
                cellColor="#c4b5a0"
                sectionSize={5}
                sectionThickness={1}
                sectionColor="#a0917e"
                fadeDistance={25}
                fadeStrength={1}
                followCamera={false}
                infiniteGrid={false}
            />

            <Suspense fallback={null}>
                <Environment preset="city" background={false} />
            </Suspense>

            <Suspense fallback={null}>
                {models.map((model, index) => (
                    <DraggableModel
                        key={model.id}
                        modelId={model.id}
                        url={model.url}
                        position={model.position}
                        rotation={model.rotation}
                        otherModelPosition={models[1 - index]?.position}
                        onPositionChange={onPositionChange}
                        onRotationChange={onRotationChange}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                    />
                ))}
            </Suspense>
        </Canvas>
    );
};

useGLTF.preload('/models/office_chair.glb');
useGLTF.preload('/models/office_table.glb');

export default Scene3D;