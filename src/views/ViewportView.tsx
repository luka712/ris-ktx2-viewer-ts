import {Alert, AlertTitle, Box} from "@mui/material";
import {useFramework} from "../hooks/useFramework.ts";
import {useViewerStore} from "../store/viewerStore.ts";

/** Center column: the render canvas. Owns the framework via useFramework. */
export function ViewportView() {
    const canvasRef = useFramework();
    const initError = useViewerStore((store) => store.initError);

    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
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
                style={{maxWidth: '95%', maxHeight: '95%', display: initError ? 'none' : undefined, color: 'transparent'}}
            />
        </Box>
    );
}
