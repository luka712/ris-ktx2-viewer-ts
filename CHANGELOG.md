# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-11-22

### Added

- **WebGPU**: switch between WebGL2 and WebGPU in the header.
- **Texture arrays**: convert several images into one KTX2 texture array, with a layer picker in the viewer.
- **Texture Format per texture**: pick sRGB or linear in the Inspector.
- Copy button for GPU info.

### Changed

- Display color space defaults to sRGB and only affects the screen output.
- Closing the Convert dialog keeps the conversion running.

### Fixed

- A failed encode shows an error instead of saving a broken file.
- An empty file name no longer saves a file called `.ktx2`.

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
