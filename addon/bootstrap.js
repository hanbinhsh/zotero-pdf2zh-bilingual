/* eslint-disable no-undef */

/**
 * Most of this code is from Zotero team's official Make It Red example[1]
 * or the Zotero 7 documentation[2].
 * [1] https://github.com/zotero/make-it-red
 * [2] https://www.zotero.org/support/dev/zotero_7_for_developers
 */

var chromeHandle;

function install(data, reason) {}

async function startup({ id, version, resourceURI, rootURI }, reason) {
  var aomStartup = Components.classes[
    "@mozilla.org/addons/addon-manager-startup;1"
  ].getService(Components.interfaces.amIAddonManagerStartup);
  var manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "__addonRef__", rootURI + "content/"],
  ]);

  /**
   * Global variables for plugin code.
   * The `_globalThis` is the global root variable of the plugin sandbox environment
   * and all child variables assigned to it is globally accessible.
   * See `src/index.ts` for details.
   */
  const ctx = {
    rootURI,
  };
  ctx._globalThis = ctx;
  ctx.globalThis = ctx;
  ctx.self = ctx;
  ctx.global = ctx;

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
  ctx.console =
    typeof console !== "undefined" && console ? console : fallbackConsole;
  for (const methodName of Object.keys(fallbackConsole)) {
    if (typeof ctx.console[methodName] !== "function") {
      ctx.console[methodName] = fallbackConsole[methodName];
    }
  }

  // Polyfill for DOMMatrix required by pdf-lib
  if (typeof ctx.DOMMatrix === "undefined") {
    ctx.DOMMatrix = class DOMMatrix {
      constructor(init) {
        this.m11 = 1;
        this.m12 = 0;
        this.m13 = 0;
        this.m14 = 0;
        this.m21 = 0;
        this.m22 = 1;
        this.m23 = 0;
        this.m24 = 0;
        this.m31 = 0;
        this.m32 = 0;
        this.m33 = 1;
        this.m34 = 0;
        this.m41 = 0;
        this.m42 = 0;
        this.m43 = 0;
        this.m44 = 1;
      }
    };
  }

  // Polyfill for navigator required by pdf.js
  if (typeof ctx.navigator === "undefined") {
    ctx.navigator = {
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Firefox/121.0",
      platform: "Win32",
      language: "en-US",
      languages: ["en-US"],
      hardwareConcurrency: 8,
      deviceMemory: 8,
      maxTouchPoints: 0,
      vendor: "",
      onLine: true,
    };
  }

  // Polyfill for GlobalWorkerOptions required by pdf.js
  if (typeof ctx.GlobalWorkerOptions === "undefined") {
    ctx.GlobalWorkerOptions = {
      workerSrc: "", // Set to empty since we disable workers with disableWorker: true
    };
  }
  
  // Force GlobalWorkerOptions to persist by using Object.defineProperty
  try {
    Object.defineProperty(ctx, "GlobalWorkerOptions", {
      value: ctx.GlobalWorkerOptions,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } catch (e) {
    // Ignore if defineProperty fails
  }

  // Additional polyfills for pdf.js compatibility
  if (typeof ctx.TextEncoder === "undefined") {
    ctx.TextEncoder = TextEncoder;
  }
  if (typeof ctx.TextDecoder === "undefined") {
    ctx.TextDecoder = TextDecoder;
  }
  if (typeof ctx.ArrayBuffer === "undefined") {
    ctx.ArrayBuffer = ArrayBuffer;
  }
  if (typeof ctx.Uint8Array === "undefined") {
    ctx.Uint8Array = Uint8Array;
  }
  if (typeof ctx.Uint32Array === "undefined") {
    ctx.Uint32Array = Uint32Array;
  }
  // Note: Do NOT polyfill document/window - let Zotero provide them
  // PDF.js will use disableWorker: true so it doesn't need full DOM

  Services.scriptloader.loadSubScript(
    `${rootURI}/content/scripts/__addonRef__.js`,
    ctx,
  );
  Zotero.__addonInstance__.hooks.onStartup();
}

async function onMainWindowLoad({ window }, reason) {
  Zotero.__addonInstance__?.hooks.onMainWindowLoad(window);
}

async function onMainWindowUnload({ window }, reason) {
  Zotero.__addonInstance__?.hooks.onMainWindowUnload(window);
}

function shutdown({ id, version, resourceURI, rootURI }, reason) {
  if (reason === APP_SHUTDOWN) {
    return;
  }

  Zotero.__addonInstance__?.hooks.onShutdown();

  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall(data, reason) {}
