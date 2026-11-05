import { getString } from "./locale";

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

export function showDialog({
  title,
  message,
}: {
  title: string;
  message?: string;
}) {
  const dialog = new ztoolkit.Dialog(4, 1)
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
        innerHTML: title,
      },
      styles: {
        width: "320px",
        margin: "0 auto 8px auto",
        fontSize: "1.1em",
        fontWeight: "600",
      },
    })
    .addCell(2, 0, {
      tag: "label",
      namespace: "html",
      properties: {
        innerHTML: message || "",
      },
      styles: {
        width: "320px",
        margin: "0 auto",
        whiteSpace: "pre-wrap",
        lineHeight: "1.4",
        opacity: "0.9",
      },
    })
    .addButton(getString("confirm-yes") || "OK", "confirm");

  centerDialogRows(dialog as any);

  dialog.open(title, {
    width: 400,
    height: 200,
    centerscreen: true,
    resizable: false,
    fitContent: false,
  });
}
