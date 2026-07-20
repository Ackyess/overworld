# Online runtime asset map

Only files referenced by `src/main.js`, the island scene, or an external glTF
dependency belong in this tree.

Full-quality editable inputs are stored outside the deploy tree in
`archives/picture-world-carousel-demo-local-source-2026-07-19.zip`.

## Worlds

| Order | Directory | Runtime payload |
| --- | --- | --- |
| 01 | `worlds/01-sponza/` | Self-contained Sponza GLB and license notes |
| 02 | `worlds/02-littlest-tokyo/` | Animated Littlest Tokyo GLB and CC BY attribution |
| 03 | `worlds/03-orbit/` | NASA ISS GLB and Earth texture maps |
| 04 | `worlds/04-marble-ceramic/` | User-supplied Gaussian splat |
| 05 | `worlds/05-marble-ceramic-02/` | User-supplied Gaussian splat |
| 06 | `worlds/06-moon-cove/` | Moon, coastal cliff, pine sapling, water/day-night scene inputs |
| 07 | `worlds/07-island-hike/` | Self-contained procedural low-poly HTML scene |

Each world keeps its source and license notes beside its payload. Online GLBs
use Draco geometry compression and textures no larger than 2K.

## Shared

- `shared/frame-materials/` — 2K WebP CC0 PBR maps used only by picture frames.
- `runtime/draco/` — Draco decoder required by compressed glTF assets.
- `runtime/three/` — vendored Three.js modules used by the iframe scene.

## Maintenance

- Add a source or license note with every new asset.
- Keep generated screenshots, audits, and `dist/` out of `public/assets/`.
- Remove a world directory only after removing its entry from `WORLDS`.
- Do not redistribute the two SPZ files until their upstream rights are recorded.
