import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    Firestore,
    initializeFirestore,
    persistentLocalCache,
    persistentMultipleTabManager,
} from 'firebase/firestore';
import { ModelState, SceneDocument } from '@/types';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

const app: FirebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];


export const db: Firestore = (() => {
    try {
        return initializeFirestore(app, {
            localCache: persistentLocalCache({
                tabManager: persistentMultipleTabManager(),
            }),
        });
    } catch {
        return getFirestore(app) as Firestore;
    }
})();

const COLLECTION = 'scenes';
const DOCUMENT  = 'furniture-scene';

export const DEFAULT_MODELS: ModelState[] = [
    { id: 'chair', name: 'Chair', url: '/models/office_chair.glb', position: [-2.5, 0, 0], rotation: [0, 0, 0] },
    { id: 'table', name: 'Table', url: '/models/office_table.glb', position: [ 2.5, 0, 0], rotation: [0, 0, 0] },
];


async function withRetry<T>(fn: () => Promise<T>, retries = 4, baseMs = 800): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            if (i < retries - 1) await new Promise(r => setTimeout(r, baseMs * 2 ** i));
        }
    }
    throw lastErr;
}


export async function loadModelStates(): Promise<ModelState[]> {
    try {
        return await withRetry(async () => {
            const ref  = doc(db, COLLECTION, DOCUMENT);
            const snap = await getDoc(ref);
            if (snap.exists()) {
                return (snap.data() as SceneDocument).models ?? DEFAULT_MODELS;
            }
            await setDoc(ref, { models: DEFAULT_MODELS, updatedAt: new Date().toISOString() });
            return DEFAULT_MODELS;
        });
    } catch (err) {
        console.error('[Firebase] loadModelStates failed, using defaults:', err);
        return DEFAULT_MODELS;
    }
}

export async function saveModelState(
    modelId: string,
    position: ModelState['position'],
    rotation: ModelState['rotation'],
): Promise<void> {
    await withRetry(async () => {
        const ref  = doc(db, COLLECTION, DOCUMENT);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
            await setDoc(ref, { models: DEFAULT_MODELS, updatedAt: new Date().toISOString() });
        }

        const current = (snap.exists() ? snap.data() : { models: DEFAULT_MODELS }) as SceneDocument;
        const updated = current.models.map(m =>
            m.id === modelId ? { ...m, position, rotation } : m,
        );

        await updateDoc(ref, { models: updated, updatedAt: new Date().toISOString() });
        console.log(`[Firebase] Saved "${modelId}"`, { position, rotation });
    });
}