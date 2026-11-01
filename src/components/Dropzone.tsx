import {type ReactNode, useCallback, useState} from "react";
import {type FileRejection, useDropzone} from "react-dropzone";
import {Alert, Box, Snackbar, Stack, Typography} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import {useTextureStore} from "../store/TextureStore.ts";

/** Files the viewer can load by drop (MIME plus extension, since .ktx2 often has no MIME type). */
const ACCEPT = {
    "image/png": [".png"],
    "image/webp": [".webp"],
    "image/ktx2": [".ktx2"],
};

interface DropzoneProps {
    children: ReactNode;
}

/**
 * Drop target around the viewport. Listens on the wrapper (no overlay intercepts pointer events),
 * so canvas interaction keeps working. Shows a prompt while nothing is loaded and a highlight while dragging.
 * Dropped files go through the same `addTextureFromFile` path as the Add File picker.
 */
export default function Dropzone({children}: DropzoneProps) {
    const addTextureFromFile = useTextureStore((state) => state.addTextureFromFile);
    const hasTexture = useTextureStore((state) => state.selectedId !== null);
    const [error, setError] = useState<string | null>(null);

    const onDrop = useCallback(async (accepted: File[], rejected: FileRejection[]) => {
        const failures = rejected.map(({file}) => `${file.name}: only PNG, WebP or KTX2 files are supported`);
        for (const file of accepted) {
            try {
                await addTextureFromFile(file);
            } catch (err) {
                console.error("Failed to add texture:", err);
                failures.push(err instanceof Error ? err.message : String(err));
            }
        }
        setError(failures.length > 0 ? failures.join("\n") : null);
    }, [addTextureFromFile]);

    // react-dropzone tracks dragenter/leave depth itself, so isDragActive does not flicker over children.
    const {getRootProps, getInputProps, isDragActive} = useDropzone({
        onDrop,
        accept: ACCEPT,
        noClick: true,
        noKeyboard: true,
    });

    const showOverlay = !hasTexture || isDragActive;

    return (
        <Box {...getRootProps()} sx={{position: "relative", minHeight: {xs: 240, md: 320}, height: "100%"}}>
            <input {...getInputProps()} aria-label="Drop texture files"/>
            {children}
            {showOverlay && (
                <Box
                    sx={{
                        position: "absolute",
                        inset: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        textAlign: "center",
                        p: 2,
                        pointerEvents: "none",
                        borderRadius: 2,
                        bgcolor: isDragActive ? "action.hover" : "transparent",
                        transition: "background-color 120ms",
                    }}
                >
                    <Stack spacing={{xs: 0.5, sm: 1}} sx={{alignItems: "center"}}>
                        <CloudUploadOutlinedIcon
                            color={isDragActive ? "primary" : "action"}
                            sx={{fontSize: {xs: 40, sm: 56}}}
                        />
                        <Typography
                            variant="h6"
                            color={isDragActive ? "primary" : "text.primary"}
                            sx={{fontWeight: 500, fontSize: {xs: "1rem", sm: "1.25rem"}}}
                        >
                            {isDragActive ? "Drop to load" : "Drop image or KTX2 file"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            PNG, WebP, KTX2
                        </Typography>
                    </Stack>
                </Box>
            )}
            <Snackbar open={error !== null} autoHideDuration={8000} onClose={() => setError(null)}>
                <Alert severity="error" onClose={() => setError(null)} sx={{whiteSpace: "pre-line"}}>
                    {error}
                </Alert>
            </Snackbar>
        </Box>
    );
}
