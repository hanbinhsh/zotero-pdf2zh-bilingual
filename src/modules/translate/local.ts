import { PDFDocument } from "pdf-lib";
import type { TranslationTaskData } from "../../types";
import { getPref } from "../../utils/prefs";
import { updateTaskInList } from "./task-manager";

const ATTR_TAG = "PDF2ZH_translated";

function logLocal(message: string, details?: unknown) {
  const prefix = `[local] ${message}`;
  try {
    ztoolkit.log(prefix, details ?? "");
  } catch {}
  try {
    const serialized =
      details === undefined
        ? ""
        : typeof details === "string"
          ? details
          : JSON.stringify(details);
    Zotero.debug(serialized ? `${prefix} ${serialized}` : prefix);
  } catch {}
  try {
    const serialized =
      details === undefined
        ? ""
        : typeof details === "string"
          ? details
          : JSON.stringify(details);
    Services.console.logStringMessage(
      serialized ? `${prefix} ${serialized}` : prefix,
    );
  } catch {}
}

function normalizeUrl(input: string) {
  return String(input || "").trim().replace(/\/+$/, "");
}

function normalizePdfMathBackendUrl(input: string) {
  const normalized = normalizeUrl(input);
  if (!normalized) {
    return "";
  }
  return /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
}

function normalizeOpenAICompatibleBaseUrl(input: string) {
  const normalized = normalizeUrl(input);
  if (!normalized) {
    return "";
  }
  return /\/v1$/i.test(normalized) ? normalized : `${normalized}/v1`;
}

function mapLanguageForPdf2zh(language: string) {
  const normalized = String(language || "").toLowerCase();
  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("en")) return "en";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("de")) return "de";
  if (normalized.startsWith("ru")) return "ru";
  return normalized.split(/[-_]/)[0] || "en";
}

function detectLanguage(text: string) {
  if (/[\u4e00-\u9fff]/.test(text)) {
    return "zh";
  }
  if (/[а-яё]/i.test(text)) {
    return "ru";
  }
  if (/[\u3040-\u30ff]/.test(text)) {
    return "ja";
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return "ko";
  }
  return "en";
}

function normalizeAttachmentText(text: string) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\u0000/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function buildPdfMathPromptTemplate(
  rawTemplate: string,
  taskData: TranslationTaskData,
  sourceLanguage: string,
) {
  const normalized = String(rawTemplate || "").trim();
  const effectiveTemplate =
    !normalized ||
    /Translate the JSON blocks into|translatedText|\"blocks\"/i.test(normalized)
      ? "You are a professional academic translator. Translate the following markdown source text from {{sourceLanguage}} to {{targetLanguage}}. Keep formula notation {v*} unchanged. Only output the translated text, without JSON, explanations, or code fences.\n\nSource Text: {{text}}\n\nTranslated Text:"
      : normalized;

  return effectiveTemplate
    .replace(/\{\{\s*targetLanguage\s*\}\}/g, "${lang_out}")
    .replace(/\{\{\s*sourceLanguage\s*\}\}/g, "${lang_in}")
    .replace(/\{\{\s*documentTitle\s*\}\}/g, "")
    .replace(/\{\{\s*pageNumber\s*\}\}/g, "")
    .replace(/\{\{\s*text\s*\}\}/g, "${text}");
}

function isAbsolutePath(input: string) {
  return /^[A-Za-z]:[\\/]/.test(input) || input.startsWith("\\\\") || input.startsWith("/");
}

function getAddonBaseDir() {
  try {
    const spec = String((globalThis as any).rootURI || rootURI || "");
    if (!spec) {
      return "";
    }
    const nsIFileURL = (Components.interfaces as any).nsIFileURL;
    if (spec.startsWith("jar:")) {
      const fileSpec = spec.slice(4).split("!")[0];
      const fileURL = (Services.io.newURI(fileSpec) as any).QueryInterface(nsIFileURL) as any;
      return PathUtils.parent(fileURL.file.path);
    }
    if (spec.startsWith("file:")) {
      const fileURL = (Services.io.newURI(spec) as any).QueryInterface(nsIFileURL) as any;
      const path = fileURL.file.path.replace(/[\\/]+$/, "");
      if (/[\\/](addon|content)$/i.test(path)) {
        return PathUtils.parent(path);
      }
      return path;
    }
  } catch (error) {
    logLocal("Failed to resolve addon base dir", String(error));
  }
  return "";
}

