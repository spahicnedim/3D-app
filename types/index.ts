export type Vector3Tuple = [number, number, number];

export interface ModelState {
    id: string;
    name: string;
    url: string;
    position: Vector3Tuple;
    rotation: Vector3Tuple;
}

export interface SceneDocument {
    models: ModelState[];
    updatedAt: string;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';