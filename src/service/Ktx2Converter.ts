import {type IKtxTextureCreateInfo, Ktx2Factory, VkFormat} from "ris-ktx2";
import type {FrameworkKtx2Texture} from "../model/FrameworkKtx2.ts";
import {AlignUtilities, type IFramework, type RawImageData} from "ris-framework";
import {vec2} from "gl-matrix";
import type {ITexture2DContainer} from "../model/ITexture2DContainer.ts";
import type {ConvertParameters} from "../model/ConvertParameters.ts";
import {KTX2_FILE_EXTENSION} from "../model/FileExtensionConstants.ts";
import {downloadKtx2} from "./textureUtilities.ts";
import {changeFileExtension} from "./formatter.ts";
import {createKtx2FromImages, encodeKtx2, isBasisEncoding, toStandaloneBytes} from "./Ktx2Encoder.ts";
import {mipLevelCount} from "./mipLevels.ts";
import {parseAstcBlockSize} from "./astcFormats.ts";
import {KTX_ENCODING_ASTC} from "../model/Ktx2EncodingConstants.ts";
import type {KtxWorkerConvertRequest, KtxWorkerResponse} from "./ktxWorkerProtocol.ts";
import {arraySourceProblem} from "./textureArray.ts";
import KtxWorker from "./ktx.worker.ts?worker";

export interface ConvertResult {
    success: boolean,
    ktx: FrameworkKtx2Texture | null,
    name: string | null,
    /** Byte length of the encoded KTX2 file. */
    fileSize?: number,
    /** KTX2 header layerCount of the written file: 0 for a 2D texture, N for an N-layer texture array. */
    layerCount?: number,
}

/** The KTX worker could not start (module load or libktx init). Safe to fall back to the main thread. */
export class KtxWorkerInitError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = "KtxWorkerInitError";
    }
}

/** Options for {@link convertToKtx2UsingWorkerAsync}. */
export interface ConvertOptions {
    /** Aborting terminates the worker and rejects with an AbortError. Has no effect once the main-thread fallback runs. */
    signal?: AbortSignal;
    /**
     * Called when the worker cannot start and the encode moves to the main thread. The UI gets one
     * chance to render (e.g. a warning) before the encode blocks it; the encode cannot be cancelled.
     */
    onMainThreadFallback?: () => void;
    /** Maps the output file name to the name used for the download and the texture list (e.g. de-duplicated). */
    resolveOutputName?: (name: string) => string;
}

/**
 * How long the worker may take to load libktx and report "ready" after the source image is prepared.
 * Longer counts as a worker start failure (main-thread fallback), so a stuck worker can't hang the conversion.
 */
export const KTX_WORKER_READY_TIMEOUT_MS = 30_000;

/** True for the rejection produced by aborting a conversion via its AbortSignal. */
export function isAbortError(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError";
}

/** One source image after block alignment and mip generation. */
type PreparedLayer = {
    /** Block-aligned image with its generated mip levels (may be `image` itself). */
    sourceImage: RawImageData;
    /** The texture's own image; never disposed here. */
    image: RawImageData;
    baseWidth: number;
    baseHeight: number;
};

/** Everything the encoder needs: one layer for a 2D texture, N layers (same size) for a texture array. */
type PreparedSource = {
    layers: PreparedLayer[];
    isArray: boolean;
    baseWidth: number;
    baseHeight: number;
    numLevels: number;
    fileName: string;
};

/** Encoded KTX2 file bytes plus the output file name. */
type EncodedKtx2 = {
    bytes: Uint8Array<ArrayBuffer>;
    name: string;
};

const VERBOSE = import.meta.env.DEV;

/** Block footprint to align the base level to, or null when the encoding has no blocks (RGBA). */
function alignmentBlock(convertParameters: ConvertParameters): { width: number; height: number } | null {
    if (isBasisEncoding(convertParameters.encoding)) {
        return {width: 4, height: 4};
    }
    if (convertParameters.encoding === KTX_ENCODING_ASTC) {
        return parseAstcBlockSize(convertParameters.astcBlockSize);
    }
    return null;
}

/**
 * Block-align Basis formats to 4×4 and ASTC to its block size and compute mip count when requested.
 * Mip count is always derived when generateMipmaps is on (not only after a resize).
 */
