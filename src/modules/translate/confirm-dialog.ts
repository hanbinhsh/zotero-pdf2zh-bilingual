import { translateModes } from "../../config";
import { getString } from "../../utils/locale";
import { getPref, setPref } from "../../utils/prefs";
import { getLanguages, getLanguageName } from "../language";
import type { Language } from "../language/types";

const DIALOG_EARLY_STYLE = `
html, body {
  margin: 0 !important;
  padding: 12px !important;
  overflow: hidden !important;
  background: var(--material-background, -moz-Dialog) !important;
  color: var(--material-text, -moz-DialogText) !important;
  font: message-box;
}
body > vbox {
  background: transparent !important;
}
select {
  padding: 4px 8px;
  border-radius: 4px;
  border: 1px solid var(--material-border, #ccc);
  background: var(--material-input-background, #fff);
  color: var(--material-text, #333);
}
`;

function centerDialogRows(helper: any) {
  const root = helper?.elementProps;
  if (!root?.children) return;
  root.attributes = {
    ...(root.attributes || {}),
    flex: 1,
    align: "center",
  };
  for (const row of root.children) {
    row.attributes = {
      ...(row.attributes || {}),
      pack: row.attributes?.pack || "center",
      align: "center",
    };
  }
}

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

export async function showConfirmationDialog(): Promise<{
  action: "confirm" | "cancel";
  data?: {
    targetLanguage: Language;
    sourceLanguage: string;
    translateMode: string;
  };
}> {
  const dialogData: { [key: string | number]: any } = {
    targetLanguage: getPref("targetLanguage"),
    sourceLanguage: String(
      (getPref as any)("localPdfMathTranslateSourceLanguage") || "auto",
    ),
    translateMode: getPref("translateMode"),
  };

  const dialogHelper = new ztoolkit.Dialog(9, 1)
    .addCell(0, 0, {
      tag: "style",
      namespace: "html",
      properties: {
        innerHTML: DIALOG_EARLY_STYLE,
      },
    })
    .addCell(1, 0, {
      tag: "h2",
      properties: {
        innerHTML: getString("confirm-options"),
      },
      styles: {
        width: "300px",
        margin: "0 auto 10px auto",
        fontSize: "1.2em",
        fontWeight: "600",
        textAlign: "center",
      },
    })
    .addCell(2, 0, {
      tag: "label",
      namespace: "html",
      properties: {
        innerHTML: getString("confirm-target-language"),
      },
      styles: {
        width: "240px",
        margin: "4px auto 2px auto",
        fontSize: "0.95em",
        fontWeight: "500",
      },
    })
    .addCell(
      3,
      0,
      {
        tag: "select",
        id: "targetLanguage",
        attributes: {
          "data-bind": "targetLanguage",
          "data-prop": "value",
        },
        children: getLanguages().map((lang) => ({
          tag: "option",
          properties: {
            value: lang,
            innerHTML: getLanguageName(lang, Zotero.locale as Language),
          },
        })),
        styles: {
          width: "240px",
          height: "32px",
          margin: "2px auto 8px auto",
        },
      },
      false,
    )
    .addCell(4, 0, {
      tag: "label",
      namespace: "html",
      properties: {
        innerHTML: getString("confirm-source-language"),
      },
      styles: {
        width: "240px",
        margin: "4px auto 2px auto",
        fontSize: "0.95em",
        fontWeight: "500",
      },
    })
    .addCell(
      5,
      0,
      {
        tag: "select",
        id: "sourceLanguage",
        attributes: {
          "data-bind": "sourceLanguage",
          "data-prop": "value",
        },
        children: getSourceLanguageOptions(Zotero.locale as Language).map(
          (lang) => ({
            tag: "option",
            properties: {
              value: lang.value,
              innerHTML: lang.label,
            },
          }),
        ),
        styles: {
          width: "240px",
          height: "32px",
          margin: "2px auto 8px auto",
        },
      },
      false,
    )
    .addCell(6, 0, {
      tag: "label",
      namespace: "html",
      properties: {
        innerHTML: getString("confirm-translate-mode"),
      },
      styles: {
        width: "240px",
        margin: "4px auto 2px auto",
        fontSize: "0.95em",
        fontWeight: "500",
      },
    })
    .addCell(
      7,
      0,
      {
        tag: "select",
        id: "translateMode",
        attributes: {
          "data-bind": "translateMode",
          "data-prop": "value",
        },
        children: translateModes.map((mode) => ({
          tag: "option",
          properties: {
            value: mode.value,
            innerHTML: getString(mode.label),
          },
        })),
        styles: {
          width: "240px",
          height: "32px",
          margin: "2px auto 14px auto",
        },
      },
      false,
    )
    .addButton(getString("confirm-yes"), "confirm")
    .addButton(getString("confirm-cancel"), "cancel")
    .setDialogData(dialogData);

  centerDialogRows(dialogHelper as any);

  dialogHelper.open(getString("confirm-title"), {
    width: 400,
    height: 350,
    centerscreen: true,
    resizable: false,
    fitContent: false,
  });

  addon.data.dialog = dialogHelper;
  await dialogData.unloadLock.promise;
  addon.data.dialog = undefined;
  if (addon.data.alive) {
    if (dialogData._lastButtonId === "confirm") {
      setPref("targetLanguage", dialogData.targetLanguage);
      setPref("translateMode", dialogData.translateMode);
      setPref("localPdfMathTranslateSourceLanguage", dialogData.sourceLanguage);
      return {
        action: "confirm",
        data: dialogData as {
          targetLanguage: Language;
          sourceLanguage: string;
          translateMode: string;
        },
      };
    }
    return {
      action: "cancel",
    };
  }
  return {
    action: "cancel",
  };
}
