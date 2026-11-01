import {useState} from "react";
import {
    Box,
    Chip,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    ListItemIcon,
    ListItemText,
    Menu,
    MenuItem,
    Paper,
    Stack,
    Tooltip,
    Typography,
    Button,
    useMediaQuery,
    useTheme,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import MemoryIcon from "@mui/icons-material/Memory";
import HelpOutlineIcon from "@mui/icons-material/HelpOutlineOutlined";
import {ThemeModeSwitch} from "../components/ThemeModeSwitch.tsx";
import AddFileButton from "../components/AddFileButton.tsx";
import ConvertButton from "../components/ConvertButton.tsx";
import AboutDialog from "../dialogs/AboutDialog.tsx";
import {GpuPropertiesView} from "./GpuPropertiesView.tsx";
import {useConvertStore} from "../store/ConvertStore.ts";

/** Shows the running background conversion (the dialog may be closed); click opens the dialog. */
function ConversionIndicator({compact}: { compact: boolean }) {
    const isConverting = useConvertStore((store) => store.isConverting);
    const outputName = useConvertStore((store) => store.outputName);
    const openDialog = useConvertStore((store) => store.openDialog);
    // Hidden in portrait: the chip overlaps the header buttons there. The header progress bar still shows it.
    const isPortrait = useMediaQuery("(orientation: portrait)");
    if (!isConverting || isPortrait) {
        return null;
    }
    const label = compact ? "Converting…" : `Converting ${outputName ?? ""}…`;
    return (
        <Chip size="small" color="primary" variant="outlined" label={label} onClick={openDialog}
              sx={{maxWidth: {xs: 120, sm: 260}}} aria-live="polite"/>
    );
}

/** Header info menu: GPU info and About, each in a dialog. */
function InfoMenu() {
    const [anchor, setAnchor] = useState<HTMLElement | null>(null);
    const [dialog, setDialog] = useState<"gpu" | "about" | null>(null);
    const theme = useTheme();
    const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

    const open = (which: "gpu" | "about") => {
        setAnchor(null);
        setDialog(which);
    };

    return (
        <>
            <Tooltip title="Info">
                <IconButton aria-label="Info" aria-haspopup="menu" onClick={(e) => setAnchor(e.currentTarget)}>
                    <InfoOutlinedIcon/>
                </IconButton>
            </Tooltip>
            <Menu anchorEl={anchor} open={anchor !== null} onClose={() => setAnchor(null)}>
                <MenuItem onClick={() => open("gpu")}>
                    <ListItemIcon><MemoryIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>GPU info</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => open("about")}>
                    <ListItemIcon><HelpOutlineIcon fontSize="small"/></ListItemIcon>
                    <ListItemText>About</ListItemText>
                </MenuItem>
            </Menu>
            <Dialog open={dialog === "gpu"} onClose={() => setDialog(null)} fullWidth maxWidth="sm" fullScreen={fullScreen}>
                <DialogTitle>GPU info</DialogTitle>
                <DialogContent>
                    <Stack spacing={2}>
                        <GpuPropertiesView/>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialog(null)}>Close</Button>
                </DialogActions>
            </Dialog>
            <AboutDialog open={dialog === "about"} onClose={() => setDialog(null)}/>
        </>
    );
}

/** Top bar: title, primary actions (Add File, Convert), conversion progress, info menu and theme switch. */
export function HeaderView() {
    const theme = useTheme();
    const compact = useMediaQuery(theme.breakpoints.down("sm"));
    const isConverting = useConvertStore((store) => store.isConverting);

    return (
        <Paper elevation={3} sx={{borderRadius: 3, position: "relative", overflow: "hidden"}}>
            <Stack direction="row" spacing={{xs: 0.5, sm: 1.5}}
                   sx={{alignItems: "center", px: {xs: 1, sm: 2}, py: 0.75, minHeight: 48}}>
                <Typography variant="subtitle1" sx={{fontWeight: 500, mr: {xs: 0.5, sm: 1}}} noWrap>
                    KTX2 Viewer
                </Typography>
                <AddFileButton compact={compact}/>
                <ConvertButton compact={compact}/>
                <Box sx={{flex: 1, minWidth: 0, display: "flex", justifyContent: "center"}}>
                    <ConversionIndicator compact={compact}/>
                </Box>
                <InfoMenu/>
                <ThemeModeSwitch/>
            </Stack>
            {isConverting && (
                <LinearProgress aria-label="Converting…"
                                sx={{position: "absolute", left: 0, right: 0, bottom: 0, height: 2}}/>
            )}
        </Paper>
    );
}
