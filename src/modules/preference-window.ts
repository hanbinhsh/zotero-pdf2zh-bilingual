import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { showDialog } from "../utils/dialog";
import { getLanguages, getLanguageName } from "./language";
import {
  translateModes,
  dualModeOptions,
  bilingualLayoutOptions,
} from "../config";
import type { Language } from "./language/types";
import { resolveLocalPythonPath } from "./translate/local";

const DEFAULT_LOCAL_TEXT_PROMPT_TEMPLATE =
  "You are a professional academic translator. Translate the following markdown source text from {{sourceLanguage}} to {{targetLanguage}}. Keep formula notation {v*} unchanged. Only output the translated text, without JSON, explanations, or code fences.\n\nSource Text: {{text}}\n\nTranslated Text:";

function getSourceLanguageOptions(interfaceLanguage: Language) {
  return [
    {
      value: "auto",
      label: getString("source-language-auto"),
    },
    ...getLanguages().map((lang) => ({
      value: lang,
      label: getLanguageName(lang, interfaceLanguage),
    })),
  ];
}

export function registerPrefs() {
  Zotero.PreferencePanes.register({
    pluginID: addon.data.config.addonID,
    src: rootURI + "content/preferences.xhtml",
    label: getString("prefs-title"),
    image: `chrome://${addon.data.config.addonRef}/content/icons/favicon.png`,
  });
}

export async function registerPrefsScripts(_window: Window) {
  if (!addon.data.prefs) {
    addon.data.prefs = { window: _window };
  } else {
    addon.data.prefs.window = _window;
  }
  buildPrefsPane();
  bindPrefEvents();
  syncBilingualControls();
}

function buildPrefsPane() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) return;

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: `${config.addonRef}-target-language`,
      attributes: { value: getPref("targetLanguage") as string, native: "true" },
      styles: { maxWidth: "250px" },
      children: [
        {
          tag: "menupopup",
          children: getLanguages().map((lang) => ({
            tag: "menuitem",
            attributes: {
              label: getLanguageName(lang, Zotero.locale as Language),
              value: lang,
            },
          })),
        },
      ],
      listeners: [{
        type: "command",
        listener: (e: Event) => setPref("targetLanguage", (e.target as XUL.MenuList).value),
      }],
    },
    doc.querySelector(`#${config.addonRef}-target-language-placeholder`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: `${config.addonRef}-source-language`,
      attributes: {
        value: String((getPref as any)("localPdfMathTranslateSourceLanguage") || "auto"),
        native: "true",
      },
      styles: { maxWidth: "250px" },
      children: [{
        tag: "menupopup",
        children: getSourceLanguageOptions(Zotero.locale as Language).map((item) => ({
          tag: "menuitem",
          attributes: { label: item.label, value: item.value },
        })),
      }],
      listeners: [{
        type: "command",
        listener: (e: Event) => setPref("localPdfMathTranslateSourceLanguage", (e.target as XUL.MenuList).value as any),
      }],
    },
    doc.querySelector(`#${config.addonRef}-source-language-placeholder`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: `${config.addonRef}-translate-mode`,
      attributes: { value: getPref("translateMode") as string, native: "true" },
      styles: { maxWidth: "250px" },
      children: [{
        tag: "menupopup",
        children: translateModes.map((item) => ({
          tag: "menuitem",
          attributes: { label: getString(item.label), value: item.value },
        })),
      }],
      listeners: [{
        type: "command",
        listener: (e: Event) => {
          setPref("translateMode", (e.target as XUL.MenuList).value);
          syncBilingualControls();
        },
      }],
    },
    doc.querySelector(`#${config.addonRef}-translate-mode-placeholder`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: `${config.addonRef}-dual-mode`,
      attributes: { value: getPref("dualMode") as string, native: "true" },
      styles: { maxWidth: "250px" },
      children: [{
        tag: "menupopup",
        children: dualModeOptions.map((item) => ({
          tag: "menuitem",
          attributes: { label: getString(item.label), value: item.value },
        })),
      }],
      listeners: [{
        type: "command",
        listener: (e: Event) => setPref("dualMode", (e.target as XUL.MenuList).value),
      }],
    },
    doc.querySelector(`#${config.addonRef}-dual-mode-placeholder`)!,
  );

  ztoolkit.UI.replaceElement(
    {
      tag: "menulist",
      id: `${config.addonRef}-local-bilingual-layout`,
      attributes: {
        value: (getPref as any)("localBilingualLayout") as string,
        native: "true",
      },
      styles: { maxWidth: "250px" },
      children: [{
        tag: "menupopup",
        children: bilingualLayoutOptions.map((item) => ({
          tag: "menuitem",
          attributes: { label: getString(item.label), value: item.value },
        })),
      }],
      listeners: [{
        type: "command",
        listener: (e: Event) =>
          setPref("localBilingualLayout", (e.target as XUL.MenuList).value as any),
      }],
    },
    doc.querySelector(`#${config.addonRef}-local-bilingual-layout-placeholder`)!,
  );
}

