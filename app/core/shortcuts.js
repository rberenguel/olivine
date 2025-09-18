// app/core/shortcuts.js

export function initializeShortcuts(app) {
  document.addEventListener("keydown", (e) => {
    // Check for Command key on macOS or Ctrl key on other OSes
    const isModifier = e.metaKey || e.ctrlKey;

    if (isModifier && e.key === "s") {
      e.preventDefault();
      app.executeCommand("core:save-pane");
    }

    if (isModifier && e.key === "w") {
      e.preventDefault();
      app.executeCommand("core:close-pane");
    }

    // We keep this to prevent new tabs, but it won't stop the browser
    // from closing the PWA window itself.
    if (isModifier && e.key === "t") {
      e.preventDefault();
      log.info("shortcuts", "Intercepted Cmd/Ctrl-t.");
    }
  });
}
