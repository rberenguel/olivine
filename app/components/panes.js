import { createEditor } from "./editor.js";
import { state, setActivePane } from "../core/state.js";
import { renameFile } from "../core/files.js";

const panesContainer = document.getElementById("panes-container");

function createPaneElement(isEditor = true) {
  const paneElement = document.createElement("div");
  paneElement.className = "pane";

  const paneHeader = document.createElement("div");
  paneHeader.className = "pane-header";

  const paneTitle = document.createElement("span");
  paneTitle.className = "pane-title";
  paneTitle.textContent = "New Note";

  const closeButton = document.createElement("button");
  closeButton.className = "close-pane-btn";
  closeButton.textContent = "×";

  const editorContainer = document.createElement("div");
  editorContainer.className = "editor-wrapper";

  paneHeader.appendChild(paneTitle);
  paneHeader.appendChild(closeButton);
  paneElement.appendChild(paneHeader);
  paneElement.appendChild(editorContainer);

  let pane;
  if (isEditor) {
    pane = createEditor(editorContainer, "");
  } else {
    pane = {
      element: paneElement,
      titleElement: paneTitle,
      contentContainer: editorContainer,
    };
  }
  pane.element = paneElement;
  pane.titleElement = paneTitle;

  // Event listener for renaming
  paneTitle.addEventListener("click", () => {
    // This now correctly checks for filePath
    if (!pane.filePath) return;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "pane-title-input";
    input.value = pane.filePath.split("/").pop(); // Show only the filename

    paneHeader.replaceChild(input, paneTitle);
    input.focus();
    input.select();

    const finishEditing = async () => {
      const newName = input.value.trim();
      const oldName = pane.filePath.split("/").pop();
      clearTimeout(pane.saveTimeout);
      if (newName && newName !== oldName) {
        const newPath = await renameFile(pane.filePath, newName);
        if (newPath) {
          pane.filePath = newPath; // Update the path on the pane
          paneTitle.textContent = newName.replace(".md", "");
        }
      }
      paneHeader.replaceChild(paneTitle, input);
    };

    input.addEventListener("blur", finishEditing);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
      if (e.key === "Escape") {
        input.removeEventListener("blur", finishEditing);
        paneHeader.replaceChild(paneTitle, input);
      }
    });
  });

  paneElement.addEventListener("click", () => setActivePane(pane));
  closeButton.addEventListener("click", (e) => {
    e.stopPropagation();
    closePane(pane);
  });

  return pane;
}

export function createCustomPane(viewType) {
  const viewConfig = window.app.viewTypes.get(viewType);
  if (!viewConfig) {
    console.error(`Unknown view type: ${viewType}`);
    return;
  }

  // Create a pane shell without an editor
  const pane = createPaneElement(false);
  pane.titleElement.textContent = viewConfig.title || "Custom View";

  // Render the extension's UI into the pane's content area
  viewConfig.render(pane.contentContainer);

  // Add the new pane to the DOM (this logic can be shared with splitActivePane)
  const panesContainer = document.getElementById("panes-container");
  panesContainer.appendChild(pane.element);
  setActivePane(pane);
}

export function createInitialPane() {
  const pane = createPaneElement();
  panesContainer.appendChild(pane.element);
  setActivePane(pane);
}

export function closePane(pane) {
  const paneElement = pane.element;
  const parent = paneElement.parentElement;

  paneElement.remove();

  if (parent.classList.contains("pane-container")) {
    const remainingPanes = Array.from(parent.children).filter((el) =>
      el.classList.contains("pane"),
    );
    if (remainingPanes.length === 1) {
      const grandparent = parent.parentElement;
      grandparent.replaceChild(remainingPanes[0], parent);
    }
  }

  if (state.activePane === pane) {
    const nextPane = document.querySelector(".pane");
    setActivePane(nextPane ? nextPane.paneObject : null);
  }

  if (panesContainer.children.length === 0) {
    createInitialPane();
  }
}

export function splitActivePane(direction) {
  log.info("panes", `Splitting ${direction}`);
  if (!state.activePane) {
    createInitialPane();
    return;
  }

  const existingPane = state.activePane;
  const parent = existingPane.element.parentElement;

  const container = document.createElement("div");
  container.className = `pane-container`; // No longer need vertical/horizontal class

  parent.replaceChild(container, existingPane.element);

  const newPane = createPaneElement(false); // Prevent opening a new file

  // The library needs a gutter element between the panes
  const gutter = document.createElement("div");

  // The setup depends on the split direction
  if (direction === "vertical") {
    // Side-by-side columns
    container.style.gridTemplateColumns = "1fr 8px 1fr"; // Pane | Gutter | Pane
    gutter.className = "gutter gutter-col";
    container.appendChild(existingPane.element);
    container.appendChild(gutter);
    container.appendChild(newPane.element);

    Split({
      columnGutters: [
        {
          track: 1, // The gutter is at track 1 (0-indexed)
          element: gutter,
        },
      ],
    });
  } else {
    // Stacked rows
    container.style.gridTemplateRows = "1fr 8px 1fr"; // Pane / Gutter / Pane
    gutter.className = "gutter gutter-row";
    container.appendChild(existingPane.element);
    container.appendChild(gutter);
    container.appendChild(newPane.element);

    Split({
      rowGutters: [
        {
          track: 1,
          element: gutter,
        },
      ],
    });
  }

  setActivePane(newPane);
}
