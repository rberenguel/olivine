import { getSlidesWithBoundaries } from './parser.js';
import { marked } from 'CodeMirrorBundle';

export class PresentationView {
    constructor(containerEl) {
        this.containerEl = containerEl;
        this.floatingEl = null;
        this.visible = false;
        this.slides = [];
        this.currentSlideIndex = -1;
    }

    create() {
        this.floatingEl = document.createElement('div');
        this.floatingEl.className = 'slide-preview';
        this.containerEl.appendChild(this.floatingEl);
        this.show();
    }

    updateForCursorPosition(content, cursorLine) {
        this.slides = getSlidesWithBoundaries(content);
        const newSlideIndex = this.slides.findIndex(
            (slide) => cursorLine >= slide.startLine && cursorLine <= slide.endLine
        );

        if (newSlideIndex !== -1 && newSlideIndex !== this.currentSlideIndex) {
            this.currentSlideIndex = newSlideIndex;
            this.renderSlide(this.slides[this.currentSlideIndex]);
        } else if (newSlideIndex === -1 && this.currentSlideIndex !== -1) {
            this.clear();
        }
    }

    applyInlineCssDirectives(container) {
        const elements = container.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li');
        const directiveRegex = /\{css;`?(.+?)`?\}/g;
        elements.forEach((element) => {
            const htmlEl = element;
            if (htmlEl.innerHTML.includes('{css;')) {
                const originalHtml = htmlEl.innerHTML;
                let styles = "";
                const cleanedHtml = originalHtml.replace(directiveRegex, (match, css) => {
                    styles += css.trim().endsWith(";") ? css.trim() + " " : css.trim() + "; ";
                    return "";
                });
                if (styles) {
                    htmlEl.style.cssText += styles;
                    htmlEl.innerHTML = cleanedHtml.trim();
                }
            }
        });
    }

    renderSlide(slide) {
        if (!this.floatingEl || !slide) return;

        // Reset slide container
        this.floatingEl.innerHTML = '';
        this.floatingEl.style.backgroundImage = '';
        this.floatingEl.classList.remove('layout-fill', 'layout-bg', 'layout-split', 'split-left', 'split-right');

        // --- 1. Handle Footnotes ---
        let finalMarkdown = slide.content;
        const lines = slide.content.split('\n');
        const footnoteDefs = new Map();
        const contentLines = [];
        const footnoteDefRegex = /^.*\[\^(.+?)\]:\s*(.*)/;

        for (const line of lines) {
            const match = line.match(footnoteDefRegex);
            if (match) {
                footnoteDefs.set(match[1].trim(), match[2].trim());
            } else {
                contentLines.push(line);
            }
        }

        if (footnoteDefs.size > 0) {
            const mainMarkdown = contentLines.join('\n');
            const footnoteRefRegex = /\[\^(.+?)\]/g;
            const footnoteRefMap = new Map();
            let footnoteCounter = 1;

            mainMarkdown.replace(footnoteRefRegex, (match, id) => {
                id = id.trim();
                if (footnoteDefs.has(id) && !footnoteRefMap.has(id)) {
                    footnoteRefMap.set(id, footnoteCounter++);
                }
                return match;
            });

            if (footnoteRefMap.size > 0) {
                finalMarkdown = mainMarkdown.replace(footnoteRefRegex, (match, id) => {
                    id = id.trim();
                    const index = footnoteRefMap.get(id);
                    return index ? `<sup class="footnote-ref">${index}</sup>` : match;
                });

                const footnotesContainer = this.floatingEl.appendChild(document.createElement('div'));
                footnotesContainer.className = 'slide-footnotes-container';
                const footnotesList = footnotesContainer.appendChild(document.createElement('ol'));
                const sortedRefs = Array.from(footnoteRefMap.entries()).sort((a, b) => a[1] - b[1]);

                for (const [id] of sortedRefs) {
                    const content = footnoteDefs.get(id);
                    if (content) {
                        const listItem = footnotesList.appendChild(document.createElement('li'));
                        listItem.id = `fn-${id}`;
                        listItem.innerHTML = marked.parse(content);
                    }
                }
            }
        }

        // --- 2. Initial Markdown Render ---
        const shadowHost = document.createElement('div');
        shadowHost.innerHTML = marked.parse(finalMarkdown);

        // --- 3. Apply Inline CSS Directives ---
        this.applyInlineCssDirectives(shadowHost);

        // --- 4. Handle Image-based Layouts ---
        const allImages = Array.from(shadowHost.querySelectorAll("img"));
        const isSimpleFill = allImages.length === 1 && !allImages[0].alt.match(/^(bg|left|right)/) && shadowHost.textContent?.trim() === "";

        if (isSimpleFill) {
            this.floatingEl.classList.add("layout-fill");
            this.floatingEl.style.backgroundImage = `url("${allImages[0].src}")`;
            return;
        }

        const imageInfos = allImages.map(img => ({ el: img, match: img.alt.match(/^(bg|left|right)(?:\s+(.*))?$/) }));
        const bgImageInfos = imageInfos.filter(info => info.match && info.match[1] === 'bg');
        const sideImageInfo = imageInfos.find(info => info.match && ['left', 'right'].includes(info.match[1]));

        if (bgImageInfos.length > 0) {
            this.floatingEl.classList.add('layout-bg');
            const sliceContainer = this.floatingEl.appendChild(document.createElement('div'));
            sliceContainer.className = 'bg-slice-container';
            bgImageInfos.forEach(info => {
                const slice = sliceContainer.appendChild(document.createElement('div'));
                slice.className = 'bg-slice';
                slice.style.backgroundImage = `url("${info.el.src}")`;
                info.el.parentElement?.remove();
            });
            const bgWrapper = this.floatingEl.appendChild(document.createElement('div'));
            bgWrapper.className = 'bg-content-wrapper';
            const filterArgs = bgImageInfos[0].match?.[2]?.trim();
            if (filterArgs) {
                bgWrapper.style.setProperty('--custom-bg-filter', filterArgs);
            }
            bgWrapper.append(...Array.from(shadowHost.childNodes));
        } else if (sideImageInfo) {
            const keyword = sideImageInfo.match[1];
            sideImageInfo.el.parentElement?.remove();
            this.floatingEl.classList.add('layout-split', keyword === 'left' ? 'split-left' : 'split-right');
            const imagePane = this.floatingEl.appendChild(document.createElement('div'));
            imagePane.className = 'split-image-pane';
            const textPane = this.floatingEl.appendChild(document.createElement('div'));
            textPane.className = 'split-text-pane';
            imagePane.style.backgroundImage = `url("${sideImageInfo.el.src}")`;
            textPane.append(...Array.from(shadowHost.childNodes));
        } else {
            this.floatingEl.append(...Array.from(shadowHost.childNodes));
        }
    }

    clear() {
        if (this.floatingEl) {
            this.floatingEl.innerHTML = '';
        }
        this.currentSlideIndex = -1;
    }

    show() {
        if (!this.floatingEl) return;
        this.floatingEl.classList.add("is-visible");
        this.visible = true;
    }

    hide() {
        if (!this.floatingEl) return;
        this.floatingEl.classList.remove("is-visible");
        this.visible = false;
    }

    destroy() {
        if (this.floatingEl) {
            this.floatingEl.remove();
            this.floatingEl = null;
        }
    }
}

