import type { TranslationTaskData } from "../../types";
import { translatePDFLocally } from "./local";

export async function translatePDF(
  taskData: TranslationTaskData,
  parentItem?: Zotero.Item,
): Promise<void> {
  await translatePDFLocally(taskData, parentItem);
}
