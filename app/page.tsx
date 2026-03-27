'use client';

import { useState, useCallback, useEffect, useRef, FC } from 'react';
import dynamic from 'next/dynamic';
import { loadModelStates, saveModelState } from '@/lib/firebase';
import { ModelState, SaveStatus, Vector3Tuple } from '@/types';

const Scene3D = dynamic(() => import('@/components/Scene3D'), { ssr: false });


interface RotationControlProps {
    label: string;
    modelId: string;
    rotation: Vector3Tuple;
    onRotationChange: (id: string, rot: Vector3Tuple, save?: boolean) => void;
}

const RotationControl: FC<RotationControlProps> = ({
                                                       label,
                                                       modelId,
                                                       rotation,
                                                       onRotationChange,
                                                   }) => {
    const degrees = Math.round((rotation[1] * 180) / Math.PI);

    const setRotation = (deg: number, save = false) => {
        const rad = (deg * Math.PI) / 180;
        onRotationChange(modelId, [0, rad, 0], save);
    };

    return (
        <div className="rotation-card">
            <div className="rotation-header">
                <span className="model-label">{label}</span>
                <span className="rotation-value">{degrees}°</span>
            </div>

            <div className="slider-container">
                <span className="slider-icon">↺</span>
                <input
                    type="range"
                    min={-180}
                    max={180}
                    value={degrees}
                    className="rotation-slider"
                    onChange={(e) => setRotation(Number(e.target.value), false)}
                    onMouseUp={(e) => setRotation(Number((e.target as HTMLInputElement).value), true)}
                    onTouchEnd={(e) => setRotation(Number((e.target as HTMLInputElement).value), true)}
                />
                <span className="slider-icon">↻</span>
            </div>

            <div className="quick-rotations">
                {([0, 90, 180, 270] as const).map((deg) => (
                    <button
                        key={deg}
                        className={`quick-btn ${Math.abs(degrees - deg) < 2 ? 'active' : ''}`}
                        onClick={() => setRotation(deg, true)}
                    >
                        {deg}°
                    </button>
                ))}
            </div>
        </div>
    );
};

const SaveIndicator: FC<{ status: SaveStatus }> = ({ status }) => {
    if (status === 'idle') return null;
    return (
        <div className={`save-status ${status}`}>
            {status === 'saving' && <><span className="spinner" />Saving...</>}
            {status === 'saved' && <><span className="check">✓</span>Saved</>}
            {status === 'error' && <><span className="x">✕</span>Error</>}
        </div>
    );
};


export default function Home() {
    const [models, setModels] = useState<ModelState[]>([]);
    const [isTopDown, setIsTopDown] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
    const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        loadModelStates().then((data) => {
            setModels(data);
            setIsLoading(false);
        });
    }, []);

    const triggerSave = useCallback(
        async (modelId: string, position: Vector3Tuple, rotation: Vector3Tuple) => {
            setSaveStatus('saving');
            if (statusTimer.current) clearTimeout(statusTimer.current);
            try {
                await saveModelState(modelId, position, rotation);
                setSaveStatus('saved');
            } catch {
                setSaveStatus('error');
            }
            statusTimer.current = setTimeout(() => setSaveStatus('idle'), 2500);
        },
        []
    );

    const handlePositionChange = useCallback(
        (modelId: string, newPos: Vector3Tuple, save = false) => {
            setModels((prev) =>
                prev.map((m) => (m.id === modelId ? { ...m, position: newPos } : m))
            );
            if (save) {
                const model = models.find((m) => m.id === modelId);
                if (model) triggerSave(modelId, newPos, model.rotation);
            }
        },
        [models, triggerSave]
    );

    const handleRotationChange = useCallback(
        (modelId: string, newRot: Vector3Tuple, save = false) => {
            setModels((prev) =>
                prev.map((m) => (m.id === modelId ? { ...m, rotation: newRot } : m))
            );
            if (save) {
                const model = models.find((m) => m.id === modelId);
                if (model) triggerSave(modelId, model.position, newRot);
            }
        },
        [models, triggerSave]
    );

    if (isLoading) {
        return (
            <div className="loading-screen">
                <div className="loading-content">
                    <div className="loading-logo">NC</div>
                    <div className="loading-bar">
                        <div className="loading-fill" />
                    </div>
                    <p>Loading scene...</p>
                </div>
            </div>
        );
    }

    return (
        <main className="app-container">

            <header className="app-header">
                <div className="header-left">
                    <div className="logo">NC</div>
                    <div className="header-text">
                        <h1>Nelson Cabinetry</h1>
                        <span>3D Room Planner</span>
                    </div>
                </div>

                <div className="header-center">
                    <SaveIndicator status={saveStatus} />
                </div>

                <div className="header-right">
                    <button
                        className={`view-toggle ${isTopDown ? 'active' : ''}`}
                        onClick={() => setIsTopDown((v) => !v)}
                    >
                        <span className="toggle-icon">{isTopDown ? '⬜' : '◈'}</span>
                        <span>{isTopDown ? '2D Top View' : '3D View'}</span>
                    </button>
                </div>
            </header>

            <div className="scene-container">
                {models.length > 0 && (
                    <Scene3D
                        models={models}
                        isTopDown={isTopDown}
                        onPositionChange={handlePositionChange}
                        onRotationChange={handleRotationChange}
                    />
                )}
                <div className="view-badge">
                    {isTopDown ? '2D · TOP VIEW' : '3D · PERSPECTIVE'}
                </div>
                <div className="help-hint">
                    {isTopDown
                        ? 'Drag models to reposition'
                        : 'Drag models · Scroll to zoom · Right-click to pan'}
                </div>
            </div>


            <aside className="controls-panel">
                <div className="panel-section">
                    <h2 className="panel-title">Rotation</h2>
                    <p className="panel-subtitle">Drag slider or use quick presets</p>
                    {models.map((model) => (
                        <RotationControl
                            key={model.id}
                            label={model.name}
                            modelId={model.id}
                            rotation={model.rotation}
                            onRotationChange={handleRotationChange}
                        />
                    ))}
                </div>

                <div className="panel-section">
                    <h2 className="panel-title">Positions</h2>
                    {models.map((model) => (
                        <div key={model.id} className="position-info">
                            <span className="pos-label">{model.name}</span>
                            <span className="pos-value">
                X: {model.position[0].toFixed(1)} · Z: {model.position[2].toFixed(1)}
              </span>
                        </div>
                    ))}
                </div>

                <div className="panel-footer">
                    <p>Changes auto-saved to Firestore</p>
                    <p>Reload to restore last session</p>
                </div>
            </aside>
        </main>
    );
}