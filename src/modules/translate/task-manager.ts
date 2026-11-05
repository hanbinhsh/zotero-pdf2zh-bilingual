import { isWindowAlive } from "../../utils/window";
import { config } from "../../../package.json";
import { getString } from "../../utils/locale";
import { saveTranslationData } from "./persistence";
import { Status, TranslationTaskData } from "../../types";
import { translateModes } from "../../config";
import { Language } from "../language/types";
import { getLanguageName } from "../language";
import { showDialog } from "../../utils/dialog";
import { startQueueProcessing } from "./task";

const PROJECT_REPO_URL = "https://github.com/hanbinhsh/zotero-pdf2zh-bilingual";

/**
 * 显示翻译任务列表的弹窗
 */
export async function showTaskManager() {
  if (isWindowAlive(addon.data.task.window)) {
    addon.data.task.window?.focus();
    refresh();
  } else {
    const windowArgs = {
      _initPromise: Zotero.Promise.defer(),
    };
    const win = Zotero.getMainWindow().openDialog(
      `chrome://${config.addonRef}/content/taskManager.xhtml`,
      `${config.addonRef}-taskManager`,
      `chrome,centerscreen,resizable,status,dialog=no`,
      windowArgs,
    )!;
    await windowArgs._initPromise.promise;
    addon.data.task.window = win;
    addon.data.task.tableHelper = new ztoolkit.VirtualizedTable(win!)
      .setContainerId("table-container")
      .setProp({
        id: "manager-table",
        columns: [
          {
            dataKey: "parentItemTitle",
            label: getString("column-item"),
            fixedWidth: false,
          },
          {
            dataKey: "attachmentFilename",
            label: getString("column-attachment"),
            fixedWidth: false,
          },
          {
            dataKey: "targetLanguage",
            label: getString("column-target-language"),
            fixedWidth: false,
          },
          {
            dataKey: "translateMode",
            label: getString("column-translate-mode"),
            fixedWidth: false,
          },
          {
            dataKey: "status",
            label: getString("column-status"),
            fixedWidth: false,
          },
          {
            dataKey: "stage",
            label: getString("column-stage"),
            fixedWidth: false,
          },
          {
            dataKey: "progress",
            label: getString("column-progress"),
            fixedWidth: false,
          },
          {
            dataKey: "error",
            label: getString("column-error"),
            fixedWidth: false,
          },
        ].map((column) =>
          Object.assign(column, {
            label: column.label,
          }),
        ),
        showHeader: true,
        multiSelect: false,
        staticColumns: false,
        disableFontSizeScaling: true,
      })
      .setProp("getRowCount", () => addon.data.task.translationTaskList.length)
      .setProp("getRowData", (index) => {
        const task = addon.data.task.translationTaskList[index];
        return {
          status: getStatusText(task.status),
          progress: `${task.progress || "0"}%`,
          parentItemTitle: task.parentItemTitle || "-",
          attachmentFilename: task.attachmentFilename || "",
          targetLanguage:
            getLanguageName(task.targetLanguage, Zotero.locale as Language) ||
            "",
          translateMode: translateModes.find(
            (m) => m.value === task.translateMode,
          )?.label
            ? getString(
                translateModes.find((m) => m.value === task.translateMode)!
                  .label,
              )
            : "",
          stage: getStageText(task.stage) || "",
          error: task.error || task.debugInfo || "-",
          resultAttachmentId: task.resultAttachmentId?.toString() || "",
        };
      })
      .setProp("onActivate", (_e: MouseEvent) => {
        const tasks = getSelectedTasks();
        if (tasks.length > 0 && tasks[0]?.resultAttachmentId) {
          const resultAttachment = Zotero.Items.get(
            tasks[0].resultAttachmentId,
          );
          if (resultAttachment) {
            Zotero.Reader.open(resultAttachment.id);
          }
        }
        return true;
      })
      .setProp(
        "getRowString",
        (index) =>
          addon.data.task.translationTaskList[index].parentItemTitle || "",
      )
      .render();

    const refreshButton = win.document.querySelector(
      "#refresh",
    ) as HTMLButtonElement;
    const cancelButton = win.document.querySelector(
      "#cancel",
    ) as HTMLButtonElement;
    const viewPdfButton = win.document.querySelector(
      "#view-pdf",
    ) as HTMLButtonElement;
    const retryButton = win.document.querySelector(
      "#retry",
    ) as HTMLButtonElement;
    const feedbackButton = win.document.querySelector(
      "#feedback",
    ) as HTMLButtonElement;
    const clearButton = win.document.querySelector(
      "#clearQueue",
    ) as HTMLButtonElement;

    clearButton?.addEventListener("click", () => {
      addon.data.task.translationGlobalQueue = [];
      addon.data.task.translationTaskList = [];
      saveTranslationData();
      refresh();
    });

    viewPdfButton?.addEventListener("click", () => {
      const tasks = getSelectedTasks();
      if (tasks.length > 0) {
        const task = tasks[0];
        if (task.resultAttachmentId) {
          const resultAttachment = Zotero.Items.get(task.resultAttachmentId);
          if (resultAttachment) {
            Zotero.Reader.open(resultAttachment.id);
          }
        } else {
          showDialog({
            title: getString("task-uncomplete"),
          });
        }
      } else {
        showDialog({
          title: getString("task-select-tip"),
        });
      }
    });

    retryButton?.addEventListener("click", () => {
      const tasks = getSelectedTasks();
      if (tasks.length > 0) {
        const task = tasks[0];
        if (task.status === "failed") {
          updateTaskInList(task.attachmentId, {
            error: "",
          });

          if (
            !addon.data.task.translationGlobalQueue.some(
              (t) => t.attachmentId === task.attachmentId,
            )
          ) {
            addon.data.task.translationGlobalQueue.unshift(task);
          }

          startQueueProcessing();
          refresh();

          showDialog({
            title: getString("task-retry-success"),
          });
        } else {
          showDialog({
            title: getString("task-retry-tip"),
          });
        }
      } else {
        showDialog({
          title: getString("task-select-tip"),
        });
      }
    });

    // Feedback opens issues directly without requiring selected item
    feedbackButton?.addEventListener("click", () => {
      Zotero.launchURL(`${PROJECT_REPO_URL}/issues`);
    });

    refreshButton?.addEventListener("click", () => {
      refresh();
    });

    cancelButton?.addEventListener("click", () => {
      const tasks = getSelectedTasks();
      if (tasks.length > 0) {
        const task = tasks[0];
        if (task.status === "queued") {
          cancelTask(task);
          refresh();
          showDialog({
            title: getString("task-cancel-success"),
          });
        } else {
          showDialog({
            title: getString("task-cancel-tip"),
          });
        }
      } else {
        showDialog({
          title: getString("task-select-tip"),
        });
      }
    });

    createWindowBoundInterval(
      () => {
        refresh();
      },
      500,
      win,
    );
  }
}

