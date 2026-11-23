import {type ReactNode} from "react";
import {type Accept, type FileRejection, useDropzone} from "react-dropzone";
import {Alert, Box, Snackbar, Stack, Typography} from "@mui/material";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";

export interface FileDropzoneProps {
    children: ReactNode;
    accept: Accept;
    onDrop: (accepted: File[], rejected: FileRejection[]) => void;
    /** When true, the idle prompt is shown (the drag highlight is always shown while dragging). */
    showIdleOverlay: boolean;
    idleTitle: string;
    activeTitle: string;
    subtitle?: string;
    inputAriaLabel: string;
    error: string | null;
    onErrorClose: () => void;
}

/**
 * Drop target around its children. Listens on the wrapper (no overlay intercepts pointer events).
 * Shows a prompt when `showIdleOverlay` is set, and a highlight while dragging.
 */
export function FileDropzone({
    children,
    accept,
    onDrop,
    showIdleOverlay,
    idleTitle,
    activeTitle,
    subtitle,
    inputAriaLabel,
    error,
    onErrorClose,
}: FileDropzoneProps) {
    // react-dropzone tracks dragenter/leave depth itself, so isDragActive does not flicker over children.
    const {getRootProps, getInputProps, isDragActive} = useDropzone({
        onDrop,
        accept,
        noClick: true,
        noKeyboard: true,
    });

    const showOverlay = showIdleOverlay || isDragActive;

    return (
        <Box {...getRootProps()} sx={{position: "relative", minHeight: {xs: 240, md: 320}, height: "100%"}}>
            <input {...getInputProps()} aria-label={inputAriaLabel}/>
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
                            {isDragActive ? activeTitle : idleTitle}
                        </Typography>
                        {subtitle && (
                            <Typography variant="caption" color="text.secondary">
                                {subtitle}
                            </Typography>
                        )}
                    </Stack>
                </Box>
            )}
            <Snackbar open={error !== null} autoHideDuration={8000} onClose={onErrorClose}>
                <Alert severity="error" onClose={onErrorClose} sx={{whiteSpace: "pre-line"}}>
                    {error}
                </Alert>
            </Snackbar>
        </Box>
    );
}
