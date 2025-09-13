import { EditorView, syntaxTree } from "CodeMirrorBundle";

const taskClickHandler = EditorView.domEventHandlers({
  mousedown: (event, view) => {
    const pos = view.posAtCoords(event);
    if (!pos) return false;

    let handled = false;
    syntaxTree(view.state).iterate({
      from: pos,
      to: pos,
      enter: (node) => {
        // Check if the user clicked specifically on a TaskMarker node
        if (node.name === "TaskMarker") {
          const currentMarker = view.state.doc.sliceString(node.from, node.to);
          const newMarker = currentMarker === "[ ]" ? "[x]" : "[ ]";

          // Dispatch a transaction to replace the text
          view.dispatch({
            changes: { from: node.from, to: node.to, insert: newMarker }
          });
          
          // Prevent the editor from also trying to place a cursor
          event.preventDefault();
          handled = true;
        }
      },
    });

    return handled;
  }
});

export function activate(app) {
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  app.state.cmExtensions.push(taskClickHandler);
}