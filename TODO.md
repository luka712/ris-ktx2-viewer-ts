- src/hooks/useFramework.ts: Framework.dispose() is a no-op (ris-framework), so the render loop cannot be stopped from this package. The hook reuses one framework per canvas (StrictMode remount) until dispose works; then dispose in the effect cleanup and drop the per-canvas map. A new canvas (e.g. viewport error-boundary retry, HMR) still starts a second framework/render loop.
- src/store/TextureStore.ts: The GPU texture is disposed on remove; the source image and KTX2 container are not.
- package.json: ris-framework is pinned to the published `^0.1.0-dev.9` (`next` tag; `latest` is still the broken 0.1.0-dev.4, so keep the explicit pin) and ris-ktx2 to `^0.2.0-dev.13` (`next` tag; see the ASTC section). The lockfile resolves both from the npm registry; there are no `file:` links to sibling checkouts.
- package.json: gl-matrix is imported directly (src/hooks/useFramework.ts, src/service/Ktx2Converter.ts) but not declared; it resolves only because npm hoists it as a ris-framework dependency. Add it as a direct dependency (same range as ris-framework, ^3.4.4).
- src/service/Ktx2Converter.ts: One worker per conversion reloads the libktx WASM each time. Consider a warm, reusable worker (pre-started when the Convert dialog opens; terminated after large jobs or when idle).
- src/service/Ktx2Converter.ts: Preparing the source (block-align resize, mip generation, reading pixels back via getBytesFromHtmlImage) still runs on the main thread; only the encode is in the worker. See the OffscreenCanvas step in docs/todo-worker-encoding.md.
- src/service/Ktx2Converter.ts: The main-thread fallback (worker unavailable) cannot be cancelled or interrupted mid-encode; the Cancel conversion button is disabled while it runs.
- src/service/Ktx2Encoder.ts: compressBasis / deflateZstd / deflateZlib return a KtxErrorCode that is ignored, so a failed encode is not reported. Check the codes and throw.
- src/service/formatter.ts: changeFileExtension ignores its `ext` argument (always writes .ktx2) and replaces the first occurrence of the old extension instead of the trailing one. The Convert dialog also allows an empty file name, which downloads as the hidden file `.ktx2`.
- tests/: the tests are not part of any tsconfig and there is no npm test script (run with `node --experimental-strip-types --test tests/<file>.test.ts`); vite.config.ts is not type-checked either.

## ASTC (ris-ktx2 0.2.0-dev.13)

- Two ris-ktx2 copies: the viewer uses 0.2.0-dev.13 (compressAstc), ris-framework 0.1.0 depends on `ris-ktx2 ^0.1.0`. The encoder (worker and main-thread fallback) only uses 0.2, and hands KTX2 bytes to the framework's 0.1 factory; textures in the store use `FrameworkKtx2Texture` (src/model/FrameworkKtx2.ts). Dedupe once ris-framework accepts ris-ktx2 0.2.
- Main bundle grew from ~3.2 MB to ~5.5 MB because both libktx builds are inlined. Fixes: dedupe (above), or make main-thread ris-ktx2 imports type-only and load the encoder factory with a dynamic import.
- Display: ris-framework 0.1 uploads non-Basis KTX2 as-is and maps only ASTC 4x4 UNORM (WebGL `WEBGL_compressed_texture_astc`). Other block sizes, or GPUs without ASTC (most desktops), show a clear error and the converted file is still downloaded, but it is not added to the list. Decode to RGBA8 for display with 0.2 `decodeAstc`, and/or add the other ASTC formats to the framework.
- ASTC HDR mode is not offered (source is always 8-bit RGBA).
- Check compressAstc/decodeAstc results in a browser (not tested yet).

## sRGB output

- The Convert dialog's sRGB option sets the source to R8G8B8A8_SRGB (vs UNORM). ris-ktx2 0.2 has no separate OETF/transfer API; libktx carries the source format into the Basis DFD transfer function and ASTC_*_SRGB_BLOCK. Not verified on real output yet: the libktx build doesn't load in Node, so check in the browser (Footer "Color Space" shows sRGB/Linear for raw and ASTC files).
- Mipmaps are not gamma-correct for sRGB: ris-framework generateMipmapsAsync filters the encoded values (src/service/Ktx2Converter.ts TODO).
- Display: raw sRGB uploads as RGBA_8_UNORM_SRGB. Basis sRGB is transcoded and uploaded with a UNORM format by ris-framework 0.1 (no sRGB decode, so it looks too bright/washed out). ASTC SRGB is blocked by the ASTC 4x4 UNORM-only check with a clear message. Needs sRGB format mapping in ris-framework.
- Footer shows "—" for Basis color space: ris-framework's ris-ktx2 0.1 does not expose the DFD transfer function.
