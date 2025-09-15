// app/extensions/graph-view/main.js

export function activate(app) {
  log.info("graph-view", "Activating Extension");

  app.ui.registerViewType("graph", {
    title: "Graph",
    render: (container) => {
      // The extension has full control over this container element
      container.style.padding = "1rem";
      container.innerHTML = `
        <h2>Graph View</h2>
        <p>This is a custom, non-editor pane rendered by an extension.</p>
        <p>You could use a library like D3.js or Mermaid.js here.</p>
      `;
    },
  });
}
