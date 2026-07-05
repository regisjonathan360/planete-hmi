# Tech

## Stack

The project is a **web frontend** in its early stages. No build tooling, package manager, or framework has been committed yet — only static brand and image assets exist so far.

What is known from configuration:

- **Target runtime**: browser (Chrome debug configuration in `.vscode/launch.json`).
- **Local dev server**: expected at `http://localhost:8080` with `webRoot` set to the workspace root.
- **Assets**: SVG (vector logos), PNG (raster originals), and WebP (optimized delivery).

## Asset formats

- **Logos/icons**: `.svg` (preferred, scalable) with `.png` fallbacks.
- **Photography / backgrounds / covers**: `.png` originals plus `.webp` optimized versions.
- Some files carry doubled extensions (e.g. `*.png.png`, `*.webp.webp`) — treat the final extension as authoritative and avoid propagating this pattern to new files.

## Common commands

No build/test/lint scripts are defined yet. To preview locally, serve the workspace root on port 8080, for example:

```bash
# Any static server pointing at the workspace root on port 8080
npx http-server . -p 8080
# or
python -m http.server 8080
```

Then launch the "Lancer Chrome en utilisant localhost" debug configuration.

## Guidance for adding tooling

- When introducing a stack (bundler, framework, package manager), keep the dev server on **port 8080** so it stays consistent with the existing debug config, or update `launch.json` accordingly.
- Keep new source code separate from the `brand/` and `image/` asset directories.
- Reference optimized `.webp` assets in the UI; keep originals for source.
