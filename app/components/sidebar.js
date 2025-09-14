import { openFile } from "../core/files.js";
import { state } from "../core/state.js";

const notesList = document.getElementById("notes-list");
const appContainer = document.getElementById("app-container");
const sidebarEl = document.getElementById("sidebar"); // Get the sidebar element

function renderTreeToDOM(nodes, container) {
  container.innerHTML = "";
  for (const node of nodes) {
    if (node.type === "folder") {
      const details = document.createElement("details");
      const summary = document.createElement("summary");
      summary.textContent = node.name;
      details.appendChild(summary);

      const sublist = document.createElement("ul");
      renderTreeToDOM(node.children, sublist); // Recurse for children
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

export function initializeSidebar() {
  notesList.addEventListener("click", (e) => {
    if (e.target?.tagName === "LI") {
      openFile(e.target.dataset.filename, state.activePane);
    }
  });

  // --- NEW: Initialize the sidebar resizer ---
  // Set initial sizes: header=auto, nav=1fr, gutter=8px, panels=1fr
  sidebarEl.style.gridTemplateRows = "auto 1fr 8px 1fr";

  Split({
    rowGutters: [
      {
        track: 2, // The gutter is at track 2 (0=header, 1=nav, 2=gutter, 3=panels)
        element: document.getElementById("sidebar-gutter"),
      },
    ],
  });
  // ------------------------------------------
}
