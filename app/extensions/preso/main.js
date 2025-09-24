import { PresentationView } from "./presentation-view.js";
import { Exporter } from "./exporter.js";
import { getSlidesWithBoundaries } from "./parser.js";

let presentationView = null;
let exporter = null;

function getImagePath(app, directiveValue, sourcePath) {
  if (!directiveValue) return null;
  const imageMatch = directiveValue.match(/!\[\[(.*?)\]\]/);
  if (imageMatch) {
    const imageName = imageMatch[1];
    // This is a simplified path resolver. Olivine might need a more robust
    // implementation similar to Obsidian's getFirstLinkpathDest.
    // For now, we assume the path is relative to the vault root.
    return imageName;
  }
  return null;
}

function extractSlideExtras(app, slides, currentSlideIndex, sourcePath) {
  let footerText = null,
    footerImage = null,
    slideNumbers = false;
  let headerText = null,
    headerImage = null,
    topLeftIcon = null,
    topRightIcon = null;

  // Iterate up to the current slide to accumulate directives
  for (let i = 0; i <= currentSlideIndex; i++) {
    const slide = slides[i];
    if ("footer" in slide.directives)
      footerText =
        slide.directives["footer"] === "empty"
          ? null
          : slide.directives["footer"];
    if ("footer-image" in slide.directives)
      footerImage =
        slide.directives["footer-image"] === "empty"
          ? null
          : slide.directives["footer-image"];
    if ("slidenumbers" in slide.directives)
      slideNumbers = slide.directives["slidenumbers"] === "true";
    if ("header" in slide.directives)
      headerText =
        slide.directives["header"] === "empty"
          ? null
          : slide.directives["header"];
    if ("header-image" in slide.directives)
      headerImage =
        slide.directives["header-image"] === "empty"
          ? null
          : slide.directives["header-image"];
    if ("top-left-icon" in slide.directives)
      topLeftIcon =
        slide.directives["top-left-icon"] === "empty"
          ? null
          : slide.directives["top-left-icon"];
    if ("top-right-icon" in slide.directives)
      topRightIcon =
        slide.directives["top-right-icon"] === "empty"
          ? null
          : slide.directives["top-right-icon"];
  }

  let showSlideNumberOnThisSlide = slideNumbers;
  if (slides[currentSlideIndex]?.directives["slidenumbers"] === "false") {
    showSlideNumberOnThisSlide = false;
  }

  return {
    footerText,
    footerImageSrc: getImagePath(app, footerImage, sourcePath),
    slideNumber: showSlideNumberOnThisSlide
      ? `${currentSlideIndex + 1} / ${slides.length}`
      : null,
    headerText,
    headerImageSrc: getImagePath(app, headerImage, sourcePath),
    topLeftIconSrc: getImagePath(app, topLeftIcon, sourcePath),
    topRightIconSrc: getImagePath(app, topRightIcon, sourcePath),
  };
}

async function handleEditorChange(app, data) {
  // ADDED FOR DEBUGGING
  //log.debug("preso", "handleEditorChange triggered. Data:");
  //log.debug("preso", JSON.parse(JSON.stringify(data)));

  const { content, cursor, filePath } = data;
  if (content === undefined || !cursor) {
    // || !filePath
    console.log(cursor, filePath);
    //log.debug("preso", "Returning mystery");
    return;
  }

  let cursorLine;
  if (typeof cursor.line === "number") {
    cursorLine = cursor.line;
  } else if (typeof cursor.head === "number") {
    const activePane = app.state.activePane;
    if (activePane && activePane.editorView) {
      cursorLine =
        activePane.editorView.state.doc.lineAt(cursor.head).number - 1;
    } else {
      //log.debug("preso", "head return");
      return;
    }
  } else {
    //log.debug("preso", "line return");
    return;
  }

  const frontmatterMatch = content.match(/^---([\s\S]*?)---/);
  const presoDirective = frontmatterMatch
    ? frontmatterMatch[1].includes("preso:")
    : false;

  if (presoDirective) {
    if (!presentationView) {
      const container = document.querySelector("#main-content");
      if (!container) {
        console.error(
          "Could not find '#main-content' to attach the presentation view.",
        );
        return;
      }
      presentationView = new PresentationView(container);
      presentationView.create();
    }
    presentationView.show();

    // The view now handles its own update logic
    presentationView.updateForCursorPosition(content, cursorLine);
  } else {
    if (presentationView) {
      presentationView.hide();
    }
  }
}

function togglePreview(app) {
  if (presentationView && presentationView.visible) {
    presentationView.hide();
  } else {
    const activePane = app.state.activePane;
    if (activePane && activePane.editorView) {
      const doc = activePane.editorView.state.doc;
      const cursor = activePane.editorView.state.selection.main;
      // Pass the raw cursor object; handleEditorChange will interpret it.
      handleEditorChange(app, {
        content: doc.toString(),
        cursor: cursor,
        filePath: activePane.filePath,
      });
    }
  }
}

export function activate(app) {
  log.info("preso", "Activating Extension");
  exporter = new Exporter(app);

  app.registerCommand("preso:toggle-preview", {
    title: "Toggle presentation preview",
    lambda: () => togglePreview(app),
  });

  app.registerCommand("preso:export-html-js", {
    title: "Export presentation as HTML (with JS)",
    lambda: () => exporter.exportPresentationAsHtml(false),
  });

  app.registerCommand("preso:export-html-css-only", {
    title: "Export presentation as HTML (CSS only)",
    lambda: () => exporter.exportPresentationAsHtml(true),
  });

  app.events.on("editor:cursorActivity", (data) =>
    handleEditorChange(app, data),
  );

  // Optional: Clean up the view when the whole app closes.
  // This depends on whether Olivine has a "shutdown" or "unload" event.
  // For now, we assume it lives for the duration of the session.
}
