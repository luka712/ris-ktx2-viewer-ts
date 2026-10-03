import {Box} from "@mui/material";
import {useFramework} from "../hooks/useFramework.ts";

/** Center column: the render canvas. Owns the framework via useFramework. */
export function ViewportView() {
    const canvasRef = useFramework();

    return (
        <Box sx={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
            <canvas
                ref={canvasRef}
                width={1920}
                height={1080}
                aria-label="Texture preview"
                style={{maxWidth: '92%', maxHeight: '92%'}}
            />
        </Box>
    );
}
