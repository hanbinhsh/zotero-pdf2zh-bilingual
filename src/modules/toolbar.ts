import { UITool } from "zotero-plugin-toolkit";
import { getString } from "../utils/locale";
import { showTaskManager } from "./translate/task-manager";

function ensureToolbarButtonStyle(document: Document) {
  const styleId = "pdf2zh-toolbar-style";
  if (document.getElementById(styleId)) {
    return;
  }
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
    #zotero-tb-pdf2zh-task .toolbarbutton-icon {
      width: 16px !important;
      height: 16px !important;
      min-width: 16px !important;
      min-height: 16px !important;
      margin: 0 !important;
    }
  `;
  (document.documentElement || document.body || document).appendChild(style);
}

export function registerToolbar() {
  const ui = new UITool();
  const document = ztoolkit.getGlobal("document");
  ensureToolbarButtonStyle(document);
  const toolbarIcon = `chrome://${addon.data.config.addonRef}/content/icons/favicon@16x16.png`;
  const taskButton = ui.createElement(document, "toolbarbutton", {
    id: "zotero-tb-pdf2zh-task",
    removeIfExists: true,
    attributes: {
      class: "zotero-tb-button",
      tooltiptext: getString("menuView-tasks"),
      image: toolbarIcon,
      label: "",
    },
    listeners: [
      {
        type: "click",
        listener: () => {
          showTaskManager();
        },
      },
    ],
  });
  const toolbarNode = document.getElementById("zotero-tb-note-add");
  if (toolbarNode) {
    toolbarNode.after(taskButton);
  }
}
