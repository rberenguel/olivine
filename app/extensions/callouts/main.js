import {
  WidgetType,
  Decoration,
  syntaxTree,
  EditorView,
  StateField,
  marked,
} from "CodeMirrorBundle";

// --- Marked.js Extension for Tags ---
const walkTokens = (token) => {
  if (token.type === "text") {
    // Regex to find tags: a # followed by allowed characters, preceded by a space or start of string.
    const tagRegex = /(^|\s)#([a-zA-Z0-9_/-]+)/g;
    token.text = token.text.replace(tagRegex, (match, p1, p2) => {
      // p1 is the space or start of string, p2 is the tag name
      return `${p1}<span class="cm-tag">#${p2}</span>`;
    });
  }
};

marked.use({ walkTokens });
// --- End Marked.js Extension ---

// Map callout types to their Iconoir class names and display titles
function getCalloutConfig(type) {
  // Read the --callout-icon-{type} variable from the document's computed styles
  const iconClass = getComputedStyle(document.documentElement)
    .getPropertyValue(`--callout-icon-${type}`)
    .trim(); // .trim() is important to remove leading/trailing whitespace

  return {
    // Fallback to a default icon if the CSS variable isn't defined
    icon: iconClass || "iconoir-info-circle",
    // Create a default title by capitalizing the type
    title: type.charAt(0).toUpperCase() + type.slice(1),
  };
}

class CalloutWidget extends WidgetType {
  constructor(type, title, contentHTML, fullNodeFrom, fullNodeTo) {
    super();
    this.type = type;
    this.title = title;
    this.contentHTML = contentHTML;
    this.fullNodeFrom = fullNodeFrom; // Needed to put cursor back correctly
    this.fullNodeTo = fullNodeTo;
  }

  eq(other) {
    // Widgets are considered equal if their content hasn't changed
    return other.type === this.type && other.contentHTML === this.contentHTML;
  }

  toDOM(view) {
    const config = getCalloutConfig(this.type);
    const container = document.createElement("div");
    container.className = `callout callout-${this.type}`;
    container.dataset.callout = this.type;
    const header = container.appendChild(document.createElement("div"));
    header.className = "callout-header";

    const titleContainer = header.appendChild(document.createElement("span"));
    const iconSpan = titleContainer.appendChild(document.createElement("span"));
    iconSpan.className = `iconoir ${config.icon}`;
    titleContainer.appendChild(document.createTextNode(` ${this.title}`));

    // Add an edit button/icon to click and reveal source
    const editIcon = header.appendChild(document.createElement("span"));
    editIcon.className = "iconoir iconoir-edit-pencil edit-icon";
    editIcon.title = "Edit callout";
    editIcon.addEventListener("mousedown", (e) => {
      e.preventDefault(); // Prevent default text selection
      // Manually set cursor inside the block to reveal source
      view.dispatch({
        selection: { anchor: this.fullNodeFrom + 1 }, // +1 to go inside the block
      });
    });

    const content = container.appendChild(document.createElement("div"));
    content.className = "callout-content rendered-markdown";
    content.innerHTML = marked.parse(this.contentHTML); // Render the markdown content as HTML

    return container;
  }

  // Prevents the widget from being editable directly
  // This is crucial when the widget replaces actual text
  ignoreEvent() {
    return true;
  }
}

function buildCalloutDecorations(state) {
  const decorations = [];
  const calloutRegex = /^>\s*\[!(\w+)\](?:(?:\s+([^\n]+))?)$/i;

  syntaxTree(state).iterate({
    enter: (node) => {
      if (
        node.name === "Blockquote" &&
        node.from === state.doc.lineAt(node.from).from
      ) {
        const firstLine = state.doc.lineAt(node.from);
        const match = firstLine.text.trim().match(calloutRegex);
        if (match) {
          const calloutType = match[1].toLowerCase();
          const customTitle = match[2] || calloutType;
          const selection = state.selection.main;
          const cursorInside =
            selection.from >= node.from && selection.to <= node.to;

          if (cursorInside) {
            // If cursor is inside, just hide the header line and stop.
            const firstLine = state.doc.lineAt(node.from);
            decorations.push(
              Decoration.line({
                class: "cm-callout-raw-header", // Use your new class name
              }).range(firstLine.from),
            );
            return; // Exit the 'enter' function for this node
          }
          let contentMarkdown = "";
          const startContentLine = state.doc.lineAt(node.from).number + 1;
          const endContentLine = state.doc.lineAt(node.to).number;

          if (startContentLine <= endContentLine) {
            for (let i = startContentLine; i <= endContentLine; i++) {
              let lineText = state.doc.line(i).text;
              contentMarkdown += lineText.replace(/^>\s*/, "") + "\n";
            }
          }

          // Create the widget decoration
          const deco = Decoration.replace({
            widget: new CalloutWidget(
              calloutType,
              customTitle,
              contentMarkdown,
              node.from,
              node.to,
            ),
            block: true,
          });
          decorations.push(deco.range(node.from, node.to));
        }
      }
    },
  });
  return Decoration.set(decorations, true);
}

const calloutStateField = StateField.define({
  create(state) {
    return buildCalloutDecorations(state);
  },
  update(decorations, transaction) {
    // Add the check for transaction.selection
    if (!transaction.docChanged && !transaction.selection) {
      return decorations;
    }
    return buildCalloutDecorations(transaction.state);
  },

  // This provides the decorations from our field to the editor view
  provide(field) {
    return EditorView.decorations.from(field);
  },
});

export function activate(app) {
  log.info("callouts", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  // Register the StateField as our extension
  app.state.cmExtensions.push(calloutStateField);
}
