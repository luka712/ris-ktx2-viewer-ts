import {useRef} from "react";
import {Button} from "@mui/material";
import {useTextureStore} from "../store/TextureStore.ts";

const ACCEPT = ".ktx2,.png,.jpg,.jpeg,.webp";

/**
 * Button that opens a file picker for texture files.
 */
export default function AddFileButton() {
    const addTexture = useTextureStore((state) => state.addTexture);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) {
            return;
        }

        for (const file of Array.from(files)) {
            await addTexture(file);
        }

        // Allow selecting the same file again.
        event.target.value = "";
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
                onChange={handleChange}
            />
        </>
    );
}
