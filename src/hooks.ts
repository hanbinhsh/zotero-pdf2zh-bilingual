import { initLocale } from "./utils/locale";
import {
  registerPrefs,
  registerPrefsScripts,
} from "./modules/preference-window";
import { registerShortcuts } from "./modules/shortcuts";
import { createZToolkit } from "./utils/ztoolkit";
import {
  registerMenu,
  registerWindowMenu,
  unregisterMenu,
  unregisterWindowMenu,
} from "./modules/menu";
import { registerToolbar } from "./modules/toolbar";
import { registerNotifier } from "./modules/notify";
import {
  addTasksToQueue,
  startQueueProcessing,
  shouldSkipAttachment,
} from "./modules/translate/task";
import {
  loadSavedTranslationData,
  restoreUnfinishedTasks,
  saveTranslationData,
} from "./modules/translate/persistence";
import { showTaskManager } from "./modules/translate/task-manager";
import { initTasks } from "./modules/translate/store";
import { getPref } from "./utils/prefs";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  initLocale();

  registerPrefs();

  registerNotifier(["item", "file"]);

  registerShortcuts();

  initTasks();

  await Promise.all(
    Zotero.getMainWindows().map((win) => onMainWindowLoad(win)),
  );

  // 加载保存的翻译任务和队列数据
  loadSavedTranslationData();

  // 恢复未完成的翻译任务
  const restoredCount = restoreUnfinishedTasks();
  if (restoredCount > 0) {
    ztoolkit.log(`已恢复${restoredCount}个未完成的翻译任务，准备重新处理`);

    // 启动处理队列
    startQueueProcessing();
  }
}

async function onMainWindowLoad(win: _ZoteroTypes.MainWindow): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  ztoolkit.basicOptions.log.disableConsole = false;

  registerMenu(win);

  registerWindowMenu(win);

  registerToolbar();
}

async function onMainWindowUnload(win: Window): Promise<void> {
  unregisterMenu(win.document);
  unregisterWindowMenu(win.document);
  ztoolkit.unregisterAll();
  if (ztoolkit.Menu) {
    ztoolkit.Menu.unregisterAll();
  }
}

function onShutdown(): void {
  // 关闭前保存翻译数据
  saveTranslationData();
  ztoolkit.unregisterAll();
  // Remove addon object
  addon.data.alive = false;
  // @ts-ignore - Plugin instance is not typed
  delete Zotero[addon.data.config.addonInstance];
}

/**
 * Dispatcher for Notify events.
 */
async function onNotify(
  event: string,
  type: string,
  ids: Array<string | number>,
  extraData: { [key: string]: any },
) {
  ztoolkit.log("notify", event, type, ids, extraData);
  const isAutoTranslateEnabled = getPref("autoTranslate");
  ztoolkit.log("isAutoTranslateEnabled", isAutoTranslateEnabled);
  if (!isAutoTranslateEnabled) {
    return;
  }
  if (event === "add" && type === "item") {
    const newIds = [];
    for (const id of ids) {
      const item = Zotero.Items.get(id);
      const isPDFAttachment = item.isPDFAttachment();

      if (item.isRegularItem()) {
        ztoolkit.log("创建了主条目:", item.getField("title"));
        newIds.push(item.id);
      } else if (isPDFAttachment) {
        const parentID = item.parentID;
        ztoolkit.log("item.attachmentFilename", item.attachmentFilename);
        const shouldSkip = shouldSkipAttachment(item);
        if (shouldSkip) {
          ztoolkit.log("跳过翻译结果附件:", item.attachmentFilename);
          continue;
        }
        if (parentID) {
          ztoolkit.log(
            "添加附件到已有条目:",
            item.attachmentFilename,
            "，父项ID:",
            parentID,
          );
          newIds.push(item.id);
        } else {
          ztoolkit.log(
            "独立附件（无法识别的PDF）暂不支持:",
            item.attachmentFilename,
          );
        }
      }
    }
    if (newIds.length > 0) {
      addTasksToQueue(newIds);
    }
  }
}

/**
 * Dispatcher for Preference UI events.
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onShortcuts(type: string) {
  if (!getPref("enableShortcuts")) {
    return;
  }
  switch (type) {
    case "translate":
      addTasksToQueue();
      break;
    case "showTaskManager":
      showTaskManager();
      break;
    default:
      break;
  }
}

function onTranslate() {
  addTasksToQueue();
}

function onViewTranslationTasks() {
  showTaskManager();
}

export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onNotify,
  onPrefsEvent,
  onShortcuts,
  onTranslate,
  onViewTranslationTasks,
};