async function prepareLayerAsync(
    fw: IFramework,
    selectedTexture: ITexture2DContainer,
    convertParameters: ConvertParameters,
): Promise<PreparedLayer> {
    if (!selectedTexture.image) {
        throw new Error(`${selectedTexture.name} has no source image to convert`);
    }

    const encoding = convertParameters.encoding;
    const image = selectedTexture.image;
    let sourceImage = image;
    let baseWidth = image.baseWidth;
    let baseHeight = image.baseHeight;

    // Basis formats use 4×4 blocks; ASTC uses the selected (possibly non-square) block footprint.
    const block = alignmentBlock(convertParameters);
    if (convertParameters.blockAlign && block) {
        if (baseWidth % block.width !== 0 || baseHeight % block.height !== 0) {
            baseWidth = AlignUtilities.align(baseWidth, block.width);
            baseHeight = AlignUtilities.align(baseHeight, block.height);
            sourceImage = await fw.imageProcessor.resizeAsync(image, vec2.fromValues(baseWidth, baseHeight));
        }
    }

    // Total level count, base included. Basis block formats stop at 4 on the smaller side; RGBA and ASTC
    // go to 1 (ASTC pads partial blocks, so levels smaller than the block footprint are valid).
    const mipLevelsToGen = convertParameters.generateMipmaps
        ? mipLevelCount(baseWidth, baseHeight, isBasisEncoding(encoding) ? 4 : 1)
        : 1;

    if (mipLevelsToGen > 1) {
        const needsDispose = sourceImage !== image;
        let mipmaped: RawImageData;
        try {
            // generateMipmapsAsync takes the number of levels to add on top of the base level.
            mipmaped = await fw.imageProcessor.generateMipmapsAsync(sourceImage, mipLevelsToGen - 1);
        } catch (err) {
            if (needsDispose) {
                sourceImage.dispose();
            }
            throw err;
        }
        if (needsDispose) {
            sourceImage.dispose();
        }
        sourceImage = mipmaped;
    }

    return {sourceImage, image, baseWidth, baseHeight};
}

function disposeLayer(layer: PreparedLayer) {
    if (layer.sourceImage !== layer.image) {
        layer.sourceImage.dispose();
    }
}

/**
 * Prepares every source image (in order; one per array layer). With `isArray` the textures must pass
 * {@link arraySourceProblem}, so every layer ends up with the same size and mip count.
 */
async function prepareSourcesAsync(
    fw: IFramework,
    textures: readonly ITexture2DContainer[],
    convertParameters: ConvertParameters,
    isArray: boolean,
): Promise<PreparedSource> {
    if (textures.length === 0) {
        throw new Error("No texture selected");
    }
    if (isArray) {
        const problem = arraySourceProblem(textures);
        if (problem) {
            throw new Error(`Can't create a texture array: ${problem}`);
        }
    }

    const layers: PreparedLayer[] = [];
    try {
        for (const texture of textures) {
            layers.push(await prepareLayerAsync(fw, texture, convertParameters));
        }
    } catch (err) {
        layers.forEach(disposeLayer);
        throw err;
    }

    const first = layers[0];
    return {
        layers,
        isArray,
        baseWidth: first.baseWidth,
        baseHeight: first.baseHeight,
        numLevels: first.sourceImage.numLevels,
        fileName: changeFileExtension(convertParameters.fileName, KTX2_FILE_EXTENSION),
    };
}

function disposePrepared(prepared: PreparedSource | null) {
    prepared?.layers.forEach(disposeLayer);
}

// TODO: Mipmaps come from ris-framework generateMipmapsAsync, which filters the stored (sRGB-encoded) values
// directly, so sRGB mips are not gamma-correct (slightly dark). Neither ris-framework nor ris-ktx2 offers a
// linear-space mip filter; add one (decode to linear, filter, re-encode) if quality matters.
function createInfoFor(prepared: PreparedSource, srgb: boolean): IKtxTextureCreateInfo {
    return {
        baseWidth: prepared.baseWidth,
        baseHeight: prepared.baseHeight,
        // The source format decides the color space of every encoding (raw, Basis DFD transfer, ASTC block format).
        vkFormat: srgb ? VkFormat.R8G8B8A8_SRGB : VkFormat.R8G8B8A8_UNORM,
        numLevels: prepared.numLevels,
        numLayers: prepared.layers.length,
        isArray: prepared.isArray,
    };
}

