/**
 * Encodes a KTX2 2D texture array with the viewer's own encode steps (createKtx2FromImages + encodeKtx2,
 * shared by the worker and the main-thread fallback) for every encoding, with mipmaps, and checks that
 * every layer and level survives a write and reload.
 *
 * Run: node --experimental-strip-types --test tests/Ktx2Encoder.textureArray.test.ts
 */
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {describe, it} from "node:test";

// The bundled libktx.js takes its Node code path here and expects CommonJS globals, which an ES module
// doesn't have. Provide them before ris-ktx2 loads the module.
const globals = globalThis as Record<string, unknown>;
globals.require ??= createRequire(import.meta.url);
globals.__filename ??= fileURLToPath(import.meta.url);
globals.__dirname ??= dirname(fileURLToPath(import.meta.url));

const {Ktx2Factory, KtxTranscodeFlags, KtxTranscodeFormat, VkFormat} = await import("ris-ktx2");
const {createKtx2FromImages, encodeKtx2, toStandaloneBytes} = await import("../src/service/Ktx2Encoder.ts");
const {ConvertParameters} = await import("../src/model/ConvertParameters.ts");
const {KTX_ENCODING_ASTC, KTX_ENCODING_BASIS_UNIVERSAL_ETC1S, KTX_ENCODING_BASIS_UNIVERSAL_UASTC, KTX_ENCODING_RGBA}
    = await import("../src/model/Ktx2EncodingConstants.ts");
const {KTX_COMPRESSION_NONE, KTX_COMPRESSION_ZSTANDARD} = await import("../src/model/Ktx2CompressionConstants.ts");

const factory = new Ktx2Factory();
await factory.initializeAsync();

const SIZE = 32;
const LEVELS = 3;
const LAYERS = 3;
/** Flat gray per layer, so block compression keeps the value exactly. */
const layerValue = (layer: number) => 20 + layer * 100;

function layerImages(layer: number): Uint8Array[] {
    return Array.from({length: LEVELS}, (_, level) => {
        const side = Math.max(1, SIZE >> level);
        return new Uint8Array(side * side * 4).fill(layerValue(layer));
    });
}

function params(encoding: string, compression: string): InstanceType<typeof ConvertParameters> {
    const p = new ConvertParameters();
    p.fileName = "array.ktx2";
    p.encoding = encoding;
    p.compression = compression;
    p.compressionLevelZstd = 3;
    p.astcBlockSize = "4x4";
    p.threadCount = 1;
    return p;
}

const cases: Array<[string, string]> = [
    [KTX_ENCODING_RGBA, KTX_COMPRESSION_ZSTANDARD],
    [KTX_ENCODING_BASIS_UNIVERSAL_UASTC, KTX_COMPRESSION_NONE],
    [KTX_ENCODING_BASIS_UNIVERSAL_ETC1S, KTX_COMPRESSION_NONE],
    [KTX_ENCODING_ASTC, KTX_COMPRESSION_ZSTANDARD],
];

describe("texture array encoding", () => {
    for (const [encoding, compression] of cases) {
        it(`${encoding} keeps ${LAYERS} layers × ${LEVELS} levels`, () => {
            const tex = createKtx2FromImages(factory, {
                baseWidth: SIZE,
                baseHeight: SIZE,
                vkFormat: VkFormat.R8G8B8A8_UNORM,
                numLevels: LEVELS,
                numLayers: LAYERS,
                isArray: true,
            }, Array.from({length: LAYERS}, (_, layer) => layerImages(layer)));
            let bytes: Uint8Array;
            try {
                encodeKtx2(tex, params(encoding, compression), false);
                bytes = toStandaloneBytes(tex.writeToMemory());
            } finally {
                tex.delete();
            }

            const loaded = factory.createFromBuffer(bytes);
            try {
                assert.equal(loaded.numLayers, LAYERS);
                assert.equal(loaded.isArray, true);
                assert.equal(loaded.numLevels, LEVELS);
                if (loaded.needsTranscoding) {
                    loaded.transcodeBasis(KtxTranscodeFormat.RGBA32, KtxTranscodeFlags.NONE);
                } else if (encoding === KTX_ENCODING_ASTC) {
                    loaded.decodeAstc();
                }
                for (let layer = 0; layer < LAYERS; layer++) {
                    for (let level = 0; level < LEVELS; level++) {
                        const pixel = loaded.getImage(level, layer, 0)[0];
                        assert.ok(Math.abs(pixel - layerValue(layer)) <= 2,
                            `layer ${layer} level ${level}: got ${pixel}, expected ${layerValue(layer)}`);
                    }
                }
            } finally {
                loaded.delete();
            }
        });
    }

    it("rejects an image of the wrong size", () => {
        assert.throws(() => createKtx2FromImages(factory, {
            baseWidth: SIZE, baseHeight: SIZE, vkFormat: VkFormat.R8G8B8A8_UNORM, numLayers: 2, isArray: true,
        }, [[new Uint8Array(SIZE * SIZE * 4)], [new Uint8Array(4)]]), /layer 1, mip 0/);
    });
});