export function resolveLocalPythonPath(rawInput?: string) {
  const raw = String(
    rawInput ?? ((getPref as any)("localPdfMathTranslatePythonPath") || ""),
  ).trim();
  if (!raw) {
    return "";
  }
  if (isAbsolutePath(raw)) {
    return raw;
  }
  const baseDir = getAddonBaseDir();
  if (!baseDir) {
    return raw;
  }
  const normalized = raw.replace(/^[.][\\/]/, "");
  const segments = normalized.split(/[\\/]+/).filter(Boolean);
  return PathUtils.join(baseDir, ...segments);
}

function getDirectPythonConfig() {
  const pythonPath = resolveLocalPythonPath();
  return {
    transport: "python",
    pythonPath,
  };
}

function explainPdfMathBackendError(
  status: number,
  statusText: string,
  responseText: string,
) {
  const raw = `${status} ${statusText} ${String(responseText || "").trim()}`.trim();
  if (
    /DisabledBackend|_get_task_meta_for|result_backend|CELERY_RESULT|redis/i.test(
      raw,
    )
  ) {
    return (
      "PDFMathTranslate backend status failed because the Celery result backend is not enabled. " +
      "Please make sure the Flask process and the worker are both using Redis, and that the running pdf2zh package includes a backend.py with result_backend configured."
    );
  }
  return `PDFMathTranslate backend request failed: ${raw}`.trim();
}

function buildPdfMathTranslateConfig() {
  const llmBaseURL = normalizeUrl(getPref("localApiBaseURL"));
  const openAICompatibleBaseURL = normalizeOpenAICompatibleBaseUrl(llmBaseURL);
  const llmModel = String(getPref("localTextModel") || "").trim();
  const llmApiKey = String(getPref("localApiKey") || "").trim();

  if (!llmBaseURL || !llmModel) {
    return null;
  }

  return {
    service: `openailiked:${llmModel}`,
    envs: {
      OPENAILIKED_BASE_URL: openAICompatibleBaseURL,
      OPENAILIKED_API_KEY: llmApiKey || "openailiked",
      OPENAILIKED_MODEL: llmModel,
      OPENAILIKED_STREAM: "false",
    } as Record<string, string>,
  };
}

function getLocalBilingualLayout() {
  return String((getPref as any)("localBilingualLayout") || "side-by-side")
    .trim()
    .toLowerCase();
}

function getEffectiveDualMode() {
  return String(getPref("dualMode") || "lort")
    .trim()
    .toLowerCase();
}

async function composeSideBySideDualPdf(inputBytes: Uint8Array) {
  const sourcePdf = await PDFDocument.load(inputBytes);
  const outputPdf = await PDFDocument.create();
  const pageCount = sourcePdf.getPageCount();
  const dualMode = getEffectiveDualMode();

  for (let index = 0; index < pageCount; index += 2) {
    const originalPage = sourcePdf.getPage(index);
    const translatedPage =
      index + 1 < pageCount ? sourcePdf.getPage(index + 1) : null;

    if (!translatedPage) {
      const [copied] = await outputPdf.copyPages(sourcePdf, [index]);
      outputPdf.addPage(copied);
      continue;
    }

    const [embeddedOriginal, embeddedTranslated] = await outputPdf.embedPdf(
      inputBytes,
      [index, index + 1],
    );
    const originalSize = originalPage.getSize();
    const translatedSize = translatedPage.getSize();

    if (dualMode === "uodt" || dualMode === "utdo") {
      const pageWidth = Math.max(originalSize.width, translatedSize.width);
      const pageHeight = originalSize.height + translatedSize.height;
      const outPage = outputPdf.addPage([pageWidth, pageHeight]);
      const topIsOriginal = dualMode === "uodt";
      const topEmbedded = topIsOriginal ? embeddedOriginal : embeddedTranslated;
      const bottomEmbedded = topIsOriginal ? embeddedTranslated : embeddedOriginal;
      const topSize = topIsOriginal ? originalSize : translatedSize;
      const bottomSize = topIsOriginal ? translatedSize : originalSize;

      outPage.drawPage(topEmbedded, {
        x: (pageWidth - topSize.width) / 2,
        y: bottomSize.height,
        width: topSize.width,
        height: topSize.height,
      });
      outPage.drawPage(bottomEmbedded, {
        x: (pageWidth - bottomSize.width) / 2,
        y: 0,
        width: bottomSize.width,
        height: bottomSize.height,
      });
      continue;
    }

    const leftIsOriginal = dualMode !== "ltro";
    const leftEmbedded = leftIsOriginal ? embeddedOriginal : embeddedTranslated;
    const rightEmbedded = leftIsOriginal ? embeddedTranslated : embeddedOriginal;
    const leftSize = leftIsOriginal ? originalSize : translatedSize;
    const rightSize = leftIsOriginal ? translatedSize : originalSize;
    const pageWidth = leftSize.width + rightSize.width;
    const pageHeight = Math.max(leftSize.height, rightSize.height);
    const outPage = outputPdf.addPage([pageWidth, pageHeight]);

    outPage.drawPage(leftEmbedded, {
      x: 0,
      y: (pageHeight - leftSize.height) / 2,
      width: leftSize.width,
      height: leftSize.height,
    });
    outPage.drawPage(rightEmbedded, {
      x: leftSize.width,
      y: (pageHeight - rightSize.height) / 2,
      width: rightSize.width,
      height: rightSize.height,
    });
  }

  return new Uint8Array(await outputPdf.save());
}
function buildLocalOutputName(
  taskData: TranslationTaskData,
  engineSuffix: string,
) {
  const baseName = taskData.attachmentFilename.replace(/\.pdf$/i, "");
  const suffix =
    taskData.translateMode === "translation"
      ? "translation"
      : taskData.translateMode === "dual"
        ? "dual"
        : "all";
  return `${baseName}_${taskData.targetLanguage}_${suffix}_${engineSuffix}.pdf`;
}

