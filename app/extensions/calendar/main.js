import { openFile } from "../../core/files.js";
import { state } from "../../core/state.js";

// Helper to format a date as YYYYMMDD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}${month}${day}`;
}

export function activate(app) {
    console.log("Activating Calendar Extension");

    const calendarContainer = document.createElement("div");
    calendarContainer.id = "calendar-container";
    app.ui.registerView("right-sidebar-panel", calendarContainer);

    // Function to get journal file dates and mark them
    const refreshCalendarDates = () => {
        let popups = {}
        const journalFiles = app.state.allFilePaths
            .filter(filePath => filePath.startsWith("journal/"))
            .map(filePath => {
                const match = filePath.match(/(\d{4})(\d{2})(\d{2})\.md$/);
                if (!match) return null;
                popups[`${match[1]}-${match[2]}-${match[3]}`] = {modifier: 'calendar-existing-day'}
            })

        if (window.calendar) {
            //window.calendar.settings.selected.dates = journalFiles;
            window.calendar.popups = popups
            window.calendar.update();
        }
    };

    // Initialize Vanilla Calendar
    window.calendar = new VanillaCalendar("#calendar-container", {
        settings: {
            iso8601: true,
            selection: { day: 'single' },
            visibility: { theme: 'dark' },
        },
        actions: {
            clickDay(e, dates) {
                if (dates.selectedDates) {
                    const clickedDate = new Date(dates.selectedDates);
                    console.log(clickedDate)
                    const dateString = formatDate(clickedDate);
                    console.log(dateString)
                    const filePath = `journal/${dateString}.md`;

                    const fileExists = app.state.allFilePaths.some(f => f === filePath);

                    if (fileExists) {
                        openFile(filePath, state.activePane);
                    } else {
                        // Create a new file if it doesn't exist
                        app.workspace.createNewFile(filePath, `# ${dateString}\n\n`);
                    }
                }
            },
        },
    });
    window.calendar.init();

    // Refresh calendar when workspace is ready and when files change
    app.events.on("workspace:ready", refreshCalendarDates);
    app.events.on("file:saved", refreshCalendarDates); // A good proxy for changes
}