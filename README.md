# Weave Incremental Reading

[English](README.en.md)

<div align="center">

**独立的 Obsidian 增量阅读插件 — 专题、阅读点、日历调度与来源回跳**

[![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.8.7-7c3aed?style=flat-square&logo=obsidian)](https://obsidian.md/)
[![License](https://img.shields.io/badge/License-GPL--3.0--or--later-blue?style=flat-square)](LICENSE)

</div>

Weave Incremental Reading（插件 ID：`weave-incremental-reading`）帮助你在 Obsidian 里把「以后再看」的内容整理成可持续推进的**阅读点队列**，并通过**专题组织、日历调度、续读进度、来源回跳**形成长期可维护的阅读工作流。

---

## 核心能力

- **阅读点与专题（IRDeck）**：从文档、选区或外部来源创建阅读点，归入 `.irdeck` 专题
- **增量阅读日历**：按日期查看待处理、已排期与逾期的阅读点
- **调度与续读**：加工流、阅读清单等策略，可配置每日上限与时间预算
- **来源回跳**：从阅读点回到原文位置继续阅读

---

## 安装

### 从 Obsidian 社区目录（推荐）

在 Obsidian **设置 → 社区插件** 中搜索 **Weave Incremental Reading** 并安装。

### 从 Release 手动安装

1. 打开 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)
2. 下载同一次 Release 中的 `main.js`、`manifest.json`、`styles.css`
3. 放入知识库：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

4. 在 **设置 → 社区插件** 中启用插件

### 从源码构建

```bash
git clone https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading.git
cd Obsidian-Weave-incremental-reading
npm install
npm run build
```

将 `dist/` 中的 `main.js`、`manifest.json`、`styles.css` 复制到 `.obsidian/plugins/weave-incremental-reading/`。

---

## 快速上手

1. 启用插件后，打开 **增量阅读日历**（左侧日历图标或命令面板）
2. 在 Markdown 视图中选中内容，执行 **从当前选区创建增量阅读点**
3. 在 **设置 → Weave Incremental Reading** 中配置默认专题与调度策略

---

## 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.8.7** |
| 平台 | 桌面端与移动端 |

---

## 与 Weave / EPUB 阅读器的关系

本插件是**独立产品**，可与 Weave 主插件、EPUB 阅读器插件协作：

| 插件 | 主要职责 |
|------|----------|
| **Weave Incremental Reading**（本插件） | 增量阅读队列、阅读点、专题、调度 |
| **Weave 主插件** | 记忆牌组、题库、AI 制卡等 |
| **EPUB 阅读器插件** | EPUB 阅读与章节定位 |

---

## 数据与隐私

- 阅读点、专题与调度数据**默认保存在本地知识库**
- 插件**不会主动上传**你的笔记内容

---

## 开发

```bash
npm install
npm run dev
```

发版前检查：

```bash
npm run lint:obsidian:community:errors
npm run audit:obsidian-release
npm run check
npm run test
npm run build
```

---

## 许可证

本插件以 [GPL-3.0-or-later](LICENSE) 发布。

---

## 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

问题与建议请提交 [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)。
