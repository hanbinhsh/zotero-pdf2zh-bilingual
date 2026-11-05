import { defineConfig } from "zotero-plugin-scaffold";
import pkg from "./package.json";

export default defineConfig({
  source: ["src", "addon"],
  dist: "dist",
  name: pkg.config.addonName,
  id: pkg.config.addonID,
  namespace: pkg.config.addonRef,
  updateURL: `https://github.com/{{owner}}/{{repo}}/releases/download/release/${
    pkg.version.includes("-") ? "update-beta.json" : "update.json"
  }`,
  xpiName: pkg.config.xpiName,
  xpiDownloadLink:
    "https://github.com/{{owner}}/{{repo}}/releases/download/v{{version}}/{{xpiName}}.xpi",

  build: {
    assets: ["addon/**/*.*"],
    define: {
      ...pkg.config,
      author: pkg.author,
      description: pkg.description,
      homepage: pkg.homepage,
      buildVersion: pkg.version,
      buildTime: "{{buildTime}}",
    },
    prefs: {
      prefix: pkg.config.prefsPrefix,
    },
    esbuildOptions: [
      {
        entryPoints: ["src/index.ts"],
        define: {
          __env__: `"${process.env.NODE_ENV}"`,
        },
        banner: {
          js: `(() => {
  const g = typeof globalThis === "object" && globalThis ? globalThis : this;
  if (!g.globalThis) g.globalThis = g;
  if (!g.self) g.self = g;
  if (!g.global) g.global = g;
  const fallbackConsole = {
    log() {},
    info() {},
    warn() {},
    error() {},
    debug() {},
    trace() {},
    group() {},
    groupCollapsed() {},
    groupEnd() {},
    time() {},
    timeEnd() {},
    dir() {},
    assert() {},
    table() {},
    count() {},
    countReset() {},
    clear() {},
  };
  g.console = typeof g.console === "object" && g.console ? g.console : fallbackConsole;
  for (const methodName of Object.keys(fallbackConsole)) {
    if (typeof g.console[methodName] !== "function") {
      g.console[methodName] = fallbackConsole[methodName];
    }
  }
})();`,
        },
        bundle: true,
        target: "firefox115",
        outfile: `dist/addon/content/scripts/${pkg.config.addonRef}.js`,
      },
    ],
  },

  // If you need to see a more detailed log, uncomment the following line:
  // logLevel: "trace",
});
