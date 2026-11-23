- src/store/TextureStore.ts: The GPU texture is disposed on remove; the source image and KTX2 container are not.
- package.json: ris-framework `^0.4.0` and ris-ktx2 `^0.3.0` from the npm registry (single, deduped ris-ktx2).
- package.json: gl-matrix is imported directly (src/features/viewport/useFramework.ts, src/service/Ktx2Converter.ts) but not declared; it resolves only because npm hoists it as a ris-framework dependency. Add it as a direct dependency (same range as ris-framework, ^3.4.4).
- src/service/Ktx2Converter.ts: One worker per conversion reloads the libktx WASM each time. Consider a warm, reusable worker (pre-started when the Convert dialog opens; terminated after large jobs or when idle).
- src/service/Ktx2Converter.ts: Preparing the source (block-align resize, mip generation, reading pixels back via getBytesFromHtmlImage) still runs on the main thread; only the encode is in the worker. See the OffscreenCanvas step in docs/todo-worker-encoding.md.
- src/service/Ktx2Converter.ts: The main-thread fallback (worker unavailable) cannot be cancelled or interrupted mid-encode; the Cancel conversion button is disabled while it runs.
- tests/: the tests are not part of any tsconfig and there is no npm test script (run with `node --experimental-strip-types --test tests/<file>.test.ts`); vite.config.ts is not type-checked either.

## Next release (framework / ris-ktx2, see ai-guide/TODO-webgpu-framework.md)

- ris-framework: gamma-correct sRGB mipmaps in `generateMipmapsAsync`.
- ris-framework: `AComputePass.endPass` doesn't restore `graphicsDevice.currentComputePass` (possible WebGPU validation error).
- ris-framework: `WebGpuInfo` returns the literal "Unknown" (empty `adapter.info` on Firefox), so the viewer's GPU name/vendor fallbacks never apply.
- ris-ktx2: expose ETC1S vs UASTC; `numLayers` / `create` doc nit.

## ASTC

- Display: ris-framework uploads all 2D LDR ASTC block sizes (UNORM/SRGB) when the GPU has `WEBGL_compressed_texture_astc`; GPUs without ASTC (most desktops) decode to RGBA8 with ris-ktx2 `decodeAstc` for display, for 2D textures and arrays (src/service/textureResources.ts).
- ASTC HDR mode is not offered (source is always 8-bit RGBA).
- Check compressAstc/decodeAstc results in a browser (not tested yet).

## sRGB output

