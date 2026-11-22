import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    worker: {
        format: 'es',
    },
    // file:../ris-framework-ts has its own node_modules/ris-ktx2 (same 0.3.0-dev.18).
    // Dedupe so the bundle uses the viewer's copy only.
    resolve: {
        dedupe: ['ris-ktx2'],
    },
    // gl-matrix is a direct dependency (same ^3.4.4 as ris-framework). Needed because the
    // viewer imports it (useFramework.ts, Ktx2Converter.ts) and file:../ris-framework-ts
    // does not hoist the framework's copy into this node_modules.
})
