import {
  EditorView,
  WidgetType,
  Decoration,
  ViewPlugin,
  syntaxTree,
} from "CodeMirrorBundle";

// 1. Define the Widget that will render the link
class LinkWidget extends WidgetType {
  constructor(href, text) {
    super();
    this.href = href;
    this.text = text;
  }

  toDOM() {
    const a = document.createElement("a");
    a.href = this.href;
    a.textContent = this.text;
    a.className = "cm-link-widget";
    // Open external links in a new tab for safety
    if (!this.href.startsWith("#")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    return a;
  }
}

// 2. Create the ViewPlugin that provides the decorations
const linkWidgetPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = this.buildDecorations(view);
    }

    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = this.buildDecorations(update.view);
      }
    }

    buildDecorations(view) {
      let decorations = [];
      const selection = view.state.selection.main;

      for (let { from, to } of view.visibleRanges) {
        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            if (node.name === "Link") {
              const urlNode = node.node.getChild("URL");

              // If there's no URL child, it's not a standard link we want to handle.
              if (!urlNode) {
                return;
              }

              const cursorInside =
                selection.from <= node.to && selection.to >= node.from;
              if (cursorInside) {
                return;
              }

              // --- NEW LOGIC ---
              // The link text is between the opening "[" and the closing "](".
              // We calculate its position relative to the parent Link node and the child URL node.
              const textFrom = node.from + 1; // Skips the opening "["
              const textTo = urlNode.from - 2; // Ends before the "]("

              // A sanity check in case of malformed links
              if (textFrom >= textTo) {
                return;
              }

              const text = view.state.doc.sliceString(textFrom, textTo);
              const url = view.state.doc.sliceString(urlNode.from, urlNode.to);

              const deco = Decoration.replace({
                widget: new LinkWidget(url, text),
              });
              decorations.push(deco.range(node.from, node.to));
            }
          },
        });
      }
      return Decoration.set(decorations);
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

const linkWidgetClickHandler = EditorView.domEventHandlers({
  mousedown: (event, view) => {
    const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
    if (pos === null) {
      const line = view.lineBlockAtHeight(event.clientY);
      view.dispatch({ selection: { anchor: line.to } });
      return true; // We handled it
    }
  },
});

// 3. Activate the extension
export function activate(app) {
  log.info("link-widget", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  app.state.cmExtensions.push(linkWidgetPlugin, linkWidgetClickHandler);
}
