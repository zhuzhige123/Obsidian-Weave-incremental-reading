# Weave Incremental Reading

[English](README.en.md)

<div align="center">

**独立的 Obsidian 增量阅读插件 — 专题、阅读点、日历调度与来源回跳**

</div>

Weave Incremental Reading（插件 ID：`weave-incremental-reading`）帮助你在 Obsidian 里把「以后再看」的内容整理成可持续推进的**阅读点队列**，并通过**专题组织、日历调度、续读进度、来源回跳**形成长期可维护的阅读工作流。

---

## 核心能力

- **阅读点与专题（IRDeck）**：从文档、选区或外部来源创建阅读点，归入 `.irdeck` 专题
- **增量阅读日历**：按日期查看待处理、已排期与逾期的阅读点，安排复习与优先级
- **调度与续读**：支持加工流、阅读清单等策略，可配置每日上限与时间预算
- **来源回跳**：保留来源信息，便于回到原文继续阅读

---

## 安装与更新

### 从 Release 安装（推荐）

1. 打开本仓库 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases) 页面，下载最新版本附件。
2. 在知识库中创建目录：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 将同一次 Release 中的以下文件放入该目录：

   - `main.js`
   - `manifest.json`
   - `styles.css`

4. 在 **设置 → 社区插件** 中启用 **Weave Incremental Reading**。

### 通过 BRAT 跟踪版本

若使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat)，可添加本仓库并选择 **Weave Incremental Reading** 检查更新。

---

## 快速上手

1. 启用插件后，点击左侧功能区**日历**图标，或执行命令 **打开增量阅读日历**
2. 在 Markdown 视图中选中内容，执行 **从当前选区创建增量阅读点**
3. 在 **设置 → Weave Incremental Reading** 中配置默认专题、调度策略与每日上限

---

## 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.8.7**（以 `manifest.json` 的 `minAppVersion` 为准） |
| 平台 | 桌面端与移动端 |

---

## 与 Weave / EPUB 阅读器的关系

本插件是**独立产品**，可与 Weave 主插件、EPUB 阅读器插件协作，但各自职责分离：

| 插件 | 主要职责 |
|------|----------|
| **Weave Incremental Reading**（本插件） | 增量阅读队列、阅读点、专题、调度、续读 |
| **Weave 主插件** | 记忆牌组、题库、AI 制卡等宿主协作能力 |
| **EPUB 阅读器插件** | EPUB 阅读与章节定位 |

---

## 数据与隐私

- 阅读点、专题与调度数据**默认保存在本地知识库**
- 插件**不会主动上传**你的笔记内容
- 跨插件协作仅在对应功能被实际使用时发生

---

## 分发说明

本公开仓库用于 Obsidian 插件版本分发与社区审核配套材料。运行时文件通过 **GitHub Releases** 提供；完整 TypeScript/Svelte 开发源码不在此仓库公开维护。

分发与授权说明：

- 用户安装方式：Release 手动安装、BRAT，或 Obsidian 社区目录（若已通过审核）。
- 本插件为 **GPL-3.0-or-later** 许可；Release 中的 `main.js` 为构建产物，可供安全审查。
- 若需完整源码协作或二次开发，请通过 Issues 联系作者。

如需反馈问题，请在 [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues) 提交。

---

## 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)
