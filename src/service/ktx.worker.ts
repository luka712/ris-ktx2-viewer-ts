// ktx.worker.ts — runs Basis/UASTC encode + optional supercompression off the main thread.
// Receives mip bytes + create info; returns transferable KTX2 file bytes (no DOM, no live WASM objects).
// Type-checked with the WebWorker lib via tsconfig.worker.json (excluded from tsconfig.app.json).

import {type IKtx2Texture, Ktx2Factory, KtxCreateStorage} from "ris-ktx2";
import {changeFileExtension} from "./formatter.ts";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import {encodeKtx2, toStandaloneBytes} from "./Ktx2Encoder.ts";
import type {KtxWorkerRequest, KtxWorkerResponse} from "./ktxWorkerProtocol.ts";

function post(message: KtxWorkerResponse, transfer: Transferable[] = []): void {
    self.postMessage(message, transfer);
}

function describeError(err: unknown): { message: string; stack?: string } {
    return err instanceof Error
        ? {message: err.message, stack: err.stack}
        : {message: String(err)};
}

// Load libktx once per worker, and tell the main thread whether that worked.
// The main thread only falls back to encoding on the main thread for init failures.
const factoryPromise: Promise<Ktx2Factory> = (async () => {
    const factory = new Ktx2Factory();
    await factory.initializeAsync();
    return factory;
})();

factoryPromise.then(
    () => post({type: "ready"}),
    (err: unknown) => post({type: "initError", ...describeError(err)}),
);

self.addEventListener("message", async (event: MessageEvent<KtxWorkerRequest>) => {
    const request = event.data;
    if (request.type !== "convert") {
        return;
    }

    let tex: IKtx2Texture | null = null;
    try {
        const {id, ktxCreateInfo, dataPerMipLevel, convertParameters, verbose} = request;
        const name = changeFileExtension(convertParameters.fileName, KTX2_FILE_EXTENSION);
        const factory = await factoryPromise;

        tex = factory.create(ktxCreateInfo, KtxCreateStorage.ALLOC_STORAGE);
        for (let i = 0; i < dataPerMipLevel.length; i++) {
            tex.setImageFromMemory(i, 0, 0, new Uint8Array(dataPerMipLevel[i]));
        }

        encodeKtx2(tex, convertParameters, verbose);

        const bytes = toStandaloneBytes(tex.writeToMemory());
        tex.delete();
        tex = null;

        post({type: "done", id, bytes, name}, [bytes.buffer]);
    } catch (err) {
        try {
            tex?.delete();
        } catch {
            // ignore dispose errors during failure cleanup
        }
        post({type: "error", id: request.id, ...describeError(err)});
    }
});
