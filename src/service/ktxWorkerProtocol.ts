import type {IKtxTextureCreateInfo} from "ris-ktx2";
import type {ConvertParameters} from "../model/ConvertParameters.ts";

// Cancel is `worker.terminate()` on the main thread, not a message.

/** Main → worker: encode one texture. The mip ArrayBuffers are transferred. */
export interface KtxWorkerConvertRequest {
    type: "convert";
    id: number;
    ktxCreateInfo: IKtxTextureCreateInfo;
    /** One ArrayBuffer of RGBA8 pixels per mip level (transferred). */
    dataPerMipLevel: ArrayBuffer[];
    convertParameters: ConvertParameters;
    /** Pass libktx verbose logging through (dev builds only). */
    verbose: boolean;
}

export type KtxWorkerRequest = KtxWorkerConvertRequest;

/** Worker → main: libktx finished loading; the worker accepts convert requests. */
export interface KtxWorkerReady {
    type: "ready";
}

/** Worker → main: libktx failed to load. The caller may fall back to the main thread. */
export interface KtxWorkerInitFailure {
    type: "initError";
    message: string;
    stack?: string;
}

/** Worker → main: encoded KTX2 file bytes (standalone copy; buffer transferred). */
export interface KtxWorkerDone {
    type: "done";
    id: number;
    bytes: Uint8Array<ArrayBuffer>;
    name: string;
}

/** Worker → main: the encode failed. Not retried on the main thread. */
export interface KtxWorkerError {
    type: "error";
    id: number;
    message: string;
    stack?: string;
}

export type KtxWorkerResponse = KtxWorkerReady | KtxWorkerInitFailure | KtxWorkerDone | KtxWorkerError;
