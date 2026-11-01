# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-11-01

Compared with 0.1.0 (`3994c6f`).

### Added

- Drop zone over the viewport for PNG, WebP and KTX2 files (hidden once an image is loaded).
- Top bar theme switch (Auto / Light / Dark), saved in localStorage.
- File size in the texture info.
- ASTC encoding (ris-ktx2 `compressAstc`) with block size, quality and mode, and a "Pad to block size" (block align) option for ASTC and Basis.
- "sRGB (color data)" option in the Convert dialog for RGBA, ETC1S, UASTC and ASTC output (off by default).
- Display color space switch (Linear | sRGB) in the Inspector, saved in localStorage; the viewer renders in Linear by default.
- PVRTC1 RGBA and RGB texture formats in the Inspector, offered only when the GPU supports PVRTC and disabled (with the reason) when the texture is not a square power of two.
- Convert dialog remembers the last used options (saved on Convert to `ris-ktx2-viewer.convertOptions`; validated on load, falling back to defaults per field) and has a "Reset to defaults" button.
- Mip level dropdown in the viewport toolbar.

### Changed

- UI layout rework: header actions, viewport toolbar (2D/3D, Linear/Nearest filter, mip level), Inspector panel (Info and Display), status bar, texture list, collapsible side panels on desktop and Textures | Inspector tabs on mobile.
- Label renames (for example "Uncompressed (RGBA8)", "Basis UASTC (higher quality)", "Basis ETC1S (smaller)", "Extra compression", "File color space").
- Uses ris-framework `^0.3.0` and ris-ktx2 `^0.2.0` from npm, with a single deduplicated ris-ktx2 shared by the framework and the encoder.
- 2D (mip inspection) and 3D (unlit quad with orbit camera) views are rendered through framework `Scene`s; the camera is a scene node instead of being passed to the material.
- Each viewport mount creates its own framework and disposes it on unmount (`Framework.dispose()`).
- The "Converting…" chip is hidden in portrait orientation, where it overlapped the header buttons.

### Fixed

- Textures disappearing after a resize across the layout breakpoint (the canvas, and with it the WebGL context, was recreated); textures are now re-uploaded to the new framework.
- ASTC block sizes that are not multiples of the image size (for example 10x5 without padding) now display, with the ris-framework 0.3 upload fix.

### Removed

- `reflect-metadata` (no longer needed by ris-framework).

### Known issues

- GPUs without ASTC (most desktops) cannot display ASTC files; the file is still downloaded. ASTC HDR is not offered.
- Mipmaps generated for sRGB output are not gamma-correct (filtered in encoded space).
- Switching the display color space recreates all textures; a texture whose sRGB/linear variant fails to upload keeps its old format (logged to the console only).
- No 2D zoom/pan (Fit / 1:1) yet.
- See [TODO.md](TODO.md) for the full list.

## [0.1.0]

- Initial release.

[0.2.0]: https://github.com/luka712/ris-ktx2-viewer-ts/compare/3994c6f...0.2.0
