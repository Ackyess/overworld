# Frame material sources

The picture frames use high-quality 2K WebP versions of the diffuse, OpenGL
normal, and roughness maps from these Poly Haven materials:

- Dark Wood — https://polyhaven.com/a/dark_wood
- Wood Floor — https://polyhaven.com/a/wood_floor
- Wood Planks — https://polyhaven.com/a/wood_planks
- Dark Wooden Planks — https://polyhaven.com/a/dark_wooden_planks

Poly Haven publishes these assets under CC0:
https://polyhaven.com/license

The adjacent `.ktx2` files are 2048px ETC1S derivatives with complete mip
chains. Rebuild them with `scripts/build-frame-ktx2.ps1`; the WebP files remain
the editable local masters.
