import { PresentationView } from './presentation-view.js';
import { Exporter } from './exporter.js';

let presentationView = null;
let exporter = null;

function togglePresentationView() {
    if (presentationView) {
        presentationView.destroy();
        presentationView = null;
    } else {
        const container = document.querySelector('#main-content');
        if (container) {
            presentationView = new PresentationView(container);
            presentationView.create();
        } else {
            console.error("Could not find '.main-content' to attach the presentation view.");
        }
    }
}

export function activate(app) {
    exporter = new Exporter(app);
    log.info("preso", "Activating Extension");
    // 1. Register the command to toggle the view
    app.registerCommand('preso:toggle', {
        title: 'Toggle presentation view',
        lambda: () => togglePresentationView(),
    });
app.registerCommand('preso:export-html', {
        title: 'Export presentation as HTML',
        lambda: () => {
            const activePane = app.state.activePane;
            if (exporter && activePane && activePane.editorView) {
                const content = activePane.editorView.state.doc.toString();
                const filename = activePane.filePath?.split('/')?.pop()?.replace(/\.md$/, '') || 'presentation';
                exporter.exportPresentation(content, filename);
            } else {
                console.error("No active editor to export from.");
            }
        },
    });
    // 2. Listen for cursor activity events from the editor
    app.events.on('editor:cursorActivity', (data) => {
        if (presentationView && data.content && data.cursor) {
            // Check if the file has 'preso:' in its frontmatter
            if (data.content.trim().startsWith('---')) {
                 const frontmatterMatch = data.content.match(/^---([\s\S]*?)---/);
                 if (frontmatterMatch && frontmatterMatch[1].includes('preso:')) {
                    presentationView.show();
                    presentationView.updateForCursorPosition(data.content, data.cursor.line);
                    return; // Keep the view visible and updated
                 }
            }
            // If it's not a presentation file, or the view is off, hide it.
            //presentationView.hide();
        }
    });
}
