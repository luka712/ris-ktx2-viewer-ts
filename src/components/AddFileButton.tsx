import {useRef, useState, useTransition} from "react";
import {Alert, Button, CircularProgress, IconButton, Snackbar, Tooltip} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import {useTextureStore} from "../store/TextureStore.ts";

const ACCEPT = ".ktx2,.png,.jpg,.jpeg,.webp";

/**
 * Header button that opens a file picker for texture files (files can also be dropped on the viewport, see Dropzone).
 * Shows a spinner while the picked files are decoded and uploaded; load errors appear in a snackbar.
 * `compact` renders an icon-only button (narrow screens).
 */
export default function AddFileButton({compact = false}: { compact?: boolean }) {
    const addTextureFromFile = useTextureStore((state) => state.addTextureFromFile);
    const inputRef = useRef<HTMLInputElement>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isLoading, startLoading] = useTransition();

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const input = event.currentTarget;
        const files = Array.from(input.files ?? []);
        // Allow selecting the same file again.
        input.value = "";
        if (files.length === 0) {
            return;
        }

        startLoading(async () => {
            const failures: string[] = [];
            for (const file of files) {
                try {
                    await addTextureFromFile(file);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error("Failed to add texture:", err);
                    failures.push(message);
                }
            }
            setLoadError(failures.length > 0 ? failures.join("\n") : null);
        });
    };

    const icon = isLoading ? <CircularProgress size={18} color="inherit" aria-label="Loading textures…"/> : <AddIcon/>;

    return (
        <>
            {compact ? (
                <Tooltip title="Add file">
                    <span>
                        <IconButton aria-label="Add file" onClick={() => inputRef.current?.click()} disabled={isLoading}>
                            {icon}
                        </IconButton>
                    </span>
                </Tooltip>
            ) : (
                <Button variant="contained" size="small" startIcon={icon}
                        onClick={() => inputRef.current?.click()} disabled={isLoading}>
                    Add File
                </Button>
            )}
            <input
                ref={inputRef}
                type="file"
                hidden
                multiple
                accept={ACCEPT}
                aria-label="Texture files"
                onChange={handleChange}
            />
            <Snackbar open={loadError !== null} autoHideDuration={8000} onClose={() => setLoadError(null)}>
                <Alert severity="error" onClose={() => setLoadError(null)} sx={{whiteSpace: "pre-line"}}>
                    {loadError}
                </Alert>
            </Snackbar>
        </>
    );
}
