class MetaP {
  static KEY_UP = "ArrowUp";
  static KEY_DOWN = "ArrowDown";
  static KEY_ENTER = "Enter";
  static KEY_ESCAPE = "Escape";

  constructor(props = {}) {
    this._initializeProperties(props);
    this._createMetaPGlass();
    this._createMetaPModal();
    this._createSearchInputDisplay();
    this._createFormInputDisplay();
    this._createCommandListContainer();
    this._hideInputDisplays();
    this.isListenerBound = false;
    this.defaultProvider = async () => [];
    this.shiftedProvider = async () => [];
    this.activeProvider = null;
    this.debounceTimeout = null;
  }

  _createProvider(source) {
    if (typeof source === "function") {
      return source; // Use the function directly
    }
    if (Array.isArray(source)) {
      // If it's an array, create a static provider for it
      return async (query) => {
        if (!query) {
          return source;
        }
        const lowerCaseQuery = query.toLowerCase();
        return source.filter((command) => {
          const titleMatch = command.title
            .toLowerCase()
            .includes(lowerCaseQuery);
          const aliasMatch = command.aliases?.some((alias) =>
            alias.toLowerCase().includes(lowerCaseQuery),
          );
          return titleMatch || aliasMatch;
        });
      };
    }
    // Return a provider that does nothing if the source is invalid
    return async () => [];
  }

  _initializeProperties(props) {
    // HTML Containers
    this.metaPGlass = null;
    this.metaPModal = null;
    this.searchInputDisplay = null;
    this.formInputDisplay = null;
    this.commandListContainer = null;
    this.ellipsisRow = null;
    // Properties used for searching / inputs
    this.searchText = "";
    this.selectedCommand = null;
    this._matchStartIndex = 0;
    this._currentIndex = -1;
    this.inputBuffer = "";
    this.focusedElementBeforeOpen = null;
    this.commandInputValues = new Map();
    this.commandRows = [];
    // Properties
    this.maxCommands = props.maxCommands ?? 3;
    this.maxCommandTitleLength = props.maxCommandTitleLength ?? 20;
    // Other
    this.oldp = window.print;
  }

  _createMetaPGlass() {
    this.metaPGlass = document.createElement("DIV");
    this.metaPGlass.id = "metap-glass";
    this.metaPGlass.style.display = "none";
  }

  _createMetaPModal() {
    this.metaPModal = document.createElement("DIV");
    this.metaPModal.id = "metap-modal";
    this.metaPGlass.appendChild(this.metaPModal);
  }

