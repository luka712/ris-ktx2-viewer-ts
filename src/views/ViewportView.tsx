import {Alert, AlertTitle, Box} from "@mui/material";
import {useFramework} from "../hooks/useFramework.ts";
import {useViewerStore} from "../store/viewerStore.ts";

/** The render canvas, centred and scaled down (aspect kept) to fit its container. Owns the framework via useFramework. */
export function ViewportView() {
    const canvasRef = useFramework();
    const initError = useViewerStore((store) => store.initError);

    return (
        <Box sx={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1, boxSizing: 'border-box'}}>
            {initError && (
                <Alert severity="error" sx={{m: 2}}>
                    <AlertTitle>The GPU viewer could not start</AlertTitle>
                    {initError}. This viewer needs WebGL2.
                </Alert>
            )}
            {/* Size is set by useFramework (initial size, then the selected texture's size). */}
            <canvas
                ref={canvasRef}
                aria-label="Texture preview"
                style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: initError ? 'none' : undefined, color: 'transparent'}}
            />
        </Box>
    );
}
