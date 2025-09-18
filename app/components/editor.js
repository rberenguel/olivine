import {
  EditorState,
  EditorView,
  keymap,
  defaultKeymap,
  history,
  historyKeymap,
  markdown,
  oneDark,
  Decoration,
  languages,
  syntaxTree,
  markdownLanguage,
  autocompletion,
  completionKeymap,
  GFM,
} from "CodeMirrorBundle"; // Use the import map
import { state } from "../core/state.js";
import { saveFile, findFileByTitle, openFile } from "../core/files.js";

// This listener handles auto-saving.
function onUpdate(pane) {
  return EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(pane.saveTimeout);
      pane.saveTimeout = setTimeout(() => {
        const content = update.state.doc.toString();
        if (pane.filePath) {
          saveFile(pane.filePath, content);
          // NEW: Emit the event after saving
          window.app.events.emit("file:saved", { path: pane.filePath });
        }
      }, 500);
    }
  });
}

// This is the click handler for wikilinks. It was present but couldn't
// work without the styled links from the plugin above.
const wikilinkClickHandler = EditorView.domEventHandlers({
  mousedown: (event, view) => {
    const pos = view.posAtCoords(event);
    if (!pos) return false;

    let clickedOnLink = false;
    syntaxTree(view.state).iterate({
      enter: (node) => {
        if (node.name === "Link") {
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

// This handles wikilink autocompletion.
const wikilinkCompletion = (context) => {
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
};

export function createEditor(parent, doc = "") {
  const pane = {
    editorView: null,
    filePath: null,
    saveTimeout: null,
  };

  const editorState = EditorState.create({
    doc,
    extensions: [
      history(),
      EditorView.lineWrapping,
      markdown({
        base: markdownLanguage,
        codeLanguages: languages,
        extensions: GFM,
      }),
      oneDark,
      EditorView.lineWrapping,
      onUpdate(pane),
      keymap.of([...historyKeymap, ...defaultKeymap, ...completionKeymap]),
      ...state.cmExtensions,
    ],
  });

  pane.editorView = new EditorView({
    state: editorState,
    parent,
  });

  parent.parentElement.paneObject = pane;

  return pane;
}
