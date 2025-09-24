import {
  ViewPlugin,
  Decoration,
  WidgetType,
  syntaxTree,
} from "CodeMirrorBundle";

// This extension still does not work (does not fetch images from the vault)
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
    return img;
  }
}

function decorate(view) {
  const decorations = [];

  syntaxTree(view.state).iterate({
    enter: (node) => {
      if (node.type.name !== "Image") return;
      const selection = view.state.selection.main;
      if (selection.from >= node.from && selection.to <= node.to) {
        return;
      }
      const urlNode = node.node.getChild("URL");
      if (!urlNode) return;

      const url = view.state.doc.sliceString(urlNode.from, urlNode.to);

      const deco = Decoration.replace({
        widget: new ImageWidget(url),
      }).range(node.from, node.to);

      decorations.push(deco);
    },
  });

  decorations.sort((a, b) => a.from - b.from);
  return Decoration.set(decorations);
}

const inlineImagesPlugin = ViewPlugin.fromClass(
  class {
    constructor(view) {
      this.decorations = decorate(view);
    }
    update(update) {
      if (update.docChanged || update.viewportChanged) {
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
