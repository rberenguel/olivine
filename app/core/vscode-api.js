// This module acts as a router to the correct file system implementation.

// --- PWA/Local Mode Implementation ---
function getPwaApi() {
  // This function lazy-loads the VS Code API from the PWA bridge.
  // It's only called when we are in 'local' mode.
  const vscode = acquireVsCodeApi();

  function sendMessage(type, payload) {
    return new Promise((resolve, reject) => {
      const requestId = Math.random().toString(36).substr(2, 9);
      const listener = (event) => {
        const message = event.data;
        if (message.requestId === requestId) {
          window.removeEventListener("message", listener);
          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve(message.payload);
          }
        }
      };
      window.addEventListener("message", listener);
      vscode.postMessage({ type, requestId, payload });
    });
  }

  return {
    getInitialFiles: () => sendMessage("getInitialFiles"),
    readFile: (path) => sendMessage("readFile", { path }),
    writeFile: (path, content) => sendMessage("writeFile", { path, content }),
    createNewFile: (path) => sendMessage("createNewFile", { path }),
    renameFile: (oldPath, newPath) =>
      sendMessage("renameFile", { oldPath, newPath }),
  };
}

// --- API Router ---

let api;

async function getApi() {
  if (api) {
    return api;
  }

  const mode = window.__SILEX_MODE__ || "local";

  if (mode === "remote") {
    // The remote bridge is loaded into the window object by main.js
    if (!window.remoteBridge) {
      throw new Error("Remote bridge not loaded!");
    }
    api = window.remoteBridge;
    return api;
  } else {
    api = getPwaApi();
    return api;
  }
}

// --- Exported Functions ---

export async function getInitialFiles() {
  const implementation = await getApi();
  return implementation.getInitialFiles();
}

export async function readFile(path) {
  const implementation = await getApi();
  return implementation.readFile(path);
}

export async function writeFile(path, content) {
  const implementation = await getApi();
  return implementation.writeFile(path, content);
}

export async function createNewFile(path) {
  const implementation = await getApi();
  return implementation.createNewFile(path);
}

export async function renameFile(oldPath, newPath) {
  const implementation = await getApi();
  return implementation.renameFile(oldPath, newPath);
}
