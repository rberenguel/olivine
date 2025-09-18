import { state } from "./state.js";
import { loadSidebarList } from "../components/sidebar.js";
import { MiniSearch, Transaction } from "CodeMirrorBundle";
import * as fs from "./fs-provider.js";
import { createEditor } from "../components/editor.js";

function buildFileTree(files) {
  const root = { children: [] };
  files.sort();

  for (const path of files) {
    const parts = path.split("/");
    let currentNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1 && part.endsWith(".md");
      const nodeName = isFile ? part.replace(".md", "") : part;

      let childNode = currentNode.children.find(
        (node) => node.name === nodeName,
      );

      if (!childNode) {
        if (isFile) {
          childNode = { type: "file", name: nodeName, path: path };
        } else {
          childNode = { type: "folder", name: nodeName, children: [] };
        }
        currentNode.children.push(childNode);
      }
      currentNode = childNode;
    }
  }
  return root.children;
}

export async function loadAndIndexNotes(files) {
  if (!files) return;

  const filteredFiles = files.filter(
    (path) => !path.split("/").some((part) => part.startsWith(".")),
  );

  const fileTree = buildFileTree(filteredFiles);
  loadSidebarList(fileTree);

  const mdFiles = filteredFiles.filter((path) => path.endsWith(".md"));

  // Process files sequentially to avoid resource exhaustion
  const documents = [];
  for (const path of mdFiles) {
    const content = await fs.readFile(path);
    documents.push({
      id: path,
      name: path.replace(".md", ""),
      text: content,
    });
  }

  state.allFilePaths = filteredFiles;

  state.fileSearchIndex = new MiniSearch({
    fields: ["name", "text"],
    storeFields: ["name"],
  });
  state.fileSearchIndex.addAll(documents);

  window.app.refreshPalette();
}

export async function createNewFile(filename, params = {}) {
  const untitledRegex = /^(?:.*\/)?Untitled (\d+)\.md$/;
  const existingNumbers = state.allFilePaths
    .map((path) => {
      const match = path.match(untitledRegex);
      return match ? parseInt(match[1], 10) : null;
    })
    .filter((num) => num !== null);

  let nextNum = 1;
  while (existingNumbers.includes(nextNum)) {
    nextNum++;
  }

  const newFilename = filename || `Untitled ${nextNum}.md`;

  try {
    await fs.createNewFile(newFilename);
    await initializeFileHandling();
    if (params.open) {
      console.log(state.activePane);
      if (!state.activePane.editorView) {
        state.activePane.editorView = createEditor(
          state.activePane.contentContainer,
          "",
        ).editorView;
      }
      await openFile(newFilename, state.activePane);
    }
  } catch (error) {
    console.error("Error creating new file:", error);
  }
}

export async function renameFile(oldPath, newName) {
  if (!newName.endsWith(".md")) {
    newName += ".md";
  }

  const pathParts = oldPath.split("/");
  pathParts.pop(); // remove old filename
  const newPath = [...pathParts, newName].join("/");

  try {
    await fs.renameFile(oldPath, newPath);
    // TODO: refresh the file list in the sidebar more smartly.
    return newPath;
  } catch (error) {
    console.error("Error renaming file:", error);
    return null;
  }
}

export async function saveFile(path, content) {
  try {
    await fs.writeFile(path, content);
  } catch (error) {
    console.error("Error saving file:", error);
  }
}

export async function openFile(filename, pane) {
  if (!pane) return;
  console.log(pane);
  try {
    const content = await fs.readFile(filename);
    pane.filePath = filename;
    if (pane.titleElement) {
      pane.titleElement.textContent = filename.split("/").pop();
    }

    pane.editorView.dispatch({
      changes: {
        from: 0,
        to: pane.editorView.state.doc?.length || 0, // For empty editors
        insert: content,
      },
      annotations: Transaction.addToHistory.of(false),
    });

    document.querySelectorAll("#notes-list li").forEach((li) => {
      li.classList.toggle("active", li.dataset.filename === filename);
    });
  } catch (error) {
    console.error(`Error opening ${filename}:`, error);
  }
}

export function findFileByTitle(title) {
  const normalizedTitle = title.toLowerCase();
  return state.allFilePaths.find(
    (path) =>
      path.toLowerCase().endsWith(`/${normalizedTitle}.md`) ||
      path.toLowerCase() === `${normalizedTitle}.md`,
  );
}

export async function initializeFileHandling() {
  try {
    const files = await fs.getInitialFiles();
    await loadAndIndexNotes(files);
  } catch (e) {
    console.error("Error getting initial files", e);
  }
}

export function saveActiveFile(app) {
  const pane = app.workspace.getActivePane();
  if (!pane || !pane.filePath) {
    log.info("files", "No active file to save.");
    return;
  }

  const content = pane.editorView.state.doc.toString();
  saveFile(pane.filePath, content);
  app.events.emit("file:saved", { path: pane.filePath });
  log.info("files", `File saved: ${pane.filePath}`);
}
