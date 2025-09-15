// app/core/app.js

import { state, setActivePane } from "./state.js";
import * as fileApi from "./files.js";
import * as paneApi from "../components/panes.js";
import { readFile } from "./vscode-api.js";
//import { updatePaletteBindings } from "./commands.js";

// A simple event emitter
class Emitter {
  constructor() {
    this.listeners = {};
  }
  on(event, callback) {
    (this.listeners[event] = this.listeners[event] || []).push(callback);
  }
  emit(event, data) {
    (this.listeners[event] || []).forEach((fn) => fn(data));
  }
}

export function createApp() {
  const app = {
    viewTypes: new Map(),
    state: state,
    events: new Emitter(),
    // 1. Centralized command storage
    commands: {
      lists: {
        static: [], // For 'New Note', etc.
        file: [], // For the file list
      },
      // 2. A safe way to register new commands
      register: (group, command) => {
        if (!app.commands.lists[group]) {
          app.commands.lists[group] = [];
        }
        // Support registering a single command or an array
        const commandsToAdd = Array.isArray(command) ? command : [command];
        app.commands.lists[group].push(...commandsToAdd);
      },
      // 3. A single function to update the palette UI
      refreshPalette: () => {
        // Define an async search function for the palette
        const fileSearcher = async (query) => {
          if (!query) return [];

          const searchResults = app.state.fileSearchIndex.search(query, {
            fields: ["name", "text"],
            boost: { name: 2, text: 1 }, // Prioritize title matches
          });

          return searchResults.map((result) => ({
            title: result.name.split("/").pop(),
            lambda: () =>
              app.workspace.openFile(result.id, app.state.activePane),
          }));
        };
        const fileCommands = app.state.allFilePaths.map((path) => ({
          title: path.replace(".md", "").split("/").pop(),
          lambda: () => app.workspace.openFile(path, app.state.activePane),
        }));
        app.commands.lists.file = fileCommands;
        // Bind the static commands and our new dynamic file searcher
        metaP.bind(
          {
            shifted: app.commands.lists.static,
            default: fileSearcher,
          },
          { maxCommands: 10, blur: 1 },
        );
      },
    },
    // Workspace API
    workspace: {
      ...fileApi,
      readFile: readFile,
      getActivePane: () => state.activePane,
      setActivePane: setActivePane,
    },

    // UI API
    ui: {
      ...paneApi,

      // NEW: The View Registration API
      registerView: (location, viewElement) => {
        let container;
        switch (location) {
          case "statusbar":
            container = document.getElementById("statusbar-container");
            break;
          case "sidebar-panel":
            container = document.getElementById("sidebar-panel-container");
            break;
          default:
            log.error("app-core", `Unknown view location: ${location}`);
            return;
        }
        if (container) {
          container.appendChild(viewElement);
        }
      },
      registerViewType: (name, config) => {
        app.viewTypes.set(name, config);
        const command = {
          title: `New ${config.title || name} View`,
          lambda: () => app.ui.createCustomPane(name),
        };
        // 4. Use the new, safe registration method
        app.commands.register("static", command);
        app.commands.refreshPalette(); // Refresh the palette to show the new command
      },
    },

    // Editor API (to be expanded)
    editor: {
      // This is where you'll add methods to register CodeMirror extensions
      // from plugins, to avoid plugins touching CodeMirror directly.
      registerCmExtension(extension) {
        // This is a placeholder for the logic that would add the extension
        // to all new and existing editor panes.
        log.info("app-core", "Registering CM extension:", extension);
      },
    },
  };
  app.ui.updatePalette = app.commands.refreshPalette;
  // When a file is opened, emit an event
  const originalOpenFile = app.workspace.openFile;
  app.workspace.openFile = async (filename, pane) => {
    await window.idbStore.set("olivine-last-open-file", filename);
    await originalOpenFile(filename, pane);
    app.events.emit("file:opened", { filename, pane });
  };

  // When a file is created, emit an event
  const originalCreateFile = app.workspace.createNewFile;
  app.workspace.createNewFile = async (filename, params) => {
    await originalCreateFile(filename, params);
    app.events.emit("file:created", { filename, opening });
  };

  const originalInit = app.workspace.initializeFileHandling;
  app.workspace.initializeFileHandling = async () => {
    const lastFile = await window.idbStore.get("olivine-last-open-file");
    await originalInit();
    app.events.emit("workspace:ready", { files: app.state.allFilePaths });
    // --- REOPEN LAST FILE ---
    // Ensure the file still exists in the current vault before opening
    if (lastFile && app.state.allFilePaths.includes(lastFile)) {
      app.workspace.openFile(lastFile, app.state.activePane);
    }
  };

  // When the active pane changes, emit an event
  const originalSetActivePane = app.workspace.setActivePane;
  app.workspace.setActivePane = (pane) => {
    originalSetActivePane(pane);
    app.events.emit("pane:activated", { pane });
  };

  return app;
}
