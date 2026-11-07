// Loads the site's own engine code (core, code, grammar engine) into Node, so tools check work exactly like the site does.
import vm from 'node:vm'; import { readFileSync } from 'node:fs';
const R = new URL('../', import.meta.url).pathname;
const el = () => new Proxy(function () {}, { get: (t, k) => k === Symbol.toPrimitive ? () => '' : el(), apply: () => el(), set: () => true });
const ctx = { console, setTimeout, clearTimeout, setInterval: () => 0, addEventListener() {}, Date, Math, JSON, Intl,
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} }, document: el(), navigator: {}, location: { href: '' }, fetch: async () => ({}) };
ctx.window = ctx; ctx.self = ctx; vm.createContext(ctx);
const run = (f, extra = '') => vm.runInContext(readFileSync(R + f, 'utf8') + extra, ctx, { filename: f });
run('vendor/grammar-engine.js');
run('src/core.js', '\n;globalThis.T=T;globalThis.N=N;globalThis.Store=Store;');
run('src/code.js', '\n;globalThis.Code=Code;');
export const { Code, T } = ctx;
export default ctx;
