import {create} from "zustand";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import type {ConvertParameters} from "../model/ConvertParameters.ts";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import {convertToKtx2UsingWorkerAsync, isAbortError} from "../service/Ktx2Converter.ts";
import {changeFileExtension} from "../service/formatter.ts";
import {useTextureStore} from "./TextureStore.ts";
import {useViewerStore} from "./viewerStore.ts";

/** Shown (dialog open or not) when the worker can't start and the encode runs on the main thread. */
export const MAIN_THREAD_FALLBACK_MESSAGE =
    "Background conversion isn't available in this browser, so converting on the main thread. "
    + "The page may freeze until it finishes.";

/** Non-blocking message shown by ConvertNotifications. */
export interface ConvertNotification {
    id: number;
    severity: "success" | "info" | "warning" | "error";
    message: string;
}

/**
 * KTX2 conversion state. Lives outside the Convert dialog so a conversion keeps running
 * (and its result is downloaded and added to the texture list) after the dialog is closed
 * or unmounted. Only one conversion runs at a time.
 */
interface ConvertStore {
    dialogOpen: boolean;
    isConverting: boolean;
    /** False while the encode runs on the main thread: it cannot be interrupted. */
    canCancel: boolean;
    /** Cancel was requested; waiting for the running step to stop. */
    isCancelling: boolean;
    /** Name of the source texture being converted. */
    sourceName: string | null;
    /** Output file name of the running (or last) conversion. */
    outputName: string | null;
    /** Error of the last conversion, shown in the dialog when it failed while the dialog was open. */
    lastError: string | null;
    /** Snackbar message (results while the dialog is closed, main-thread fallback warning). */
    notification: ConvertNotification | null;

    openDialog: () => void;
    /** Closes the dialog. Never stops a running conversion. */
    closeDialog: () => void;
    /** Starts a conversion unless one is already running. Resolves when it has finished. */
    startConversion: (texture: ITexture2DContainer, params: ConvertParameters) => Promise<void>;
    /** Aborts the running conversion (terminates its worker). No-op while `canCancel` is false. */
    cancelConversion: () => void;
    clearLastError: () => void;
    dismissNotification: () => void;
}

/** Internal: lets cancelConversion abort the running conversion (terminates its worker). */
let activeController: AbortController | null = null;
let nextNotificationId = 0;

export const useConvertStore = create<ConvertStore>((set, get) => {
    const notify = (severity: ConvertNotification["severity"], message: string): number => {
        nextNotificationId++;
        set({notification: {id: nextNotificationId, severity, message}});
        return nextNotificationId;
    };

    /** Result goes into the open dialog, or into a snackbar notification when the dialog is closed. */
    const report = (severity: "success" | "error", message: string) => {
        if (get().dialogOpen) {
            // As before: success closes the dialog (the new texture is selected); errors show in it.
            set(severity === "success" ? {dialogOpen: false} : {lastError: message});
            return;
        }
        notify(severity, message);
    };

    return {
        dialogOpen: false,
        isConverting: false,
        canCancel: false,
        isCancelling: false,
        sourceName: null,
        outputName: null,
        lastError: null,
        notification: null,

        openDialog: () => set({dialogOpen: true, lastError: null}),

        closeDialog: () => set({dialogOpen: false}),

        startConversion: async (texture, params) => {
            if (get().isConverting) {
                return;
            }

            const framework = useViewerStore.getState().framework;
            if (!framework) {
                // This should never happen.
                report("error", "Framework not set");
                return;
            }

            const controller = new AbortController();
            activeController = controller;
            let fallbackNotificationId: number | null = null;
            set({
                isConverting: true,
                canCancel: true,
                isCancelling: false,
                sourceName: texture.name,
                outputName: changeFileExtension(params.fileName, KTX2_FILE_EXTENSION),
                lastError: null,
            });

            const finish = () => {
                // The fallback warning is only about the running conversion.
                if (fallbackNotificationId !== null && get().notification?.id === fallbackNotificationId) {
                    set({notification: null});
                }
                set({isConverting: false, canCancel: false, isCancelling: false});
            };

            try {
                const result = await convertToKtx2UsingWorkerAsync(framework, texture, params, {
                    signal: controller.signal,
                    onMainThreadFallback: () => {
                        set({canCancel: false});
                        fallbackNotificationId = notify("warning", MAIN_THREAD_FALLBACK_MESSAGE);
                    },
                    // Download and list entry share one unique name.
                    resolveOutputName: (name) => useTextureStore.getState().uniqueTextureName(name),
                });
                if (!result.success || !result.ktx || !result.name) {
                    throw new Error("Conversion failed.");
                }
                // The texture store takes ownership of the KTX2 texture (and deletes it if the upload fails).
                // Only select it while the dialog is open; a background result must not change the selection.
                const name = useTextureStore.getState().addKtx2Texture(result.name, result.ktx, {
                    select: get().dialogOpen,
                });
                finish();
                report("success", `${name} converted`);
            } catch (err) {
                finish();
                if (isAbortError(err)) {
                    return;
                }
                console.error("Convert failed:", err);
                report("error", err instanceof Error ? err.message : String(err));
            } finally {
                if (activeController === controller) {
                    activeController = null;
                }
            }
        },

        cancelConversion: () => {
            const {isConverting, canCancel, isCancelling} = get();
            if (!activeController || !isConverting || !canCancel || isCancelling) {
                return;
            }
            set({isCancelling: true});
            activeController.abort();
        },

        clearLastError: () => set({lastError: null}),

        dismissNotification: () => set({notification: null}),
    };
});
