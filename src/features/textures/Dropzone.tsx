import {type ReactNode, useCallback, useState} from "react";
import {type FileRejection} from "react-dropzone";
import {FileDropzone} from "../../components/ui/FileDropzone.tsx";
import {useTextureStore} from "../../store/TextureStore.ts";

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

    return (
        <FileDropzone
            accept={ACCEPT}
            onDrop={onDrop}
            showIdleOverlay={!hasTexture}
            idleTitle="Drop image or KTX2 file"
            activeTitle="Drop to load"
            subtitle="PNG, WebP, KTX2"
            inputAriaLabel="Drop texture files"
            error={error}
            onErrorClose={() => setError(null)}
        >
            {children}
        </FileDropzone>
    );
}
