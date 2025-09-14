# Silex Plugin API Documentation

This document outlines the API available for creating extensions. The system is designed to be minimal but extensible. All plugin logic is executed within a browser environment.

## Extension Structure

Every extension is a self-contained module within its own directory. It must have two key files:

### 1. `manifest.json`

This file declares the extension's metadata and entry points.

- `name`: The human-readable name of the extension.
- `main`: (Required) The path to the main JavaScript entry point.
- `style`: (Optional) The path to a CSS stylesheet that will be automatically loaded.

**Example:**

```json
{
  "name": "Document Outline",
  "main": "./main.js",
  "style": "./style.css"
}
```

### 2. `main.js`

This is the JavaScript entry point. It must export a single function named `activate`.

- `activate(app)`: This function is called once when the application starts. It receives the global `app` object, which is the gateway to all core APIs.

**Example:**

```javascript
export function activate(app) {
  console.log("My extension is now active!");
  // ... register commands, views, and editor plugins here ...
}
```

---

## The Global `app` Object

The `app` object is the single argument passed to your `activate` function. It provides access to all core functionality.

- `app.state`: Raw access to the shared application state.
- `app.workspace`: API for interacting with files and editor panes.
- `app.ui`: API for creating and managing UI elements.
- `app.commands`: API for registering commands in the command palette.
- `app.events`: An event bus for decoupled communication.

---

## 1. State (`app.state`)

Direct access to the application's reactive state. Use with caution.

- `app.state.activePane`: The currently focused pane object. A pane object contains an `.editorView` (the CodeMirror instance), a `.filePath`, and other UI-related properties.
- `app.state.allFilePaths`: An array of strings, where each string is the full path to a note in the vault.
- `app.state.cmExtensions`: **(Crucial)** An array where you push your CodeMirror plugins. Any `StateField`, `ViewPlugin`, or other CodeMirror extension added to this array will be automatically included in all new and existing editor panes.

---

## 2. Workspace API (`app.workspace`)

For file and pane manipulation.

- `app.workspace.openFile(filePath: string, pane: object)`: Opens the specified file in the given pane.
- `app.workspace.saveFile(filePath: string, content: string)`: Saves content to a file.
- `app.workspace.createNewFile(filePath: string)`: Creates a new, empty file.
- `app.workspace.findFileByTitle(title: string): string | undefined`: A utility function that searches `allFilePaths` to find the full path for a note given its title (e.g., "My Note" -> "folder/My Note.md").
- `app.workspace.getActivePane(): object`: Returns the currently active pane object.

**Example:**

```javascript
// Get the active editor view
const activeEditorView = app.workspace.getActivePane().editorView;
// Open a file
const notePath = app.workspace.findFileByTitle("Daily Note");
if (notePath) {
  app.workspace.openFile(notePath, app.workspace.getActivePane());
}
```

---

## 3. UI API (`app.ui`)

For creating and managing UI elements.

- `app.ui.registerView(location: string, element: HTMLElement)`: Adds a persistent UI element to a predefined location.

  - **Available `location`s:** `'statusbar'`, `'sidebar-panel'`.

- `app.ui.registerViewType(name: string, config: object)`: Registers a new type of non-editor pane that can be opened via a command.

  - `config.title`: The display name for the new view (e.g., "Graph").
  - `config.render(container: HTMLElement)`: A function that populates the pane's content area.

- `app.ui.splitActivePane(direction: string)`: Splits the current pane.
  - **Available `direction`s:** `'vertical'` (side-by-side), `'horizontal'` (stacked).

**Example:**

```javascript
// Add an item to the status bar
const myStatusItem = document.createElement("div");
myStatusItem.textContent = "My Plugin Status";
app.ui.registerView("statusbar", myStatusItem);

// Register a new custom pane for a calendar view
app.ui.registerViewType("calendar", {
  title: "Calendar",
  render: (container) => {
    container.innerHTML = "<h2>My Calendar View</h2>";
  },
});
```

---

## 4. Commands API (`app.commands`)

Integrates with the command palette.

- `app.commands.register(group: string, command: object | object[])`: Adds one or more commands to the palette.
  - `group`: Must be `'static'`.
  - `command`: An object with `{ title: string, lambda: function }`.
- `app.commands.refreshPalette()`: Re-renders the command palette with the current command list.

**Example:**

```javascript
const myCommand = {
  title: "Insert Today's Date",
  lambda: () => {
    const editorView = app.workspace.getActivePane().editorView;
    editorView.dispatch({
      changes: {
        from: editorView.state.selection.main.head,
        insert: new Date().toLocaleDateString(),
      },
    });
  },
};
app.commands.register("static", myCommand);
app.commands.refreshPalette();
```

---

## 5. Events API (`app.events`)

A simple event bus for listening to application events.

- `app.events.on(eventName: string, callback: function)`: Listens for an event.
- `app.events.emit(eventName:string, data: object)`: Fires an event.

**Known Core Events:**

- `workspace:ready`: Fired after the initial file list is loaded. `data.files` contains the file list.
- `file:opened`: Fired when a file is opened. `data.filename` and `data.pane`.
- `file:saved`: Fired after a file is auto-saved. `data.path`.
- `pane:activated`: Fired when the active pane changes. `data.pane`.

**Example:**

```javascript
app.events.on("file:opened", ({ filename }) => {
  console.log(`${filename} was opened.`);
});
```

---

## 6. CodeMirror API Integration

To extend the editor's functionality, you create CodeMirror 6 extensions and push them to the `app.state.cmExtensions` array.

- **Importing:** All necessary CodeMirror modules are available from the `"CodeMirrorBundle"`.
- **Accessing the Editor:** Get the current editor instance via `app.workspace.getActivePane().editorView`.

**Common Extension Patterns:**

1.  **Event Handlers:** For clicks, mouseovers, etc. Use `EditorView.domEventHandlers`.

    ```javascript
    import { EditorView } from "CodeMirrorBundle";
    const myClickHandler = EditorView.domEventHandlers({
      mousedown: (event, view) => {
        /* ... */
      },
    });
    app.state.cmExtensions.push(myClickHandler);
    ```

2.  **Complex Decorations (Block Widgets):** For features that replace entire blocks of text and need to manage their own state. Use `StateField`.

    ```javascript
    import { StateField, Decoration, EditorView } from "CodeMirrorBundle";
    const myStateField = StateField.define({
      create(state) {
        /* ... */
      },
      update(decorations, transaction) {
        /* ... */
      },
      provide(field) {
        return EditorView.decorations.from(field);
      },
    });
    app.state.cmExtensions.push(myStateField);
    ```

3.  **Inline Decorations & Widgets:** For styling text or replacing it with simple inline elements. Use `ViewPlugin`.

    ```javascript
    import { ViewPlugin, Decoration } from "CodeMirrorBundle";
    const myViewPlugin = ViewPlugin.fromClass(class {
      constructor(view) { this.decorations = /* ... */; }
      update(update) { /* ... */ }
    }, {
      decorations: v => v.decorations,
    });
    app.state.cmExtensions.push(myViewPlugin);
    ```

4.  **Autocompletion:**
    ```javascript
    import { autocompletion } from "CodeMirrorBundle";
    const myCompleter = autocompletion({
      override: [
        (context) => {
          // ... return { from: ..., options: [...] } or null
        },
      ],
    });
    app.state.cmExtensions.push(myCompleter);
    ```
