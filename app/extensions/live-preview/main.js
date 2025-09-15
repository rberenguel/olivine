import {
  ViewPlugin,
  Decoration,
  syntaxTree,
  WidgetType,
  StateField,
  EditorView,
  RangeSetBuilder, // Now correctly imported from your bundle
} from "CodeMirrorBundle";

// --- START: Original Live Preview Code ---

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement("hr");
    hr.className = "cm-hr";
    return hr;
  }
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

      for (let { from, to } of view.visibleRanges) {
        const text = view.state.doc.sliceString(from, to);

        let match;
        while ((match = tagRegex.exec(text))) {
          const start = from + match.index;
          const end = start + match[0].length;
          decorations.push(
            Decoration.mark({ class: "cm-tag" }).range(start, end),
          );
        }

        syntaxTree(view.state).iterate({
          from,
          to,
          enter: (node) => {
            const { type, from, to } = node;
            switch (type.name) {
              case "HeaderMark":
                decorations.push(
                  Decoration.mark({ class: "header-mark" }).range(from, to),
                );
                break;
              case "QuoteMark":
                decorations.push(
                  Decoration.mark({ class: "quote-mark" }).range(from, to),
                );
                break;
              case "ListMark":
                decorations.push(
                  Decoration.mark({ class: "list-mark" }).range(from, to),
                );
                break;
              case "EmphasisMark":
              case "StrongEmphasisMark":
              case "CodeMark":
                decorations.push(
                  Decoration.mark({ class: "cm-formatting" }).range(from, to),
                );
                break;
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
// --- END: Original Live Preview Code ---

// --- START: New Frontmatter Rendering Code ---

class FrontmatterWidget extends WidgetType {
  constructor(content) {
    super();
    this.content = content;
  }

  toDOM() {
    const container = document.createElement("div");
    container.className = "cm-frontmatter";

    const lines = this.content.split("\n").filter((line) => line.trim() !== "");

    const list = document.createElement("ul");
    list.className = "cm-frontmatter-list";

    for (const line of lines) {
      const parts = line.split(":");
      const key = parts[0]?.trim();
      const value = parts
        .slice(1)
        .join(":")
        .trim()
        .replace(/^"|"$/g, "")
        .replace(/^'|'$/g, "");

      if (!key) continue;

      const listItem = document.createElement("li");
      listItem.className = "cm-frontmatter-property";

      const keyEl = document.createElement("span");
      keyEl.className = "cm-frontmatter-key";
      keyEl.textContent = `${key}: `;

      const valueEl = document.createElement("span");
      valueEl.className = "cm-frontmatter-value";
      valueEl.textContent = value;

      listItem.appendChild(keyEl);
      listItem.appendChild(valueEl);
      list.appendChild(listItem);
    }

    container.appendChild(list);
    return container;
  }
}

const frontmatterField = StateField.define({
  create(state) {
    return Decoration.none;
  },
  update(value, tr) {
    const builder = new RangeSetBuilder();
    const doc = tr.state.doc;
    const firstLine = doc.line(1);

    if (doc.lines < 2 || firstLine.text.trim() !== "---") {
      return Decoration.none;
    }

    let endLineNum = -1;
    let content = [];
    for (let i = 2; i <= doc.lines; i++) {
      const line = doc.line(i);
      if (line.text.trim() === "---") {
        endLineNum = i;
        break;
      }
      content.push(line.text);
    }

    if (endLineNum !== -1) {
      const from = firstLine.from;
      const to = doc.line(endLineNum).to;
      const selection = tr.state.selection.main;
      const cursorOnFrontmatter = selection.from >= from && selection.to <= to;

      if (!cursorOnFrontmatter) {
        builder.add(
          from,
          to,
          Decoration.replace({
            widget: new FrontmatterWidget(content.join("\n")),
            block: true,
          }),
        );
      }
    }

    return builder.finish();
  },
  provide: (f) => EditorView.decorations.from(f),
});

// --- END: New Frontmatter Rendering Code ---

// --- START: Combined Activation ---
export function activate(app) {
  log.info("live-preview", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  // Add both the original plugin and the new state field
  app.state.cmExtensions.push(livePreviewPlugin, frontmatterField);
}
// --- END: Combined Activation ---
