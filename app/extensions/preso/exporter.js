import { getSlidesWithBoundaries } from "./parser.js";
import { PresentationView } from "./presentation-view.js";
import { marked } from "CodeMirrorBundle";

export class Exporter {
  constructor(app) {
    this.app = app;
  }

  async getAssetContent(assetName) {
    const path = `../app/extensions/preso/assets/${assetName}`;
    try {
      const response = await fetch(path);
      if (response.ok) {
        return await response.text();
      }
      console.error(
        `[Exporter] Could not fetch asset: ${path}. Status: ${response.status}`,
      );
    } catch (e) {
      console.error(`[Exporter] Network error fetching asset: ${path}`, e);
    }
    return "";
  }

  async exportPresentationAsHtml(cssOnly = false) {
    const activePane = this.app.state.activePane;
    if (!activePane || !activePane.filePath) {
      console.error("No active presentation file to export.");
      return;
    }

    const file = {
      path: activePane.filePath,
      basename: activePane.filePath.split("/").pop().replace(/\.md$/, ""),
    };
    const content = activePane.editorView.state.doc.toString();
    const allSlides = getSlidesWithBoundaries(content);

    // Simplified theme handling for Olivine
    const frontmatterMatch = content.match(/^---([\s\S]*?)---/);
    const theme = frontmatterMatch
      ? (frontmatterMatch[1].match(/preso:\s*(\w+)/) || [])[1]
      : null;

    const bodyThemeClass = document.body.className.includes("theme-dark")
      ? "theme-dark"
      : "theme-light";

    console.log(`Exporting ${allSlides.length} slides...`);

    // Olivine doesn't have a direct equivalent of getFirstLinkpathDest or getResourcePath
    // This is a simplified placeholder. We'll need to resolve this.
    const getImagePath = (directiveValue) => {
      if (!directiveValue) return null;
      const imageMatch = directiveValue.match(/!\b\[\[(.*?)\]\]/);
      if (imageMatch) {
        const imageName = imageMatch[1];
        // This is a major assumption. Olivine needs a way to resolve this.
        // For now, let's assume it's relative to the root.
        return imageName;
      }
      return null;
    };

    let faviconDataUrl = null;
    for (const slide of allSlides) {
      if ("favicon" in slide.directives) {
        const faviconPath = getImagePath(slide.directives["favicon"]);
        if (faviconPath) {
          faviconDataUrl = await this.convertUrlToBase64(faviconPath);
          break;
        }
      }
    }

    let footerText = null;
    let footerImage = null;
    let slideNumbers = false;
    let headerText = null;
    let headerImage = null;
    let topLeftIcon = null;
    let topRightIcon = null;

    const slidePromises = allSlides.map(async (currentSlide, index) => {
      if ("footer" in currentSlide.directives)
        footerText =
          currentSlide.directives["footer"] === "empty"
            ? null
            : currentSlide.directives["footer"];
      if ("footer-image" in currentSlide.directives)
        footerImage =
          currentSlide.directives["footer-image"] === "empty"
            ? null
            : currentSlide.directives["footer-image"];
      if ("slidenumbers" in currentSlide.directives)
        slideNumbers = currentSlide.directives["slidenumbers"] === "true";
      if ("header" in currentSlide.directives)
        headerText =
          currentSlide.directives["header"] === "empty"
            ? null
            : currentSlide.directives["header"];
      if ("header-image" in currentSlide.directives)
        headerImage =
          currentSlide.directives["header-image"] === "empty"
            ? null
            : currentSlide.directives["header-image"];
      if ("top-left-icon" in currentSlide.directives)
        topLeftIcon =
          currentSlide.directives["top-left-icon"] === "empty"
            ? null
            : currentSlide.directives["top-left-icon"];
      if ("top-right-icon" in currentSlide.directives)
        topRightIcon =
          currentSlide.directives["top-right-icon"] === "empty"
            ? null
            : currentSlide.directives["top-right-icon"];

      let showSlideNumberOnThisSlide = slideNumbers;
      if (currentSlide.directives["slidenumbers"] === "false") {
        showSlideNumberOnThisSlide = false;
      }

      const extras = {
        footerText: footerText,
        footerImageSrc: getImagePath(footerImage),
        slideNumber: showSlideNumberOnThisSlide
          ? `${index + 1} / ${allSlides.length}`
          : null,
        headerText: headerText,
        headerImageSrc: getImagePath(headerImage),
        topLeftIconSrc: getImagePath(topLeftIcon),
        topRightIconSrc: getImagePath(topRightIcon),
      };

      const speakerNotesMarkdown = currentSlide.speakerNotes.join("\n");

      const [slideHtml, speakerNotesHtml] = await Promise.all([
        this.renderSlideToHtml(currentSlide, theme, extras),
        Promise.resolve(marked.parse(speakerNotesMarkdown)),
      ]);

      return { slideHtml, speakerNotesHtml };
    });

    const [combinedCss, renderedSlides] = await Promise.all([
      this.getCombinedCss(),
      Promise.all(slidePromises),
    ]);

    const slidesHtml = renderedSlides.map((s) => s.slideHtml);
    const speakerNotesHtml = renderedSlides.map((s) => s.speakerNotesHtml);

    const finalHtml = cssOnly
      ? await this.createCssOnlyHtmlDocument(
          file.basename,
          allSlides,
          slidesHtml,
          speakerNotesHtml,
          combinedCss,
          bodyThemeClass,
          faviconDataUrl,
        )
      : await this.createHtmlDocument(
          file.basename,
          allSlides,
          slidesHtml,
          speakerNotesHtml,
          combinedCss,
          bodyThemeClass,
          faviconDataUrl,
        );

    const suffix = cssOnly ? ".css-only.html" : ".html";
    this.downloadFile(finalHtml, `${file.basename}${suffix}`);
  }

