const log = {
  // Color configuration for different log levels
  _colors: {
    info: "#00c", // Blue
    warn: "#c60", // Amber
    error: "#c00", // Red
  },

  /**
   * The core logging function.
   * @param {string} level - The log level ('info', 'warn', 'error').
   * @param {string} system - The name of the system/module logging the message.
   * @param {*} message - The message or object to log.
   */
  _log: function (level, system, message) {
    const color = this._colors[level] || "#6B7280"; // Default to gray
    const systemStyle = `
            color: #ccc;
            background-color: ${color};
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: bold;
          `;
    console.log(`%c${system}`, systemStyle, message);
  },

  /**
   * Logs an informational message.
   * @param {string} system - The system name.
   * @param {*} message - The message.
   */
  info: function (system, message) {
    this._log("info", system, message);
  },

  /**
   * Logs a warning message.
   * @param {string} system - The system name.
   * @param {*} message - The message.
   */
  warn: function (system, message) {
    this._log("warn", system, message);
  },

  debug: function (system, message) {
    this._log("warn", system, message);
  },

  /**
   * Logs an error message.
   * @param {string} system - The system name.
   * @param {*} message - The message.
   */
  error: function (system, message, error) {
    this._log("error", system, message);
    console.log(error);
  },
};

const idbStore = {
  db: null,
  async getDb() {
    if (this.db) return this.db;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("olivine-db", 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore("keyval");
      };
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };
      request.onerror = (e) => reject(e);
    });
  },
  async get(key) {
    const db = await this.getDb();
    return new Promise((resolve) => {
      const tx = db.transaction("keyval", "readonly");
      const store = tx.objectStore("keyval");
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
    });
  },
  async set(key, value) {
    const db = await this.getDb();
    const tx = db.transaction("keyval", "readwrite");
    const store = tx.objectStore("keyval");
    store.put(value, key);
    return tx.done;
  },
};

idbStore.getDb(); // Initialize the database connection early.

window.idbStore = idbStore;
