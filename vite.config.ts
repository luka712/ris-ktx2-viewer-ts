import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    worker: {
        format: 'es',
    },
    // gl-matrix is a transitive dependency of ris-framework and npm hoists it to the top-level
    // node_modules, so it resolves without an alias. TODO: it is imported directly
    // (useFramework.ts, Ktx2Converter.ts) but not declared in package.json; add it as a direct
    // dependency (same version as ris-framework) so it doesn't rely on hoisting.
})
