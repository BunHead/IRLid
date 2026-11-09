// A small D1 stand-in on a real in-memory SQLite (node:sqlite), built from
// irlid-api-org/schema.sql. Unlike the hand-written SQL mocks in other tests,
// it runs the Worker's real SQL, and batch() is a real transaction (all
// statements commit together or none do), the way Cloudflare D1 runs a batch.
//
// failOn(regex[, times]): the next statement whose SQL matches throws, so a
// test can prove a multi-step write is all-or-nothing.
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const SCHEMA = readFileSync(new URL("../../schema.sql", import.meta.url), "utf8");

class Statement {
  constructor(d1, sql) { this.d1 = d1; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args.map(a => (a === undefined ? null : a)); return this; }
  check() { this.d1.maybeFail(this.sql); return this.d1.db.prepare(this.sql); }
  async first() { return this.runFirst(); }
  runFirst() { return this.check().get(...this.args) ?? null; }
  async all() { return this.runAll(); }
  runAll() { return { results: this.check().all(...this.args), meta: {} }; }
  async run() { return this.runSync(); }
  runSync() {
    const st = this.check();
    if (/^\s*(SELECT|PRAGMA)\b/i.test(this.sql) || /\bRETURNING\b/i.test(this.sql)) {
      return { results: st.all(...this.args), meta: { changes: 0 } };
    }
    const info = st.run(...this.args);
    return { results: [], meta: { changes: Number(info.changes) } };
  }
}

export class SqliteD1 {
  constructor(extraSql) {
    this.db = new DatabaseSync(":memory:");
    this.db.exec(SCHEMA);
    if (extraSql) this.db.exec(extraSql);
    this.failures = [];
    this.batches = 0;
  }
  prepare(sql) { return new Statement(this, sql); }
  failOn(re, times = 1) { this.failures.push({ re, times }); }
  maybeFail(sql) {
    for (const f of this.failures) {
      if (f.times > 0 && f.re.test(sql)) { f.times -= 1; throw new Error("injected D1 failure"); }
    }
  }
  async batch(statements) {
    this.batches += 1;
    this.db.exec("BEGIN");
    try {
      const out = statements.map(s => s.runSync());
      this.db.exec("COMMIT");
      return out;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }
  get(sql, ...args) { return this.db.prepare(sql).get(...args) ?? null; }
  all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  exec(sql, ...args) { return this.db.prepare(sql).run(...args); }
}
