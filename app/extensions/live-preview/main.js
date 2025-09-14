import {
  ViewPlugin,
  Decoration,
  syntaxTree,
  WidgetType,
} from "CodeMirrorBundle";

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-hr";
    return hr;
  }
  // This widget doesn't need to handle any events
  ignoreEvent() {
    return true;
  }
}

const livePreviewPlugin = ViewPlugin.fromClass(
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
      const decorations = [];
      const tagRegex = /#([a-zA-Z0-9_/-]+)/g;
      const selection = view.state.selection.main;

      // We iterate over the visible parts of the document for performance.
      for (let { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);

        // Find tags with a Regex
        let match;
        while ((match = tagRegex.exec(text))) {
          const start = from + match.index;
          const end = start + match[0].length;
          decorations.push(
            Decoration.mark({ class: "cm-tag" }).range(start, end),
          );
        }

        // Find other markdown elements with the syntax tree
        syntaxTree(view.state).iterate({
          from,
          to, // Only iterate within the visible range
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
                decorations.push(
                  Decoration.line({ class: "cm-quote" }).range(from),
                );
                break;
              case "Emphasis":
                decorations.push(
                  Decoration.mark({ class: "cm-em" }).range(from, to),
                );
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
              case "HorizontalRule":
                console.log(selection.from, selection.to, from, to);
                const cursorOnLine =
                  selection.from >= from && selection.to <= to;
                if (cursorOnLine) break;
                decorations.push(
                  Decoration.replace({
                    widget: new HrWidget(),
                  }).range(from, to),
                );
                break;
            }
          },
        });
      }
      return Decoration.set(decorations, true);
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);

export function activate(app) {
  // We need to figure out a way to register this.
  // We can add it to the app object, and then collect all registered
  // extensions when we create a new pane
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  app.state.cmExtensions.push(livePreviewPlugin);
}
