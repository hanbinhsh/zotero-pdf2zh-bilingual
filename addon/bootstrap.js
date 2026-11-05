/* eslint-disable no-undef */

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
