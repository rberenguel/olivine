import { syntaxTree } from "CodeMirrorBundle";
import { EditorView, EditorSelection } from "CodeMirrorBundle";

function updateOutline(pane, listElement, panelContainer) {
  listElement.innerHTML = ""; // Clear the old outline

  if (!pane || !pane.editorView) {
    panelContainer.style.display = "none";
    return;
  }
  panelContainer.style.display = "block";
  const doc = pane.editorView.state.doc;

  syntaxTree(pane.editorView.state).iterate({
    enter: (node) => {
      // Look for Markdown headings
      if (node.name.startsWith("ATXHeading")) {
        const level = parseInt(node.name.replace("ATXHeading", ""), 10);
        const text = doc.sliceString(node.from, node.to).replace(/^#+\s*/, "");
        const position = node.from;

        const listItem = document.createElement("li");
        listItem.textContent = text;
        listItem.className = `outline-h${level}`; // For CSS indentation
        listItem.style.cursor = "pointer";

        // On click, scroll the editor to the heading
        listItem.addEventListener("click", () => {
          pane.editorView.dispatch({
            selection: EditorSelection.cursor(position),
            effects: EditorView.scrollIntoView(position, { y: "start" }),
          });
          pane.editorView.focus();
        });

        listElement.appendChild(listItem);
      }
    },
  });
}

export function activate(app) {
  log.info("outline", "Activating Extension");
  // 1. Create the UI for the panel
  const panelContainer = document.createElement("div");
  panelContainer.classList.add("outline-container");
  const content = document.createElement("div");
  content.classList.add("outline-content");
  const outlineList = document.createElement("ul");
  panelContainer.appendChild(content);
  content.appendChild(outlineList);

  // 2. Register the panel with the UI
  app.ui.registerView("right-sidebar-panel", panelContainer);

  // 3. Listen for events to update the outline
  const refresh = () =>
    updateOutline(app.state.activePane, outlineList, panelContainer);
  refresh();
  app.events.on("file:opened", refresh);
  app.events.on("file:saved", refresh); // file:saved is a good proxy for content changed
}