function bindPrefEvents() {
  const doc = addon.data.prefs!.window.document;

  const bindTextPref = (
    idSuffix: string,
    prefKey:
      | "localApiBaseURL"
      | "localApiKey"
      | "localPdfMathTranslatePythonPath"
      | "localPdfMathTranslateThread"
      | "localTextModel"
      | "localTextPromptTemplate",
  ) => {
    const element = doc.querySelector(
      `#zotero-prefpane-${config.addonRef}-${idSuffix}`,
    ) as HTMLInputElement | HTMLTextAreaElement | null;
    if (!element) return;
    const handler = (e: Event) => {
      const value = (e.target as HTMLInputElement | HTMLTextAreaElement).value;
      setPref(
        prefKey,
        (prefKey === "localPdfMathTranslateThread"
          ? Math.max(1, Number.parseInt(value || "1", 10) || 1)
          : value) as any,
      );
    };
    element.addEventListener("input", handler);
    element.addEventListener("change", handler);
  };

  bindTextPref("localPdfMathTranslatePythonPath", "localPdfMathTranslatePythonPath");
  bindTextPref("localApiBaseURL", "localApiBaseURL");
  bindTextPref("localApiKey", "localApiKey");
  bindTextPref("localPdfMathTranslateThread", "localPdfMathTranslateThread");
  bindTextPref("localTextModel", "localTextModel");
  bindTextPref("localTextPromptTemplate", "localTextPromptTemplate");

  doc.querySelectorAll(`.${config.addonRef}-placeholder-button`)?.forEach((button: Element) => {
    const insert = () => {
      insertPlaceholderToken(
        doc,
        (button as HTMLElement).getAttribute("data-target") || "",
        (button as HTMLElement).getAttribute("data-token") || "",
      );
    };
    button.addEventListener("command", insert);
    button.addEventListener("click", insert);
  });

  const resetPrompt = () => {
    setPref("localTextPromptTemplate", DEFAULT_LOCAL_TEXT_PROMPT_TEMPLATE);
    const element = doc.querySelector(
      `#zotero-prefpane-${config.addonRef}-localTextPromptTemplate`,
    ) as HTMLTextAreaElement | null;
    if (element) {
      element.value = DEFAULT_LOCAL_TEXT_PROMPT_TEMPLATE;
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }
  };

  doc.querySelector(`#zotero-prefpane-${config.addonRef}-reset-localTextPromptTemplate`)?.addEventListener("command", resetPrompt);
  doc.querySelector(`#zotero-prefpane-${config.addonRef}-reset-localTextPromptTemplate`)?.addEventListener("click", resetPrompt);

  doc.querySelector(`#zotero-prefpane-${config.addonRef}-test-button`)?.addEventListener("command", async () => {
    try {
      const pythonPath = resolveLocalPythonPath();
      const pythonReady = !!pythonPath && (await IOUtils.exists(pythonPath));
      const localReady = await addon.api.checkLocalApi({
        baseURL: getPref("localApiBaseURL"),
        apiKey: getPref("localApiKey"),
      });

      if (pythonReady && localReady) {
        showDialog({ title: getString("pref-test-success") });
        return;
      }

      const reasons = [
        pythonReady ? null : getString("pref-local-python-path-invalid"),
        localReady ? null : getString("pref-local-api-base-url-description"),
      ].filter(Boolean);

      showDialog({
        title: getString("pref-test-failed"),
        message: reasons.join("\n") || getString("pref-local-test-failed-description"),
      });
    } catch (error) {
      ztoolkit.log(error);
      showDialog({
        title: getString("pref-test-failed"),
        message: getString("pref-local-test-failed-description"),
      });
    }
  });
}

function syncBilingualControls() {
  const doc = addon.data.prefs?.window?.document;
  if (!doc) return;
  const translateMode = String(getPref("translateMode") || "dual");
  const disabled = translateMode === "translation";
  const dualMode = doc.querySelector(`#${config.addonRef}-dual-mode`) as XUL.MenuList | null;
  const layout = doc.querySelector(`#${config.addonRef}-local-bilingual-layout`) as XUL.MenuList | null;
  if (dualMode) {
    dualMode.disabled = disabled;
  }
  if (layout) {
    layout.disabled = disabled;
  }
}

function insertPlaceholderToken(doc: Document, targetId: string, token: string) {
  const element = doc.querySelector(`#${targetId}`) as HTMLInputElement | HTMLTextAreaElement | null;
  if (!element || !token) return;
  const start = element.selectionStart ?? element.value.length;
  const end = element.selectionEnd ?? start;
  const nextValue = element.value.slice(0, start) + token + element.value.slice(end);
  element.value = nextValue;
  const cursor = start + token.length;
  element.setSelectionRange?.(cursor, cursor);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.focus();
}


