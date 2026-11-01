# TODO: Move KTX2 encoding to a Web Worker

Goal: keep the UI responsive during convert. Encode stays the same speed; it just leaves the main thread.

## Feasibility

Yes. `compressBasis` and the rest of the libktx pipeline can run in a worker. A probe on the box confirmed that.

Blocker today: `ris-ktx2` loads libktx with `document.createElement('script')` and `window.LIBKTX`, so a plain worker fails with `document is not defined`.

Workaround (viewer-only): at the top of the worker, set `self.window = self` and a stub `document` whose `head.appendChild` fetches the script URL, runs it with `eval`, and calls `onload`. Relies on `ris-ktx2` internals and `eval` (no CSP on `index.html` today).

Proper fix (sibling package, later): teach `ris-ktx2` to load without the DOM, or ship libktx as an ES module. Then drop the shim.

## What stays on the main thread

- Download (`downloadKtx2` needs the DOM)
- GPU upload: `createFromKtx2` / WebGL transcode
- Opening the file picker and wiring the Convert dialog

## What moves into the worker

- Block-align / resize / mip generation (rewrite with `OffscreenCanvas`; do **not** import `ris-framework`)
- `ktx2Factory.create`, `setImageFromMemory`, `compressBasis`, deflate, `writeToMemory`
- Always `.slice()` the WASM output before posting. The view points into the whole heap; transferring that buffer breaks libktx, and posting without slice copies megabytes.

## Steps

1. **Vite** — set `worker: { format: 'es' }` in `vite.config.ts`. Create the worker with:
   `new Worker(new URL('./ktx2Convert.worker.ts', import.meta.url), { type: 'module' })`.
2. **Worker** — `src/worker/ktx2Convert.worker.ts`: apply the shim (until `ris-ktx2` is fixed), `new Ktx2Factory().initializeAsync()` once, then port the core of `convertToKtx2Async` using OffscreenCanvas (no PNG round-trip). Import only `ris-ktx2` / `ris-ktx2-api`, never `ris-framework`.
3. **Input** — on the main thread, `createImageBitmap(...)` (prefer `premultiplyAlpha: 'none'`, `colorSpaceConversion: 'none'`) and transfer the bitmap. Later option: keep the original `File` on the texture container and decode in the worker.
4. **Client** — `src/service/Ktx2ConvertClient.ts`: lazy worker, request id → Promise of `{ bytes, fileName }`. Cancel with `worker.terminate()` and create a fresh worker next time (`compressBasis` cannot be interrupted mid-call). Fallback to today’s main-thread `convertToKtx2Async` if `Worker` / `OffscreenCanvas` is missing or init fails.
5. **After convert** — `downloadKtx2(bytes, fileName)`, then `fw.ktx2Factory.createFromBuffer(bytes)` (pass `Uint8Array`, not bare `ArrayBuffer`), then existing `createFromKtx2` → `addTexture`. Zstd-compressed output reloads fine, so the pre-compress `createCopy` can go.
6. **ConvertDialog** — keep Cancel enabled while converting and wire it to `client.cancel()`. Optional step-level progress.

## Message protocol

Main → worker:

- `{ type: 'init' }` (optional warm-up)
- `{ type: 'convert', id, source: ImageBitmap, width, height, fileName, params }` transferring `[source]`

Worker → main:

- `{ type: 'ready' }` / `{ type: 'initError', message }`
- `{ type: 'progress', id, stage, level?, levels? }` — stages only (`prepare` | `resize` | `mipmaps` | `upload` | `encode` | `deflate` | `write`); no % inside encode
- `{ type: 'done', id, bytes: Uint8Array, fileName, width, height, numLevels }` transferring `[bytes.buffer]`
- `{ type: 'error', id, message, stack? }`

Cancel is `terminate()` on the main thread, not a message.

## Risks

- Shim breaks if `ris-ktx2`’s loader changes; needs `eval`
- Two WASM instances (viewer + worker); npm build inlines ~2.3 MB of WASM into the worker bundle
- WASM memory never shrinks — terminate the worker after large jobs or when idle
- Module workers: Firefox 114+; 2D OffscreenCanvas: Safari 16.4+
- Effort: about 1–2 days in the viewer; proper `ris-ktx2` loader fix is a small extra change in that package

## Related bugs to fix while moving

- Block-align check in `Ktx2Converter.ts` compares UASTC to itself twice, so ETC1S is never block-aligned
- Mip count is only computed inside the “needs resize” branch, so Generate Mipmaps often does nothing
- `Framework.initialize()` does not await `ktx2Factory.initializeAsync()` (sibling package)
