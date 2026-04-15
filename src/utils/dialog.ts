import { getString } from "./locale";

const DIALOG_EARLY_STYLE = `
html, body {
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: var(--material-background, #2f2f2f) !important;
  color: var(--material-foreground, #f5f5f5) !important;
}
body > vbox {
  background: var(--material-background, #2f2f2f) !important;
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
        width: "300px",
        margin: "0 auto",
      },
    })
    .addCell(2, 0, {
      tag: "label",
      namespace: "html",
      properties: {
        innerHTML: message || "",
      },
      styles: {
        width: "300px",
        margin: "0 auto",
        whiteSpace: "pre-wrap",
      },
    })
    .addButton(getString("confirm-yes"), "confirm");

  centerDialogRows(dialog as any);

  dialog.open(title, {
      width: 380,
      height: 180,
      centerscreen: true,
      resizable: false,
      fitContent: false,
    });
}
