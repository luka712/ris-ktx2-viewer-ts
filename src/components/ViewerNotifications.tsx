import {Alert, Snackbar, type SnackbarCloseReason} from "@mui/material";
import {useViewerStore} from "../store/viewerStore.ts";

const INFO_AUTO_HIDE_MS = 6000;

/** Viewer messages (e.g. WebGPU failed and the viewer switched to WebGL2). Warnings stay until dismissed. */
export function ViewerNotifications() {
    const notice = useViewerStore((store) => store.notice);
    const dismissNotice = useViewerStore((store) => store.dismissNotice);

    const handleClose = (_event: unknown, reason?: SnackbarCloseReason) => {
        if (reason !== "clickaway") {
            dismissNotice();
        }
    };

    return (
        <Snackbar
            key={notice?.id}
            open={notice !== null}
            onClose={handleClose}
            autoHideDuration={notice?.severity === "info" ? INFO_AUTO_HIDE_MS : null}
            // Top, so it doesn't cover the conversion snackbar at the bottom.
            anchorOrigin={{vertical: "top", horizontal: "center"}}
        >
            {notice ? (
                <Alert severity={notice.severity} variant="filled" onClose={dismissNotice}
                       sx={{width: "100%", whiteSpace: "pre-line"}}>
                    {notice.message}
                </Alert>
            ) : undefined}
        </Snackbar>
    );
}
