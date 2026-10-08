// Shared KTX2 encode steps used by both the Web Worker and the main-thread fallback.
// Must stay DOM-free: it is type-checked against the WebWorker lib (tsconfig.worker.json).

import type {IKtx2Texture, IKtxBasisParams} from "ris-ktx2";
import type {ConvertParameters} from "../model/ConvertParameters.ts";
import {
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

// TODO: compressBasis / deflateZstd / deflateZlib return a KtxErrorCode that is ignored here (as before),
// so a failed encode is not reported. Check the codes and throw once the success value is confirmed.
/**
 * Basis-encodes (UASTC / ETC1S) and then supercompresses (Zstd / ZLib) the texture in place.
 * ETC1S already uses its own compression, so supercompression applies to UASTC and RGBA only.
 */
export function encodeKtx2(tex: IKtx2Texture, params: ConvertParameters, verbose: boolean): void {
    const basisParams = buildBasisParams(params, verbose);
    if (basisParams) {
        tex.compressBasis(basisParams);
    }

    const supercompressible = params.encoding === KTX_ENCODING_BASIS_UNIVERSAL_UASTC
        || params.encoding === KTX_ENCODING_RGBA;
    if (!supercompressible) {
        return;
    }
    if (params.compression === KTX_COMPRESSION_ZSTANDARD) {
        tex.deflateZstd(params.compressionLevelZstd);
    } else if (params.compression === KTX_COMPRESSION_ZLIB) {
        tex.deflateZlib(params.compressionLevelZLib);
    }
}

/**
 * Copies a view into its own ArrayBuffer. Needed for WASM output (the view points into the
 * whole heap, which must not be transferred or kept) and for buffers that will be transferred.
 */
export function toStandaloneBytes(view: ArrayBufferView): Uint8Array<ArrayBuffer> {
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength).slice();
}
