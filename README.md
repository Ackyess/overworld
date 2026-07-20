# Parallax Archive

An experimental Three.js gallery in which each picture frame acts as a fixed
window into a real-time 3D world.

[Live exhibition](https://parallax.leooo.fun/)

## Interaction

- Drag to move the viewing angle around the frame.
- Use the mouse wheel or a two-finger pinch to change viewing distance.
- On touch screens, drag with two fingers to change the viewing angle.
- Each world is loaded one at a time and released after viewing to keep GPU and
  memory usage predictable.

## Local development

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The generated static site is written to `dist/`.

## Project structure

- `src/main.js` — gallery lifecycle, portal camera mapping, interactions, and
  scene renderers.
- `style.css` — exhibition and transition presentation.
- `public/assets/worlds/` — runtime world assets and their provenance notes.
- `public/assets/shared/` — shared frame materials.
- `public/assets/runtime/` — vendored runtime decoders and licenses.

## Licensing

The original source code in this repository is licensed under the
[MIT License](LICENSE).

Bundled models, textures, Gaussian splats, and runtime dependencies are **not
automatically covered by the MIT license**. They retain their original licenses
and attribution requirements, documented beside each asset under
`public/assets/`. Assets without an explicit redistribution license are
provided only as part of this project; their public availability does not grant
reuse rights.

