import {
  ViewPlugin,
  Decoration,
  WidgetType,
  syntaxTree,
} from "CodeMirrorBundle";

class LanguageWidget extends WidgetType {
  constructor(lang) {
    super();
    this.lang = lang;
  }
  toDOM() {
    const span = document.createElement("span");
    span.className = "cm-code-block-lang";
    span.textContent = this.lang;
    return span;
  }
}

function decorate(view) {
  const decorations = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "FencedCode") return;

        const selection = view.state.selection.main;
        if (selection.from >= node.from && selection.to <= node.to) return;

        const firstLine = view.state.doc.lineAt(node.from);
        const info = node.node.getChild("CodeInfo");
        const lang = info ? view.state.doc.sliceString(info.from, info.to) : "";
        const mark = node.node.firstChild;
        const lastMark = node.node.lastChild;

        // 1. Add all decorations to a simple array
        // Replace opening ``` and language identifier
        decorations.push(
          Decoration.replace({}).range(mark.from, info ? info.to : mark.to),
        );

        // Add language widget
        if (lang) {
          decorations.push(
            Decoration.widget({
              widget: new LanguageWidget(lang),
              side: 1, // Place after other decorations at the same point
            }).range(firstLine.from),
          );
        }

        // Add line background class for every line
        for (
          let i = firstLine.number;
          i <= view.state.doc.lineAt(node.to).number;
          i++
        ) {
          const line = view.state.doc.line(i);
          decorations.push(
            Decoration.line({ class: "cm-code-block" }).range(line.from),
          );
        }

        // Replace closing ```
        if (lastMark?.name === "CodeMark") {
          decorations.push(
            Decoration.replace({}).range(lastMark.from, lastMark.to),
          );
        }
      },
    });
  }

  // 2. Sort the array by the 'from' position before creating the final set.
  // This is the critical step that fixes the crash.
  decorations.sort(
    (a, b) => a.from - b.from || a.value.startSide - b.value.startSide,
  );
  return Decoration.set(decorations);
}

const prettyCodeBlocksPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = decorate(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged || update.selectionSet) {
        this.decorations = decorate(update.view);
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  },
);
// The single, correct entry point for the extension.
export function activate(app) {
  log.info("codeblocks", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  // Use the existing system to register the plugin.
  app.state.cmExtensions.push(prettyCodeBlocksPlugin);
}
