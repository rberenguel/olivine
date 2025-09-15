import { openFile } from "../core/files.js";
import { state } from "../core/state.js";

// Keep this reference for the file list in the left sidebar
const notesList = document.getElementById("notes-list");

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

export function loadSidebarList(tree) {
  renderTreeToDOM(tree, notesList);
}

export function initializeSidebar(app) {
  // Handle file clicks in the left sidebar
  notesList.addEventListener("click", (e) => {
    if (e.target?.tagName === "LI") {
      openFile(e.target.dataset.filename, state.activePane);
    }
  });

  // --- MODIFIED: Initialize a multi-column layout ---
  const contentWrapper = document.getElementById("content-wrapper");
  // Set initial sizes: left-sidebar | gutter | main | gutter | right-sidebar
  contentWrapper.style.gridTemplateColumns = "250px 8px 1fr 8px 300px";

  Split({
    columnGutters: [
      {
        track: 1, // Gutter between left-sidebar and main
        element: document.getElementById("main-gutter"),
      },
      {
        track: 3, // Gutter between main and right-sidebar
        element: document.getElementById("right-gutter"),
      },
    ],
  });

  // --- Initialize the resizer for the left sidebar's internal panels ---
  const leftSidebarEl = document.getElementById("left-sidebar");
  leftSidebarEl.style.gridTemplateRows = "auto 1fr 8px 1fr";

  Split({
    rowGutters: [
      {
        track: 2, // The gutter is at track 2
        element: document.getElementById("left-sidebar-gutter"),
      },
    ],
  });

  Split({
    rowGutters: [
      {
        track: 2, // The gutter is at track 2
        element: document.getElementById("right-sidebar-gutter"),
      },
    ],
  });

  // --- MODIFIED: Update the app.ui.registerView function ---
  app.ui.registerView = (viewName, element) => {
    if (viewName === "sidebar-panel") {
      document.getElementById("left-sidebar-panel-container").appendChild(element);
    } else if (viewName === "right-sidebar-panel") {
      document.getElementById("right-sidebar-panel-container").appendChild(element);
    } else if (viewName === "statusbar") {
      // Assuming statusbar exists elsewhere, keeping this logic.
      const statusbar = document.getElementById('statusbar-container');
      if (statusbar) statusbar.appendChild(element);
    }
  };
}