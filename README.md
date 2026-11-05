# Zotero PDF2ZH Bilingual

Zotero PDF2ZH Bilingual 是一个面向 Zotero 7 / 8 / 9 / 10 的本地 PDF 翻译插件，底层使用 `pdf2zh` 完成高质量 PDF 文档翻译，并支持本地 Ollama 或其他 OpenAI 兼容大模型服务接口。

它的目标是保持纯粹高效的本地工作流：在 Zotero 中直接发起翻译，调用本地 Python 环境中的 `pdf2zh`，生成单语或双语对照 PDF，并将结果自动重新导入关联到 Zotero 条目中。

![Main](ReadMeSrc/readme.png)

## 功能特性

- **纯本地工作流**：基于本地 `pdf2zh` Python 虚拟环境执行 PDF 解析与排版翻译
- **主流本地大模型支持**：
  - Ollama（默认支持，如 `qwen2.5`、`translategemma` 等）
  - 任意 OpenAI 兼容 API 接口（如 LM Studio、vLLM、One-API、LocalAI 等）
- **灵活的输出模式**：
  - 单语翻译 PDF（纯译文）
  - 双语对照 PDF
- **双语 PDF 排版方式**：
  - 插件后处理的**同页左右对照**（推荐，便于在阅读器中并排精读）
  - `pdf2zh` 原始交替页排版
- **便捷的图形界面与交互**：
  - 偏好设置中支持**文件选择器一键浏览选取** `python.exe` 解释器路径
  - 提供**一键测试连接**，分别实时检测 Python 环境与模型 API 状态
  - 优雅的任务管理器：实时查看队列与阶段进度，支持双击直接在 Zotero 阅读器中打开已翻译的 PDF
  - 自定义学术翻译提示词模板，提供常用占位符一键插入与重置
- **快捷键支持**：
  - `Shift + A`：快速翻译当前选中的条目/PDF
  - `Shift + T`：打开任务管理器

## 运行要求与环境准备

- **Zotero**：Zotero 7.0 及以上（支持 Zotero 7、8、9、10）
- **Python 环境**：安装有 `pdf2zh` 的 Python 虚拟环境（Python 3.10 ~ 3.12 推荐）
- **模型服务**：已在本地启动的 Ollama 或兼容 OpenAI 协议的本地模型服务

## 安装与配置

1. 在 [Releases](../../releases) 页面下载最新的 `.xpi` 插件安装包。
2. 打开 Zotero，点击菜单栏 `工具` -> `插件`（Plugins），点击右上角齿轮选择 `Install Add-on From File...`，选择下载的 `.xpi` 文件完成安装。
3. 打开 Zotero `编辑` -> `首选项`（macOS 上为 `设置`），切换到 `Zotero PDF2ZH Bilingual` 标签页：
   - **Python 路径**：点击右侧的「浏览...」按钮，直接选择虚拟环境中的 `python.exe`（例如 `D:\tools\pdf2zh\.venv\Scripts\python.exe`）。
   - **本地 API 地址**：如果使用 Ollama，保持默认 `http://127.0.0.1:11434/v1` 即可。
   - **本地文本模型**：填写你的本地模型名称，例如 `qwen2.5:latest` 或 `translategemma:latest`。
   - 点击「测试连接」按钮，确认 Python 环境和模型服务连通正常。
4. 选择目标语言、源语言以及翻译排版模式。

## 关于系统代理导致的 502 说明

如果系统开启了全局科学上网代理软件，本地模型请求虽然目标地址是 `127.0.0.1` 或 `localhost`，仍然可能被代理软件劫持，最终在 `pdf2zh` 翻译请求模型时表现为 `502 Bad Gateway`。

插件在调用本地 Python `pdf2zh` 时已主动做了环境代理旁路处理：

- 清除外部代理环境变量：`HTTP_PROXY`、`HTTPS_PROXY`、`ALL_PROXY`
- 显式设置回环无代理：`NO_PROXY=127.0.0.1,localhost`

如果仍遇到 `502` 或无法连接：

1. 检查本地模型接口地址是否使用 `127.0.0.1` 或 `localhost`；
2. 检查本地 Ollama / 模型服务是否已开启并在监听对应端口。

## 项目构建

如果你想从源码自行编译插件：

```bash
npm install
npm run build
```

构建生成的 `.xpi` 安装包将输出至 `dist/` 目录下。

## 许可证

AGPL-3.0-or-later
