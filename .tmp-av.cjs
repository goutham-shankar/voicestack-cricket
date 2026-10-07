"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key2 of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key2) && key2 !== except)
        __defProp(to, key2, { get: () => from[key2], enumerable: !(desc = __getOwnPropDesc(from, key2)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/dotenv/dist/index.cjs
var require_dist = __commonJS({
  "node_modules/dotenv/dist/index.cjs"(exports2, module2) {
    var I = (e, o) => () => {
      try {
        return o || e((o = { exports: {} }).exports, o), o.exports;
      } catch (t) {
        throw o = 0, t;
      }
    };
    var S = I((xe, U) => {
      function G(e) {
        return typeof e == "string" ? !["false", "0", "no", "off", ""].includes(e.toLowerCase()) : !!e;
      }
      function X(e = process.env) {
        let o = {};
        for (let t of ["ENCODING", "PATH", "QUIET", "DEBUG", "OVERRIDE", "FAST"]) {
          let n = e[`DOTENV_${t}`] != null ? e[`DOTENV_${t}`] : e[`DOTENV_CONFIG_${t}`];
          n != null && (o[t.toLowerCase()] = t === "ENCODING" || t === "PATH" ? n : G(n));
        }
        return o;
      }
      U.exports = { parseBoolean: G, optionsFromEnv: X };
    });
    var N = I((ye, x) => {
      var Y = require("fs"), j = require("path"), z = require("os"), { URL: Z, fileURLToPath: ee } = require("url"), { parseBoolean: k, optionsFromEnv: B } = S(), te = /(?:^|^)\s*(?:export\s+)?([\w.-]+)(?:\s*=\s*?|:\s+?)(\s*'(?:\\'|[^'])*'|\s*"(?:\\"|[^"])*"|\s*`(?:\\`|[^`])*`|[^#\r\n]+)?\s*(?:#.*)?(?:$|$)/mg, b = new Uint8Array(256);
      for (let e = 48; e <= 57; e++) b[e] = 1;
      for (let e = 65; e <= 90; e++) b[e] = 1;
      for (let e = 97; e <= 122; e++) b[e] = 1;
      b[45] = 1;
      b[46] = 1;
      b[95] = 1;
      function re(e) {
        let o = {}, t = e.toString();
        t = t.replace(/\r\n?/mg, `
`);
        let n;
        for (; (n = te.exec(t)) != null; ) {
          let r = n[1], s = n[2] || "";
          s = s.trim();
          let i = s[0];
          s = s.replace(/^(['"`])([\s\S]*)\1$/mg, "$2"), i === '"' && (s = s.replace(/\\n/g, `
`), s = s.replace(/\\r/g, "\r")), o[r] = s;
        }
        return o;
      }
      function w(e) {
        return e <= 32 ? e === 32 || e >= 9 && e <= 13 : e >= 160 && (e === 160 || e === 5760 || e >= 8192 && e <= 8202 || e === 8232 || e === 8233 || e === 8239 || e === 8287 || e === 12288 || e === 65279);
      }
      function O(e) {
        return e === 10 || e === 8232 || e === 8233;
      }
      function oe(e) {
        let o = {}, t = typeof e == "string" ? e : e.toString();
        t.indexOf("\r") !== -1 && (t = t.replace(/\r\n?/g, `
`));
        let n = t.length, r = 0;
        for (; r < n; ) {
          let s = t.charCodeAt(r);
          for (; r < n && w(s); ) r++, s = t.charCodeAt(r);
          if (r >= n) break;
          if (s === 35) {
            for (; r < n && !O(t.charCodeAt(r)); ) r++;
            continue;
          }
          let i = -1;
          if (s === 101 && r + 6 < n && t.charCodeAt(r + 1) === 120 && t.charCodeAt(r + 2) === 112 && t.charCodeAt(r + 3) === 111 && t.charCodeAt(r + 4) === 114 && t.charCodeAt(r + 5) === 116) {
            let C = t.charCodeAt(r + 6);
            if (w(C)) {
              let d = r + 7;
              for (; d < n && w(t.charCodeAt(d)); ) d++;
              b[t.charCodeAt(d)] && (i = r + 6, r = d);
            } else s = t.charCodeAt(r);
          }
          let l = r, u = 0;
          for (; r < n && (u = t.charCodeAt(r), b[u]); ) r++;
          if (r === l) {
            for (; r < n && !O(t.charCodeAt(r)); ) r++;
            continue;
          }
          let p = t.slice(l, r), f = r;
          if (r >= n && (u = 0), w(u)) do
            r++, u = r < n ? t.charCodeAt(r) : 0;
          while (w(u));
          if (u === 61) r++;
          else if (u === 58 && r === f && r + 1 < n && w(t.charCodeAt(r + 1))) r += 2;
          else {
            for (r = i === -1 ? f : i; r < n && !O(t.charCodeAt(r)); ) r++;
            continue;
          }
          let c = r, a = r;
          for (; a < n && w(t.charCodeAt(a)); ) a++;
          let g = t.charCodeAt(a), h, y = false;
          if (g === 39 || g === 34 || g === 96) {
            let C = t[a], d = t.indexOf(C, a + 1), m = -1, v = -1;
            for (; d !== -1; ) {
              let q = t.charCodeAt(d - 1) === 92, A = d + 1;
              for (; A < n && !O(t.charCodeAt(A)) && w(t.charCodeAt(A)); ) A++;
              if ((A === n || O(t.charCodeAt(A)) || t.charCodeAt(A) === 35) && (m = d, v = A), !q) break;
              d = t.indexOf(C, d + 1);
            }
            if (m !== -1) {
              if (h = t.slice(a + 1, m), r = v, t.charCodeAt(r) === 35) for (; r < n && !O(t.charCodeAt(r)); ) r++;
              y = true;
            }
          }
          if (!y) {
            let C = t.indexOf(`
`, c);
            C === -1 && (C = n);
            let d = t.indexOf("#", c);
            (d === -1 || d > C) && (d = C);
            let m = c, v = d;
            for (; m < v && w(t.charCodeAt(m)); ) m++;
            for (; v > m && w(t.charCodeAt(v - 1)); ) v--;
            let q = t.charCodeAt(m);
            if (v - m >= 2 && (q === 39 || q === 34 || q === 96) && t.charCodeAt(v - 1) === q ? h = t.slice(m + 1, v - 1) : h = t.slice(m, v), r = d, d < C) for (; r < n && !O(t.charCodeAt(r)); ) r++;
          }
          g === 34 && (y || a < r) && h.indexOf("\\") !== -1 && (h = h.replace(/\\n/g, `
`).replace(/\\r/g, "\r")), o[p] = h;
        }
        return o;
      }
      function ne(e, o) {
        return o && k(o.fast) ? oe(e) : re(e);
      }
      function T(e) {
        console.log(`\u2506 ${e}`);
      }
      function se(e) {
        console.error(`\u25C7 ${e}`);
      }
      function V(e) {
        return e[0] === "~" ? j.join(z.homedir(), e.slice(1)) : e;
      }
      function ie(e = {}) {
        return { ...B(), ...e };
      }
      function ce(e) {
        e = ie(e);
        let o = j.resolve(process.cwd(), ".env"), t = "utf8", n = process.env;
        e && e.processEnv != null && (n = e.processEnv);
        let r = k(e && e.debug);
        e && e.encoding ? t = e.encoding : r && T("no encoding is specified (UTF-8 is used by default)");
        let s = [o];
        if (e && e.path) if (!Array.isArray(e.path)) s = [V(e.path)];
        else {
          s = [];
          for (let c of e.path) s.push(V(c));
        }
        let i, l = {}, u = { fast: e.fast };
        for (let c of s) try {
          let a = E.parse(Y.readFileSync(c, { encoding: t }), u);
          E.populate(l, a, e);
        } catch (a) {
          r && T(`failed to load ${c} ${a.message}`), i = a;
        }
        let p = E.populate(n, l, e), f = k(Object.prototype.hasOwnProperty.call(e, "quiet") ? e.quiet : B(n).quiet);
        if (r || !f) {
          let c = Object.keys(p).length, a = [];
          for (let g of s) try {
            let h = j.relative(process.cwd(), g instanceof Z ? ee(g) : g);
            a.push(h);
          } catch (h) {
            r && T(`failed to load ${g} ${h.message}`), i = h;
          }
          se(`injected env (${c}) from ${a.join(",")}`);
        }
        return i ? { parsed: l, error: i } : { parsed: l };
      }
      function ae(e) {
        return E.configDotenv(e);
      }
      function le(e, o, t = {}) {
        let n = !!(t && t.debug), r = !!(t && t.override), s = {};
        if (e === null || typeof e != "object" || o === null || typeof o != "object") {
          let i = new Error("OBJECT_REQUIRED: Please check the processEnv argument being passed to populate");
          throw i.code = "OBJECT_REQUIRED", i;
        }
        for (let i of Object.keys(o)) Object.prototype.hasOwnProperty.call(e, i) ? (r === true && (e[i] = o[i], s[i] = o[i]), n && T(r === true ? `"${i}" is already defined and WAS overwritten` : `"${i}" is already defined and was NOT overwritten`)) : (e[i] = o[i], s[i] = o[i]);
        return s;
      }
      var E = { configDotenv: ce, config: ae, parse: ne, populate: le };
      x.exports.configDotenv = E.configDotenv;
      x.exports.config = E.config;
      x.exports.parse = E.parse;
      x.exports.populate = E.populate;
      x.exports = E;
    });
    var M = I((Te, W) => {
      var _ = require("child_process"), fe = require("fs"), L = require("path");
      function ue(e) {
        let o = ['"'], t = 0;
        for (let n of e) {
          if (n === "\\") {
            t++;
            continue;
          }
          n === '"' ? o.push("\\".repeat(t * 2 + 1), '"') : o.push("\\".repeat(t), n), t = 0;
        }
        return o.push("\\".repeat(t * 2), '"'), o.join("");
      }
      function H(e, o = 1) {
        for (let t = 0; t < o; t++) {
          let n = [];
          for (let r of e) {
            let s = r.charCodeAt(0), i = s >= 48 && s <= 57 || s >= 65 && s <= 90 || s >= 97 && s <= 122, l = "\\/:._-".includes(r);
            !i && !l && s < 128 && n.push("^"), n.push(r);
          }
          e = n.join("");
        }
        return e;
      }
      function P(e, o) {
        let t = Object.keys(e).reverse().find((n) => n.toUpperCase() === o);
        return t === void 0 ? void 0 : e[t];
      }
      function de(e, o, t) {
        let n = (P(o, "PATHEXT") || ".COM;.EXE;.BAT;.CMD").split(";").filter(Boolean), s = n.some((l) => e.toLowerCase().endsWith(l.toLowerCase())) ? ["", ...n] : [...n, ""], i = /[\\/]/.test(e) ? [t] : [t, ...(P(o, "PATH") || "").split(";")];
        for (let l of i) for (let u of s) {
          let p = L.resolve(t, l.replace(/^"|"$/g, ""), e + u);
          try {
            if (fe.statSync(p).isFile()) return p;
          } catch {
          }
        }
      }
      function pe(e, o, t) {
        if (process.platform !== "win32") return _.spawn(e, o, t);
        let n = t.env || process.env, r = de(e, n, t.cwd || process.cwd());
        if (r && /\.(?:exe|com)$/i.test(r)) return _.spawn(r, o, t);
        let s = /\.(?:bat|cmd)$/i.test(r || e), i = [H(L.normalize(r || e))];
        for (let u of o) i.push(H(ue(u), s ? 2 : 1));
        let l = i.join(" ");
        return _.spawn(P(n, "COMSPEC") || "cmd.exe", ["/d", "/v:off", "/s", "/c", `"${l}"`], { ...t, windowsVerbatimArguments: true });
      }
      W.exports = pe;
    });
    var K = I(($e, F) => {
      var he = require("fs"), ge = require("os"), Q = require("path"), me = require("child_process"), ve = M(), R = N(), { optionsFromEnv: Ce } = S();
      function $() {
        console.log(["Usage: dotenv run [--help] [-q|--quiet] [--debug] [--override] [--fast] [-f|--file <paths>] [--] <command> [args...]", "", "Run a command with environment variables from a .env file.", "Place dotenv options before the command; all following arguments go to the command.", "", "Options:", "  -f, --file <paths>  .env paths, comma-separated or repeated (default: .env)", "  -q, --quiet suppress the injected env message", "  --debug     enable debug logging", "  --override  override existing environment variables", "  --fast      use the faster character-scanner parser", "", "Environment variables (DOTENV_CONFIG_* names remain as fallbacks):", "  DOTENV_PATH, DOTENV_ENCODING, DOTENV_QUIET,", "  DOTENV_DEBUG, DOTENV_OVERRIDE,", "  DOTENV_FAST"].join(`
`));
      }
      function we(e) {
        let o = [], t = false, n, r, s, i, l = -1;
        for (let p = 0; p < e.length; p++) {
          let f = e[p];
          if (f === "--") {
            l = p + 1;
            break;
          }
          if (f === "--help" || f === "-h") return { help: true };
          if (f === "--quiet" || f === "-q") {
            n = true;
            continue;
          }
          if (f === "--debug") {
            r = true;
            continue;
          }
          if (f === "--override") {
            s = true;
            continue;
          }
          if (f === "--fast") {
            i = true;
            continue;
          }
          if (f === "-f" || f === "--file" || f.startsWith("-f=") || f.startsWith("--file=")) {
            let c = f.indexOf("="), a = c === -1 ? f : f.slice(0, c), g = c === -1 ? e[++p] : f.slice(c + 1);
            if (!g || g === "--") return { error: `${a} requires a path` };
            let h = g.split(",").map((y) => y.trim()).filter(Boolean);
            if (h.length === 0) return { error: `${a} requires a path` };
            o.push(...h), t = true;
            continue;
          }
          if (f.startsWith("-")) return { error: `unknown option: ${f}` };
          l = p;
          break;
        }
        let u = l === -1 ? [] : e.slice(l);
        return { paths: o, pathSet: t, quiet: n, debug: r, override: s, fast: i, command: u };
      }
      function Ee(e) {
        return e[0] === "~" ? Q.join(ge.homedir(), e.slice(1)) : e;
      }
      function Ae(e) {
        let o = Ce(), t = { encoding: o.encoding || "utf8", quiet: o.quiet === true, debug: o.debug === true, override: o.override === true, fast: o.fast === true, paths: [".env"], defaultPath: true };
        return o.path != null && (t.paths = [o.path], t.defaultPath = false), e.pathSet && (t.paths = e.paths, t.defaultPath = false), e.quiet != null && (t.quiet = e.quiet), e.debug != null && (t.debug = e.debug), e.override != null && (t.override = e.override), e.fast != null && (t.fast = e.fast), t;
      }
      function be(e) {
        let o = {}, t = [], n = { override: e.override, debug: e.debug };
        for (let s of e.paths) {
          let i = Q.resolve(process.cwd(), Ee(s));
          try {
            let l = R.parse(he.readFileSync(i, { encoding: e.encoding }), { fast: e.fast });
            R.populate(o, l, n), t.push(s);
          } catch (l) {
            if (e.debug && console.log(`\u2506 failed to load ${s} ${l.message}`), !(e.defaultPath && l.code === "ENOENT")) throw l;
          }
        }
        return { injected: R.populate(process.env, o, n), loadedPaths: t };
      }
      function J(e) {
        let o = e[0];
        if (o === "--help" || o === "-h") {
          $();
          return;
        }
        if (o !== "run") {
          $(), process.exitCode = 1;
          return;
        }
        let t = we(e.slice(1));
        if (t.help) {
          $();
          return;
        }
        if (t.error) {
          console.error(`dotenv: ${t.error}`), $(), process.exitCode = 1;
          return;
        }
        if (t.command.length === 0) {
          $(), process.exitCode = 1;
          return;
        }
        let n = Ae(t);
        try {
          let c = be(n);
          if (!n.quiet) {
            let a = `\u25C7 injected env (${Object.keys(c.injected).length})`;
            c.loadedPaths.length > 0 && (a += ` from ${c.loadedPaths.join(", ")}`), console.error(a);
          }
        } catch (c) {
          console.error(`dotenv: ${c.message}`), process.exitCode = 1;
          return;
        }
        let r = !!process.stdin.isTTY, s = process.platform !== "win32" && !r, i = ve(t.command[0], t.command.slice(1), { stdio: "inherit", detached: s }), l = /* @__PURE__ */ new Map(), u = 0;
        function p(c) {
          if (!(!i.pid || i.exitCode !== null || i.signalCode !== null)) {
            if (process.platform === "win32") {
              me.spawnSync("taskkill", ["/pid", String(i.pid), "/T", "/F"], { stdio: "ignore" });
              return;
            }
            try {
              process.kill(s ? -i.pid : i.pid, c);
            } catch (a) {
              if (a.code !== "ESRCH") throw a;
            }
          }
        }
        function f() {
          for (let [c, a] of l) process.removeListener(c, a);
        }
        for (let c of ["SIGINT", "SIGTERM", "SIGHUP", "SIGQUIT"]) {
          let a = () => {
            if (c === "SIGINT") {
              if (u++, r && process.platform !== "win32" && u === 1) return;
              if (u > 1) {
                p(u === 2 ? "SIGTERM" : "SIGKILL");
                return;
              }
            }
            p(c);
          };
          l.set(c, a), process.on(c, a);
        }
        i.on("error", function(c) {
          f(), console.error(`dotenv: ${c.message}`), process.exitCode = 1;
        }), i.on("exit", function(c, a) {
          f(), typeof c == "number" ? process.exit(c) : (setInterval(() => {
          }, 1e3), process.kill(process.pid, a));
        });
      }
      F.exports = J;
      require.main === F && J(process.argv.slice(2));
    });
    var D = N();
    var Oe = K();
    module2.exports = D;
    module2.exports.config = D.config;
    module2.exports.configDotenv = D.configDotenv;
    module2.exports.parse = D.parse;
    module2.exports.populate = D.populate;
    require.main === module2 && Oe(process.argv.slice(2));
  }
});

// scripts/add-avatars.ts
var import_dotenv2 = __toESM(require_dist());
var import_sharp = __toESM(require("sharp"));
var import_path2 = require("path");

// src/lib/mongo.ts
var import_mongodb = require("mongodb");
var cache = global._mongoCache ?? { client: null, promise: null };
global._mongoCache = cache;
function uri() {
  const value = process.env.MONGODB_URI;
  if (!value) {
    throw new Error(
      "Missing MONGODB_URI. Set it to your MongoDB connection string."
    );
  }
  return value;
}
function dbName() {
  return process.env.MONGODB_DB || void 0;
}
async function getClient() {
  if (cache.client) return cache.client;
  if (!cache.promise) {
    cache.promise = new import_mongodb.MongoClient(uri(), {
      // The auction polls constantly from a handful of clients; a small pool is
      // plenty and keeps us well inside Atlas's shared-tier connection limit.
      maxPoolSize: 10,
      // Fail fast rather than hanging a request for 30s when Mongo is away.
      serverSelectionTimeoutMS: 8e3
    }).connect();
  }
  try {
    cache.client = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.client;
}
async function getDb() {
  const client = await getClient();
  return client.db(dbName());
}
async function closeDb() {
  const client = cache.client;
  cache.client = null;
  cache.promise = null;
  if (client) await client.close();
}

// src/lib/db.ts
var import_mongodb2 = require("mongodb");

// src/lib/db-errors.ts
var DuplicateKeyError = class extends Error {
  constructor(field) {
    super(`Duplicate value for unique field "${field}"`);
    this.name = "DuplicateKeyError";
    this.field = field;
  }
};

// src/lib/db.ts
var OPERATOR_KEYS = ["$in", "$ne", "$contains", "$size", "$exists"];
var UPDATE_OP_KEYS = ["$push", "$pull", "$pop", "$inc"];
function toId(id) {
  return import_mongodb2.ObjectId.isValid(id) && String(new import_mongodb2.ObjectId(id)) === id ? new import_mongodb2.ObjectId(id) : id;
}
function isOperator(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  if (value instanceof Date || value instanceof import_mongodb2.ObjectId) return false;
  return OPERATOR_KEYS.some((key2) => key2 in value);
}
function compare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (typeof a === "boolean" && typeof b === "boolean") {
    return Number(a) - Number(b);
  }
  return String(a).localeCompare(String(b));
}
function sortDocs(rows, sort) {
  const keys = Object.entries(sort);
  if (!keys.length) return rows;
  return [...rows].sort((left, right) => {
    for (const [key2, direction] of keys) {
      const result = compare(
        left[key2],
        right[key2]
      );
      if (result !== 0) return result * direction;
    }
    return 0;
  });
}
var writeListeners = /* @__PURE__ */ new Set();
function notifyDbWrite() {
  for (const listener of writeListeners) listener();
}
function asDuplicate(error, unique) {
  const err = error;
  if (err?.code === 11e3) {
    const field = Object.keys(err.keyPattern ?? {}).join("+") || unique[0] || "field";
    throw new DuplicateKeyError(field);
  }
  throw error;
}
async function ensureIndex(handle, collectionName, keys, indexName) {
  try {
    await handle.createIndex(keys, { unique: true, name: indexName });
  } catch (error) {
    const code = error.code;
    if (code === 85 || code === 86) return;
    console.warn(
      `[db] could not create index ${indexName} on ${collectionName}:`,
      error instanceof Error ? error.message : error
    );
  }
}
function collection(def) {
  const { name, defaults, unique = [], uniqueCompound = [] } = def;
  const hasIndexes = unique.length > 0 || uniqueCompound.length > 0;
  let indexesReady = null;
  async function col() {
    const database = await getDb();
    const handle = database.collection(name);
    if (hasIndexes && !indexesReady) {
      indexesReady = Promise.all([
        ...unique.map(
          (field) => ensureIndex(handle, name, { [field]: 1 }, `uniq_${field}`)
        ),
        ...uniqueCompound.map(
          (fields) => ensureIndex(
            handle,
            name,
            Object.fromEntries(fields.map((field) => [field, 1])),
            `uniq_${fields.join("_")}`
          )
        )
      ]).then(() => void 0);
    }
    if (indexesReady) await indexesReady;
    return handle;
  }
  function hydrate(row) {
    const { _id, ...rest } = row;
    return { ...rest, _id: String(_id) };
  }
  function build(filter) {
    const out = {};
    for (const [field, condition] of Object.entries(filter ?? {})) {
      if (condition === void 0) continue;
      const cast = (value) => field === "_id" && typeof value === "string" ? toId(value) : value;
      if (!isOperator(condition)) {
        out[field] = cast(condition ?? null);
        continue;
      }
      const op = condition;
      if ("$in" in op) out[field] = { $in: op.$in.map(cast) };
      if ("$ne" in op) out[field] = { $ne: cast(op.$ne ?? null) };
      if ("$contains" in op) out[field] = { $all: [op.$contains] };
      if ("$size" in op) out[field] = { $size: op.$size };
      if ("$exists" in op) out[field] = { $exists: op.$exists };
    }
    return out;
  }
  function buildUpdate(patch) {
    const set = {};
    const update = {};
    for (const [key2, value] of Object.entries(patch)) {
      if (UPDATE_OP_KEYS.includes(key2)) update[key2] = value;
      else set[key2] = value;
    }
    set.updatedAt = /* @__PURE__ */ new Date();
    update.$set = set;
    return update;
  }
  return {
    name,
    defaults,
    async find(filter, options) {
      const handle = await col();
      const rows = (await handle.find(build(filter)).toArray()).map(hydrate);
      const sorted = options?.sort ? sortDocs(rows, options.sort) : rows;
      return options?.limit != null ? sorted.slice(0, options.limit) : sorted;
    },
    async findOne(filter, options) {
      const rows = await this.find(filter, { ...options, limit: 1 });
      return rows[0] ?? null;
    },
    async findById(id) {
      if (!id) return null;
      const handle = await col();
      const row = await handle.findOne({ _id: toId(id) });
      return row ? hydrate(row) : null;
    },
    async count(filter) {
      const handle = await col();
      return handle.countDocuments(build(filter));
    },
    async exists(filter) {
      const handle = await col();
      return await handle.findOne(build(filter), { projection: { _id: 1 } }) != null;
    },
    async create(data) {
      const handle = await col();
      const now = /* @__PURE__ */ new Date();
      const payload = { ...defaults(), ...data, createdAt: now, updatedAt: now };
      try {
        const result = await handle.insertOne(payload);
        notifyDbWrite();
        return { ...payload, _id: String(result.insertedId) };
      } catch (error) {
        asDuplicate(error, unique);
      }
    },
    /** One batched insert, used by the player importer. */
    async createMany(rows) {
      if (!rows.length) return [];
      const handle = await col();
      const now = /* @__PURE__ */ new Date();
      const payloads = rows.map((row) => ({
        ...defaults(),
        ...row,
        createdAt: now,
        updatedAt: now
      }));
      try {
        const result = await handle.insertMany(payloads);
        notifyDbWrite();
        return payloads.map((payload, index) => ({
          ...payload,
          _id: String(result.insertedIds[index])
        }));
      } catch (error) {
        asDuplicate(error, unique);
      }
    },
    async updateById(id, patch) {
      const handle = await col();
      try {
        const row = await handle.findOneAndUpdate(
          { _id: toId(id) },
          buildUpdate(patch),
          { returnDocument: "after" }
        );
        if (!row) return null;
        notifyDbWrite();
        return hydrate(row);
      } catch (error) {
        asDuplicate(error, unique);
      }
    },
    /**
     * The conditional claim the auction leans on: moves a document only while
     * it still matches `filter`, in one atomic operation. Returns the updated
     * document, or null when another request got there first.
     */
    async findOneAndUpdate(filter, patch, options) {
      const handle = await col();
      try {
        const row = await handle.findOneAndUpdate(
          build(filter),
          buildUpdate(patch),
          { returnDocument: options?.returnDocument ?? "after" }
        );
        if (!row) return null;
        notifyDbWrite();
        return hydrate(row);
      } catch (error) {
        asDuplicate(error, unique);
      }
    },
    async updateMany(filter, patch) {
      const handle = await col();
      const result = await handle.updateMany(build(filter), buildUpdate(patch));
      if (result.modifiedCount) notifyDbWrite();
      return result.modifiedCount;
    },
    /**
     * Reads the row at `id`, creating it from the collection's defaults when it
     * is absent. A single upsert, so two requests racing on a cold database
     * cannot produce two rows. Nothing is written when the row already exists.
     */
    async ensureById(id) {
      const handle = await col();
      const now = /* @__PURE__ */ new Date();
      const row = await handle.findOneAndUpdate(
        { _id: toId(id) },
        { $setOnInsert: { ...defaults(), createdAt: now, updatedAt: now } },
        { upsert: true, returnDocument: "after" }
      );
      if (!row) return null;
      notifyDbWrite();
      return hydrate(row);
    },
    async deleteById(id) {
      const handle = await col();
      const result = await handle.deleteOne({ _id: toId(id) });
      if (result.deletedCount) notifyDbWrite();
      return result.deletedCount > 0;
    },
    async deleteMany(filter) {
      const handle = await col();
      const result = await handle.deleteMany(build(filter));
      if (result.deletedCount) notifyDbWrite();
      return result.deletedCount;
    }
  };
}

// src/models/Player.ts
var Players = collection({
  name: "players",
  defaults: () => ({
    name: "",
    order: 0,
    avatarUrl: null,
    role: "Batsman",
    categoryId: "",
    basePriceOverride: null,
    tagIds: [],
    info: "",
    status: "PENDING",
    soldToTeamId: null,
    soldPrice: null
  })
});

// scripts/match-avatars.ts
var import_dotenv = __toESM(require_dist());
var import_fs = require("fs");
var import_path = require("path");
(0, import_dotenv.config)({ path: ".env.local" });
var IMAGE_EXT = /* @__PURE__ */ new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
function tokens(name) {
  const raw = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ").filter(Boolean);
  const out = [];
  for (const token of raw) {
    const prev = out[out.length - 1];
    if (token.length === 1 && prev && prev.length <= 2 && /^[a-z]+$/.test(prev)) {
      out[out.length - 1] = prev + token;
    } else {
      out.push(token);
    }
  }
  return out;
}
var ALIASES = {
  "Arjun S": "Arjun Sathyan"
};
function key(name) {
  return tokens(ALIASES[name.trim()] ?? name).join("");
}
function distance(a, b) {
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(
        prev[j] + 1,
        prev[j - 1] + 1,
        diag + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diag = temp;
    }
  }
  return prev[b.length];
}
function labelOf(file) {
  return (0, import_path.basename)(file, (0, import_path.extname)(file)).replace(/-[A-Za-z]*\d+\s*$/, "").trim();
}
function subsequence(short, long) {
  let i = 0;
  for (const t of long) if (t === short[i]) i++;
  return i === short.length;
}
function matchAll(files, players) {
  const remaining = new Map(players.map((p) => [p._id, p]));
  const matches = [];
  const unmatchedFiles = [];
  const candidates = files.map((file) => {
    const label = labelOf(file);
    return { file, label, label_key: key(label), label_tokens: tokens(label) };
  });
  const passes = ["exact", "prefix", "middle", "fuzzy"];
  const taken = /* @__PURE__ */ new Set();
  for (const how of passes) {
    for (const c of candidates) {
      if (taken.has(c.file)) continue;
      const hits = [...remaining.values()].filter((p) => {
        const pk = key(p.name);
        const pt = tokens(ALIASES[p.name.trim()] ?? p.name);
        if (how === "exact") return pk === c.label_key;
        if (how === "prefix") {
          const [short, long] = pt.length <= c.label_tokens.length ? [pt, c.label_tokens] : [c.label_tokens, pt];
          return short.length >= 1 && short.every((t, i) => long[i] === t);
        }
        if (how === "middle") {
          const [short, long] = pt.length <= c.label_tokens.length ? [pt, c.label_tokens] : [c.label_tokens, pt];
          return short.length >= 2 && short[0] === long[0] && short[short.length - 1] === long[long.length - 1] && subsequence(short, long);
        }
        return distance(pk, c.label_key) <= 2 && pt[0] === c.label_tokens[0];
      });
      if (hits.length === 1) {
        matches.push({
          file: c.file,
          label: c.label,
          playerId: hits[0]._id,
          playerName: hits[0].name,
          how
        });
        remaining.delete(hits[0]._id);
        taken.add(c.file);
      }
    }
  }
  for (const c of candidates) if (!taken.has(c.file)) unmatchedFiles.push(c.file);
  return { matches, unmatchedFiles, unmatchedPlayers: [...remaining.values()] };
}
async function main() {
  const dir = process.argv[2];
  if (!dir) throw new Error("Pass the image directory");
  const files = (0, import_fs.readdirSync)(dir).filter(
    (f) => IMAGE_EXT.has((0, import_path.extname)(f).toLowerCase())
  );
  const players = await Players.find({}, { sort: { order: 1 } });
  const { matches, unmatchedFiles, unmatchedPlayers } = matchAll(files, players);
  const byHow = (how) => matches.filter((m) => m.how === how);
  console.log(`${files.length} images, ${players.length} players
`);
  console.log(`MATCHED ${matches.length}  (exact ${byHow("exact").length}, prefix ${byHow("prefix").length}, middle ${byHow("middle").length}, fuzzy ${byHow("fuzzy").length})
`);
  for (const how of ["prefix", "middle", "fuzzy"]) {
    const list = byHow(how);
    if (!list.length) continue;
    console.log(`-- ${how} matches, check these --`);
    for (const m of list) console.log(`   "${m.label}"  ->  "${m.playerName}"`);
    console.log();
  }
  console.log(`-- ${unmatchedPlayers.length} players with NO image --`);
  for (const p of unmatchedPlayers) console.log(`   ${p.name}`);
  console.log(`
-- ${unmatchedFiles.length} images matched to nobody --`);
  for (const f of unmatchedFiles) console.log(`   ${labelOf(f)}`);
}
if (process.argv[1]?.endsWith("match-avatars.ts")) {
  main().catch((err) => {
    console.error(String(err instanceof Error ? err.message : err));
    process.exitCode = 1;
  }).finally(() => closeDb());
}

// scripts/add-avatars.ts
(0, import_dotenv2.config)({ path: ".env.local" });
var OUT_DIR = (0, import_path2.join)(process.cwd(), "public", "players");
var PUBLIC_PREFIX = "/players";
var MAX_EDGE = 900;
var slugOf = (name) => tokens(name).join("-");
async function main2() {
  const apply = process.argv.includes("--yes");
  const inputs = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  if (!inputs.length) {
    throw new Error('Pass one or more image paths, e.g. "public/players/esha.jpg"');
  }
  const players = await Players.find();
  const { matches, unmatchedFiles } = matchAll(
    inputs.map((p) => (0, import_path2.basename)(p)),
    players
  );
  const sourceOf = new Map(inputs.map((p) => [(0, import_path2.basename)(p), p]));
  if (!apply) console.log("DRY RUN \u2014 nothing written\n");
  for (const match of matches) {
    const slug = slugOf(match.playerName);
    console.log(
      `${match.file}  ->  ${match.playerName}  (${match.how})  ->  ${PUBLIC_PREFIX}/${slug}.jpg`
    );
  }
  for (const file of unmatchedFiles) {
    console.log(`${file}  ->  NO MATCH \u2014 rename it after the player and retry`);
  }
  if (!apply) {
    console.log("\nRe-run with --yes to apply.");
    return;
  }
  let written = 0;
  for (const match of matches) {
    const slug = slugOf(match.playerName);
    const source = sourceOf.get(match.file);
    const out = (0, import_path2.join)(OUT_DIR, `${slug}.jpg`);
    const buffer = await (0, import_sharp.default)(source).rotate().resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
    await (0, import_sharp.default)(buffer).toFile(out);
    const saved = await Players.updateById(match.playerId, {
      avatarUrl: `${PUBLIC_PREFIX}/${slug}.jpg`
    });
    console.log(
      saved ? `wrote ${slug}.jpg and set ${match.playerName}'s avatar` : `wrote ${slug}.jpg but ${match.playerName} vanished mid-run`
    );
    if (saved) written++;
  }
  console.log(`
${written} avatar(s) applied, ${unmatchedFiles.length} unmatched`);
}
main2().catch((err) => {
  console.error(String(err instanceof Error ? err.message : err));
  process.exitCode = 1;
}).finally(() => closeDb());
