const idbStore = {
  db: null,
  async getDb() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("olivine-db", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("keyval");
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    const db = await this.getDb();
    return new Promise((resolve) => {
      const tx = db.transaction("keyval", "readonly");
      const store = tx.objectStore("keyval");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
    });
  },
  async set(key, value) {
    const db = await this.getDb();
    const tx = db.transaction("keyval", "readwrite");
    const store = tx.objectStore("keyval");
    store.put(value, key);
    return tx.done;
  },
};

window.idbStore = idbStore;

window.idbStore.getDb();

const log = {
  // Color configuration for different log levels
  _colors: {
    info: "#00c", // Blue
    warn: "#c60", // Amber
    error: "#c00", // Red
  },

  /**
   * The core logging function.
   * @param {string} level - The log level ('info', 'warn', 'error').
   * @param {string} system - The name of the system/module logging the message.
   * @param {*} message - The message or object to log.
   */
  _log: function (level, system, message) {
    const color = this._colors[level] || "#6B7280"; // Default to gray
    const systemStyle = `
            color: #ccc; 
            background-color: ${color}; 
            padding: 2px 6px; 
            border-radius: 4px; 
            font-weight: bold;
          `;
    console.log(`%c${system}`, systemStyle, message);
  },

  /**
   * Logs an informational message.
   * @param {string} system - The system name.
   * @param {*} message - The message.
   */
  info: function (system, message) {
    this._log("info", system, message);
  },

  /**
   * Logs a warning message.
   * @param {string} system - The system name.
   * @param {*} message - The message.
   */
  warn: function (system, message) {
    this._log("warn", system, message);
  },

  /**
   * Logs an error message.
   * @param {string} system - The system name.
   * @param {*} message - The message.
   */
  error: function (system, message) {
    this._log("error", system, message);
  },
};

if (window.__OLIVINE_MODE__ !== "remote") {
  let directoryHandle;
  let fileHandles = new Map();
  let initialFilesRequest = null;

  async function verifyPermission(handle) {
    const options = { mode: "readwrite" };
    // Check if permission was already granted
    if ((await handle.queryPermission(options)) === "granted") {
      return true;
    }
    // Request permission if it wasn't granted
    if ((await handle.requestPermission(options)) === "granted") {
      return true;
    }
    // Permission not granted
    return false;
  }

  // 1. Mock the VS Code API
  const vscode = {
    postMessage: (message) => {
      console.log("Message from App:", message);
      switch (message.type) {
        case "getInitialFiles":
          initialFilesRequest = { requestId: message.requestId };
          break;
        case "writeFile":
          saveFile(message.payload.path, message.payload.content);
          break;
        case "readFile":
          readFileAndRespond(message.payload.path, message.requestId);
          break;
      }
    },
    getState: () => ({}),
    setState: (state) => console.log("Setting state:", state),
  };
  window.acquireVsCodeApi = () => vscode;

  // 2. NEW: Recursive File System Traversal
  async function getFilesRecursively(dirHandle, path = "") {
    const files = [];
    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith(".")) {
        continue; // Skip hidden files and folders
      }
      const entryPath = path ? `${path}/${entry.name}` : entry.name;
      if (entry.kind === "file" && entry.name.endsWith(".md")) {
        fileHandles.set(entryPath, entry);
        files.push(entryPath);
      } else if (entry.kind === "directory") {
        const subFiles = await getFilesRecursively(entry, entryPath);
        files.push(...subFiles);
      }
    }
    return files;
  }

  // 3. Updated File System Access Logic
  async function openVault() {
    if (!initialFilesRequest) {
      console.warn("Vault request not ready.");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker();
      directoryHandle = handle;

      // Save the handle to IndexedDB for next time
      await idbStore.set("directoryHandle", handle);

      await loadFilesFromHandle(handle);
    } catch (e) {
      console.error("Error opening vault:", e);
    }
  }

  async function loadFilesFromHandle(handle) {
    fileHandles.clear();
    const files = await getFilesRecursively(handle);
    window.dispatchEvent(
      new MessageEvent("message", {
        data: {
          requestId: initialFilesRequest.requestId,
          payload: files,
        },
      }),
    );
    initialFilesRequest = null;
  }

  async function loadInitialVault() {
    const handle = await idbStore.get("directoryHandle");

    if (handle && initialFilesRequest) {
      if (await verifyPermission(handle)) {
        console.log("Restoring vault access from saved handle.");
        directoryHandle = handle;
        await loadFilesFromHandle(handle);
      } else {
        console.log("Saved handle found, but permission was denied.");
      }
    }
  }

  async function readFileAndRespond(filePath, requestId) {
    try {
      const handle = fileHandles.get(filePath);
      if (!handle) throw new Error(`File handle not found for ${filePath}`);
      const file = await handle.getFile();
      const content = await file.text();

      window.dispatchEvent(
        new MessageEvent("message", {
          data: { requestId: requestId, payload: content },
        }),
      );
    } catch (e) {
      console.error("Error reading file:", e);
      window.dispatchEvent(
        new MessageEvent("message", {
          data: { requestId: requestId, error: e.message },
        }),
      );
    }
  }

  async function saveFile(filePath, content) {
    try {
      // To save, we need to get the handle again, which might involve traversing
      let currentHandle = directoryHandle;
      const parts = filePath.split("/");
      const fileName = parts.pop();

      for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part);
      }

      const fileHandle = await currentHandle.getFileHandle(fileName, {
        create: true,
      });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      console.log(`${filePath} saved.`);
    } catch (e) {
      console.error("Error saving file:", e);
    }
  }

  // 4. Hook up the UI button
  window.addEventListener("DOMContentLoaded", () => {
    document
      .getElementById("open-vault-btn")
      .addEventListener("click", openVault);

    // We need to wait for the app to be ready to receive files
    const originalPostMessage = vscode.postMessage;
    vscode.postMessage = (message) => {
      if (message.type === "getInitialFiles") {
        initialFilesRequest = { requestId: message.requestId };
        // Now that the app is ready, try to load the saved vault
        loadInitialVault();
      }
      originalPostMessage(message);
    };
  });
}
