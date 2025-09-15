import { EditorView, syntaxTree, autocompletion } from "CodeMirrorBundle";
import { findFileByTitle, openFile } from "../../core/files.js";
import { state } from "../../core/state.js";

// Define the click handler directly, just like the original code in editor.js
const wikilinkClickHandler = EditorView.domEventHandlers({
  mousedown: (event, view) => {
    const pos = view.posAtCoords(event);
    if (event.button != 1) {
      return false;
    }
    if (!pos) return false;

    let clickedOnLink = false;
    syntaxTree(view.state).iterate({
      enter: (node) => {
        if (node.name === "Link" && !node.node.getChild("URL")) {
          clickedOnLink = true;
          const linkText = view.state.doc.sliceString(
            node.from + 1,
            node.to - 1,
          );
          const targetPath = findFileByTitle(linkText);
          if (targetPath) {
            event.preventDefault();
            openFile(targetPath, state.activePane);
          }
        }
      },
      from: pos,
      to: pos,
    });
    return clickedOnLink;
  },
});

const wikilinkCompletion = autocompletion({
  override: [
    (context) => {
      let match = context.matchBefore(/\[\[([^\]]*)$/);
      if (!match) return null;

      let query = match.text.slice(2);
      let results = state.fileSearchIndex
        .search(query, { prefix: true, fuzzy: 0.2 })
        .slice(0, 10);

      return {
        from: match.from + 2,
        options: results.map((r) => ({
          label: r.name,
          apply: r.name,
        })),
      };
    },
  ],
});

// --- Activation ---

export function activate(app) {
  log.info("wikilinks", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  // Register both the click handler plugin and the autocompletion extension
  app.state.cmExtensions.push(wikilinkClickHandler, wikilinkCompletion);
}
