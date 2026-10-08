import {useRef, useState, useTransition} from "react";
import {Alert, Button, LinearProgress} from "@mui/material";
import {useTextureStore} from "../store/TextureStore.ts";

const ACCEPT = ".ktx2,.png,.jpg,.jpeg,.webp";

/**
 * Button that opens a file picker for texture files.
 * Disabled with a progress bar while the picked files are decoded and uploaded.
 */
export default function AddFileButton() {
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

    return (
        <>
            <Button
                variant="contained"
                onClick={() => inputRef.current?.click()}
                disabled={isLoading}
            >
                Add File
            </Button>
            {/* TODO: react-dropzone is a dependency, but files can only be added with this picker. */}
            <input
                ref={inputRef}
                type="file"
                hidden
                multiple
                accept={ACCEPT}
                aria-label="Texture files"
                onChange={handleChange}
            />
            {isLoading && <LinearProgress aria-label="Loading textures…"/>}
            {loadError && (
                <Alert severity="error" onClose={() => setLoadError(null)} sx={{whiteSpace: "pre-line"}}>
                    {loadError}
                </Alert>
            )}
        </>
    );
}
