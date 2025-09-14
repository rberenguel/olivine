# Plan: Refactor Search into a Core API

The goal is to evolve the search functionality from a simple file list filter into a powerful, content-aware service that can be used by the core app and extended by plugins.

---

### Phase 1: Centralize and Expose a Formal Search API

The current search logic is mixed inside `files.js`. We need to extract it into its own dedicated module and expose it on the global `app` object.

1.  **Create a New Module: `app/core/search.js`**

    - This file will be responsible for creating and managing all `MiniSearch` instances.
    - It will hold two separate indexes:
      - `fileNameIndex`: For quickly searching file paths and titles. Fast to build.
      - `contentIndex`: For full-text search across all note content. Slower to build.

2.  **Define the Search Service in `search.js`**

    ```javascript
    // app/core/search.js
    import { MiniSearch } from "CodeMirrorBundle";

    let fileNameIndex = null;
    let contentIndex = null;

    export function initializeSearch() {
      fileNameIndex = new MiniSearch({
        fields: ["title", "path"],
        storeFields: ["title", "path"],
      });
      contentIndex = new MiniSearch({
        fields: ["title", "content"],
        storeFields: ["title", "path"],
      });
    }

    export function getFileNameIndex() {
      return fileNameIndex;
    }
    export function getContentIndex() {
      return contentIndex;
    }

    export function searchFiles(query) {
      if (!fileNameIndex) return [];
      // Use fuzzy search for better title matching
      return fileNameIndex.search(query, { prefix: true, fuzzy: 0.2 });
    }

    export function searchContent(query) {
      if (!contentIndex) return [];
      return contentIndex.search(query);
    }
    ```

3.  **Expose the API on the `app` Object**

    - In `app/core/app.js`, create a new `app.search` namespace that exposes these functions.

    ```javascript
    // app/core/app.js
    import * as searchApi from "./search.js";

    // ... inside createApp() ...
    const app = {
      // ...
      search: searchApi,
      // ...
    };
    ```

---

### Phase 2: Implement Full-Content Indexing & Lifecycle Management

The index must be aware of file content and stay synchronized with file operations.

1.  **Index Content on Startup**

    - Modify `files.js`'s `loadAndIndexNotes` function. It will now be responsible for fetching content.
    - It must loop through all files, read their content using `vscode.readFile()`, and then add structured documents to both search indexes.

    ```javascript
    // In files.js, inside loadAndIndexNotes(files)

    // This logic should be moved into or called by search.js's initialization
    const docs = [];
    for (const path of files) {
      const content = await vscode.readFile(path);
      const title = path.split("/").pop().replace(".md", "");
      docs.push({ id: path, path, title, content });
    }

    // Now add to the indexes
    app.search.getFileNameIndex().addAll(docs);
    app.search.getContentIndex().addAll(docs);
    ```

2.  **Update Index on File Changes**
    - We need to hook into file operations in `files.js`.
    - **`createNewFile`**: After a file is successfully created, call `app.search.getFileNameIndex().add({ id: path, ... })`.
    - **`renameFile`**: After a file is renamed, call `app.search.getFileNameIndex().remove({ id: oldPath })` and then `app.search.getFileNameIndex().add({ id: newPath, ... })`.
    - **File Saves (`onUpdate` in `editor.js`)**: After a file is saved, its content has changed. We need to update the `contentIndex`. Call `app.search.getContentIndex().replace({ id: path, content: newContent, ... })`.

---

### Phase 3: Apply the New API to Wikilinks

This is the immediate payoff. We can now fix the wikilink limitation.

1.  **Refactor `findFileByTitle`**

    - The current function in `files.js` performs a simple, brittle string search.
    - Rewrite it to use our new, powerful search API.

    ```javascript
    // app/core/files.js

    export function findFileByTitle(title) {
      // Use the powerful, fuzzy search instead of a simple string match
      const results = app.search.searchFiles(title);

      // Return the path of the best match, if one exists
      if (results.length > 0) {
        // MiniSearch results are already sorted by relevance
        return results[0].path;
      }
      return undefined;
    }
    ```

    - This will immediately make wikilinks work with just the title, as `MiniSearch` will find `"My Note"` even if the path is `"journal/2025/My Note.md"`.

---

### Phase 4: Expose API for Custom Search Plugins

With this structure, creating a custom search plugin becomes straightforward. A plugin's `activate` function can:

- **Access the indexes directly:** `app.search.getContentIndex()` to perform its own complex queries.
- **Create a custom view:** Use `app.ui.registerViewType` to create a dedicated "Search" pane.
- **Add a command:** Use `app.commands.register` to add a "Search in all files" command that opens its custom view.

This plan establishes a solid foundation for search that solves your immediate problem and provides the necessary hooks for much more powerful extensions in the future.
