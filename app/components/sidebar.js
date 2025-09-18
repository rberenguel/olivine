import { openFile } from "../core/files.js";
import { state } from "../core/state.js";

const notesList = document.getElementById("notes-list");

// --- Store Split.js instances so they can be destroyed and recreated ---
let leftPanelSplit, rightPanelSplit;

function renderTreeToDOM(nodes, container) {
  container.innerHTML = "";
  for (const node of nodes) {
    if (node.type === "folder") {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = node.name;
      details.appendChild(summary);

      const sublist = document.createElement("ul");
      renderTreeToDOM(node.children, sublist);
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

/**
 * Dynamically adds a panel to a container, creating gutters and re-initializing
 * the Split.js layout.
 * @param {HTMLElement} container - The container element for the panels.
 * @param {HTMLElement} element - The new panel element to add.
 * @param {object} splitRef - A reference object to store the Split.js instance.
 */
function addResizablePanel(container, element, splitRef) {
  // If this is not the first panel, add a gutter before it.
  if (container.children.length > 0) {
    const gutter = document.createElement("div");
    gutter.className = "gutter gutter-row";
    container.appendChild(gutter);
  }
  container.appendChild(element);

  // If there is more than one panel, activate the grid layout and splitter.
  const panels = Array.from(container.children).filter(
    (el) => !el.classList.contains("gutter"),
  );
  if (panels.length > 1) {
    // Destroy the previous Split instance if it exists
    if (splitRef.instance) {
      splitRef.instance.destroy();
    }

    container.style.display = "grid";

    const gutters = Array.from(container.querySelectorAll(".gutter"));
    const tracks = [];
    panels.forEach(() => tracks.push("1fr"));
    gutters.forEach(() => tracks.push("8px"));

    // We need to interleave the gutters between the panels for the grid template
    const gridTemplateRows = panels.map(() => "1fr").join(" 8px ");
    container.style.gridTemplateRows = gridTemplateRows;

    splitRef.instance = Split({
      rowGutters: gutters.map((gutter, i) => ({
        track: i * 2 + 1, // Gutters are at odd-numbered tracks (1, 3, 5...)
        element: gutter,
      })),
    });
  }
}

export function loadSidebarList(tree) {
  renderTreeToDOM(tree, notesList);
}

export function initializeSidebar(app) {
  notesList.addEventListener("click", (e) => {
    if (e.target?.tagName === "LI") {
      app.workspace.openFile(e.target.dataset.filename, state.activePane);
    }
  });

  const contentWrapper = document.getElementById("content-wrapper");
  // 1. Get the root font size to calculate rem units in pixels.
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );

  // 2. Calculate the desired width of the right sidebar in pixels.
  const rightSidebarWidthInPixels =
    window.innerWidth * 0.15 + rootFontSize * 1.5;

  // 3. Set the grid template columns using the calculated pixel value.
  contentWrapper.style.gridTemplateColumns = `250px 8px 1fr 8px ${rightSidebarWidthInPixels}px`;

  Split({
    columnGutters: [
      { track: 1, element: document.getElementById("main-gutter") },
      { track: 3, element: document.getElementById("right-gutter") },
    ],
  });

  const leftSidebarEl = document.getElementById("left-sidebar");
  leftSidebarEl.style.gridTemplateRows = "auto 1fr 8px 1fr";

  Split({
    rowGutters: [
      { track: 2, element: document.getElementById("left-sidebar-gutter") },
    ],
  });

  app.ui.registerView = (viewName, element) => {
    switch (viewName) {
      case "sidebar-panel": {
        const container = document.getElementById(
          "left-sidebar-panel-container",
        );
        addResizablePanel(container, element, {
          get instance() {
            return leftPanelSplit;
          },
          set instance(val) {
            leftPanelSplit = val;
          },
        });
        break;
      }
      case "right-sidebar-panel": {
        const container = document.getElementById(
          "right-sidebar-panel-container",
        );
        addResizablePanel(container, element, {
          get instance() {
            return rightPanelSplit;
          },
          set instance(val) {
            rightPanelSplit = val;
          },
        });
        break;
      }
      case "statusbar": {
        const statusbar = document.getElementById("statusbar-container");
        if (statusbar) statusbar.appendChild(element);
        break;
      }
    }
  };
}
