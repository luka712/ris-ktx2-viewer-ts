import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    List,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    Stack,
    Typography,
} from "@mui/material";
import FileCopyOutlinedIcon from "@mui/icons-material/FileCopyOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import type {ITexture2DContainer} from "../../model/ITexture2DContainer.ts";
import {arraySourceProblem, convertibleSources} from "../../service/textureArray.ts";

/** How the Convert dialog converts: the selected texture, each selected image on its own, or all as one array. */
export type ConvertMode = "single" | "separate" | "array";

interface ConvertModeDialogProps {
    open: boolean;
    /** Every selected texture, in list order (KTX2 files included; they can't be converted). */
    textures: ITexture2DContainer[];
    onClose: () => void;
    onChoose: (mode: Exclude<ConvertMode, "single">) => void;
}

/**
 * Asked when Convert is pressed with two or more convertible images selected: one KTX2 per image, or one
 * KTX2 2D texture array. The array option is disabled, with the reason, unless every selected texture is a
 * decoded image of the same size. Both paths continue in the Convert dialog with the remembered options.
 */
export default function ConvertModeDialog({open, textures, onClose, onChoose}: ConvertModeDialogProps) {
    const sources = convertibleSources(textures);
    const skipped = textures.length - sources.length;
    const arrayProblem = arraySourceProblem(textures);
    const size = sources[0]?.image ? `${sources[0].image.baseWidth}×${sources[0].image.baseHeight}` : "";

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs" aria-labelledby="convert-mode-title">
            <DialogTitle id="convert-mode-title">Convert {textures.length} textures</DialogTitle>
            <DialogContent sx={{px: 1.5}}>
                <Typography variant="body2" color="text.secondary" sx={{px: 1, pb: 1}}>
                    How do you want to convert the selected images?
                </Typography>
                <List disablePadding>
                    <ListItemButton onClick={() => onChoose("separate")} sx={{borderRadius: 1, alignItems: "flex-start"}}>
                        <ListItemIcon sx={{mt: 0.5}}><FileCopyOutlinedIcon/></ListItemIcon>
                        <ListItemText
                            primary="Separate KTX2 files"
                            secondary={
                                <Stack component="span">
                                    <span>{`${sources.length} files, one per image, with the same options. They are converted one after another.`}</span>
                                    {skipped > 0 && (
                                        <span>{`${skipped} KTX2 ${skipped === 1 ? "file is" : "files are"} already converted and will be skipped.`}</span>
                                    )}
                                </Stack>
                            }
                        />
                    </ListItemButton>
                    <ListItemButton onClick={() => onChoose("array")} disabled={arrayProblem !== null}
                                    sx={{borderRadius: 1, alignItems: "flex-start", "&.Mui-disabled": {opacity: 0.8}}}>
                        <ListItemIcon sx={{mt: 0.5}}><LayersOutlinedIcon/></ListItemIcon>
                        <ListItemText
                            primary="One texture array"
                            secondary={arrayProblem
                                ? <Typography component="span" variant="body2" color="warning.main">{arrayProblem}</Typography>
                                : `One KTX2 file with ${textures.length} layers of ${size}, in list order. You can reorder the layers next.`}
                        />
                    </ListItemButton>
                </List>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
            </DialogActions>
        </Dialog>
    );
}
