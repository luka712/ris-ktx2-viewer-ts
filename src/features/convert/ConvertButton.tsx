import {useState} from "react";
import {Button, CircularProgress, IconButton, Tooltip} from "@mui/material";
import TransformIcon from "@mui/icons-material/Transform";
import ConvertDialog from "./ConvertDialog.tsx";
import ConvertModeDialog, {type ConvertMode} from "./ConvertModeDialog.tsx";
import {useSelectedTexture, useSelectedTextures} from "../../store/TextureStore.ts";
import {useConvertStore} from "../../store/ConvertStore.ts";
import {convertibleSources} from "../../service/textureArray.ts";
import type {ITexture2DContainer} from "../../model/ITexture2DContainer.ts";

/** What the Convert dialog instance was opened for. Captured on open, so a later selection change doesn't affect it. */
interface ConvertJob {
    mode: ConvertMode;
    textures: ITexture2DContainer[];
}

/**
 * Opens the Convert To Ktx2 dialog for the selection.
 * With one convertible image selected it converts that image (as before). With two or more, a small
 * chooser asks first: separate KTX2 files, or one texture array (see ConvertModeDialog).
 * Each open gets a fresh dialog instance (new `key`), so the form starts from the
 * remembered options and the selected texture's name without resetting state by hand.
 * While a conversion runs, the button shows a spinner and stays clickable so the
 * dialog can show that a conversion is already running.
 */
export default function ConvertButton({compact = false}: { compact?: boolean }) {
    const selectedTexture = useSelectedTexture();
    const selectedTextures = useSelectedTextures();
    const dialogOpen = useConvertStore((store) => store.dialogOpen);
    const isConverting = useConvertStore((store) => store.isConverting);
    const openDialog = useConvertStore((store) => store.openDialog);
    const [session, setSession] = useState(0);
    const [job, setJob] = useState<ConvertJob>({mode: "single", textures: []});
    const [chooserOpen, setChooserOpen] = useState(false);

    const sources = convertibleSources(selectedTextures);
    const disabled = !isConverting && sources.length === 0;

    const open = (next: ConvertJob) => {
        setJob(next);
        setSession((value) => value + 1);
        openDialog();
    };

    const handleClick = () => {
        if (!isConverting && sources.length >= 2) {
            setChooserOpen(true);
            return;
        }
        // One convertible image: the active texture if it is one, otherwise the selected image.
        const texture = selectedTexture?.image ? selectedTexture : sources[0] ?? selectedTexture;
        open({mode: "single", textures: texture ? [texture] : []});
    };

    const handleChoose = (mode: Exclude<ConvertMode, "single">) => {
        setChooserOpen(false);
        open({mode, textures: mode === "array" ? selectedTextures : sources});
    };

    const label = sources.length >= 2 ? `Convert ${sources.length} images to KTX2` : "Convert to KTX2";
    const tooltip = isConverting ? "Conversion running" : disabled ? "Select a PNG, JPEG or WebP image to convert" : label;

    return (
        <>
            {compact ? (
                <Tooltip title={tooltip}>
                    <span>
                        <IconButton aria-label={label} onClick={handleClick}
                                    disabled={disabled} aria-busy={isConverting}>
                            {isConverting ? <CircularProgress size={18} color="inherit"/> : <TransformIcon/>}
                        </IconButton>
                    </span>
                </Tooltip>
            ) : (
                <Tooltip title={tooltip}>
                    <span>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleClick}
                            // Stays enabled while converting so the dialog can show the running conversion.
                            disabled={disabled}
                            startIcon={isConverting ? <CircularProgress size={16} color="inherit"/> : <TransformIcon/>}
                            aria-busy={isConverting}
                            aria-label={label}
                        >
                            {sources.length >= 2 && !isConverting ? `Convert (${sources.length})` : "Convert"}
                        </Button>
                    </span>
                </Tooltip>
            )}
            <ConvertModeDialog open={chooserOpen} textures={selectedTextures}
                               onClose={() => setChooserOpen(false)} onChoose={handleChoose}/>
            <ConvertDialog key={session} open={dialogOpen} mode={job.mode} textures={job.textures}/>
        </>
    );
}
