import {Alert, Snackbar, type SnackbarCloseReason} from "@mui/material";
import {useConvertStore} from "../store/ConvertStore.ts";

const SUCCESS_AUTO_HIDE_MS = 6000;

/**
 * App-level snackbar for conversions that finish or fail while the Convert dialog is closed,
 * and for the main-thread fallback warning (shown whether the dialog is open or not).
 * Success / info hide after a few seconds; warnings and errors stay until dismissed or replaced.
 */
export function ConvertNotifications() {
    const notification = useConvertStore((store) => store.notification);
    const dismissNotification = useConvertStore((store) => store.dismissNotification);

    const handleClose = (_event: unknown, reason?: SnackbarCloseReason) => {
        if (reason === "clickaway") {
            return;
        }
        dismissNotification();
    };

    return (
        <Snackbar
            key={notification?.id}
            open={notification !== null}
            onClose={handleClose}
            autoHideDuration={notification?.severity === "success" || notification?.severity === "info"
                ? SUCCESS_AUTO_HIDE_MS
                : null}
            anchorOrigin={{vertical: "bottom", horizontal: "center"}}
        >
            {notification ? (
                <Alert severity={notification.severity} variant="filled" onClose={dismissNotification}
                       sx={{width: "100%", whiteSpace: "pre-line"}}>
                    {notification.message}
                </Alert>
            ) : undefined}
        </Snackbar>
    );
}
