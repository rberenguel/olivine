document.addEventListener("DOMContentLoaded", () => {
  // Global state
  let editorView;
  let notesDirectoryHandle;
  let currentlyOpenFileHandle;
  let allNoteCommands = [];
  let fileSearchIndex; // This will be our MiniSearch instance
  let allFilePaths = []; // A flat list of all file paths
  const staticCommands = [
    {
      title: "Toggle Sidebar",
      aliases: ["ui", "sidebar"],
    },
    {
      title: "Re-index Notes",
      aliases: ["rescan", "refresh"],
      lambda: () => loadAndIndexNotes(notesDirectoryHandle),
    },
  ];
  let saveTimeout;

  // Deconstruct modules from our bundle
  const {
    EditorState,
    EditorView,
    keymap,
    defaultKeymap,
    markdown,
    oneDark,
    MiniSearch,
    Decoration,
    syntaxTree,
    markdownLanguage,
    autocompletion,
    completionKeymap,
  } = CodeMirrorBundle;
  function findFileByTitle(title) {
    // Finds the full path of a file, given only its base name
    const normalizedTitle = title.toLowerCase();
    return allFilePaths.find(
      (path) =>
        path.toLowerCase().endsWith(`/${normalizedTitle}.md`) ||
        path.toLowerCase() === `${normalizedTitle}.md`,
    );
  }
  // --- DOM Elements ---
  const appContainer = document.getElementById("app-container");
  const openFolderBtn = document.getElementById("open-folder-btn");
  const notesList = document.getElementById("notes-list");
  const editorContainer = document.getElementById("editor-container");
  const currentFileTitle = document.getElementById("current-file-title"); // <-- Add this

  // --- IndexedDB Helper ---
  const idb = {
    db: null,
    async init() {
      return new Promise((resolve) => {
        const request = indexedDB.open("FileHandles", 1);
        request.onupgradeneeded = () =>
          request.result.createObjectStore("handles");
        request.onsuccess = () => {
          this.db = request.result;
          resolve();
        };
        request.onerror = (e) => console.error("IndexedDB error:", e);
      });
    },
    async get(key) {
      return new Promise((resolve) => {
        const tx = this.db.transaction("handles", "readonly");
        const request = tx.objectStore("handles").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(undefined);
      });
    },
    async set(key, value) {
      const tx = this.db.transaction("handles", "readwrite");
      tx.objectStore("handles").put(value, key);
      return tx.done;
    },
  };

  // --- Combined Live Preview and Wikilink Plugin ---
  const livePreviewPlugin = EditorView.decorations.compute(
    ["doc", "selection"],
    (state) => {
      let decorations = [];
      const activeLine = state.doc.lineAt(state.selection.main.head).from;

      syntaxTree(state).iterate({
        enter: (node) => {
          const { type, from, to } = node;
          const lineStart = state.doc.lineAt(from).from;
          const onActiveLine = lineStart === activeLine;

          // Handle Wikilinks
          if (type.name === "Link") {
            decorations.push(
              Decoration.mark({ class: "cm-wikilink" }).range(from, to),
            );
            return; // Stop processing this node further
          }

          // Handle hiding syntax markers, but only on inactive lines
          if (onActiveLine) return;

          if (type.name.endsWith("Mark")) {
            decorations.push(
              Decoration.mark({ class: "cm-formatting" }).range(from, to),
            );
          } else if (type.name.startsWith("ATXHeading")) {
            const headerText = state.doc.sliceString(from, to);
            const level = headerText.match(/^#+/)[0].length;
            decorations.push(
              Decoration.line({ class: `cm-header cm-header-${level}` }).range(
                from,
              ),
            );
          } else if (type.name === "Blockquote") {
            decorations.push(
              Decoration.line({ class: "cm-quote" }).range(from),
            );
          }
        },
      });
      return Decoration.set(decorations, true);
    },
  );
  // --- Diagnostic Click Handler ---
  const wikilinkClickHandler = EditorView.domEventHandlers({
    mousedown: (event, view) => {
      const pos = view.posAtCoords(event);
      if (!pos) return false;

      let clickedOnLink = false;
      syntaxTree(view.state).iterate({
        enter: (node) => {
          // Log every node type we are currently inside
          if (node.name === "Link") {
            clickedOnLink = true;
            const linkText = view.state.doc.sliceString(
              node.from + 1,
              node.to - 1,
            );
            const targetPath = findFileByTitle(linkText);
            if (targetPath) {
              event.preventDefault();
              openFile(targetPath);
            }
          }
        },
        from: pos,
        to: pos,
      });
      console.log("--------------------------");
      return clickedOnLink;
    },
  });
  // --- Autocomplete Source ---
  const wikilinkCompletion = (context) => {
    let match = context.matchBefore(/\[\[([^\]]*)$/);
    if (!match) return null;

    let query = match.text.slice(2); // Text after the '[['
    let results = fileSearchIndex
      .search(query, { prefix: true, fuzzy: 0.2 })
      .slice(0, 10);

    return {
      from: match.from + 2,
      options: results.map((r) => ({
        label: r.name,
        apply: r.name,
      })),
    };
  };
  // --- Editor & File Functions ---
  async function saveCurrentFile() {
    if (!currentlyOpenFileHandle || !editorView) return;
    try {
      const content = editorView.state.doc.toString();
      const writable = await currentlyOpenFileHandle.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (error) {
      console.error("Error saving file:", error);
    }
  }

  const onUpdate = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(saveTimeout);
      saveTimeout = setTimeout(saveCurrentFile, 500);
    }
  });

  function initEditor() {
    // Make sure GFM is deconstructed from the bundle at the top of app.js
    const {
      EditorState,
      EditorView,
      keymap,
      defaultKeymap,
      markdown,
      oneDark,
      Decoration,
      syntaxTree,
      markdownLanguage,
      autocompletion,
      completionKeymap,
      GFM,
    } = CodeMirrorBundle;

    editorView = new EditorView({
      state: EditorState.create({
        doc: "# Welcome\n\nTry creating a [[link to another note]].",
        extensions: [
          // Configure the markdown parser to use the GFM extension set
          markdown({
            base: markdownLanguage,
            extensions: GFM, // <-- This enables WikiLinks, Tables, etc.
          }),
          oneDark,
          EditorView.lineWrapping,
          onUpdate,
          livePreviewPlugin,
          autocompletion({ override: [wikilinkCompletion] }),
          wikilinkClickHandler,
          keymap.of([...defaultKeymap, ...completionKeymap]),
        ],
      }),
      parent: editorContainer,
    });
  }

  async function openFile(filename) {
    if (!notesDirectoryHandle) return;
    try {
      currentlyOpenFileHandle = await getFileHandleRecursive(
        notesDirectoryHandle,
        filename,
      );
      if (!currentlyOpenFileHandle) throw new Error("File not found");
      const file = await currentlyOpenFileHandle.getFile();
      const content = await file.text();
      currentFileTitle.textContent = filename;
      editorView.dispatch({
        changes: { from: 0, to: editorView.state.doc.length, insert: content },
      });
      document.querySelectorAll("#notes-list li").forEach((li) => {
        li.classList.toggle("active", li.dataset.filename === filename);
      });
    } catch (error) {
      console.error(`Error opening ${filename}:`, error);
    }
  }

  // --- Recursive Indexing --- (This section is unchanged)
  async function buildFileTree(dirHandle, currentPath = "") {
    const items = [];
    for await (const entry of dirHandle.values()) {
      if (entry.name.startsWith(".")) continue;

      const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
      if (entry.kind === "directory") {
        items.push({
          type: "folder",
          name: entry.name,
          children: await buildFileTree(entry, newPath),
        });
      } else if (entry.kind === "file" && entry.name.endsWith(".md")) {
        items.push({
          type: "file",
          name: entry.name.replace(".md", ""),
          path: newPath,
        });
      }
    }
    // Sort with folders first, then files
    items.sort((a, b) => {
      if (a.type === b.type) return a.name.localeCompare(b.name);
      return a.type === "folder" ? -1 : 1;
    });
    return items;
  }

  // --- Helper for opening files --- (Unchanged)
  async function getFileHandleRecursive(dirHandle, path) {
    const parts = path.split("/");
    let currentHandle = dirHandle;
    for (let i = 0; i < parts.length - 1; i++) {
      currentHandle = await currentHandle.getDirectoryHandle(parts[i]);
    }
    return await currentHandle.getFileHandle(parts[parts.length - 1]);
  }

  // --- Palette and List Functions --- (Unchanged)
  function updatePaletteBindings() {
    metaP.maxCommands = 10;
    metaP.maxCommandTitleLength = 50;
    metaP.bind(
      { command: staticCommands, file: allNoteCommands },
      { maxCommands: 10, blur: 1 },
    );
  }
  function renderTreeToDOM(nodes, container) {
    container.innerHTML = "";
    for (const node of nodes) {
      if (node.type === "folder") {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = node.name;
        details.appendChild(summary);

        const sublist = document.createElement("ul");
        renderTreeToDOM(node.children, sublist); // Recurse for children
        details.appendChild(sublist);
        container.appendChild(details);
      } else {
        const li = document.createElement("li");
        li.textContent = node.name;
        li.dataset.filename = node.path;
        li.classList.add("sidebar-file");
        container.appendChild(li);
      }
    }
  }

  function loadSidebarList(tree) {
    renderTreeToDOM(tree, notesList);
  }
  async function loadAndIndexNotes(dirHandle) {
    if (!dirHandle) return;

    // Helper to flatten the tree for searching and indexing
    const flattenTree = (nodes) => {
      let flat = [];
      for (const node of nodes) {
        if (node.type === "file") {
          flat.push({ id: node.path, name: node.path.replace(".md", "") });
        } else if (node.type === "folder" && node.children) {
          flat = flat.concat(flattenTree(node.children));
        }
      }
      return flat;
    };

    const fileTree = await buildFileTree(dirHandle);
    loadSidebarList(fileTree);

    const documents = flattenTree(fileTree);
    allFilePaths = documents.map((doc) => doc.id); // Store all full paths

    // Create the search index
    fileSearchIndex = new MiniSearch({
      fields: ["name"],
      storeFields: ["name"],
      extractField: (doc, fieldName) => doc[fieldName], // Index only by filename
    });
    fileSearchIndex.addAll(documents);

    // Update the command palette
    allNoteCommands = documents.map((doc) => ({
      title: doc.name.split("/").pop(),
      lambda: () => openFile(doc.id),
    }));
    //updatePaletteBindings();
  }

  // --- Permission & Startup --- (Unchanged)
  async function verifyPermission(handle) {
    const options = { mode: "readwrite" };
    if ((await handle.queryPermission(options)) === "granted") return true;
    return (await handle.requestPermission(options)) === "granted";
  }
  async function startup() {
    await idb.init();
    const storedHandle = await idb.get("directoryHandle");
    if (storedHandle && (await verifyPermission(storedHandle))) {
      notesDirectoryHandle = storedHandle;
      await loadAndIndexNotes(notesDirectoryHandle);
    }
  }

  // --- Event Listeners --- (Unchanged)
  openFolderBtn.addEventListener("click", async () => {
    try {
      const handle = await window.showDirectoryPicker();
      if (await verifyPermission(handle)) {
        notesDirectoryHandle = handle;
        await idb.set("directoryHandle", handle);
        await loadAndIndexNotes(handle);
      }
    } catch (err) {
      console.log("User cancelled folder selection.");
    }
  });
  notesList.addEventListener("click", (e) => {
    if (e.target?.tagName === "LI") openFile(e.target.dataset.filename);
  });

  // --- Initialization --- (Unchanged)
  initEditor();
  updatePaletteBindings();
  startup();
});
