// app/core/commands.js
import { state } from "./state.js";
import { loadAndIndexNotes, createNewFile } from "./files.js";
import { splitActivePane } from "../components/panes.js";

// This file now only defines the static commands
const staticCommands = [
  { title: "New Note", lambda: () => createNewFile("", true) },
  { title: "Split horizontally", lambda: () => splitActivePane("horizontal") },
  { title: "Split vertically", lambda: () => splitActivePane("vertical") },
  { title: "Re-index Notes", lambda: () => loadAndIndexNotes() },
];

export function initializeCommands(app) {
  // Register the initial static commands
  app.commands.register("static", staticCommands);

  // The palette is now refreshed elsewhere, like after files are loaded
}

// The old updatePaletteBindings function is no longer needed here.
// Its logic has been moved to app.commands.refreshPalette.