/** RGBA8 bytes of every image as `[layer][mipLevel]`. */
function collectImageBytes(prepared: PreparedSource): Uint8Array[][] {
    return prepared.layers.map(({sourceImage}) =>
        Array.from({length: prepared.numLevels}, (_, level) => sourceImage.getData(level) as Uint8Array));
}

/** Standalone RGBA8 copies of every image, so the ArrayBuffers can be transferred to the worker. */
function collectImageBuffers(prepared: PreparedSource): ArrayBuffer[][] {
    return collectImageBytes(prepared).map((levels) => levels.map((bytes) => toStandaloneBytes(bytes).buffer));
}

/** Reloads written KTX2 bytes as a texture for the list (same rule for worker and main-thread paths). */
function loadEncodedKtx2(fw: IFramework, bytes: Uint8Array<ArrayBuffer>): FrameworkKtx2Texture {
    if (!fw.ktx2Factory) {
        throw new Error("KTX2 factory not available");
    }
    return fw.ktx2Factory.createFromBuffer(bytes);
}

/** Abort listener that is removed again once the operation settles. */
function onAbort(signal: AbortSignal | undefined, listener: () => void): () => void {
    if (!signal) {
        return () => {
        };
    }
    signal.addEventListener("abort", listener, {once: true});
    return () => signal.removeEventListener("abort", listener);
}

// TODO: One worker per conversion: libktx WASM (~2.3 MB) is reloaded every time, but terminate() is the
// only way to cancel compressBasis and WASM memory never shrinks. Consider a lazy client that keeps a warm
// worker (pre-started when the dialog opens) and terminates it after large jobs or when idle.

/**
 * Starts a KTX worker and waits for its "ready" handshake (libktx loaded).
 * Rejects with {@link KtxWorkerInitError} if the worker cannot start, or with the
 * signal's AbortError if aborted first (the worker is terminated in both cases).
 */
function startWorkerAsync(signal?: AbortSignal): Promise<Worker> {
    return new Promise<Worker>((resolve, reject) => {
        let worker: Worker;
        try {
            worker = new KtxWorker();
        } catch (err) {
            reject(new KtxWorkerInitError("KTX worker could not be created", {cause: err}));
            return;
        }

        let settled = false;
        const settle = (error: unknown | null) => {
            if (settled) {
                return;
            }
            settled = true;
            removeAbort();
            worker.removeEventListener("message", handleMessage);
            worker.removeEventListener("error", handleError);
            if (error === null) {
                resolve(worker);
            } else {
                worker.terminate();
                reject(error);
            }
        };
        const handleMessage = (event: MessageEvent<KtxWorkerResponse>) => {
            if (event.data.type === "ready") {
                settle(null);
            } else if (event.data.type === "initError") {
                settle(new KtxWorkerInitError(event.data.message || "KTX worker failed to initialize"));
            }
        };
        const handleError = (event: ErrorEvent) => {
            event.preventDefault();
            settle(new KtxWorkerInitError(event.message || "KTX worker failed to load"));
        };
        const removeAbort = onAbort(signal, () => settle(signal?.reason));

        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", handleError);
        if (signal?.aborted) {
            settle(signal.reason);
        }
    });
}

let nextRequestId = 0;

/**
 * Sends one convert request to a ready worker and waits for the result.
 * Failures here are encode failures and are not retried on the main thread.
 * Aborting terminates the worker (compressBasis cannot be interrupted otherwise).
 */
