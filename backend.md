# Plan: Implement a Hybrid Local/Remote File Backend

The goal is to allow the application to run in two modes without changing the core application logic:
1.  **Local Mode (Current):** Uses the browser's File System Access API via `pwa-bridge.js`.
2.  **Remote Mode (New):** Communicates with a Go backend for all file operations via a new `remote-bridge.js`.

The core principle is that the main application (`files.js`, `editor.js`, etc.) remains completely unaware of which mode it's in. It will always just call the functions in `vscode-api.js`.



---

### Phase 1: Create the "Remote Bridge" Adapter

This new file will be a sibling to `pwa-bridge.js`. Its job is to implement the same functions but by making network requests to your Go backend.

**Create a new file: `remote-bridge.js`**
```javascript
// remote-bridge.js

// This file implements the same API as pwa-bridge.js, but with fetch calls.

// 1. We still need to mock the VS Code API for the app to initialize.
const vscode = {
  postMessage: (message) => {
    // We can use postMessage to trigger the initial file load.
    if (message.type === 'getInitialFiles') {
      getFilesAndRespond(message.requestId);
    }
    // Other messages can be ignored or handled as needed.
  },
  getState: () => ({}),
  setState: (state) => {},
};
window.acquireVsCodeApi = () => vscode;

// 2. A helper to make API calls to our Go backend.
async function apiFetch(endpoint, options = {}) {
  const response = await fetch(`/api/${endpoint}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error (${response.status}): ${errorText}`);
  }
  return response.json();
}

// 3. Implement the file system functions.

async function getFilesAndRespond(requestId) {
  try {
    const files = await apiFetch('files');
    window.dispatchEvent(new MessageEvent("message", {
      data: { requestId, payload: files },
    }));
  } catch (e) {
    console.error("Error getting initial files from remote:", e);
    window.dispatchEvent(new MessageEvent("message", {
      data: { requestId, error: e.message },
    }));
  }
}

// In this bridge, the functions exported from vscode-api.js will
// call these handlers internally. We will need to slightly modify
// vscode-api.js to support this, or replace its content with this bridge.
// For now, let's assume we create a new file `api.js` that `files.js` imports.

// This would be the content of the new `api.js` when in remote mode.
export function getInitialFiles() {
  return apiFetch('files');
}

export function readFile(path) {
  return apiFetch(`files/read?path=${encodeURIComponent(path)}`);
}

export function writeFile(path, content) {
  return apiFetch('files/write', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, content }),
  });
}

export function createNewFile(path) {
  return apiFetch('files/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
}

export function renameFile(oldPath, newPath) {
  return apiFetch('files/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ oldPath, newPath }),
  });
}
```

---

### Phase 2: Define the Go Backend API

Your Go server will need to serve the PWA's static files (`index.html`, etc.) and also expose a simple JSON API for these file operations.

**Required API Endpoints:**

-   `GET /api/files`:
    -   **Action:** Scan the vault directory and return all `.md` file paths.
    -   **Response Body:** `["file1.md", "folder/file2.md"]`

-   `GET /api/files/read?path=<filepath>`:
    -   **Action:** Read the content of the specified file.
    -   **Response Body:** `{ "content": "File content here..." }`

-   `POST /api/files/write`:
    -   **Action:** Write content to a file.
    -   **Request Body:** `{ "path": "file.md", "content": "New content" }`
    -   **Response Body:** `{ "success": true }`

-   `POST /api/files/create`:
    -   **Action:** Create a new, empty file.
    -   **Request Body:** `{ "path": "new-note.md" }`
    -   **Response Body:** `{ "success": true }`

-   `POST /api/files/rename`:
    -   **Action:** Rename or move a file.
    -   **Request Body:** `{ "oldPath": "old.md", "newPath": "new.md" }`
    -   **Response Body:** `{ "success": true }`

---

### Phase 3: Implement the Runtime Switch

The final step is to tell the browser which bridge to load. The cleanest way is to have the Go server inject a global variable when it serves the `index.html` file.

1.  **Modify `index.html` to include a runtime configuration script:**
    ```html
    <!-- index.html -->
    <head>
      <!-- ... other head elements ... -->
      <script>
        // This global variable will be set by the Go server template.
        // If it's not set, we default to 'local' PWA mode.
        window.__SILEX_MODE__ = '{{ .SilexMode }}' || 'local';
      </script>
      <!-- ... importmap and stylesheets ... -->
    </head>
    <body>
      <!-- ... app container ... -->
      
      <!-- REMOVE the static script tag for pwa-bridge.js -->
      <!-- <script src="pwa-bridge.js"></script> -->
      <script type="module" src="../app/main.js"></script>
    </body>
    ```
    *(Here, `{{ .SilexMode }}` is a placeholder for a Go template variable.)*

2.  **Add a dynamic loader script at the top of `app/main.js`:**
    This script will check the global variable and load the correct bridge *before* the rest of the app initializes.

    ```javascript
    // app/main.js

    // --- Dynamic Bridge Loader ---
    async function loadBridge() {
      const mode = window.__SILEX_MODE__ || 'local';
      const bridgePath = mode === 'remote' ? './remote-bridge.js' : './pwa-bridge.js';
      
      try {
        await import(bridgePath);
        console.log(`Loaded ${mode} bridge.`);
      } catch (e) {
        console.error(`Failed to load bridge for mode: ${mode}`, e);
      }
    }
    
    // --- Main App Initialization ---
    document.addEventListener("DOMContentLoaded", async () => {
      // Load the correct bridge BEFORE initializing the app
      await loadBridge();

      // The rest of the app initialization is unchanged
      createInitialPane();
      initializeSidebar();
      initializeCommands();
      initializeFileHandling();
      // ...
    });
    ```
    *Note: The path to the bridge might need adjustment, e.g., `../pwa-bridge.js` depending on your final structure.*

With this setup, your application can seamlessly switch between local and remote file handling based on how it's served, all without changing a single line of your core application or extension code.