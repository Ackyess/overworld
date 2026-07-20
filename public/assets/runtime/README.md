# Browser runtime assets

## Three.js

`three/` contains the module build used by the standalone island scene. It was
copied from the installed `three` package and is covered by the Three.js MIT
license.

## Draco

`draco/` contains the JavaScript and WebAssembly decoders used by
`DRACOLoader`. Google Draco is licensed under Apache License 2.0:
https://github.com/google/draco

These files are runtime dependencies, not source-scene content.

## Basis Universal

`basis/` contains the JavaScript and WebAssembly transcoder required by
Three.js `KTX2Loader`. Basis Universal is licensed under Apache License 2.0.
