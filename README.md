# ris-ktx2-viewer

Browser viewer for KTX2 textures. Load a PNG, JPEG, WebP, or KTX2 file, inspect its format and what this GPU supports, preview it in 2D or 3D, and convert an image to KTX2.

## What it does

- Add one or more files from the Files tab. PNG, JPEG, and WebP are decoded as images. `.ktx2` files are loaded as KTX2. A file whose name is already in the list is rejected.
- Select a texture in the list. Right-click it to remove it.
- Preview the selection on the canvas. **2D View** draws one mip level. **3D View** draws the texture on a quad with an orbit camera. Sampling is nearest or linear.
- Choose the GPU texture format. RGBA8 is always available. A Basis Universal texture (`needsTranscoding`, undefined Vulkan format) can also be shown as BC7, ASTC 4x4, BC3, or ETC2 when this GPU supports that format.
- Generate mipmaps when the texture is not a KTX2 file, or when its KTX2 data is `R8G8B8A8_UNORM`, or when the GPU format is RGBA8. In 2D View, pick which mip level to show when the texture has more than one.
- The footer shows resolution, mip count, and GPU memory. For a KTX2 file it also shows the Vulkan format name, "Universal Basis" when the file still needs transcoding, or an em dash when the format is undefined.
- GPU Info shows the GPU vendor and name, and whether S3TC (BC1–BC3), BPTC (BC6–BC7), ETC2, ASTC, and PVRTC compression are supported.
- Convert is enabled when the selection has decoded image data. It writes a KTX2 file and downloads it, then adds that file to the list. Encoding is uncompressed RGBA, Basis Universal UASTC, or Basis Universal ETC1S. UASTC and ETC1S have a quality setting. Mipmaps are optional. Zstandard or ZLib supercompression is available except for ETC1S. UASTC with supercompression also has an RDO quality setting.

## Packages

The viewer depends on these packages:

- [ris-framework](https://github.com/luka712/ris-framework-ts) — WebGL2 framework used to create the device, textures, materials, and render loop
- [ris-framework-api](https://github.com/luka712/ris-framework-api-ts) — shared framework types (`IFramework`, `TextureFormat`, samplers, and the rest)
- [ris-ktx2](https://github.com/luka712/ris-ktx2-ts) — KTX2 load, create, and Basis encode runtime
- [ris-ktx2-api](https://github.com/luka712/ris-ktx2-api-ts) — KTX2 types and enumerations such as `VkFormat`

`ris-framework` and `ris-ktx2` are direct dependencies. The app imports the two API packages as well; they are installed with those dependencies.

A browser with WebGL2 is required.

## Scripts

```sh
npm install
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Typecheck, then production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | Run ESLint |
