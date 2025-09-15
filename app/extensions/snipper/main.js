import {
  StateField,
  Decoration,
  syntaxTree,
  WidgetType,
  EditorView,
} from "CodeMirrorBundle";

// Settings are hardcoded for now, mimicking the Obsidian plugin's defaults.
const SNIPPER_SETTINGS = {
  snippetFolderPath: "snippets",
  characterLimit: 140,
  defaultStyle: "glow",
};

class SnippetWidget extends WidgetType {
  constructor(style, sourcePath, from, to) {
    super();
    this.style = style;
    this.sourcePath = sourcePath; // The path of the note containing the snippet
    this.from = from;
    this.to = to;
    this.saveTimeout = null;
  }

  // --- ADDED: The eq method to prevent unnecessary re-renders ---
  eq(other) {
    // If the style and source path are the same, CodeMirror can skip
    // redrawing the widget, which prevents the flicker.
    return this.style === other.style && this.sourcePath === other.sourcePath;
  }

  toDOM(view) {
    const container = document.createElement("div");
    container.className = `snippet-widget ${this.style}`;
    // Initial state: render the read-only view.
    this.renderView(view, container);
    return container;
  }

  // Renders the read-only view of the snippet
  async renderView(view, container) {
    container.innerHTML = ""; // Clear existing content
    container.onclick = () => {
      directClick = true;
      this.renderEdit(view, container);
    }; // Re-attach click listener
    const snippetPath = this.getSnippetPath();

    try {
      const content = await window.app.workspace.readFile(snippetPath);
      if (content != null) {
        container.textContent = content;
        if (content === "") {
          container.textContent = "Empty snippet. Click to edit.";
        }
      } else {
        container.textContent = "Error reading snippet file.";
      }
    } catch (e) {
      log.warn("snipper", e);
      try {
        log.info("snipper", "Creating snippet file");
        await window.app.workspace.createNewFile(snippetPath);
        container.textContent = "Empty snippet. Click to edit.";
      } catch (folderError) {
        const folder = SNIPPER_SETTINGS.snippetFolderPath;
        log.info(
          "snipper",
          `Assuming folder '${folder}' exists or will be created.`,
        );
        await window.app.workspace.createNewFile(snippetPath);
        container.textContent = "Empty snippet. Click to edit.";
      }
    }
  }

  // Renders the editable <textarea>
  async renderEdit(view, container) {
    container.innerHTML = "";
    container.onclick = null; // Disable click listener while in edit mode

    const textarea = document.createElement("textarea");
    const charCount = document.createElement("span");
    const snippetPath = this.getSnippetPath();

    try {
      const content = await window.app.workspace.readFile(snippetPath);
      textarea.value = content;
      this.updateCharCount(textarea.value, charCount);
    } catch (e) {
      textarea.value = "";
      this.updateCharCount("", charCount);
    }

    textarea.oninput = () => {
      this.updateCharCount(textarea.value, charCount);
      clearTimeout(this.saveTimeout);
      this.saveTimeout = setTimeout(async () => {
        await window.app.workspace.saveFile(snippetPath, textarea.value);
      }, 500); // Debounced save
    };

    textarea.onblur = async () => {
      clearTimeout(this.saveTimeout);
      await window.app.workspace.saveFile(snippetPath, textarea.value);
      this.renderView(view, container); // Switch back to view mode
    };

    textarea.onclick = (e) => e.stopPropagation();

    container.appendChild(textarea);
    container.appendChild(charCount);
    setTimeout(() => textarea.focus(), 0);
  }

  // Helper functions adapted from the original plugin
  getSnippetPath() {
    if (!this.sourcePath) return null; // Guard against missing sourcePath
    const currentFileName = this.sourcePath.split("/").pop().split(".").shift();
    return `${SNIPPER_SETTINGS.snippetFolderPath}/s-${currentFileName}.md`;
  }
  updateCharCount(text, el) {
    const remaining = SNIPPER_SETTINGS.characterLimit - text.length;
    el.textContent = `${remaining}`;
    el.style.color = remaining < 0 ? "red" : "inherit";
  }

  ignoreEvent() {
    return true;
  }
}

let directClick = false;

// This function is now standalone to avoid `this` context issues.
function buildDecorations(state) {
  const decorations = [];
  const selection = state.selection.main;

  syntaxTree(state).iterate({
    enter: (node) => {
      if (node.name === "FencedCode") {
        const codeBlockHeader = state.doc.sliceString(
          node.from,
          state.doc.lineAt(node.from).to,
        );
        if (codeBlockHeader.startsWith("```snippet")) {
          const cursorInside =
            selection.from >= node.from && selection.to <= node.to;
          if (cursorInside && !directClick) {
            directClick = false;
            return;
          }

          const style =
            codeBlockHeader.replace("```snippet", "").trim() ||
            SNIPPER_SETTINGS.defaultStyle;
          const sourcePath = window.app.state.activePane?.filePath || "";

          decorations.push(
            Decoration.replace({
              widget: new SnippetWidget(style, sourcePath, node.from, node.to),
              block: true,
            }).range(node.from, node.to),
          );
        }
      }
    },
  });
  return Decoration.set(decorations, true);
}

// This StateField finds ` ```snippet ` blocks and replaces them.
const snippetPlugin = StateField.define({
  create(state) {
    return buildDecorations(state);
  },
  update(decorations, transaction) {
    if (!transaction.docChanged) return decorations;
    return buildDecorations(transaction.state);
  },
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

// Activate the plugin and register the "Insert Snipper block" command.
export function activate(app) {
  log.info("snipper", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  app.state.cmExtensions.push(snippetPlugin);

  app.commands.register("static", {
    title: "Insert Snipper block",
    lambda: () => {
      const editorView = app.workspace.getActivePane().editorView;
      const { from, to } = editorView.state.selection.main;
      editorView.dispatch({
        changes: { from, to, insert: "```snippet\n\n```" },
        selection: { anchor: from + "```snippet\n".length },
      });
    },
  });
  app.commands.refreshPalette();
}