  async getCombinedCss() {
    const styleEls = Array.from(
      document.querySelectorAll('style, link[rel="stylesheet"]'),
    );
    let combinedCss = "";

    // First, fetch all CSS content
    for (const el of styleEls) {
      try {
        if (el.tagName.toLowerCase() === "style") {
          combinedCss += el.innerHTML;
        } else if (
          el.tagName.toLowerCase() === "link" &&
          el.rel === "stylesheet" &&
          el.href
        ) {
          const response = await fetch(el.href);
          if (response.ok) {
            // Pass the stylesheet's URL as the base for resolving relative font paths
            combinedCss += await this.embedFontsInCss(
              await response.text(),
              el.href,
            );
          }
        }
      } catch (e) {
        console.warn(`Could not read or fetch stylesheet:`, el, e);
      }
    }
    return combinedCss;
  }

  async embedFontsInCss(cssContent, baseUrl) {
    const fontFaceRegex = /@font-face\s*{[^}]+}/g;
    const urlRegex = /url\((['"]?)(.*?)\1\)/;
    const fontFaces = cssContent.match(fontFaceRegex) || [];

    for (const fontFace of fontFaces) {
      const urlMatch = fontFace.match(urlRegex);
      if (urlMatch && urlMatch[2] && !urlMatch[2].startsWith("data:")) {
        try {
          // Construct an absolute URL for the font file
          const fontUrl = new URL(urlMatch[2], baseUrl).href;
          const dataUrl = await this.convertUrlToBase64(fontUrl);
          const newFontFace = fontFace.replace(urlMatch[0], `url(${dataUrl})`);
          cssContent = cssContent.replace(fontFace, newFontFace);
        } catch (e) {
          console.error(`Failed to embed font from ${urlMatch[2]}`, e);
        }
      }
    }
    return cssContent;
  }

  async renderSlideToHtml(slide, theme, extras) {
    const tempContainer = document.createElement("div");
    // Hide the container from view
    tempContainer.style.cssText =
      "position:absolute; top:-9999px; left:-9999px; width:1280px; height:720px;";
    document.body.appendChild(tempContainer);

    const tempView = new PresentationView(tempContainer);
    tempView.create();
    tempView.setTheme(theme);
    await tempView.renderSlide(slide);
    await tempView.setExtras(extras);

    const floatingEl = tempView.floatingEl;
    if (floatingEl) {
      for (const img of Array.from(floatingEl.querySelectorAll("img"))) {
        if (img.src && !img.src.startsWith("data:")) {
          img.src = await this.convertUrlToBase64(img.src);
        }
      }
      const elementsWithBg = [
        floatingEl,
        ...Array.from(
          floatingEl.querySelectorAll(".split-image-pane, .bg-slice"),
        ),
      ];
      for (const el of elementsWithBg) {
        if (
          el.style.backgroundImage.includes("url(") &&
          !el.style.backgroundImage.includes("data:")
        ) {
          const urlMatch = el.style.backgroundImage.match(
            /url\(\"?([^\\"]+)\"?\)/,
          );
          if (urlMatch && urlMatch[1]) {
            const dataUrl = await this.convertUrlToBase64(urlMatch[1]);
            el.style.backgroundImage = `url("${dataUrl}")`;
          }
        }
      }
      const finalHtml = floatingEl.outerHTML;
      tempView.destroy();
      tempContainer.remove();
      return finalHtml;
    }
    return "";
  }

  async createCssOnlyHtmlDocument(
    title,
    allSlides,
    slidesHtml,
    speakerNotesHtml,
    css,
    bodyThemeClass,
    faviconDataUrl,
  ) {
    const numSlides = allSlides.length;
    const radioInputs = allSlides
      .map(
        (_, index) =>
          `<input type="radio" name="slide" id="s${index + 1}" ${index === 0 ? "checked" : ""}>`,
      )
      .join("\n");
    const slideMarkup = slidesHtml
      .map((slideOuterHtml, index) => {
        if (!slideOuterHtml) return "";
        const i = index + 1;
        const prev = i === 1 ? numSlides : i - 1;
        const next = i === numSlides ? 1 : i + 1;
        const navigationDiv = `<div class="navigation"><label for="s${prev}" class="nav-label prev"></label><label for="overview-toggle" class="nav-label overview-toggle"></label><label for="notes-toggle" class="nav-label notes-toggle"></label><label for="s${next}" class="nav-label next"></label></div>`;
        return `<div class="slide-wrapper">${slideOuterHtml.replace(/<\/div>$/, `${navigationDiv}</div>`)}</div>`;
      })
      .join("\n");
    const speakerNotesMarkup = speakerNotesHtml
      .map(
        (notes, index) =>
          `<div class="notes-content" id="notes-for-s${index + 1}">${notes}</div>`,
      )
      .join("\n");
    const miniSlidesMarkup = allSlides
      .map(
        (slide, index) =>
          `<label for="s${index + 1}" class="mini-slide-wrapper"><div class="mini-slide-content">${slide.previewText}</div></label>`,
      )
      .join("\n");

    let dynamicCss = "";
    let dynamicNotesCss = "";
    for (let i = 1; i <= numSlides; i++) {
      dynamicCss += `#s${i}:checked ~ .slides-container .slide-wrapper:nth-of-type(${i}) { opacity: 1; pointer-events: auto; z-index: 1; }\n`;
      dynamicNotesCss += `#s${i}:checked ~ .speaker-notes-pane .notes-content-wrapper #notes-for-s${i} { display: block; }\n`;
    }

    const [template, presentationCssCommon, presentationCss] =
      await Promise.all([
        this.getAssetContent("template-css-only.html"),
        this.getAssetContent("presentation-common.css"),
        this.getAssetContent("presentation-css-only.css"),
      ]);

    const finalCss = [
      css,
      presentationCssCommon,
      presentationCss
        .replace("%%DYNAMIC_CSS%%", dynamicCss)
        .replace("%%DYNAMIC_NOTES_CSS%%", dynamicNotesCss),
    ].join("\n");
    const faviconTag = faviconDataUrl
      ? `<link rel="icon" href="${faviconDataUrl}">`
      : "";

    return template
      .replace("%%TITLE%%", title)
      .replace("%%FAVICON_TAG%%", faviconTag)
      .replace("%%CSS%%", finalCss)
      .replace("%%BODY_CLASS%%", bodyThemeClass)
      .replace("%%RADIO_INPUTS%%", radioInputs)
      .replace("%%MINI_SLIDES_MARKUP%%", miniSlidesMarkup)
      .replace("%%SLIDES_MARKUP%%", slideMarkup)
      .replace("%%SPEAKER_NOTES_MARKUP%%", speakerNotesMarkup);
  }

  async createHtmlDocument(
    title,
    allSlides,
    slidesHtml,
    speakerNotesHtml,
    css,
    bodyThemeClass,
    faviconDataUrl,
  ) {
    const slideMarkup = slidesHtml
      .map((slideOuterHtml, index) => {
        if (!slideOuterHtml) return "";
        const navigationDiv = `<div class="navigation"><div class="nav-label prev"></div><div class="nav-label overview-toggle"></div><div class="nav-label notes-toggle"></div><div class="nav-label next"></div></div>`;
        return `<div class="slide-wrapper ${index === 0 ? "active" : ""}">${slideOuterHtml.replace(/<\/div>$/, `${navigationDiv}</div>`)}</div>`;
      })
      .join("\n");
    const speakerNotesMarkup = speakerNotesHtml
      .map(
        (notes, index) =>
          `<div class="notes-content" id="notes-for-slide-${index}">${notes}</div>`,
      )
      .join("\n");
    const miniSlidesMarkup = allSlides
      .map(
        (slide, index) =>
          `<div class="mini-slide-wrapper" data-slide-index="${index}"><div class="mini-slide-content">${slide.previewText}</div></div>`,
      )
      .join("\n");

    const [template, presentationCssCommon, presentationCss, navigationJs] =
      await Promise.all([
        this.getAssetContent("template-js.html"),
        this.getAssetContent("presentation-common.css"),
        this.getAssetContent("presentation-js.css"),
        this.getAssetContent("presentation.js"),
      ]);

    const finalCss = [css, presentationCssCommon, presentationCss].join("\n");
    const faviconTag = faviconDataUrl
      ? `<link rel="icon" href="${faviconDataUrl}">`
      : "";

    return template
      .replace("%%TITLE%%", title)
      .replace("%%FAVICON_TAG%%", faviconTag)
      .replace("%%CSS%%", finalCss)
      .replace("%%BODY_CLASS%%", bodyThemeClass)
      .replace("%%MINI_SLIDES_MARKUP%%", miniSlidesMarkup)
      .replace("%%SLIDES_MARKUP%%", slideMarkup)
      .replace("%%SPEAKER_NOTES_MARKUP%%", speakerNotesMarkup)
      .replace("%%NAVIGATION_JS%%", navigationJs);
  }

  async convertUrlToBase64(url) {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.error("Error converting URL to base64:", url, e);
      return url; // Return original URL on failure
    }
  }

  downloadFile(content, filename) {
    const blob = new Blob([content], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log(`Exported to ${filename}`);
  }
}
