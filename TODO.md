- src/store/TextureStore.ts: The GPU texture is disposed on remove; the source image and KTX2 container are not.
- package.json: ris-framework `^0.3.0` and ris-ktx2 `^0.2.0` from the npm registry (single, deduped ris-ktx2).
- package.json: gl-matrix is imported directly (src/hooks/useFramework.ts, src/service/Ktx2Converter.ts) but not declared; it resolves only because npm hoists it as a ris-framework dependency. Add it as a direct dependency (same range as ris-framework, ^3.4.4).
- src/service/Ktx2Converter.ts: One worker per conversion reloads the libktx WASM each time. Consider a warm, reusable worker (pre-started when the Convert dialog opens; terminated after large jobs or when idle).
- src/service/Ktx2Converter.ts: Preparing the source (block-align resize, mip generation, reading pixels back via getBytesFromHtmlImage) still runs on the main thread; only the encode is in the worker. See the OffscreenCanvas step in docs/todo-worker-encoding.md.
- src/service/Ktx2Converter.ts: The main-thread fallback (worker unavailable) cannot be cancelled or interrupted mid-encode; the Cancel conversion button is disabled while it runs.
- src/service/Ktx2Encoder.ts: compressBasis / deflateZstd / deflateZlib return a KtxErrorCode that is ignored, so a failed encode is not reported. Check the codes and throw.
- src/service/formatter.ts: changeFileExtension ignores its `ext` argument (always writes .ktx2) and replaces the first occurrence of the old extension instead of the trailing one. The Convert dialog also allows an empty file name, which downloads as the hidden file `.ktx2`.
- tests/: the tests are not part of any tsconfig and there is no npm test script (run with `node --experimental-strip-types --test tests/<file>.test.ts`); vite.config.ts is not type-checked either.

## ASTC

- Display: ris-framework 0.3 uploads all 2D LDR ASTC block sizes (UNORM/SRGB) when the GPU has `WEBGL_compressed_texture_astc`; GPUs without ASTC (most desktops) show a clear error. Decoding to RGBA8 with ris-ktx2 `decodeAstc` as a fallback is not done yet.
- ASTC HDR mode is not offered (source is always 8-bit RGBA).
- Check compressAstc/decodeAstc results in a browser (not tested yet).

## sRGB output

- The Convert dialog's sRGB option sets the source to R8G8B8A8_SRGB (vs UNORM). ris-ktx2 0.2 has no separate OETF/transfer API; libktx carries the source format into the Basis DFD transfer function and ASTC_*_SRGB_BLOCK. Not verified on real output yet: the libktx build doesn't load in Node, so check in the browser (Footer "Color Space" shows sRGB/Linear for raw and ASTC files).
- Mipmaps are not gamma-correct for sRGB: ris-framework generateMipmapsAsync filters the encoded values (src/service/Ktx2Converter.ts TODO).
- Display: the Inspector Display switch (Linear | sRGB) picks the sRGB or linear variant of every texture format (ris-framework `renderer.colorSpace`); Basis sRGB is transcoded to the matching sRGB format.
- Info shows "—" for Basis file color space; ris-ktx2 0.2 exposes the supercompression scheme and DFD now, so this (and ETC1S vs UASTC) can be filled in.

## UI layout (uncommitted prototype)

- [ ] Viewport Fit / 1:1 / zoom: the framework has no 2D zoom/pan API (canvas is sized to the texture by useFramework; 3D has only the orbit camera). Add the buttons to `ViewportToolbar` once it exists.
- [ ] Convert dialog restructure (left: source/target, right: encoding options, sticky footer) — deferred.
- [ ] Mobile: Textures | Inspector are tabs under a 60vh canvas; consider a swipeable bottom sheet instead.
- [ ] Browser check of the new layout (light/dark, xs/sm/md/lg, collapsed panels, drop zone with toolbar on top).

- [ ] Display color space: the switch recreates all textures; a texture whose sRGB/linear variant fails to upload keeps its old format (logged to console only).