async function importResultAttachment(
  taskData: TranslationTaskData,
  parentItem: Zotero.Item | undefined,
  attachment: any,
  outputBytes: Uint8Array,
  outputName: string,
) {
  const tempPath = PathUtils.join(
    PathUtils.tempDir || Zotero.getTempDirectory().path,
    outputName,
  );
  await IOUtils.write(tempPath, outputBytes);

  const resultAttachment = await Zotero.Attachments.importFromFile({
    file: tempPath,
    parentItemID: taskData.parentItemId || undefined,
    collections: taskData.parentItemId
      ? undefined
      : attachment.getCollections?.(),
    libraryID: parentItem?.libraryID,
    title: outputName,
    contentType: "application/pdf",
  });
  resultAttachment.setTags?.([ATTR_TAG]);
  await resultAttachment.saveTx();

  try {
    await IOUtils.remove(tempPath);
  } catch {}

  return resultAttachment;
}

function createMultipartFormData(
  fileBytes: Uint8Array,
  filename: string,
  payload: Record<string, unknown>,
) {
  const mainWindow = Zotero.getMainWindow?.() as Window & {
    FormData?: typeof FormData;
    Blob?: typeof Blob;
    File?: typeof File;
  };
  const FormDataCtor =
    mainWindow?.FormData || (globalThis as any).FormData || undefined;
  const BlobCtor = mainWindow?.Blob || (globalThis as any).Blob || undefined;
  const FileCtor = mainWindow?.File || (globalThis as any).File || undefined;

  if (!FormDataCtor) {
    throw new Error("FormData is not available in the current Zotero runtime.");
  }

  const formData = new FormDataCtor();
  if (FileCtor) {
    formData.append(
      "file",
      new FileCtor([fileBytes], filename, {
        type: "application/pdf",
      }),
    );
  } else if (BlobCtor) {
    formData.append(
      "file",
      new BlobCtor([fileBytes], { type: "application/pdf" }),
      filename,
    );
  } else {
    throw new Error("File/Blob is not available in the current Zotero runtime.");
  }
  formData.append("data", JSON.stringify(payload));
  return formData;
}

function runExternalProcess(executablePath: string, args: string[]) {
  return new Promise<number>((resolve, reject) => {
    try {
      const classes = Components.classes as any;
      const interfaces = Components.interfaces as any;
      const file = classes[
        "@mozilla.org/file/local;1"
      ].createInstance(interfaces.nsIFile);
      file.initWithPath(executablePath);
      if (!file.exists()) {
        reject(new Error(`Executable not found: ${executablePath}`));
        return;
      }
      const process = classes[
        "@mozilla.org/process/util;1"
      ].createInstance(interfaces.nsIProcess);
      process.init(file);
      process.runwAsync(
        args,
        args.length,
        {
          observe: (_subject: unknown, topic: string) => {
            if (topic === "process-finished") {
              resolve(process.exitValue);
            } else {
              resolve(process.exitValue);
            }
          },
        } as any,
        false,
      );
    } catch (error) {
      reject(error);
    }
  });
}

