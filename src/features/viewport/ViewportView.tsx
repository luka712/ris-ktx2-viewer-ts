import {Alert, AlertTitle, Box} from "@mui/material";
import {useFramework} from "./useFramework.ts";
import {useViewerStore} from "../../store/viewerStore.ts";

/** The render canvas, centred and scaled down (aspect kept) to fit its container. Owns the framework via useFramework. */
export function ViewportView() {
    const backend = useViewerStore((store) => store.backend);
    const canvasHostRef = useFramework(backend);
    const initError = useViewerStore((store) => store.initError);

    return (
        <Box sx={{width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', p: 1, boxSizing: 'border-box'}}>
            {initError && (
                <Alert severity="error" sx={{m: 2}}>
                    <AlertTitle>The GPU viewer could not start</AlertTitle>
                    {initError}. This viewer needs WebGL2.
                </Alert>
            )}
            {/* useFramework creates a fresh canvas in this host on every mount (a disposed WebGL canvas can't be
                reused) and sets its size (initial size, then the selected texture's size). */}
            <div
                ref={canvasHostRef}
                style={{display: initError ? 'none' : 'contents'}}
            />
        </Box>
    );
}
