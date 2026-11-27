# Studio — Browser IDE

Static, client-side code editor for GitHub Pages.

## Run
Open `index.html` through a static web host (recommended) or a local static file server. CDN access is required for CodeMirror and JSZip.

## Deploy to GitHub Pages
Commit the complete folder contents to a repository, then enable GitHub Pages for the desired branch and folder. Keep the relative asset paths unchanged.

## Notes
- Project data is stored in IndexedDB (LocalStorage fallback).
- The preview runs in a sandboxed iframe. Local CSS and JavaScript references are bundled from the project root.
- External CDN libraries require internet access.
- This is a browser IDE, not a secure execution environment for untrusted code. Preview code can make network requests allowed by the browser's normal policy.
