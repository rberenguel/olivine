import { ViewPlugin, Decoration, WidgetType } from "CodeMirrorBundle";
import { findFileByTitle } from "../../core/files.js";
import { state } from "../../core/state.js";

class ImageWidget extends WidgetType {
  constructor(url) {
    super();
    this.url = url;
  }

  toDOM() {
    const img = document.createElement("img");
    img.className = "cm-rendered-image";
    img.src = this.url;
    img.alt = "Embedded Image";
    img.onerror = () => {
      img.alt = "Image not found";
      img.style.display = "none";
    };
    return img;
  }
}

function decorate(view) {
  const decorations = [];
  const imageRegex = /!\[\[([^\]]+)\]\]|!\[([^\]]*)\]\(([^)]+)\)/g;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);
    log.info("images", text);
    let match;
    while ((match = imageRegex.exec(text))) {
      const start = from + match.index;
      const end = start + match[0].length;
      const selection = view.state.selection.main;
      if (selection.from >= start && selection.to <= end) {
        log.info("inline-images", "Cursor is in");
        continue;
      }
      let url = null;

      // This is an Obsidian-style embed
      if (match[1]) {
        const filePath = findFileByTitle(match[1].split("|")[0]);
        if (filePath) {
          // Construct the URL to fetch the file from the Go server
          url = `/api/files/read?path=${encodeURIComponent(filePath)}`;
        }
      }
      // This is a standard Markdown image
      else if (match[3]) {
        url = match[3];
      }
      log.info("images", `url: ${url}`);
      //url = undefined
      if (url) {
        decorations.push(
          Decoration.replace({
            widget: new ImageWidget(url),
          }).range(start, end),
        );
      }
    }
  }

  return Decoration.set(decorations);
}

const inlineImagesPlugin = ViewPlugin.fromClass(
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

export function activate(app) {
  log.info("images", "Activating Extension");
  if (!app.state.cmExtensions) {
    app.state.cmExtensions = [];
  }
  app.state.cmExtensions.push(inlineImagesPlugin);
}
