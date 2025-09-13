import { EditorView, Decoration, syntaxTree } from "CodeMirrorBundle";

// This is the exact code from editor.js
const livePreviewPlugin = EditorView.decorations.compute(["doc"], (state) => {
  let decorations = [];
  syntaxTree(state).iterate({
    enter: (node) => {
      const { type, from, to } = node;
      switch (type.name) {
        case "HeaderMark":
        case "QuoteMark":
        case "ListMark":
          decorations.push(
            Decoration.mark({ class: "list-bullet" }).range(from, to), // Useless for now
          );
          break;
        case "EmphasisMark":
        case "StrongEmphasisMark": // For ** and __
        case "CodeMark": // For ` and ```
          decorations.push(
            Decoration.mark({ class: "cm-formatting" }).range(from, to),
          );
          break;

        // Block-level styling
        case "ATXHeading1":
          decorations.push(
            Decoration.line({ class: "cm-header-1" }).range(from),
          );
          break;
        case "ATXHeading2":
          decorations.push(
            Decoration.line({ class: "cm-header-2" }).range(from),
          );
          break;
        case "ATXHeading3":
          decorations.push(
            Decoration.line({ class: "cm-header-3" }).range(from),
          );
          break;
        case "Blockquote":
          decorations.push(Decoration.line({ class: "cm-quote" }).range(from));
          break;
        case "Emphasis":
          decorations.push(Decoration.mark({ class: "cm-em" }).range(from, to));
          break;
        case "StrongEmphasis":
          decorations.push(
            Decoration.mark({ class: "cm-strong" }).range(from, to),
          );
          break;
        case "InlineCode":
          decorations.push(
            Decoration.mark({ class: "cm-inline-code" }).range(from, to),
          );
          break;
        case "ListItem":
          decorations.push(
            Decoration.mark({ class: "cm-list-item" }).range(from, to),
          );
          break;
      }
    },
  });
  return Decoration.set(decorations);
});

export function activate(app) {
  // We need to figure out a way to register this.
  // We can add it to the app object, and then collect all registered
  // extensions when we create a new pane
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  app.state.cmExtensions.push(livePreviewPlugin);
}