- The Convert dialog's sRGB option sets the source to R8G8B8A8_SRGB (vs UNORM). ris-ktx2 0.2 has no separate OETF/transfer API; libktx carries the source format into the Basis DFD transfer function and ASTC_*_SRGB_BLOCK. Not verified on real output yet: the libktx build doesn't load in Node, so check in the browser (Footer "Color Space" shows sRGB/Linear for raw and ASTC files).
- Mipmaps are not gamma-correct for sRGB: ris-framework generateMipmapsAsync filters the encoded values (src/service/Ktx2Converter.ts TODO; next framework release).
- Display: each texture has its own sRGB / linear format (Inspector Texture Format lists both variants of every format; PVRTC has none). Defaults: images RGBA8 sRGB, KTX2 the file's own color space (`oetf`, else `*_SRGB` vkFormat), Basis transcode targets in the matching variant. Stored as `ITexture2DContainer.textureColorSpace` and kept on backend switch / mipmaps. The Display switch (sRGB | Linear, default sRGB) only sets `renderer.outputColorSpace` (SRGB / NONE) and the clear color (0.8^2.2 under SRGB, 0.8 under NONE), live and at framework creation (src/service/outputColorSpace.ts). Persisted in localStorage (`ris-ktx2-viewer.displayColorSpace`; the old "FILE" value loads as sRGB). See guide/color-space.md.
- sRGB output precision (framework, next release, ai-guide/TODO-webgpu-framework.md #5): the main render target is RGBA8_UNORM (8-bit linear) and the encode is pow(1/2.2), not the sRGB curve, so very dark sRGB values are slightly lifted/banded compared to an image viewer. Not verified in a browser yet.
- Inspector "File color space" now reads the DFD transfer function (Basis too). ETC1S vs UASTC still needs ris-ktx2 (next release).

## UI layout (uncommitted prototype)

- [ ] Viewport Fit / 1:1 / zoom: the framework has no 2D zoom/pan API (canvas is sized to the texture by useFramework; 3D has only the orbit camera). Add the buttons to `ViewportToolbar` once it exists.
- [ ] Convert dialog restructure (left: source/target, right: encoding options, sticky footer) — deferred.
- [ ] Mobile: Textures | Inspector are tabs under a 60vh canvas; consider a swipeable bottom sheet instead.
- [ ] Browser check of the new layout (light/dark, xs/sm/md/lg, collapsed panels, drop zone with toolbar on top).



## Texture arrays (multi-select → separate files / one array)

- Encoding works for arrays with ris-ktx2 0.3.0 (`create` with `numLayers` + `isArray`, `setImageFromMemory(level, layer, 0, …)`): raw RGBA8, UASTC, ETC1S and ASTC, with per-layer mipmaps and Zstd/ZLib. Covered in Node by tests/Ktx2Encoder.textureArray.test.ts; not checked in a browser yet.
- Display (ris-framework 0.4.0): arrays are uploaded once with `textureFactory.createTexture2DArrayFromKtx2` (all layers and levels). 2D uses `InspectTextureArrayMaterial`, 3D uses `UnlitTextureArrayMaterial` (with the orbit camera), so the layer picker only sets the materials' `layer`. Layer count comes from the KTX2 `isArray` / `numLayers`. Works on WebGL2 and WebGPU.
  - Compressed arrays upload as-is (BC, ETC2, ASTC) where the device supports the format, on both backends. PVRTC can't be used for arrays (WebGL: TEXTURE_2D only; WebGPU: no PVRTC): the Inspector shows it disabled with the reason, and Basis on a GPU whose only transcode target is PVRTC is shown as RGBA8. ASTC array files on a GPU without ASTC are decoded to RGBA8 (`decodeAstc`).
  - "Generate mipmaps" is offered for single-level arrays shown as RGBA8 (createTexture2DArrayFromKtx2 `generateMipmaps`; the framework renders the chain on both backends).
  - `createFromKtx2` has no `generateMipmaps`; for 2D KTX2 files without mips the viewer transcodes to RGBA8 and uploads with `textureFactory.create(..., generateMipMaps: true)`.
- Layer order is picked in the Convert dialog (up/down buttons). Drag-and-drop reordering would be nicer.
- Layer limit: the Convert dialog warns when the layer count exceeds `graphicsDevice.limits.maxTextureArrayLayers` (the file is still saved), and uploading such an array fails with a clear error.
- Converting N layers prepares every layer (resize, mips, pixel read-back) on the main thread before the worker encodes, and holds all of them in memory at once.

## GPU info (header Info menu → GPU info)

- Format families are the framework's extension flags refined with `supportsTextureFormat` per format / sRGB variant. BC6H has no `TextureFormat` yet, so the BC6H/BC7 card counts BC7 only.
- src/components/ui/PropertyList.tsx (and ui/fields/TextBlockField.tsx) are no longer used after the GPU info redesign; remove them or reuse.

## Rendering backends (header WebGL2 | WebGPU switch)

- The switch (Info menu on narrow screens) is saved in localStorage `ris-ktx2-viewer.backend` (default WebGL2). WebGPU is disabled with the reason when `navigator.gpu` is missing or no adapter is available. ris-framework 0.4 has no fallback, so when WebGPU fails to start the viewer switches to WebGL2, saves it and shows the error (ViewerNotifications).
- A switch disposes the framework, creates a new one on a fresh canvas (a canvas keeps its first context type), re-points ris-ktx2 at the new WebGL2 context / GPUDevice (`initializeAsync({preinitializedWebGLContext | preinitializedGPUDevice})`) and re-uploads every texture (`moveTexturesToFramework`), keeping selection, mip, layer, view and color space. A format the new backend doesn't support (e.g. PVRTC on WebGPU) falls back to the framework's pick (KTX2) or RGBA8 (images). If re-uploading with mipmaps fails, the texture is re-uploaded without them (not restored when switching back).
- Conversions keep running across a switch (the worker encode and the CPU image processor don't use the GPU); the finished texture waits for the new framework before it is uploaded.
- Headless Chrome on Linux only presents WebGPU canvases with `--ozone-platform=headless --use-vulkan=swiftshader` (plus `--enable-unsafe-webgpu`); otherwise the device is destroyed on the first present.