async function translateWithDirectPython(
  taskData: TranslationTaskData,
  parentItem: Zotero.Item | undefined,
  attachment: any,
  sourceLanguage: string,
  thread: number,
  enableDebug: boolean,
  promptText: string,
  config: NonNullable<ReturnType<typeof buildPdfMathTranslateConfig>>,
) {
  const direct = getDirectPythonConfig();
  if (direct.transport !== "python") {
    return null;
  }
  if (!direct.pythonPath) {
    throw new Error(
      "Direct Python mode is enabled but no Python executable path is configured.",
    );
  }
  const pythonExists = await IOUtils.exists(direct.pythonPath);
  if (!pythonExists) {
    throw new Error(`Configured Python executable was not found: ${direct.pythonPath}`);
  }

  const workDir = PathUtils.join(
    PathUtils.tempDir || Zotero.getTempDirectory().path,
    `zotero-pdf2zh-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  );
  await IOUtils.makeDirectory(workDir);
  const payloadPath = PathUtils.join(workDir, "payload.json");
  const resultPath = PathUtils.join(workDir, "result.json");
  const scriptPath = PathUtils.join(workDir, "runner.py");
  const outputDir = PathUtils.join(workDir, "out");
  await IOUtils.makeDirectory(outputDir);
  await IOUtils.makeDirectory(PathUtils.join(workDir, "cache"));

  const payload = {
    inputPath: taskData.attachmentPath,
    outputDir,
    langIn: sourceLanguage,
    langOut: mapLanguageForPdf2zh(taskData.targetLanguage),
    service: config.service,
    thread,
    envs: config.envs,
    prompt: promptText || "",
    ignoreCache: false,
    debug: enableDebug,
    configPath: PathUtils.join(workDir, "pdf2zh-config.json"),
    cacheDir: PathUtils.join(workDir, "cache"),
  };
  await IOUtils.writeUTF8(payloadPath, JSON.stringify(payload, null, 2));

  const runnerSource = `
import json
import os
import sys
import traceback
from pathlib import Path
from string import Template

def main():
    payload_path = Path(sys.argv[1])
    result_path = Path(sys.argv[2])
    payload = json.loads(payload_path.read_text(encoding="utf-8"))
    os.environ["PDF2ZH_CONFIG"] = str(payload["configPath"])
    os.environ["PDF2ZH_CACHE_DIR"] = str(payload["cacheDir"])
    for proxy_key in [
        "HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY",
        "http_proxy", "https_proxy", "all_proxy",
    ]:
        os.environ.pop(proxy_key, None)
    os.environ["NO_PROXY"] = "127.0.0.1,localhost"
    os.environ["no_proxy"] = "127.0.0.1,localhost"
    for key, value in (payload.get("envs") or {}).items():
        if value is not None:
            os.environ[str(key)] = str(value)
    from pdf2zh import translate_stream
    from pdf2zh.doclayout import OnnxModel
    prompt = Template(payload["prompt"]) if payload.get("prompt") else None
    model = OnnxModel.load_available()
    with open(payload["inputPath"], "rb") as fp:
        stream_mono, stream_dual = translate_stream(
            stream=fp.read(),
            lang_in=payload["langIn"],
            lang_out=payload["langOut"],
            service=payload["service"],
            thread=int(payload["thread"]),
            prompt=prompt,
            ignore_cache=bool(payload.get("ignoreCache")),
            model=model,
            envs=payload.get("envs"),
        )
    mono_path = str(Path(payload["outputDir"]) / "result-mono.pdf")
    dual_path = str(Path(payload["outputDir"]) / "result-dual.pdf")
    Path(mono_path).write_bytes(stream_mono)
    Path(dual_path).write_bytes(stream_dual)
    result_path.write_text(json.dumps({"mono": mono_path, "dual": dual_path}, ensure_ascii=False), encoding="utf-8")

if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        Path(sys.argv[2]).write_text(json.dumps({
            "error": str(exc),
            "traceback": traceback.format_exc(),
        }, ensure_ascii=False), encoding="utf-8")
        raise
`.trim();
  await IOUtils.writeUTF8(scriptPath, runnerSource);

  updateTaskInList(taskData.attachmentId, {
    status: "translating",
    stage: "TranslateParagraphs",
    progress: 10,
    debugInfo: `Running local python pdf2zh.translate_stream via ${direct.pythonPath}` ,
  });
  logLocal("Running local python pdf2zh", {
    attachmentId: taskData.attachmentId,
    pythonPath: direct.pythonPath,
    service: config.service,
    outputDir,
  });

  const exitCode = await runExternalProcess(direct.pythonPath, [
    "-X",
    "utf8",
    scriptPath,
    payloadPath,
    resultPath,
  ]);

  if (!(await IOUtils.exists(resultPath))) {
    throw new Error(
      `Direct Python pdf2zh finished with exit code ${exitCode}, but no result manifest was produced.`,
    );
  }

  const resultJson = JSON.parse(await IOUtils.readUTF8(resultPath));
  if (exitCode !== 0 || resultJson?.error) {
    throw new Error(
      `Direct Python pdf2zh failed: ${resultJson?.error || `exit code ${exitCode}`}\n${resultJson?.traceback || ""}`.trim(),
    );
  }

  const format = taskData.translateMode === "translation" ? "mono" : "dual";
  const outputPath = String(resultJson?.[format] || "").trim();
  if (!outputPath || !(await IOUtils.exists(outputPath))) {
    throw new Error(`Direct Python pdf2zh did not produce expected ${format} PDF.`);
  }

  let resultBytes = new Uint8Array(await IOUtils.read(outputPath));
  if (format === "dual" && getLocalBilingualLayout() === "side-by-side") {
    resultBytes = await composeSideBySideDualPdf(resultBytes);
  }
  const outputName = buildLocalOutputName(taskData, "pdf2zh-direct");
  const resultAttachment = await importResultAttachment(
    taskData,
    parentItem,
    attachment,
    resultBytes,
    outputName,
  );

  updateTaskInList(taskData.attachmentId, {
    status: "success",
    stage: "completed",
    progress: 100,
    resultAttachmentId: resultAttachment.id,
    debugInfo: `Direct Python pdf2zh finished via ${config.service}, layout=${getLocalBilingualLayout()}, bytes=${resultBytes.length}`,
  });

  if (getPref("autoOpenPDF")) {
    Zotero.Reader.open(resultAttachment.id);
  }

  return resultAttachment;
}

export async function translatePDFLocally(
  taskData: TranslationTaskData,
  parentItem?: Zotero.Item,
) {
  const attachment = Zotero.Items.get(taskData.attachmentId) as any;
  if (!attachment) {
    throw new Error("Attachment not found.");
  }

  const attachmentText = normalizeAttachmentText(await attachment.attachmentText);
  const config = buildPdfMathTranslateConfig();
  if (!config) {
    throw new Error(
      "Local translation configuration is incomplete. Please check the Python path, local API base URL, and local model.",
    );
  }

  const sourceLanguagePref = String(
    (getPref as any)("localPdfMathTranslateSourceLanguage") || "auto",
  )
    .trim()
    .toLowerCase();
  const sourceLanguage =
    sourceLanguagePref && sourceLanguagePref !== "auto"
      ? mapLanguageForPdf2zh(sourceLanguagePref)
      : mapLanguageForPdf2zh(
          detectLanguage(attachmentText || taskData.parentItemTitle || "en"),
        );
  const thread = Math.max(
    1,
    Number((getPref as any)("localPdfMathTranslateThread") || 1),
  );
  const promptText = buildPdfMathPromptTemplate(
    String(getPref("localTextPromptTemplate") || "").trim(),
    taskData,
    sourceLanguage,
  );

  updateTaskInList(taskData.attachmentId, {
    status: "translating",
    stage: "parse-pdf",
    progress: 3,
    debugInfo:
      `Local python pipeline, service=${config.service}, ` +
      `source=${sourceLanguage}, target=${mapLanguageForPdf2zh(taskData.targetLanguage)}, layout=${getLocalBilingualLayout()}`,
  });

  logLocal("Submitting PDF to local python pdf2zh", {
    attachmentId: taskData.attachmentId,
    service: config.service,
    sourceLanguage,
    targetLanguage: mapLanguageForPdf2zh(taskData.targetLanguage),
    thread,
  });

  await translateWithDirectPython(
    taskData,
    parentItem,
    attachment,
    sourceLanguage,
    thread,
    false,
    promptText,
    config,
  );
}