async function updateTable() {
  const keys =
    addon.data.task.tableHelper?.treeInstance.selection.selected?.keys() || [];
  let id = undefined;
  for (const key of keys) {
    id = key;
  }
  return new Promise<void>((resolve) => {
    addon.data.task.tableHelper?.render(id, (_: any) => {
      resolve();
    });
  });
}

async function refresh() {
  await updateTable();
}

export function updateTaskInList(
  attachmentId: number,
  updates: {
    status?: Status;
    stage?: string;
    pdfId?: string;
    progress?: number;
    resultAttachmentId?: number;
    error?: string;
    debugInfo?: string;
  },
) {
  if (!addon.data.task.translationTaskList) return;

  let taskIndex = -1;
  for (let i = addon.data.task.translationTaskList.length - 1; i >= 0; i--) {
    if (addon.data.task.translationTaskList[i].attachmentId === attachmentId) {
      taskIndex = i;
      break;
    }
  }

  if (taskIndex !== -1) {
    addon.data.task.translationTaskList[taskIndex] = {
      ...addon.data.task.translationTaskList[taskIndex],
      ...updates,
    };
  }

  saveTranslationData();
}

function getSelectedTasks() {
  const keys =
    addon.data.task.tableHelper?.treeInstance.selection.selected?.keys() || [];
  const datas = [];
  for (const key of keys) {
    const data = addon.data.task.translationTaskList[key];
    datas.push(data);
  }
  return datas;
}

function cancelTask(task: TranslationTaskData) {
  updateTaskInList(task.attachmentId, {
    status: "canceled",
  });
  addon.data.task.translationGlobalQueue.splice(
    addon.data.task.translationGlobalQueue.findIndex(
      (t) => t.attachmentId === task.attachmentId,
    ),
    1,
  );
  saveTranslationData();
}

export function createWindowBoundInterval(
  callback: () => void,
  delay: number,
  window: Window,
): ReturnType<typeof setInterval> {
  const intervalId = setInterval(callback, delay);

  window.addEventListener(
    "unload",
    () => {
      clearInterval(intervalId);
    },
    { once: true },
  );

  return intervalId;
}

function getStatusText(status?: string) {
  const statusMap: Record<string, string> = {
    queued: getString("task-status-queued"),
    translating: getString("task-status-translating"),
    success: getString("task-status-success"),
    failed: getString("task-status-failed"),
    canceled: getString("task-status-canceled"),
  };

  if (!status) return "";

  return statusMap[status] || status;
}

function getStageText(stage?: string) {
  if (!stage) return "";
  const translationMap: Record<string, string> = {
    queued: getString("task-stage-queued"),
    "parse-pdf": getString("task-stage-parse-pdf"),
    TranslateParagraphs: getString("task-stage-TranslateParagraphs"),
    completed: getString("task-stage-completed"),
  };

  return translationMap[stage] || stage;
}
