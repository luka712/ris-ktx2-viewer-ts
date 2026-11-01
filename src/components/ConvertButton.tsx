import {useState} from "react";
import {Button, CircularProgress, IconButton, Tooltip} from "@mui/material";
import TransformIcon from "@mui/icons-material/Transform";
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
export default function ConvertButton({compact = false}: { compact?: boolean }) {
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
            {compact ? (
                <Tooltip title={isConverting ? "Conversion running" : "Convert to KTX2"}>
                    <span>
                        <IconButton aria-label="Convert to KTX2" onClick={handleOpen}
                                    disabled={!isConverting && !selectedTexture?.image} aria-busy={isConverting}>
                            {isConverting ? <CircularProgress size={18} color="inherit"/> : <TransformIcon/>}
                        </IconButton>
                    </span>
                </Tooltip>
            ) : (
                <Button
                    variant="outlined"
                    size="small"
                    onClick={handleOpen}
                    // Stays enabled while converting so the dialog can show the running conversion.
                    disabled={!isConverting && !selectedTexture?.image}
                    startIcon={isConverting ? <CircularProgress size={16} color="inherit"/> : <TransformIcon/>}
                    aria-busy={isConverting}
                >
                    Convert
                </Button>
            )}
            <ConvertDialog key={session} open={dialogOpen} texture={selectedTexture}/>
        </>
    );
}
