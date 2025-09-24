### Indexing / refreshing

- [ ] Event based reindexing
- [ ] Need to refresh on rename
- [ ] Store and load created indexes (needs a reindex command then)

### Commands, extensions, layout

- [ ] and be callable by id (this may be done already)
- [ ] Worth having the Chrome extension mode?

### Rendering

- [ ] Snippets don't render the markdown yet (Admonitions do)
- [ ] Preso needs a lot of work in styling

### Nits

- [ ] **LOW** There seems to be something partially broken in clicking on lines that contain external links (the cursor is not placed correctly)
- [ ] **LOW** Can't move files, delete files (soft delete)

### Tests / Improvements

- [ ] Add CSP to the server side
- [ ] Think if we can have some simple browser-based tests

### Documented quirks

- The backend does not look for new files. A refresh could do, but we will need reindexing on actions, and refreshing of the sidebar too

### Done

- [x] Admonition tags now render its internal markdown
- [x] Tags should be better visible
- [x] The sidebar behaves weirdly when the outline is very large
- [x] No right side sidebar
- [x] Gutters no longer work, closing a pane does not remove it either. What happened?
- [x] There could be a problem with renaming files that have spaces (note: not really, it was something else broken)
- [x] Create a sample test vault with stuff here
- [x] Offer an API for buttons in the header
- [x] Clean up the code related to VS Code
- [x] Clean and remove the VS Code extension parts
- [x] Better rendering for code blocks
- [x] Commands should have ids
