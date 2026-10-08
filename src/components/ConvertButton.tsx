import {useState} from "react";
import {Button, CircularProgress} from "@mui/material";
import ConvertDialog from "../dialogs/ConvertDialog.tsx";
import {useSelectedTexture} from "../store/TextureStore.ts";
import {useConvertStore} from "../store/ConvertStore.ts";

/**
 * Opens the Convert To Ktx2 dialog for the selected texture.
 * Each open gets a fresh dialog instance (new `key`), so the form starts from the
 * defaults and the selected texture's name without resetting state by hand.
 * While a conversion runs, the button shows a spinner and stays clickable so the
 * dialog can show that a conversion is already running.
 */
export default function ConvertButton() {
    const selectedTexture = useSelectedTexture();
    const dialogOpen = useConvertStore((store) => store.dialogOpen);
    const isConverting = useConvertStore((store) => store.isConverting);
    const openDialog = useConvertStore((store) => store.openDialog);
    const [session, setSession] = useState(0);

    const handleOpen = () => {
        setSession((value) => value + 1);
        openDialog();
    };

    return (
        <>
            <Button
                variant="outlined"
                onClick={handleOpen}
                // Stays enabled while converting so the dialog can show the running conversion.
                disabled={!isConverting && !selectedTexture?.image}
                startIcon={isConverting ? <CircularProgress size={16} color="inherit"/> : undefined}
                aria-busy={isConverting}
            >
                Convert
            </Button>
            <ConvertDialog key={session} open={dialogOpen} texture={selectedTexture}/>
        </>
    );
}
