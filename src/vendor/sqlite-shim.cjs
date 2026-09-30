/**
 * Minimal better-sqlite3-compatible shim backed by node:sqlite (Node 22+).
 * Only the surface LeanGraph uses is implemented.
 */
const { DatabaseSync } = require("node:sqlite");

class Statement {
  constructor(stmt) {
    this._stmt = stmt;
  }
  _bind(args) {
    if (args.length === 1 && args[0] && typeof args[0] === "object" && !Array.isArray(args[0])) {
      return [args[0]];
    }
    return args;
  }
  all(...args) {
    return this._stmt.all(...this._bind(args));
  }
  get(...args) {
    return this._stmt.get(...this._bind(args));
  }
  run(...args) {
    const r = this._stmt.run(...this._bind(args));
    return { changes: Number(r.changes), lastInsertRowid: r.lastInsertRowid };
  }
  *iterate(...args) {
    for (const row of this.all(...args)) yield row;
  }
  pluck() {
    return this;
  }
  raw() {
    return this;
  }
}

class Database {
  constructor(filename = ":memory:") {
    this._db = new DatabaseSync(filename === "" ? ":memory:" : filename, {
      allowExtension: false,
    });
    this.open = true;
    this.name = filename;
    this.inTransaction = false;
  }
  exec(sql) {
    this._db.exec(sql);
    return this;
  }
  pragma(source) {
    try {
      const stmt = this._db.prepare(`PRAGMA ${source}`);
      return stmt.all();
    } catch {
      this._db.exec(`PRAGMA ${source}`);
      return [];
    }
  }
  prepare(sql) {
    return new Statement(this._db.prepare(sql));
  }
  function(name, optionsOrFn, maybeFn) {
    const fn = typeof optionsOrFn === "function" ? optionsOrFn : maybeFn;
    const options = typeof optionsOrFn === "function" ? {} : optionsOrFn || {};
    this._db.function(
      name,
      { deterministic: !!options.deterministic, varargs: true, useBigIntArguments: false },
      (...args) => {
        const out = fn(...args);
        if (out === undefined || out === null) return null;
        if (typeof out === "boolean") return out ? 1 : 0;
        return out;
      },
    );
    return this;
  }
  transaction(fn) {
    const db = this._db;
    const self = this;
    const wrapped = (...args) => {
      if (self.inTransaction) return fn(...args);
      db.exec("BEGIN");
      self.inTransaction = true;
      try {
        const result = fn(...args);
        db.exec("COMMIT");
        return result;
      } catch (err) {
        try {
          db.exec("ROLLBACK");
        } catch {
          /* ignore */
        }
        throw err;
      } finally {
        self.inTransaction = false;
      }
    };
    wrapped.default = wrapped;
    wrapped.deferred = wrapped;
    wrapped.immediate = wrapped;
    wrapped.exclusive = wrapped;
    return wrapped;
  }
  close() {
    if (this.open) {
      this._db.close();
      this.open = false;
    }
  }
}

module.exports = Database;
module.exports.default = Database;
