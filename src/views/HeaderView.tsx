import {Paper, Stack, Typography} from "@mui/material";
import {ThemeModeSwitch} from "../components/ThemeModeSwitch.tsx";

/** Top strip (styled like FooterView): app title on the left, theme switch on the right. */
export function HeaderView() {
    return (
        <Paper sx={{flexShrink: 0, pt: 1, pb: 0.5, px: 1, marginBottom: 1}}>
            <Stack direction="row" spacing={2} sx={{alignItems: "center", justifyContent: "space-between", padding: 1}}>
                <Typography variant="body2" sx={{fontSize: 16, opacity: 0.8}} noWrap>
                    KTX2 Viewer
                </Typography>
                <ThemeModeSwitch/>
            </Stack>
        </Paper>
    );
}
