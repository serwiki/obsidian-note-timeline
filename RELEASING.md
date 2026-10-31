# Releasing Note Timeline

1. Test in a disposable vault on supported platforms; confirm date recognition, preview, folder/file filter, activity log and settings. Mobile support is not yet verified.
2. Update `manifest.json` and `package.json` to the same semantic version (e.g. `0.2.1`).
3. When raising `minAppVersion`, update `versions.json` accordingly.
4. Run `npm install` and `npm run build`; inspect the generated `main.js`.
5. Commit and push source files and `manifest.json` to GitHub.
6. On GitHub, create a release whose tag is **exactly** the manifest version (e.g. `0.2.0`, **not** `v0.2.0`).
7. Attach **three separate files** as release assets: `main.js`, `manifest.json`, and `styles.css`.
8. Publish the release. To submit to the official directory, sign in at https://community.obsidian.md, connect GitHub, and submit your public repository.

The release assets must contain the **same build** as the release commit. The root README and LICENSE should also be present before submission.

Official submission guide: https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin
