# Olivine

> Olivine is an olive-green mineral ocurring in igneous (volcanic) rocks. Easy to find in La Garrotxa (Catalonia)

This is a ~~Chrome extension~~ ~~VS Code extension~~ progressive web app that can be pointed at an Obsidian vault and more or less read the files and edit them.
Also offers search (through Minisearch, title only for now) and a couple commands.

<img src="sample/olivine.png"/>

---

Rendering and styles are still a bit so-so. So far can only be considered a proof of concept. Hopefully I never need
to add any more features.

You can find a TODO list of what I'm finding in `sample/TODO.md`.

## With backend

```
go run server.go -vault path-to-vault
```

## Local development

This project is separated into two distinct parts:

1.  `bundler`: A folder where we can bundle codemirror and whatever else we need in a `codemirror-bundle.js` file.
2.  `the rest`: The actual ~~Chrome~~ VS Code Extension, written in pure vanilla JavaScript, with no build tools (but needs packaging).

This leaves the extension dependency-free aside from the (hopefully fixed) bundle.

### Building the CodeMirror Bundle (A One-Time Task most of the time)

1.  **Navigate to the Bundler:**
    Open your terminal in the `codemirror-bundler` directory.

2.  **Install Dependencies:**
    Run `npm install`. This only installs tools needed for bundling (like Rollup).

3.  **Run the Build:**
    Run `npm run build`.

This command will read the dependencies from `package.json`, bundle them into a single file, and save it directly into the correct location: `chrome-notes-app/lib/codemirror-bundle.js`.

That's it. You are done with the `codemirror-bundler` folder. You can now ignore it, or even delete it, until you need to update CodeMirror in the future.

### Loading the Extension

1.  Download the release.
2.  Open VS Code and invoke the _Command Palette_.
3.  Choose _Extensions: Install from vsix_.
