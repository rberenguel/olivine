// app/extensions/status-bar/main.js

export function activate(app) {
  log.info("status-bar", "Activating Extension");

  // 1. Create the UI element for the status bar
  const statusBarItem = document.createElement("div");
  statusBarItem.className = "statusbar-item";
  statusBarItem.textContent = "Workspace ready.";

  // 2. Register this element with the UI
  app.ui.registerView("statusbar", statusBarItem);

  // 3. Update the element's content based on events
  app.events.on("workspace:ready", (data) => {
    statusBarItem.textContent = `${data.files.length} notes indexed.`;
  });

  app.events.on("file:opened", (data) => {
    statusBarItem.textContent = data.filename.split("/").pop();
  });

  app.events.on("file:saved", (data) => {
    statusBarItem.textContent = `${data.path.split("/").pop()} (saved)`;
    setTimeout(() => {
      // Reset after a moment
      if (app.state.activePane?.filePath === data.path) {
        statusBarItem.textContent = data.path.split("/").pop();
      }
    }, 2000);
  });

  app.events.on("pane:activated", (data) => {
    const filePath = data.pane?.filePath?.split("/").pop() || "New Note";
    statusBarItem.textContent = filePath;
  });
}
