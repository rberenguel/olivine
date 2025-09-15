// --- Dynamic Bridge Loader ---
async function loadBridge() {
  const mode = window.__OLIVINE_MODE__ || "local";
  if (mode === "remote") {
    try {
      // Dynamically import the remote bridge module.
      // Its functions will be available for the new vscode-api.js to use.
      window.remoteBridge = await import("./remote-bridge.js");
      log.info("app-main", "Loaded remote bridge.");
      document.getElementById("open-vault-btn").style.display = "none";
    } catch (e) {
      log.error("app-main", "Failed to load remote bridge:", e);
      document.body.innerHTML = `<h1>Error</h1><p>Could not load the remote file bridge.</p>`;
    }
  } else {
    log.info("app-main", "Using local bridge (statically loaded).");
  }
}

import { createApp } from "./core/app.js";
import { initializeSidebar } from "./components/sidebar.js";
import extensionDirectories from "./extensions.js";
import { initializeCommands } from "./core/commands.js";

async function loadExtensions(app) {
  for (const path of extensionDirectories) {
    try {
      // 1. Fetch the manifest for the extension
      const manifestResponse = await fetch(`${path}/manifest.json`);
      const manifest = await manifestResponse.json();
      // 2. Check for a stylesheet and inject it if it exists
      if (manifest.style) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = `${path}/${manifest.style}`;
        document.head.appendChild(link);
      }

      // 3. Load the main JavaScript module
      if (manifest.main) {
        const module = await import(`${path}/${manifest.main}`);
        if (module.activate) {
          module.activate(app);
        }
      }
    } catch (e) {
      log.error("app-main", `Failed to load extension from ${path}:`, e);
    }
  }
}

// The rest of your main.js file remains the same...
document.addEventListener("DOMContentLoaded", async () => {
  // Load the correct bridge BEFORE initializing the app
  await loadBridge();

  const app = createApp();
  window.app = app;

  // --- NEW: Initialize the main layout resizer ---
  const contentWrapper = document.getElementById("content-wrapper");
  // Initial sizes: sidebar=250px, gutter=8px, main-content=1fr (fills rest)
  contentWrapper.style.gridTemplateColumns = "250px 8px 1fr";

  Split({
    columnGutters: [
      {
        track: 1, // The gutter is at track 1 (0=sidebar, 1=gutter, 2=main)
        element: document.getElementById("main-gutter"),
      },
    ],
  });
  // ---------------------------------------------
  initializeSidebar(app);
  initializeCommands(app);

  await loadExtensions(app);
  app.ui.createInitialPane();
  await app.workspace.initializeFileHandling();
});
