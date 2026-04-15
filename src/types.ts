import { Language } from "./modules/language/types";

export type Status =
  | "uploading"
  | "queued"
  | "translating"
  | "success"
  | "failed"
  | "canceled";

export type Stage = "queued" | "processing" | "success" | "failed";

export type TranslationTaskData = {
  parentItemId?: number;
  parentItemTitle?: string;
  attachmentId: number;
  attachmentFilename: string;
  attachmentPath: string;
  targetLanguage: Language;
  translateMode: string;
  status?: Status;
  stage?: string;
  progress?: number;
  error?: string;
  debugInfo?: string;
  resultAttachmentId?: number;
};
