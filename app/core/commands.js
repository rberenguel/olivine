// app/core/commands.js
import { state } from "./state.js";
import { loadAndIndexNotes, createNewFile, saveActiveFile } from "./files.js";
import { splitActivePane, closePane } from "../components/panes.js";

// This file now only defines the static commands
const staticCommands = [
  { title: "New Note", lambda: () => createNewFile("", { open: true }) },
  { title: "Split horizontally", lambda: () => splitActivePane("horizontal") },
  { title: "Split vertically", lambda: () => splitActivePane("vertical") },
  { title: "Re-index Notes", lambda: () => loadAndIndexNotes() },
];

export function initializeCommands(app) {
  // Register commands that should appear in the palette
  for (let command of staticCommands) {
    const id = command.title
      .split(" ")
      .map((s) => s.toLowerCase())
      .join("-");
    app.registerCommand("core:" + id, command);
  }

  // Register commands that should NOT appear in the palette
  app.registerCommand("core:close-pane", {
    lambda: () => closePane(app.workspace.getActivePane()),
  });
  app.registerCommand("core:save-pane", {
    lambda: () => saveActiveFile(app),
  });
}
