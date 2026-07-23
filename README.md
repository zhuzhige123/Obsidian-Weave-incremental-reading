# Weave Incremental Reading

[中文](#中文文档) | [English](#english) | [日本語](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ja.md) | [한국어](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ko.md) | [繁體中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.zh-TW.md) | [Русский](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ru.md)

<div align="center">

**把「以后再看」变成可持续推进的阅读队列**

Standalone incremental reading for Obsidian — topics, reading points, calendar scheduling, and source resume

</div>

---
![QQ_1784229108205](https://github.com/user-attachments/assets/05b583f0-6485-45a9-9665-b7e4aa95f5ab)
![QQ_1784229164256](https://github.com/user-attachments/assets/649226dd-db4c-4529-95dd-a412898dfe1a)
![QQ20260717-031452-HD](https://github.com/user-attachments/assets/72411a43-638c-4ce8-80ff-8cf5fadbc8ae)

## 中文文档

**Weave Incremental Reading**（插件 ID：`weave-incremental-reading`）是一款**独立**的 Obsidian 增量阅读插件。

它帮你把散落在 Markdown、内容块链接、PDF（配合 [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)）、Canvas、网页、EPUB 等处的材料，整理成可排期、可续读、可回跳的**阅读点队列**，再用**专题**与**日历**长期推进——而不是让内容停在「收藏了就算读过了」。

本插件可单独使用，**不依赖** Weave 主插件。需要 EPUB 库内阅读或记忆牌组制卡时，再按需安装系列中的其它插件。

---

### 三个核心概念

| 概念 | 说明 |
|------|------|
| **阅读点** | 一条待阅读任务，带来源溯源；可从队列一键回跳原文继续读。 |
| **专题（IRDeck）** | 阅读点的容器，以 `.irdeck` 文件保存在知识库中，按主题或计划分组。 |
| **增量阅读日历** | 插件主界面：按日期查看待处理、已排期与逾期的阅读点，安排每日节奏。 |

---

### 核心能力

- **增量阅读日历** — 月历热力与当日队列；查看负载、优先级与逾期项；支持连续阅读等辅助操作
- **统一「添加链接」** — 粘贴网页、双链、块引用、PDF++ 定位、Canvas 节点、EPUB 定位等，一次完成命名、专题与首次排期
- **专题与阅读点管理** — 优先级、暂停、归档；打开 `.irdeck` 在专题视图与日历之间切换
- **调度与续读** — 加工流 / 阅读清单等策略，每日上限与时间预算；完成后自动安排下次出现
- **材料导入** — 从 Markdown 批量拆分导入；高级功能支持订阅文件夹、PDF / EPUB 章节批量导入
- **来源回跳** — Markdown、PDF++、Canvas、网页、EPUB 等保留稳定续读位置

---

### 快速上手

1. 安装并启用插件（见下方[安装](#安装与更新)）
2. 打开**增量阅读日历**（左侧功能区日历图标，或命令面板「打开增量阅读日历」）
3. 点击日历顶部 **「+」/ 添加链接**：粘贴来源 → 修改名称 → 选择专题 → 安排首次阅读日 → 保存
4. 在日历中打开今日待读项，回到原文续读；完成后标记进度，系统会安排下次出现时间

日常主路径建议走 **添加链接**；选区命令与右键菜单仍可用。

---

### 安装与更新

#### 从 Release 安装（当前推荐）

1. 打开本仓库 [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases)，下载最新版本附件
2. 在知识库中创建目录：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 将同一次 Release 中的 `main.js`、`manifest.json`、`styles.css` 放入该目录
4. 在 **设置 → 社区插件** 中启用 **Weave Incremental Reading**

#### 通过 BRAT 跟踪版本

若使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat)，可添加本仓库并选择 **Weave Incremental Reading** 检查更新。

#### Obsidian 社区插件目录

若插件已出现在社区目录中，可在 **设置 → 社区插件** 中搜索 **Weave Incremental Reading** 安装与更新。

#### 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.8.7**（以 `manifest.json` 的 `minAppVersion` 为准） |
| 平台 | 桌面端与移动端 |

---

### 与 Weave 系列的关系

Weave 是一组面向 Obsidian 的知识工作流插件，围绕 **读 → 记 → 排 → 复习** 组织长期学习。本插件负责其中的**增量阅读队列与日历排期**，与其它成员职责分离、可组合使用。

| 插件 | 主要职责 |
|------|----------|
| **Weave Incremental Reading**（本插件） | 阅读点、专题、日历调度、续读与来源回跳 |
| **Weave 主插件** | 记忆牌组、题库、摘录制卡、FSRS 复习等 |
| **Weave EPUB Reader** | 库内 EPUB 阅读、摘录与章节定位 |

怎么组合：

- **只做增量阅读队列** — 只装本插件即可
- **还要读 EPUB 并回跳章节** — 本插件 + Weave EPUB Reader
- **还要制卡与复习** — 本插件 + Weave 主插件
- **完整闭环（读 → 记 → 排 → 复习）** — 三款都装

外部协作（非 Weave 系列）：**PDF++** 可用于 PDF 选区/定位链接，再通过「添加链接」纳入队列。

---

### 免费功能与高级功能

当前版本：**增量阅读日历与 Markdown 阅读点主流程免费开放**，足以完成日常增量阅读。

| 免费 | 高级（需激活） |
|------|----------------|
| 日历与 Markdown 阅读点 | 批量导入 PDF / EPUB 章节阅读点 |
| 专题与阅读点管理（优先级、暂停、归档） | 调度策略自定义、交错学习设置 |
| 基础调度、今日待读、续读回跳 | 订阅文件夹自动同步 |
| 添加链接创建阅读点（含 MD、块链接、PDF++ 等） | 统计分析、阅读计时器、日历背景墙等 |
| 从 Markdown 拆分导入、数据管理工具 | 阅读点关联笔记等更多能力 |

未激活时，高级入口会明确提示；基础阅读流程不受影响。

若已安装并激活 **Weave 主插件**，本插件可继承其授权，无需重复激活。独立激活入口：**设置 → Weave Incremental Reading → 授权**。

---

### 数据与隐私

- 阅读点、专题、调度与设置**默认保存在本地知识库**
- 插件**不会主动上传**你的笔记内容
- 跨插件协作（如 EPUB 回跳、授权校验）仅在对应功能被实际使用时发生
- 卸载插件**不会自动删除**已创建的 `.irdeck` 与阅读点数据；清理请用数据管理工具或手动删除

---

### 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- 邮箱：tutaoyuan8@outlook.com
- 问题与建议：[Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- 许可证：[GPL-3.0-or-later](LICENSE)

---

<div align="center">

**让阅读队列真正动起来，而不是躺在收藏夹里。**

</div>

---

## English

**Weave Incremental Reading** (plugin ID: `weave-incremental-reading`) is a **standalone** Obsidian plugin for incremental reading.

It helps you turn scattered material from Markdown notes, block links, PDF (with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)), Canvas, web pages, and EPUB into a maintainable **reading-point queue**, organized by **topics** and advanced through a **calendar**—so content does not stay stuck in “saved but never read.”

The plugin works on its own and does **not** require the Weave main plugin. Install other Weave family plugins only when you need in-vault EPUB reading or memory-deck / card workflows.

---

### Three core concepts

| Concept | Meaning |
|---------|---------|
| **Reading point** | A single reading task with source traceability; open it from the queue to jump back to the original location. |
| **Topic (IRDeck)** | A container for reading points, stored as an `.irdeck` file in your vault. Group by subject or plan. |
| **Incremental reading calendar** | The main view: browse pending, scheduled, and overdue items by date and manage daily pace. |

---

### Core capabilities

- **Incremental reading calendar** — month heatmap and day queue; load, priority, and overdue items; continue-reading helpers
- **Unified “Add link”** — paste web URLs, wikilinks, block refs, PDF++ locations, Canvas nodes, EPUB locations; set name, topic, and first read day in one flow
- **Topics and reading points** — priority, suspend, archive; open `.irdeck` and switch between topic view and calendar
- **Scheduling and resume** — processing-flow / reading-list strategies, daily caps and time budget; auto next appearance after progress
- **Material import** — split/import from Markdown; premium: folder subscription, bulk PDF / EPUB chapter import
- **Source resume** — stable resume links for Markdown, PDF++, Canvas, web pages, and EPUB

---

### Quick start

1. Install and enable the plugin (see [Installation](#installation-and-updates))
2. Open the **incremental reading calendar** (ribbon calendar icon, or command **Open incremental reading calendar**)
3. Click **“+” / Add link** at the top of the calendar: paste source → edit name → choose topic → schedule first read day → save
4. Open today’s items from the calendar, resume at the source, mark progress; the plugin schedules the next appearance

Prefer **Add link** for daily use; selection commands and context menus remain available.

---

### Installation and updates

#### Install from Releases (recommended today)

1. Open [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases) and download the latest assets
2. Create this folder in your vault:

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. Copy `main.js`, `manifest.json`, and `styles.css` from the **same** release into that folder
4. Enable **Weave Incremental Reading** under **Settings → Community plugins**

#### Track updates with BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), add this repository and select **Weave Incremental Reading**.

#### Obsidian Community Plugins directory

If the plugin is listed in the community directory, search for **Weave Incremental Reading** under **Settings → Community plugins**.

#### Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** (see `minAppVersion` in `manifest.json`) |
| Platforms | Desktop and mobile |

---

### Relationship to the Weave family

Weave is a set of Obsidian plugins organized around **read → capture → schedule → review**. This plugin owns the **incremental reading queue and calendar scheduling**. Other members are optional and complementary.

| Plugin | Responsibility |
|--------|----------------|
| **Weave Incremental Reading** (this plugin) | Reading points, topics, calendar scheduling, resume and source navigation |
| **Weave main plugin** | Memory decks, question banks, excerpt-to-card, FSRS review |
| **Weave EPUB Reader** | In-vault EPUB reading, excerpts, and chapter location |

How to combine:

- **Incremental reading only** — install this plugin alone
- **EPUB reading with chapter resume** — this plugin + Weave EPUB Reader
- **Cards and spaced review** — this plugin + Weave main plugin
- **Full loop (read → capture → schedule → review)** — all three

External collaboration (outside Weave): **PDF++** for PDF selection/location links via **Add link**.

---

### Free vs premium

In the current version, the **calendar and Markdown reading-point workflow are free**, which covers everyday incremental reading.

| Free | Premium (license required) |
|------|----------------------------|
| Calendar and Markdown reading points | Bulk import PDF / EPUB chapter reading points |
| Topic and reading-point management | Custom scheduling strategies, interleaved learning |
| Basic scheduling, today’s queue, resume | Folder subscription auto-sync |
| Create via Add link (MD, block links, PDF++, etc.) | Analytics, reading timer, calendar background wall, and more |
| Split/import from Markdown; data management tools | Linked notes for reading points, and further premium features |

Locked features are clearly marked; the core reading flow still works without a license.

If the **Weave main plugin** is installed and activated, this plugin can inherit that license. Standalone activation: **Settings → Weave Incremental Reading → License**.

---

### Data and privacy

- Reading points, topics, schedules, and settings stay in your **local vault** by default
- The plugin does **not** upload your note content proactively
- Cross-plugin calls (EPUB resume, license checks, etc.) happen only when you use those features
- Uninstalling does **not** automatically delete `.irdeck` files or reading-point data; use the data management tool or remove files manually

---

### Author

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- Email: tutaoyuan8@outlook.com
- Issues: [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- License: [GPL-3.0-or-later](LICENSE)

---

<div align="center">

**Make your reading queue move—not your bookmarks pile up.**

</div>
