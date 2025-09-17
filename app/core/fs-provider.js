// app/core/fs-provider.js

let directoryHandle;
let fileHandles = new Map();
let remoteBridge = null;
let initialFileList = []; // Variable to store the initial file list

async function verifyPermission(handle) {
  const options = { mode: "readwrite" };
  if ((await handle.queryPermission(options)) === "granted") {
    return true;
  }
  if ((await handle.requestPermission(options)) === "granted") {
    return true;
  }
  return false;
}

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

async function loadFilesFromHandle(handle) {
  fileHandles.clear();
  return getFilesRecursively(handle);
}

async function initializeLocalFs() {
  const handle = await idbStore.get("directoryHandle");
  if (handle) {
    if (await verifyPermission(handle)) {
      console.log("Restoring vault access from saved handle.");
      directoryHandle = handle;
      return loadFilesFromHandle(handle);
    } else {
      console.log("Saved handle found, but permission was denied.");
    }
  }
  return [];
}

async function openVault() {
  const handle = await window.showDirectoryPicker();
  directoryHandle = handle;
  await idbStore.set("directoryHandle", handle);
  return loadFilesFromHandle(handle);
}

// --- Public API ---

export async function initialize() {
  const mode = window.__OLIVINE_MODE__ || "local";
  if (mode === "remote") {
    try {
      const bridge = await import("../remote-bridge.js");
      remoteBridge = bridge;
      document.getElementById("open-vault-btn").style.display = "none";
      initialFileList = await remoteBridge.getInitialFiles();
    } catch (e) {
      console.error("Failed to load remote bridge:", e);
      document.body.innerHTML = `<h1>Error</h1><p>Could not load the remote file bridge.</p>`;
      initialFileList = [];
    }
  } else {
    document
      .getElementById("open-vault-btn")
      .addEventListener("click", async () => {
        const files = await openVault();
        // This is a bit of a hack. We need to reload the file list in the sidebar.
        // A more robust solution would be to have a proper event system.
        window.app.workspace.setFileList(files);
      });
    initialFileList = await initializeLocalFs();
  }
}

export function getInitialFiles() {
  return initialFileList;
}

export async function readFile(path) {
  if (remoteBridge) {
    return remoteBridge.readFile(path);
  }

  const handle = fileHandles.get(path);
  if (!handle) throw new Error(`File handle not found for ${path}`);
  const file = await handle.getFile();
  return file.text();
}

export async function writeFile(path, content) {
  if (remoteBridge) {
    return remoteBridge.writeFile(path, content);
  }

  try {
    let currentHandle = directoryHandle;
    const parts = path.split("/");
    const fileName = parts.pop();

    for (const part of parts) {
      currentHandle = await currentHandle.getDirectoryHandle(part, {
        create: true,
      });
    }

    const fileHandle = await currentHandle.getFileHandle(fileName, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(content);
    await writable.close();
  } catch (e) {
    console.error("Error saving file:", e);
    throw e; // Re-throw the error to be handled by the caller
  }
}

export async function createNewFile(path) {
  return writeFile(path, "");
}

export async function renameFile(oldPath, newPath) {
  if (remoteBridge) {
    return remoteBridge.renameFile(oldPath, newPath);
  }

  const content = await readFile(oldPath);
  await writeFile(newPath, content);

  // Delete the old file
  let currentHandle = directoryHandle;
  const parts = oldPath.split("/");
  const fileName = parts.pop();

  for (const part of parts) {
    currentHandle = await currentHandle.getDirectoryHandle(part);
  }
  await currentHandle.removeEntry(fileName);
}
