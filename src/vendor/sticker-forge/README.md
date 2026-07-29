# Sticker Forge vendored runtime

This directory contains the browser runtime used by the homepage avatar.

- Source: https://github.com/CatsJuice/sticker-forge
- Commit: `a1b1853564651fb2fce4d8e637e751fc076066ad`
- Upstream entry: `lib/standalone.ts`
- SHA-256: `01ffc103f3a37fd29b2a3ca7012f1ccc1051e32b5538cba40a228f3ba3c2bc5f`

The ES module was built from the upstream library with `three` configured as a
Rollup external. Next.js therefore resolves it to this project's `three`
dependency instead of loading the separate copy included in the official
standalone bundles.

License texts for Sticker Forge and Three.js are included alongside the
runtime.
