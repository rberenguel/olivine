# Olivine PWA Cleanup Plan

This document outlines the plan to remove the deprecated VS Code and Chrome Extension parts of the Olivine application, refactoring it into a pure Progressive Web App (PWA) with an optional remote backend.

## Part 1: Remove Deprecated Files and Configuration

1.  **Delete VS Code Files:**
    *   `extension.js` (VS Code entry point)
    *   `main.html` (VS Code webview)
    *   `.vscodeignore` (VS Code packaging manifest)
2.  **Delete Chrome Extension:**
    *   `chrome-extension/` directory.
3.  **Delete `package.json`:**
    *   The `package.json` file was solely for the VS Code extension and is no longer needed.

## Part 2: Refactor the File System Abstraction

1.  **Create a new File System Provider (`app/core/fs-provider.js`):**
    *   This new module will define a clear interface for all file operations (e.g., `getInitialFiles`, `readFile`, `writeFile`).
    *   It will contain the logic currently in `pwa/pwa-bridge.js` (using File System Access API and IndexedDB) for the `"local"` mode.
    *   It will also contain the logic for handling the `"remote"` mode by calling the `remoteBridge`.
2.  **Integrate the New Provider:**
    *   `app/main.js`: Will be updated to import and initialize the new `fs-provider.js` instead of the dynamic bridge loading.
    *   `app/core/files.js` (and any other module using `vscode-api.js`): Will be refactored to directly import and use the new `fs-provider.js`.
3.  **Delete Redundant Files:**
    *   `app/core/vscode-api.js`: This will be entirely replaced by the new provider.
    *   `pwa/pwa-bridge.js`: Its logic will be moved into the new `fs-provider.js`, so it can be deleted.
