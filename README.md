# Nelson Cabinetry — 3D Room Planner

## Tech Stack
- Next.js 14
- Firebase Firestore
- Three.js / React Three Fiber
- TypeScript

## Pokretanje projekta
1. Kloniraj repo
2. `npm install`
3. Kreiraj `.env.local` i dodaj Firebase kredencijale:
   NEXT_PUBLIC_FIREBASE_API_KEY=
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
   NEXT_PUBLIC_FIREBASE_APP_ID=
4. `npm run dev`

## Funkcionalnosti
- 3D i 2D top-down prikaz scene
- Drag & drop modela
- Rotacija putem slidera
- Auto-save u Firestore

## Izazovi tokom razvoja
- OrbitControls je blokirao drag modela pa sam
  implementirao custom kameru sa spherical coordinates
- GLB modeli imaju offset pivot point pa hover efekat
  nije bio centriran — riješeno računanjem bounding boxa
- Drag & drop na 3D površini zahtijeva ray casting
  na floor plane umjesto standardnih DOM eventi