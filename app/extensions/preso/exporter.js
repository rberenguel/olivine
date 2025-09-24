import { getSlidesWithBoundaries } from './parser.js';
import { PresentationView } from './presentation-view.js';
import { marked } from 'CodeMirrorBundle';

export class Exporter {
    constructor(app) {
        this.app = app;
    }

    async getCombinedCss() {
        const cssStrings = [];
        for (const sheet of document.styleSheets) {
            try {
                if (sheet.href) {
                    const response = await fetch(sheet.href);
                    if (response.ok) {
                        cssStrings.push(await response.text());
                    }
                } else if (sheet.cssRules) {
                    cssStrings.push(Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n'));
                }
            } catch (e) {
                console.warn(`Could not read stylesheet:`, sheet.href, e);
            }
        }
        return cssStrings.join('\n');
    }

    async convertUrlToBase64(url) {
        // This needs to handle both absolute and relative URLs correctly.
        const absoluteUrl = new URL(url, window.location.href).href;
        const response = await fetch(absoluteUrl);
        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }

    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    async createHtmlDocument(title, slidesHtml, speakerNotesHtml, css) {
        const bodyClass = document.body.className.includes('theme-dark') ? 'theme-dark' : 'theme-light';

        const slideMarkup = slidesHtml.map((slideOuterHtml, index) => {
                if (!slideOuterHtml) return '';
                const navigationDiv = `<div class="navigation"><div class="nav-label prev"></div><div class="nav-label overview-toggle"></div><div class="nav-label notes-toggle"></div><div class="nav-label next"></div></div>`;
                return `<div class="slide-wrapper ${index === 0 ? "active" : ""}">${slideOuterHtml.replace('</div>', navigationDiv + '</div>')}</div>`;
            }).join('\n');

        const speakerNotesMarkup = speakerNotesHtml.map((notes, index) =>
            `<div class="notes-content" id="notes-for-slide-${index}">${notes}</div>`
        ).join('\n');
        
        const template = `
<!DOCTYPE html>
<html>
<head>
    <title>${title}</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>${css}</style>
</head>
<body class="${bodyClass}">
    <div class="slides-container">${slideMarkup}</div>
    <div class="speaker-notes-pane"><div class="notes-content-wrapper">${speakerNotesMarkup}</div></div>
    <script>
        // Basic navigation and state management logic
        let currentSlide = 0;
        const slides = document.querySelectorAll('.slide-wrapper');
        const notes = document.querySelectorAll('.notes-content');
        const notesPane = document.querySelector('.speaker-notes-pane');

        function showSlide(index) {
            slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
            notes.forEach((note, i) => note.style.display = i === index ? 'block' : 'none');
            currentSlide = index;
            window.location.hash = '#' + (index + 1);
        }

        document.querySelector('.slides-container').addEventListener('click', e => {
            if (e.target.classList.contains('next')) {
                showSlide((currentSlide + 1) % slides.length);
            } else if (e.target.classList.contains('prev')) {
                showSlide((currentSlide - 1 + slides.length) % slides.length);
            } else if (e.target.classList.contains('notes-toggle')) {
                notesPane.classList.toggle('visible');
            }
        });

        document.addEventListener('keydown', e => {
            if (e.key === 'ArrowRight' || e.key === ' ') showSlide((currentSlide + 1) % slides.length);
            if (e.key === 'ArrowLeft') showSlide((currentSlide - 1 + slides.length) % slides.length);
            if (e.key === 'n') notesPane.classList.toggle('visible');
        });

        const initialSlide = parseInt(window.location.hash.substring(1), 10) - 1 || 0;
        showSlide(initialSlide);
    <\/script>
</body>
</html>`;
        return template.trim();
    }

    async exportPresentation(markdownContent, baseFilename = 'presentation') {
        const allSlides = getSlidesWithBoundaries(markdownContent);
        const combinedCss = await this.getCombinedCss();

        const renderedSlides = await Promise.all(allSlides.map(async (slide) => {
            const tempContainer = document.createElement('div');
            document.body.appendChild(tempContainer);
            tempContainer.style.cssText = 'position:absolute;top:-9999px;left:-9999px;';

            const tempView = new PresentationView(tempContainer);
            tempView.create();
            tempView.renderSlide(slide);

            const floatingEl = tempView.floatingEl;
            for (const img of Array.from(floatingEl.querySelectorAll('img'))) {
                if (img.src && !img.src.startsWith('data:')) {
                    img.src = await this.convertUrlToBase64(img.src);
                }
            }
             for (const el of Array.from(floatingEl.querySelectorAll('[style*="background-image"]'))) {
                const style = el.style.backgroundImage;
                 if (style.includes('url(') && !style.includes('data:')) {
                    const urlMatch = style.match(/url\\("?([^"]+)"?\\)/);
                    if (urlMatch && urlMatch[1]) {
                        const dataUrl = await this.convertUrlToBase64(urlMatch[1]);
                        el.style.backgroundImage = `url("\${dataUrl}")`;
                    }
                }
            }

            const slideHtml = floatingEl.innerHTML;
            const speakerNotesHtml = marked.parse(slide.speakerNotes.join('\\n'));
            
            tempView.destroy();
            tempContainer.remove();

            return { slideHtml: `<div class="slide-preview is-visible">${slideHtml}</div>`, speakerNotesHtml };
        }));

        const finalHtml = await this.createHtmlDocument(
            baseFilename,
            renderedSlides.map(s => s.slideHtml),
            renderedSlides.map(s => s.speakerNotesHtml),
            combinedCss
        );

        this.downloadFile(finalHtml, `${baseFilename}.html`);
    }
}
