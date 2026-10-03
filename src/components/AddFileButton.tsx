import {useRef, useState} from "react";
import {Alert, Button} from "@mui/material";
import {useTextureStore} from "../store/TextureStore.ts";

const ACCEPT = ".ktx2,.png,.jpg,.jpeg,.webp";

/**
 * Button that opens a file picker for texture files.
 */
export default function AddFileButton() {
    const addTexture = useTextureStore((state) => state.addTexture);
    const inputRef = useRef<HTMLInputElement>(null);
    const [loadError, setLoadError] = useState<string | null>(null);

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) {
            return;
        }

        const failures: string[] = [];
        try {
            for (const file of Array.from(files)) {
                try {
                    await addTexture(file);
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    console.error("Failed to add texture:", err);
                    failures.push(message);
                }
            }
        } finally {
            // Allow selecting the same file again.
            event.target.value = "";
        }

        setLoadError(failures.length > 0 ? failures.join("\n") : null);
    };

    return (
        <>
            <Button
                variant="contained"
                onClick={() => inputRef.current?.click()}
            >
                Add File
            </Button>
            <input
                ref={inputRef}
                type="file"
                hidden
                multiple
                accept={ACCEPT}
                aria-label="Texture files"
                onChange={handleChange}
            />
            {loadError && (
                <Alert severity="error" onClose={() => setLoadError(null)} sx={{whiteSpace: "pre-line"}}>
                    {loadError}
                </Alert>
            )}
        </>
    );
}
