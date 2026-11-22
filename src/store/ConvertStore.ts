import {create} from "zustand";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import type {ConvertParameters} from "../model/ConvertParameters.ts";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import type {IFramework} from "ris-framework";
import {
    convertArrayToKtx2UsingWorkerAsync,
    type ConvertOptions,
    type ConvertResult,
    convertToKtx2UsingWorkerAsync,
    isAbortError,
} from "../service/Ktx2Converter.ts";
import {changeFileExtension} from "../service/formatter.ts";
import {useTextureStore} from "./TextureStore.ts";
import {useViewerStore, waitForFrameworkAsync} from "./viewerStore.ts";

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

/** Progress of a "separate KTX2 files" run: `index` is the 0-based file being converted. */
export interface ConvertBatchProgress {
    index: number;
    total: number;
}

/** One output file of a conversion run. */
interface ConversionStep {
    sourceName: string;
    params: ConvertParameters;
    convert: (framework: IFramework, options: ConvertOptions) => Promise<ConvertResult>;
}

/**
 * KTX2 conversion state. Lives outside the Convert dialog so a conversion keeps running
 * (and its result is downloaded and added to the texture list) after the dialog is closed
 * or unmounted. Only one conversion (or batch of separate files) runs at a time.
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
    /** Set while several separate files are converted one after another; null for a single output. */
    batch: ConvertBatchProgress | null;
    /** Error of the last conversion, shown in the dialog when it failed while the dialog was open. */
    lastError: string | null;
    /** Snackbar message (results while the dialog is closed, main-thread fallback warning). */
    notification: ConvertNotification | null;

    openDialog: () => void;
    /** Closes the dialog. Never stops a running conversion. */
    closeDialog: () => void;
    /** Starts a conversion unless one is already running. Resolves when it has finished. */
    startConversion: (texture: ITexture2DContainer, params: ConvertParameters) => Promise<void>;
    /**
     * Converts each texture to its own KTX2 file (named after the texture) with the same options, one after
     * another. A failed file is reported and the next one still runs; Cancel stops the rest.
     */
    startBatchConversion: (textures: ITexture2DContainer[], params: ConvertParameters) => Promise<void>;
    /** Converts the textures (in order) to one KTX2 2D texture array named `params.fileName`. */
    startArrayConversion: (textures: ITexture2DContainer[], params: ConvertParameters) => Promise<void>;
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

    /**
     * Runs the steps in order with one AbortController (Cancel stops the whole run) and adds every result to
     * the texture list. A single result is selected while the dialog is open; batch results never change the
     * selection. With several steps a failure is collected and the next step still runs.
     */
    const runConversion = async (
        steps: ConversionStep[],
        describeSuccess: (name: string, result: ConvertResult) => string,
    ): Promise<void> => {
        if (get().isConverting || steps.length === 0) {
            return;
        }

        const framework = useViewerStore.getState().framework;
        if (!framework) {
            // This should never happen.
            report("error", "Framework not set");
            return;
        }

        const isBatch = steps.length > 1;
        const controller = new AbortController();
        activeController = controller;
        let fallbackNotificationId: number | null = null;
        set({isConverting: true, canCancel: true, isCancelling: false, lastError: null});

        const finish = () => {
            // The fallback warning is only about the running conversion.
            if (fallbackNotificationId !== null && get().notification?.id === fallbackNotificationId) {
                set({notification: null});
            }
            set({isConverting: false, canCancel: false, isCancelling: false, batch: null});
        };

        const converted: string[] = [];
        const failed: string[] = [];
        try {
            for (let i = 0; i < steps.length; i++) {
                const step = steps[i];
                set({
                    sourceName: step.sourceName,
                    outputName: changeFileExtension(step.params.fileName, KTX2_FILE_EXTENSION),
                    batch: isBatch ? {index: i, total: steps.length} : null,
                });
                try {
                    const result = await step.convert(framework, {
                        signal: controller.signal,
                        onMainThreadFallback: () => {
                            set({canCancel: false});
                            fallbackNotificationId ??= notify("warning", MAIN_THREAD_FALLBACK_MESSAGE);
                        },
                        // Download and list entry share one unique name.
                        resolveOutputName: (name) => useTextureStore.getState().uniqueTextureName(name),
                    });
                    if (!result.success || !result.ktx || !result.name) {
                        throw new Error("Conversion failed.");
                    }
                    // A backend switch may be in progress (no framework for a moment). The conversion itself doesn't need
                    // the GPU (worker encode; the fallback uses the CPU image processor and the realm-wide libktx), only
                    // this upload does, so wait for the new framework instead of blocking the switch.
                    try {
                        await waitForFrameworkAsync(controller.signal);
                    } catch (err) {
                        result.ktx.delete();
                        throw err;
                    }
                    // The texture store takes ownership of the KTX2 texture (and deletes it if the upload fails).
                    // Only select it while the dialog is open; a background result must not change the selection.
                    const name = useTextureStore.getState().addKtx2Texture(result.name, result.ktx, {
                        select: !isBatch && get().dialogOpen,
                        fileSize: result.fileSize,
                    });
                    converted.push(describeSuccess(name, result));
                } catch (err) {
                    if (!isBatch || isAbortError(err)) {
                        throw err;
                    }
                    console.error(`Convert failed (${step.sourceName}):`, err);
                    failed.push(`${step.sourceName}: ${err instanceof Error ? err.message : String(err)}`);
                }
            }
            finish();
            if (failed.length > 0) {
                report("error", `${converted.length} of ${steps.length} files converted. Failed: ${failed.join("; ")}`);
            } else if (isBatch) {
                // The dialog closes on success like a single conversion, but say what was added either way.
                set({dialogOpen: false});
                notify("success", `${converted.length} files converted`);
            } else {
                report("success", converted[0]);
            }
        } catch (err) {
            finish();
            if (isAbortError(err)) {
                if (converted.length > 0) {
                    notify("info", `Cancelled. ${converted.length} of ${steps.length} files were converted.`);
                }
                return;
            }
            console.error("Convert failed:", err);
            report("error", err instanceof Error ? err.message : String(err));
        } finally {
            if (activeController === controller) {
                activeController = null;
            }
        }
    };

    return {
        dialogOpen: false,
        isConverting: false,
        canCancel: false,
        isCancelling: false,
        sourceName: null,
        outputName: null,
        batch: null,
        lastError: null,
        notification: null,

        openDialog: () => set({dialogOpen: true, lastError: null}),

        closeDialog: () => set({dialogOpen: false}),

        startConversion: (texture, params) => runConversion(
            [{sourceName: texture.name, params, convert: (framework, options) =>
                convertToKtx2UsingWorkerAsync(framework, texture, params, options)}],
            (name) => `${name} converted`,
        ),

        startBatchConversion: (textures, params) => runConversion(
            textures.map((texture) => {
                // Same options for every file; each output is named after its source.
                const itemParams = {...params, fileName: changeFileExtension(texture.name, KTX2_FILE_EXTENSION)};
                return {sourceName: texture.name, params: itemParams, convert: (framework, options) =>
                    convertToKtx2UsingWorkerAsync(framework, texture, itemParams, options)};
            }),
            (name) => `${name} converted`,
        ),

        startArrayConversion: (textures, params) => runConversion(
            [{
                sourceName: `${textures.length} images`,
                params,
                convert: (framework, options) => convertArrayToKtx2UsingWorkerAsync(framework, textures, params, options),
            }],
            (name, result) => `${name} converted (${result.layerCount ?? textures.length} layers)`,
        ),

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