function encodeInWorkerAsync(
    worker: Worker,
    prepared: PreparedSource,
    convertParameters: ConvertParameters,
    signal?: AbortSignal,
): Promise<EncodedKtx2> {
    const dataPerLayer = collectImageBuffers(prepared);
    const request: KtxWorkerConvertRequest = {
        type: "convert",
        id: ++nextRequestId,
        ktxCreateInfo: createInfoFor(prepared, convertParameters.srgb),
        dataPerLayer,
        convertParameters,
        verbose: VERBOSE,
    };

    return new Promise<EncodedKtx2>((resolve, reject) => {
        const cleanup = () => {
            removeAbort();
            worker.removeEventListener("message", handleMessage);
            worker.removeEventListener("error", handleError);
            worker.removeEventListener("messageerror", handleMessageError);
        };
        const handleMessage = (event: MessageEvent<KtxWorkerResponse>) => {
            const response = event.data;
            if ((response.type !== "done" && response.type !== "error") || response.id !== request.id) {
                return;
            }
            cleanup();
            if (response.type === "done") {
                resolve({bytes: response.bytes, name: response.name || prepared.fileName});
            } else {
                const error = new Error(response.message || "Conversion failed.");
                if (response.stack) {
                    console.error("KTX worker stack:", response.stack);
                }
                reject(error);
            }
        };
        const handleError = (event: ErrorEvent) => {
            event.preventDefault();
            cleanup();
            reject(new Error(event.message || "KTX worker crashed during conversion."));
        };
        const handleMessageError = () => {
            cleanup();
            reject(new Error("KTX worker message deserialization failed."));
        };
        const removeAbort = onAbort(signal, () => {
            cleanup();
            worker.terminate();
            reject(signal?.reason);
        });

        worker.addEventListener("message", handleMessage);
        worker.addEventListener("error", handleError);
        worker.addEventListener("messageerror", handleMessageError);
        worker.postMessage(request, dataPerLayer.flat());
    });
}

let encoderFactoryPromise: Promise<Ktx2Factory> | null = null;

/**
 * The viewer's own ris-ktx2 0.2 factory for main-thread encoding (the framework's factory is 0.1 and
 * has no compressAstc). Initialized lazily, so libktx only starts on the main thread for the fallback.
 */
function getEncoderFactoryAsync(): Promise<Ktx2Factory> {
    encoderFactoryPromise ??= (async () => {
        const factory = new Ktx2Factory();
        await factory.initializeAsync();
        return factory;
    })();
    encoderFactoryPromise.catch(() => {
        encoderFactoryPromise = null;
    });
    return encoderFactoryPromise;
}

/** Encodes on the main thread (blocks the UI while libktx runs). Used as the fallback. */
async function encodeOnMainThreadAsync(
    prepared: PreparedSource,
    convertParameters: ConvertParameters,
): Promise<EncodedKtx2> {
    const factory = await getEncoderFactoryAsync();
    const createInfo = createInfoFor(prepared, convertParameters.srgb);
    const tex = createKtx2FromImages(factory, createInfo, collectImageBytes(prepared));
    try {
        encodeKtx2(tex, convertParameters, VERBOSE);
        // Copy out of the WASM heap before the texture is deleted.
        return {bytes: toStandaloneBytes(tex.writeToMemory()), name: prepared.fileName};
    } finally {
        tex.delete();
    }
}

/**
 * Downloads the file and reloads it as an IKtx2Texture. The caller owns the returned texture.
 * The download and the returned name both use `resolveOutputName` when given.
 */
function finishConversion(
    fw: IFramework,
    encoded: EncodedKtx2,
    resolveOutputName?: (name: string) => string,
): ConvertResult {
    const name = resolveOutputName ? resolveOutputName(encoded.name) : encoded.name;
    downloadKtx2(encoded.bytes, name);
    const ktx = loadEncodedKtx2(fw, encoded.bytes);
    return {
        success: true,
        ktx,
        name,
        fileSize: encoded.bytes.byteLength,
        layerCount: ktx.isArray ? ktx.numLayers : 0,
    };
}

/** Gives the browser a chance to render (e.g. the fallback warning) before a long synchronous task. */
function yieldToBrowserAsync(): Promise<void> {
    return new Promise((resolve) => {
        // rAF + task lets a frame paint; the plain timeout covers hidden tabs where rAF doesn't fire.
        const timeoutId = window.setTimeout(resolve, 100);
        requestAnimationFrame(() => window.setTimeout(() => {
            window.clearTimeout(timeoutId);
            resolve();
        }, 0));
    });
}