  _createSearchInputDisplay() {
    this.searchInputDisplay = document.createElement("DIV");
    this.searchInputDisplay.id = "metap-search-input";
    this.searchInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.searchInputDisplay);
  }

  _createFormInputDisplay() {
    this.formInputDisplay = document.createElement("DIV");
    this.formInputDisplay.id = "metap-form-input";
    this.formInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.formInputDisplay);
  }

  _createCommandListContainer() {
    this.commandListContainer = document.createElement("DIV");
    this.commandListContainer.id = "metap-command-list";
    this.metaPModal.appendChild(this.commandListContainer);
  }

  _hideInputDisplays() {
    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).forEach(
      (inp) => (inp.style.display = "none"),
    );
  }

  async _fetchAndRender() {
    if (!this.activeProvider) return;
    const commands = await this.activeProvider(this.searchText);
    this.commands = commands;
    this.generate();
    this.updateDisplay();
  }

  bind(providers = {}, filters = {}) {
    this.defaultProvider = this._createProvider(providers.default);
    this.shiftedProvider = this._createProvider(providers.shifted);

    if (filters.maxCommands) {
      this.maxCommands = filters.maxCommands;
      delete filters["maxCommands"];
    }
    if (filters.maxCommandTitleLength) {
      this.maxCommandTitleLength = filters.maxCommandTitleLength;
      delete filters["maxCommandTitleLength"];
    }
    if (!this.isListenerBound) {
      document.body.appendChild(this.metaPGlass);
      this.blur = filters.blur ?? 3;
      this.sepia = filters.sepia ?? 0;
      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform);

      document.addEventListener("keydown", (ev) => {
        const cmd = isMac ? ev.metaKey : ev.ctrlKey;
        if (cmd && ev.key === "p") {
          ev.preventDefault();
          ev.stopPropagation();

          // Determine which command set to use based on Shift key
          this.activeProvider = ev.shiftKey
            ? this.shiftedProvider
            : this.defaultProvider;

          this.metaP();
          return;
        }
        // The handler for UP/DOWN/ENTER keys within the modal
        this.handler(ev);
      });

      this.isListenerBound = true; // <-- Set the flag
    }
  }

  toggle() {
    if (this.metaPModal.style.display === "block") {
      this.metaPModal.style.display = "none";
      this.metaPGlass.style.display = "none";
      this.metaPGlass.style.backdropFilter = null;
      if (this.focusedElementBeforeOpen) {
        this.focusedElementBeforeOpen.focus();
        this.focusedElementBeforeOpen = null;
      }
    } else {
      this.focusedElementBeforeOpen = document.activeElement;
      this.metaPModal.style.display = "block";
      this.metaPGlass.style.display = "block";
      this.metaPGlass.style.backdropFilter = `blur(${this.blur}px) sepia(${this.sepia}%)`;
      this.updateDisplay();
    }
    this.resetState();
  }

  generate() {
    this.commandListContainer.innerHTML = "";
    this.commandRows = [];
    // This now uses this.commands, which is set right before opening
    console.log(this.commands)
    this.commands.forEach((d, index) => {
      if(!d.title){
        return;
      }
      const div = document.createElement("DIV");
      let commandTitle = d.title;
      if (d.title.split("\n").length > 1) {
        commandTitle = d.aliases ? d.aliases[0] : "[Multiline command]";
      }
      if (commandTitle.length > this.maxCommandTitleLength) {
        commandTitle =
          commandTitle.substring(0, this.maxCommandTitleLength) + "…";
      }
      div.innerText = commandTitle;
      div.title = d.title;

      div.classList.add("metap-modal-row");
      div.style.display = "none";

      div.lambda = d.lambda;
      div.updater = d.updater;
      div.inputs = d.inputs;
      div.command = d;
      div.aliases = d.aliases;
      div.dataset.index = index;

      div.addEventListener("mouseup", () => {
        console.log("clickity");
        console.log(div.textContent);
        this.searchText = div.textContent;
        this._triggerFetch();
        this.updateDisplay();
        setTimeout(() => {
          this.handler(
            new KeyboardEvent("keyup", {
              key: "Enter",
              code: "KeyEnter",
            }),
          );
        }, 20); // Maybe it even works with a 0 timeout
      });

      this.commandListContainer.appendChild(div);
      this.commandRows.push({
        command: d,
        div: div,
        isMatch: true,
        originalIndex: index,
      });
    });
  }

  metaP() {
    this._matchStartIndex = 0;
    this._fetchAndRender();
    this.toggle();
  }

  _removeInputs() {
    this.formInputDisplay.innerHTML = "";
  }

  selectCommand(command, div) {
    this._clearSearchInput();

    if (command.inputs && Array.isArray(command.inputs)) {
      Array.from(this.commandListContainer.querySelectorAll("DIV")).map((d) => {
        if (d != div) {
          d.style.display = "none";
        }
      });
      this._handleCommandWithInputs(command, div);
    } else {
      this._executeCommandWithoutInputs(command);
    }
  }

  _clearSearchInput() {
    this.searchInputDisplay.innerText = "";
    this.searchInputDisplay.style.display = "none";
  }

  _handleCommandWithInputs(command, div) {
    this.selectedCommand = command;
    this._prepareFormInputDisplay();
    const form = this._createInputForm(command);
    this._appendInputsToForm(form, command, div);
    this.formInputDisplay.appendChild(form);
    this._displayFormInputAndHideOthers();
  }

  _prepareFormInputDisplay() {
    this.formInputDisplay.innerHTML = "";
    this.formInputDisplay.style.display = "block";
  }

  _createInputForm(command) {
    const form = document.createElement("FORM");
    form.id = "metap-input-form";
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.handleFormSubmit(form, command);
    });
    return form;
  }

  _appendInputsToForm(form, command, div) {
    const savedValues = this.commandInputValues.get(command);

    command.inputs.forEach((inputDef, index) => {
      const input = document.createElement("INPUT");
      input.type = "text";
      input.classList.add("metap-form-input");
      input.dataset.index = index;
      input.placeholder = inputDef.title;

      if (inputDef.default) {
        input.value = inputDef.default;
      } else if (savedValues && savedValues[index]) {
        input.value = savedValues[index];
      }

      input.addEventListener("keyup", (ev) =>
        this._handleInputKeyup(ev, form, command, div, index),
      );
      form.appendChild(input);
      if (index === 0) {
        setTimeout(() => input.focus(), 0);
      }
    });
  }

  _handleInputKeyup(ev, form, command, div, index) {
    if (ev.key === "Enter") {
      ev.preventDefault();
      this._focusNextInputOrSubmitForm(ev, form, command, index);
    } else {
      if (command.updater) {
        this._updateCommandTitleWithInput(form, command, div);
      }
    }
  }

  _focusNextInputOrSubmitForm(ev, form, command, index) {
    const nextIndex = index + 1;
    if (nextIndex < command.inputs.length) {
      const nextInput = form.querySelector(`input[data-index="${nextIndex}"]`);
      if (nextInput) {
        nextInput.focus();
      }
    } else {
      form.dispatchEvent(new Event("submit"));
    }
  }

  _updateCommandTitleWithInput(form, command, div) {
    const inputValues = Array.from(
      form.querySelectorAll(".metap-form-input"),
    ).map((input) => input.value);
    this.commandInputValues.set(command, inputValues);
    div.textContent = command.updater(...inputValues);
  }

  _displayFormInputAndHideOthers() {
    Array.from(this.metaPModal.querySelectorAll(".metap-inputs"))
      .filter((inp) => inp !== this.formInputDisplay)
      .forEach((inp) => (inp.style.display = "none"));
  }

  _executeCommandWithoutInputs(command) {
    this.toggle();
    command.lambda();
  }

  handleFormSubmit(form, command) {
    const inputValues = Array.from(
      form.querySelectorAll(".metap-form-input"),
    ).map((input) => input.value);
    this.commandInputValues.set(command, inputValues);
    command.lambda(...inputValues);
    this.toggle();
  }

  resetState() {
    this.selectedCommand = null;
    this.inputBuffer = "";
    this.searchText = "";
    this._currentIndex = -1;
    this._matchStartIndex = 0;

    this.formInputDisplay.innerHTML = "";
    this.formInputDisplay.style.display = "none";

    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
      (inp) => (inp.style.display = "none"),
    );
    this.updateDisplay();
  }

  updateDisplay() {
    this._updateSearchInputDisplay();
    this._updateCommandMatchStatus();
    this._filterAndSliceCommands();
    this._renderVisibleCommands();
    //this._handleEllipsisDisplay();
    this._updateSelectionHighlight();
  }

  _updateSearchInputDisplay() {
    this.searchInputDisplay.innerText = this.searchText;
    this.searchInputDisplay.style.display = this.searchText ? "block" : "none";
  }

  _updateCommandMatchStatus() {
    // This method can be removed or simplified, as the provider now handles matching.
    // For simplicity, we assume all returned commands are matches.
    this.commandRows.forEach((rowObj) => (rowObj.isMatch = true));
  }

  _filterAndSliceCommands() {
    let matches = this.commandRows.filter((rowObj) => rowObj.isMatch);

    this.candidateCommands = matches;

    this.matchesToDisplay = this.candidateCommands.slice(
      this._matchStartIndex,
      this._matchStartIndex + this.maxCommands,
    );
    this.allMatchingCommandsCount = this.candidateCommands.length;
  }
  _renderVisibleCommands() {
    this.commandRows.forEach((rowObj) => (rowObj.div.style.display = "none"));
    this.commandListContainer.innerHTML = "";

    this.matchesToDisplay.forEach((rowObj) => {
      rowObj.div.style.display = "block";
      this.commandListContainer.appendChild(rowObj.div);
    });
  }

  _handleEllipsisDisplay() {
    const displayedMatchCount = this.matchesToDisplay.length;

    if (
      (this.searchText &&
        this.allMatchingCommandsCount > displayedMatchCount) ||
      (!this.searchText && this.commands.length > this.maxCommands)
    ) {
      if (!this.ellipsisRow) {
        this.ellipsisRow = document.createElement("DIV");
        this.ellipsisRow.innerText = "...";
        this.ellipsisRow.classList.add("metap-modal-row", "metap-ellipsis-row");
        this.commandListContainer.appendChild(this.ellipsisRow);
      }
      this.ellipsisRow.style.display = "block";
    } else if (this.ellipsisRow) {
      this.ellipsisRow.style.display = "none";
    }
  }

  _updateSelectionHighlight() {
    const visibleRows = Array.from(
      this.commandListContainer.querySelectorAll(".metap-modal-row"),
    ).filter(
      (row) =>
        row.style.display === "block" &&
        !row.classList.contains("metap-ellipsis-row"),
    );

    if (visibleRows.length > 0) {
      if (this._currentIndex < 0) {
        this._currentIndex = 0;
      } else if (this._currentIndex >= visibleRows.length) {
        this._currentIndex = visibleRows.length - 1;
      }

      visibleRows.forEach((row, index) => {
        if (index === this._currentIndex) {
          row.classList.add("metap-modal-row-hovered");
        } else {
          row.classList.remove("metap-modal-row-hovered");
        }
      });
    } else {
      this._currentIndex = -1;
    }
  }

  handler(ev) {
    if (!this._isMetaPModalOpen()) {
      return;
    }
    if (this._isInputTyping(ev)) {
      return;
    }

    ev.preventDefault();
    ev.stopPropagation();

    switch (ev.key) {
      case "Backspace":
        this._handleBackspace();
        this.updateDisplay();
        this._triggerFetch();
        break;
      case "Escape":
        this._handleEscape();
        this.updateDisplay();
        this._triggerFetch();
        break;
      case "Enter":
        this._handleEnter();
        break;
      case "ArrowDown":
        this._handleArrowDown();
        this.updateDisplay();
        break;
      case "ArrowUp":
        this._handleArrowUp();
        this.updateDisplay();
        break;
      default:
        if (ev.key.length === 1) {
          this._handleSingleCharInput(ev.key); // this updates searchText
          this._triggerFetch(); // Use the new trigger
        }
    }
  }

  _triggerFetch() {
    clearTimeout(this.debounceTimeout);
    this.debounceTimeout = setTimeout(() => {
      this._fetchAndRender();
    }, 5);
  }

  _isMetaPModalOpen() {
    return this.metaPModal.style.display === "block";
  }

  _isInputTyping(ev) {
    return ev.target?.nodeName === "INPUT" && ev.key !== "Escape" && ev.key !== "Backspace";
  }

  _handleBackspace() {
    this.searchText = this.searchText.slice(0, -1);
    this._currentIndex = -1;
    this._matchStartIndex = 0;
  }

  _handleEscape() {
    this._removeInputs();
    if (this.searchText !== "") {
      this.searchText = "";
      this._currentIndex = -1;
      this._matchStartIndex = 0;
    } else {
      this.toggle();
    }
  }

  _handleEnter() {
    const visibleRows = this._getVisibleCommandRows();
    if (this._isValidSelection(visibleRows)) {
      const selectedRow = visibleRows[this._currentIndex];
      const commandIndex = parseInt(selectedRow.dataset.index);
      const command = this.commands[commandIndex];
      this.selectCommand(command, selectedRow);
    } else {
      this.toggle();
    }
  }

  _getVisibleCommandRows() {
    return Array.from(
      this.commandListContainer.querySelectorAll(".metap-modal-row"),
    ).filter(
      (row) =>
        row.style.display === "block" &&
        !row.classList.contains("metap-ellipsis-row"),
    );
  }

  _isValidSelection(visibleRows) {
    return (
      visibleRows.length > 0 &&
      this._currentIndex >= 0 &&
      this._currentIndex < visibleRows.length
    );
  }

  _handleArrowDown() {
    this._currentIndex++;
    let visibleRows = this._getVisibleCommandRows();

    if (this._currentIndex >= visibleRows.length) {
      const allMatchesCount = this.commandRows.filter(
        (row) => row.isMatch,
      ).length;
      if (this._matchStartIndex + this.maxCommands < allMatchesCount) {
        this._matchStartIndex += 1;
        this.updateDisplay();
        this._currentIndex = this.maxCommands - 1;
      } else {
        this._currentIndex = visibleRows.length - 1;
      }
    }
  }

  _handleArrowUp() {
    this._currentIndex--;
    if (this._currentIndex < 0) {
      if (this._matchStartIndex > 0) {
        this._matchStartIndex -= 1;
        this.updateDisplay();
        this._currentIndex = 0;
      } else {
        this._currentIndex = 0;
      }
    }
  }

  _handleSingleCharInput(key) {
    this.searchText += key;
    this._currentIndex = -1;
    this._matchStartIndex = 0;
  }

  dispatchKeyEvent(key) {
    if (!this._isMetaPModalOpen()) {
      return;
    }

    const event = new KeyboardEvent("keyup", { key: key });

    this.handler(event);
  }
}

const metaP = new MetaP();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { metaP };
} else if (typeof define === "function" && define.amd) {
  define(function () {
    return metaP;
  });
} else {
  window.metaP = metaP;
}
