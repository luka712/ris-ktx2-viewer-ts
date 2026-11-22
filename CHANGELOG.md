# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-22

### Added

- **WebGPU**: switch between WebGL2 and WebGPU in the header.
- **Texture arrays**: select several images and convert them to separate files or one KTX2 texture array, with a layer picker in the viewer.
- **GPU info**: supported formats and limits, with a copy button.
- Conversions run in the background and can be cancelled.
- Generate mipmaps on GPU works on WebGPU too.
- ASTC files now display on GPUs without ASTC support.
- Texture Format lists sRGB and linear versions of each format, per texture (images default to sRGB, KTX2 to the file's color space).

### Changed

- The Display color space switch (sRGB default, or Linear) now only sets the screen output; it no longer changes texture formats.

### Fixed

- sRGB images and textures now display with correct colors (no longer too dark).
- A failed encode now shows an error instead of saving a broken file.
- An empty file name no longer saves a file called `.ktx2`.
- Texture arrays with more layers than the GPU supports show a clear error.

### Known issues

- Mipmaps for sRGB images are slightly dark (not gamma-corrected).

## [0.2.0] - 2026-11-01

### Added

- **ASTC encoding**: all block sizes (4x4 to 12x12), with sRGB support.
- **PVRTC1 display** (RGBA and RGB) on GPUs that support it.
- **Color space switching**: view textures in Linear or sRGB, and an sRGB option when converting.
- Drag and drop files onto the viewer.
- Light and dark theme.
- Refreshed layout.
- The Convert dialog remembers your last options.

### Known issues

- ASTC files display only on GPUs with ASTC support (most desktop GPUs lack it); the converted file is still saved.

## [0.1.0]

- Initial release.

[0.3.0]: https://github.com/luka712/ris-ktx2-viewer-ts/compare/0.2.0...0.3.0
[0.2.0]: https://github.com/luka712/ris-ktx2-viewer-ts/compare/3994c6f...0.2.0
