// Shared KTX2 encode steps used by both the Web Worker and the main-thread fallback.
// Must stay DOM-free: it is type-checked against the WebWorker lib (tsconfig.worker.json).

import {
    KtxAstcQualityLevel,
    type IKtx2Factory,
    type IKtx2Texture,
    type IKtxAstcParams,
    type IKtxBasisParams,
    type IKtxTextureCreateInfo,
    KtxAstcBlockDimension,
    KtxAstcEncoderMode,
    KtxCreateStorage,
    KtxErrorCode,
} from "ris-ktx2";
import type {ConvertParameters} from "../model/ConvertParameters.ts";
import {
    KTX_ENCODING_ASTC,
    KTX_ENCODING_BASIS_UNIVERSAL_ETC1S,
    KTX_ENCODING_BASIS_UNIVERSAL_UASTC,
    KTX_ENCODING_RGBA,
} from "../model/Ktx2EncodingConstants.ts";
import {etECT1SQualityLevel, getUastcEncodingFlags} from "../model/CompressionQualityConstants.ts";
import {getUastcRDOQualityScalar} from "../model/RDOCompressionConstants.ts";
import {KTX_COMPRESSION_ZLIB, KTX_COMPRESSION_ZSTANDARD} from "../model/Ktx2CompressionConstants.ts";

export function isBasisEncoding(encoding: string): boolean {
    return encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC
        || encoding === KTX_ENCODING_BASIS_UNIVERSAL_ETC1S;
}

/** A positive `threadCount` is used as-is; otherwise use all logical cores. */
export function resolveThreadCount(threadCount: number): number {
    if (threadCount > 0) {
        return threadCount;
    }
    return globalThis.navigator?.hardwareConcurrency || 1;
}

/** Basis Universal parameters for UASTC / ETC1S, or null for raw RGBA. */
export function buildBasisParams(convertParameters: ConvertParameters, verbose: boolean): IKtxBasisParams | null {
    if (!isBasisEncoding(convertParameters.encoding)) {
        return null;
    }

    const basisParams: IKtxBasisParams = {
        verbose,
        threadCount: resolveThreadCount(convertParameters.threadCount),
    };

    if (convertParameters.encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC) {
        basisParams.uastc = true;
        basisParams.uastcFlags = getUastcEncodingFlags(convertParameters.uastcQuality);
        basisParams.uastcRDO = true;
        basisParams.uastcRDOQualityScalar = getUastcRDOQualityScalar(convertParameters.rdoQuality);
    } else {
        basisParams.qualityLevel = etECT1SQualityLevel(convertParameters.etc1sQuality);
    }
    return basisParams;
}

/** ASTC encoder parameters for the ASTC encoding, or null for other encodings. */
export function buildAstcParams(convertParameters: ConvertParameters, verbose: boolean): IKtxAstcParams | null {
    if (convertParameters.encoding !== KTX_ENCODING_ASTC) {
        return null;
    }
    const blockDimension = KtxAstcBlockDimension[`D${convertParameters.astcBlockSize}` as keyof typeof KtxAstcBlockDimension];
    if (blockDimension === undefined) {
        throw new Error(`Unsupported ASTC block size: ${convertParameters.astcBlockSize}`);
    }
    const mode = KtxAstcEncoderMode[convertParameters.astcMode as keyof typeof KtxAstcEncoderMode];
    if (mode === undefined) {
        throw new Error(`Unsupported ASTC mode: ${convertParameters.astcMode}`);
    }
    return {
        blockDimension,
        mode,
        qualityLevel: convertParameters.astcQuality as KtxAstcQualityLevel,
        normalMap: convertParameters.astcNormalMap,
        threadCount: resolveThreadCount(convertParameters.threadCount),
        verbose,
    };
}

/** Throws when a libktx call did not return SUCCESS, so a failed step never produces a broken file. */
export function assertKtxSuccess(result: KtxErrorCode, step: string): void {
    if (result !== KtxErrorCode.SUCCESS) {
        throw new Error(`${step} failed (${KtxErrorCode[result] ?? result})`);
    }
}

/**
 * Basis-encodes (UASTC / ETC1S) and then supercompresses (Zstd / ZLib) the texture in place.
 * ASTC-encodes (needs the uncompressed RGBA8 input the converter creates).
 * ETC1S already uses its own compression, so supercompression applies to UASTC, ASTC and RGBA only.
 */
export function encodeKtx2(tex: IKtx2Texture, params: ConvertParameters, verbose: boolean): void {
    const basisParams = buildBasisParams(params, verbose);
    if (basisParams) {
        const name = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC ? "UASTC" : "ETC1S";
        assertKtxSuccess(tex.compressBasis(basisParams), `${name} encoding`);
    }

    const astcParams = buildAstcParams(params, verbose);
    if (astcParams) {
        assertKtxSuccess(tex.compressAstc(astcParams), "ASTC encoding");
    }

    const supercompressible = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC
        || params.encoding === KTX_ENCODING_ASTC
        || params.encoding === KTX_ENCODING_RGBA;
    if (!supercompressible) {
        return;
    }
    if (params.compression === KTX_COMPRESSION_ZSTANDARD) {
        assertKtxSuccess(tex.deflateZstd(params.compressionLevelZstd), "Zstandard supercompression");
    } else if (params.compression === KTX_COMPRESSION_ZLIB) {
        assertKtxSuccess(tex.deflateZlib(params.compressionLevelZLib), "ZLib supercompression");
    }
}

/**
 * Creates the uncompressed RGBA8 texture to encode and fills every image.
 * `dataPerLayer[layer][level]` holds the RGBA8 bytes of one image; one layer for a plain 2D texture,
 * N layers (with `createInfo.isArray`) for a 2D texture array. The caller deletes the texture.
 * Throws (and deletes the texture) when libktx rejects an image, e.g. a size that doesn't match.
 */
export function createKtx2FromImages(
    factory: IKtx2Factory,
    createInfo: IKtxTextureCreateInfo,
    dataPerLayer: readonly (readonly ArrayBufferView[])[],
): IKtx2Texture {
    const tex = factory.create(createInfo, KtxCreateStorage.ALLOC_STORAGE);
    try {
        for (let layer = 0; layer < dataPerLayer.length; layer++) {
            const levels = dataPerLayer[layer];
            for (let level = 0; level < levels.length; level++) {
                assertKtxSuccess(tex.setImageFromMemory(level, layer, 0, levels[level]), `Setting layer ${layer}, mip ${level}`);
            }
        }
    } catch (err) {
        tex.delete();
        throw err;
    }
    return tex;
}

/**
 * Copies a view into its own ArrayBuffer. Needed for WASM output (the view points into the
 * whole heap, which must not be transferred or kept) and for buffers that will be transferred.
 */
export function toStandaloneBytes(view: ArrayBufferView): Uint8Array<ArrayBuffer> {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
}
