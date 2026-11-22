/**
 * GPU info: per-family format support and the plain-text summary (GPU info "Copy").
 *
 * Run: node --experimental-strip-types --test tests/gpuInfo.test.ts
 */
import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {GpuBackend, TextureFormat} from "ris-framework";
import {backendLabel, formatFamilySupport, formatGpuSummary, type GpuFeatureSource} from "../src/service/gpuInfo.ts";

function features(supported: TextureFormat[], flags: Partial<GpuFeatureSource> = {}): GpuFeatureSource {
    return {
        supportsTextureCompressionS3TC: true,
        supportsTextureCompressionBC: true,
        supportsTextureCompressionETC2: false,
        supportsTextureCompressionASTC: true,
        supportsTextureCompressionPVRTC: false,
        supportsTextureFormat: (format) => supported.includes(format),
        ...flags,
    };
}

describe("formatFamilySupport", () => {
    it("uses the flag and refines with supportsTextureFormat", () => {
        const families = formatFamilySupport(features([
            TextureFormat.BC1_RGB_UNORM, TextureFormat.BC3_RGBA_UNORM, TextureFormat.BC7_RGBA_UNORM, TextureFormat.BC7_RGBA_UNORM_SRGB,
            TextureFormat.ASTC_4X4_UNORM,
        ]));
        const byId = Object.fromEntries(families.map((family) => [family.id, family]));
        assert.deepEqual(byId.s3tc.formatCount, {supported: 2, total: 2});
        assert.equal(byId.s3tc.srgb, false);
        assert.equal(byId.bptc.srgb, true);
        assert.equal(byId.etc2.supported, false);
        assert.deepEqual(byId.astc.formatCount, {supported: 1, total: 14});
        assert.equal(byId.pvrtc.srgb, null);
    });

    it("treats a throwing supportsTextureFormat as unsupported", () => {
        const families = formatFamilySupport(features([], {supportsTextureFormat: () => { throw new Error("x"); }}));
        assert.equal(families.find((family) => family.id === "s3tc")?.formatCount.supported, 0);
    });
});

describe("formatGpuSummary", () => {
    it("lists device, backend, families and skips missing limits", () => {
        const text = formatGpuSummary({
            name: "Test GPU", vendor: "ACME", backend: backendLabel(GpuBackend.WEB_GL), apiVersion: "WebGL 2.0",
            families: formatFamilySupport(features([TextureFormat.BC1_RGB_UNORM])), limits: null,
        }, "UA/1");
        assert.match(text, /^GPU: Test GPU\nVendor: ACME\nBackend: WebGL2 \(WebGL 2\.0\)/);
        assert.match(text, /BC1–BC3 \(S3TC \/ DXT\): supported \(1\/2 formats, sRGB no\)/);
        assert.match(text, /ETC2 \(ETC2 \/ EAC\): not supported/);
        assert.doesNotMatch(text, /Limits/);
        assert.match(text, /User agent: UA\/1$/);
    });

    it("lists all graphicsDevice limits", () => {
        const text = formatGpuSummary({
            name: "Test GPU", vendor: "ACME", backend: backendLabel(GpuBackend.WEB_GPU), apiVersion: "WebGPU",
            families: formatFamilySupport(features([TextureFormat.BC1_RGB_UNORM])),
            limits: [
                {label: "Max 2D texture size", value: "16384"},
                {label: "Max 3D texture size", value: "2048"},
                {label: "Max texture array layers", value: "256"},
                {label: "Max uniform buffer binding size", value: "65536 bytes"},
                {label: "Max anisotropy", value: "16"},
            ],
        });
        assert.match(text, /Limits:/);
        assert.match(text, /Max 2D texture size: 16384/);
        assert.match(text, /Max 3D texture size: 2048/);
        assert.match(text, /Max texture array layers: 256/);
        assert.match(text, /Max uniform buffer binding size: 65536 bytes/);
        assert.match(text, /Max anisotropy: 16/);
    });
});
