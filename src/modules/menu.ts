import { getString } from "../utils/locale";

const ITEM_MENU_ID = "zotero-itemmenu-babeldoc-translate";
const VIEW_MENU_SEPARATOR_ID = "zotero-menuview-babeldoc-translate-separator";
const VIEW_MENU_ID = "zotero-menuview-babeldoc-translate-menuitem";

function getMenuIcon() {
  return `chrome://${addon.data.config.addonRef}/content/icons/favicon@16x16.png`;
}

export function registerMenu(win?: Window) {
  const doc = resolveDocument(win);
  if (!doc) {
    ztoolkit.log("registerMenu: document is unavailable");
    return;
  }

  unregisterMenu(doc);

  const popup = findFirstElement(doc, [
    "zotero-itemmenu",
    "zotero-items-tree-context-menu",
    "itemmenu",
  ]);
  if (!popup) {
    ztoolkit.log("registerMenu: item popup not found");
    return;
  }

  const menuitem = ztoolkit.createXULElement(doc, "menuitem");
  menuitem.id = ITEM_MENU_ID;
  menuitem.setAttribute("label", getString("menuitem-translate"));
  menuitem.setAttribute("class", "menuitem-iconic");
  menuitem.setAttribute("image", getMenuIcon());
  menuitem.addEventListener("command", () => addon.hooks.onTranslate());
  popup.appendChild(menuitem);
  ztoolkit.log("registerMenu: item menu registered", popup.id || popup.tagName);
}

export function registerWindowMenu(win?: Window) {
  const doc = resolveDocument(win);
  if (!doc) {
    ztoolkit.log("registerWindowMenu: document is unavailable");
    return;
  }

  unregisterWindowMenu(doc);

  const popup = findFirstElement(doc, [
    "menu_ViewPopup",
    "menuViewPopup",
    "viewMenuPopup",
  ]);
  if (!popup) {
    ztoolkit.log("registerWindowMenu: view popup not found");
    return;
  }

  const separator = ztoolkit.createXULElement(doc, "menuseparator");
  separator.id = VIEW_MENU_SEPARATOR_ID;
  popup.appendChild(separator);

  const menuitem = ztoolkit.createXULElement(doc, "menuitem");
  menuitem.id = VIEW_MENU_ID;
  menuitem.setAttribute("label", getString("menuView-tasks"));
  menuitem.setAttribute("class", "menuitem-iconic");
  menuitem.setAttribute("image", getMenuIcon());
  menuitem.addEventListener("command", () => addon.hooks.onViewTranslationTasks());
  popup.appendChild(menuitem);
  ztoolkit.log("registerWindowMenu: view menu registered", popup.id || popup.tagName);
}

export function unregisterMenu(doc?: Document | null) {
  if (!doc) {
    return;
  }
  doc.getElementById(ITEM_MENU_ID)?.remove();
}

export function unregisterWindowMenu(doc?: Document | null) {
  if (!doc) {
    return;
  }
  doc.getElementById(VIEW_MENU_SEPARATOR_ID)?.remove();
  doc.getElementById(VIEW_MENU_ID)?.remove();
}

function resolveDocument(win?: Window) {
  return win?.document || ztoolkit.getGlobal("document");
}

function findFirstElement(doc: Document, ids: string[]) {
  for (const id of ids) {
    const found = doc.getElementById(id);
    if (found) {
      return found;
    }
  }
  return null;
}