/**
 * Converts via a module Web Worker. Main thread prepares pixels; worker encodes.
 * Downloads on the main thread and rebuilds an IKtx2Texture from the returned bytes.
 *
 * Falls back to encoding on the main thread only when the worker cannot start
 * ({@link KtxWorkerInitError}, including no "ready" within {@link KTX_WORKER_READY_TIMEOUT_MS});
 * encode failures are reported, not retried.
 * Aborting `options.signal` terminates the worker and rejects with an AbortError; nothing is
 * downloaded or returned after an abort.
 */
export async function convertToKtx2UsingWorkerAsync(
    fw: IFramework,
    selectedTexture: ITexture2DContainer,
    convertParameters: ConvertParameters,
    options: ConvertOptions = {},
): Promise<ConvertResult> {
    return convertUsingWorkerAsync(fw, [selectedTexture], convertParameters, options, false);
}

/**
 * Like {@link convertToKtx2UsingWorkerAsync}, but writes one KTX2 2D texture array with one layer per
 * texture, in the given order. The textures must be decoded images of the same size
 * (see {@link arraySourceProblem}); otherwise this rejects with the reason.
 */
export async function convertArrayToKtx2UsingWorkerAsync(
    fw: IFramework,
    textures: readonly ITexture2DContainer[],
    convertParameters: ConvertParameters,
    options: ConvertOptions = {},
): Promise<ConvertResult> {
    return convertUsingWorkerAsync(fw, textures, convertParameters, options, true);
}

async function convertUsingWorkerAsync(
    fw: IFramework,
    textures: readonly ITexture2DContainer[],
    convertParameters: ConvertParameters,
    options: ConvertOptions,
    isArray: boolean,
): Promise<ConvertResult> {
    const {signal, onMainThreadFallback, resolveOutputName} = options;
    signal?.throwIfAborted();

    // Aborted with a KtxWorkerInitError when the ready handshake times out (terminates the worker).
    const startController = new AbortController();
    const startSignal = signal ? AbortSignal.any([signal, startController.signal]) : startController.signal;

    // Load the worker (and its WASM) while the source image is prepared.
    const workerPromise = startWorkerAsync(startSignal);
    // Errors are handled where the promise is awaited below; avoid an unhandled rejection
    // if preparing the image fails first.
    workerPromise.catch(() => {
    });

    let worker: Worker | null = null;
    let prepared: PreparedSource | null = null;
    try {
        prepared = await prepareSourcesAsync(fw, textures, convertParameters, isArray);
        signal?.throwIfAborted();

        // The timeout starts once the (main-thread) preparation is done, so a long resize can't trip it.
        const readyTimeoutId = window.setTimeout(() => startController.abort(new KtxWorkerInitError(
            `KTX worker did not start within ${KTX_WORKER_READY_TIMEOUT_MS / 1000} s`,
        )), KTX_WORKER_READY_TIMEOUT_MS);
        try {
            worker = await workerPromise;
        } catch (err) {
            if (!(err instanceof KtxWorkerInitError)) {
                throw err;
            }
            console.warn("KTX worker unavailable; converting on the main thread.", err);
            onMainThreadFallback?.();
            await yieldToBrowserAsync();
            signal?.throwIfAborted();
            const encoded = await encodeOnMainThreadAsync(prepared, convertParameters);
            return finishConversion(fw, encoded, resolveOutputName);
        } finally {
            window.clearTimeout(readyTimeoutId);
        }

        const encoded = await encodeInWorkerAsync(worker, prepared, convertParameters, signal);
        signal?.throwIfAborted();
        return finishConversion(fw, encoded, resolveOutputName);
    } finally {
        disposePrepared(prepared);
        if (worker) {
            worker.terminate();
        } else {
            workerPromise.then((w) => w.terminate(), () => {
            });
        }
    }
}

/**
 * Converts the given texture's source image to KTX2 on the main thread and downloads it.
 * Works on a local image reference; the texture's image is never mutated.
 * Returns the written KTX2 reloaded as a texture so it can be added to the texture list.
 */
export async function convertToKtx2Async(
    fw: IFramework,
    selectedTexture: ITexture2DContainer,
    convertParameters: ConvertParameters,
): Promise<ConvertResult> {
    const prepared = await prepareSourcesAsync(fw, [selectedTexture], convertParameters, false);
    try {
        return finishConversion(fw, await encodeOnMainThreadAsync(prepared, convertParameters));
    } finally {
        disposePrepared(prepared);
    }
}
