// app/extensions/graph-view/main.js

export function activate(app) {
  log.info("graph-view", "Activating Extension");

  const viewConfig = {
    title: "Graph",
    render: (container) => {
      container.style.padding = "1rem";
      container.innerHTML = `
        <h2>Graph View</h2>
        <p>This is a custom, non-editor pane rendered by an extension.</p>
        <p>You could use a library like D3.js or Mermaid.js here.</p>
      `;
    },
  };

  // Step 1: Register the view type
  app.ui.registerViewType("graph", viewConfig);

  // Step 2: Register the command to open the new view
  app.registerCommand("graph-view:open", {
    title: "New Graph View",
    lambda: () => app.ui.createCustomPane("graph"),
  });

  // No need to refresh the palette here, as the core app will do it.
}
