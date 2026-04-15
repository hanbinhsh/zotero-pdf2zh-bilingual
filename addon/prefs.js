/* eslint-disable no-undef */
pref("targetLanguage", "zh-CN");
pref("translateMode", "dual");
pref("localApiBaseURL", "http://127.0.0.1:11434/v1");
pref("localApiKey", "");
pref(
  "localPdfMathTranslatePythonPath",
  "./pdf2zh/.venv/Scripts/python.exe",
);
pref("localPdfMathTranslateThread", 1);
pref("localPdfMathTranslateSourceLanguage", "auto");
pref("localBilingualLayout", "side-by-side");
pref("localTextModel", "translategemma:latest");
pref(
  "localTextPromptTemplate",
  "You are a professional academic translator. Translate the following markdown source text from {{sourceLanguage}} to {{targetLanguage}}. Keep formula notation {v*} unchanged. Only output the translated text, without JSON, explanations, or code fences.\n\nSource Text: {{text}}\n\nTranslated Text:",
);
pref("autoTranslate", false);
pref("autoOpenPDF", true);
pref("dualMode", "lort");
pref("enableShortcuts", true);


