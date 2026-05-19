# Weave Incremental Reading

[English](README.en.md)

<div align="center">

**独立的 Obsidian 增量阅读插件 — 专题、阅读点、日历调度与来源回跳**

[![Obsidian](https://img.shields.io/badge/Obsidian-%E2%89%A5%201.7.0-7c3aed?style=flat-square&logo=obsidian)](https://obsidian.md/)
[![Platform](https://img.shields.io/badge/平台-桌面端%20%7C%20移动端-4b5563?style=flat-square)](https://obsidian.md/)
[![License](https://img.shields.io/badge/许可证-见仓库说明-6b7280?style=flat-square)]()

</div>

Weave Incremental Reading（插件 ID：`weave-incremental-reading`）是一个**从 Weave 主插件拆分出来的独立增量阅读插件**。  
它帮助你在 Obsidian 里把「以后再看」的内容，整理成可持续推进的**阅读点队列**，并通过**专题组织、日历调度、续读进度、来源回跳**形成长期可维护的阅读工作流。

---

## 目录

- [为什么需要这个插件](#为什么需要这个插件)
- [核心能力](#核心能力)
- [快速上手](#快速上手)
- [安装与更新](#安装与更新)
- [与 Weave / EPUB 阅读器的关系](#与-weave--epub-阅读器的关系)
- [数据与隐私](#数据与隐私)
- [参与开发](#参与开发)
- [相关文档](#相关文档)

---

## 为什么需要这个插件

在知识库里，值得反复阅读的内容往往分散在笔记、Canvas、EPUB 等不同来源中。如果没有统一队列，这些内容很容易变成「收藏了就等于读过了」。

本插件专注解决三件事：

1. **收拢**：把零散材料变成结构化的阅读点，归入专题（IRDeck）。
2. **推进**：用日历与调度策略安排「今天读什么」，维持续读节奏。
3. **回跳**：从阅读点回到原文位置，继续阅读或拆分任务。

---

## 核心能力

### 阅读点与专题（IRDeck）

- 从当前文档、选区或外部来源创建阅读点
- 将阅读点归入增量阅读专题（`.irdeck`）
- 在专题视图中整理、筛选与推进阅读任务

### 增量阅读日历

- 按日期查看待处理、已排期与逾期的阅读点
- 安排复习时间、优先级与标签组
- 支持阅读计时、连续阅读等辅助操作
- 侧边栏可配置显示范围、背景墙等个性化选项

### 调度与续读

- 支持**加工流**与**阅读清单**等调度策略
- 可配置每日新内容上限、复习上限、时间预算等
- 支持交错学习，避免长时间只读同一主题

### 来源回跳与跨插件协作

- 为阅读点保留来源信息，便于回到原文继续阅读
- 可与 **Weave 主插件**、**EPUB 阅读器插件**协作（来源定位、宿主能力等）
- 长期保持职责边界清晰：增量阅读工作流在本插件内完成，不把核心能力混回主插件

### 主要界面

| 界面 | 说明 |
|------|------|
| **增量阅读日历** | 按日历推进队列，查看今日待办 |
| **IRDeck 专题视图** | 管理某个专题下的阅读点与进度 |
| **专注阅读视图** | 围绕当前阅读点进行集中续读 |

---

## 快速上手

### 1. 安装并启用插件

完成[安装](#安装与更新)后，在 Obsidian **设置 → 社区插件** 中启用 **Weave Incremental Reading**。

### 2. 打开增量阅读日历

任选一种方式：

- 点击左侧功能区中的**日历**图标
- 命令面板执行：**打开增量阅读日历**

### 3. 从选区创建阅读点

在 Markdown 等可编辑视图中选中内容后，执行命令：

- **从当前选区创建增量阅读点**

插件会按你的设置，把选区整理为阅读点并纳入对应专题流程。

### 4. 打开专题文件（IRDeck）

若当前打开的是 `.irdeck` 专题文件，可执行：

- **打开当前 IRDeck**

在专题视图与日历之间切换，继续安排或续读。

### 5. 建议的首次配置

进入 **设置 → Weave Incremental Reading**，可优先确认：

- 默认专题与数据目录
- 调度策略（加工流 / 阅读清单）
- 每日新内容与复习上限
- 选区快速创建阅读点时的行为（是否删除源文、回链位置等）

---

## 安装与更新

### 方式一：从 Release 手动安装（推荐）

1. 打开本仓库的 [Releases](./releases) 页面，下载最新版本附件。
2. 在知识库中创建目录：

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. 将以下文件放入该目录（须来自**同一次** Release 构建产物）：

   - `main.js`
   - `manifest.json`
   - `styles.css`

4. 重启 Obsidian，或在 **设置 → 社区插件** 中重新加载插件。

### 方式二：通过 BRAT 跟踪开发版

若你使用 [BRAT](https://github.com/TfTHacker/obsidian42-brat) 插件，可添加本仓库地址并选择 **Weave Incremental Reading**，之后通过 BRAT 检查更新即可获取新版本。

> Release 中只需包含 `main.js`、`manifest.json`、`styles.css` 三个运行时文件；`versions.json` 保留在仓库中用于版本兼容记录，不作为手动安装包必需文件。

### 方式三：从源码构建

```bash
git clone <你的仓库地址>
cd weave-incremental-reading
npm install
npm run build
```

构建完成后，将 `dist/` 目录中的 `main.js`、`manifest.json`、`styles.css` 复制到知识库的 `.obsidian/plugins/weave-incremental-reading/`。

开发时也可使用：

```bash
npm run dev
```

将构建输出目录指向你的测试库插件目录，即可热更新调试。

### 系统要求

| 项目 | 要求 |
|------|------|
| Obsidian | **≥ 1.7.0** |
| 平台 | 桌面端与移动端均可（`isDesktopOnly: false`） |

当前 manifest 版本：**0.5.1**（以仓库内 `manifest.json` 为准）。

---

## 与 Weave / EPUB 阅读器的关系

本插件是**独立产品**，不是 Weave 主插件的内嵌模块，也不是 EPUB 阅读器本体。三者分工如下：

| 插件 | 主要职责 |
|------|----------|
| **Weave Incremental Reading**（本插件） | 增量阅读队列、阅读点、专题、调度、续读工作流 |
| **Weave 主插件** | 记忆牌组、题库、AI 制卡、全源溯源等宿主协作能力 |
| **EPUB 阅读器插件** | EPUB 阅读、章节定位、阅读器内选区与阅读体验 |

若你只使用增量阅读，可单独安装本插件；若需要 EPUB 内书签回跳或 Weave 侧扩展能力，再按需安装对应兄弟插件。

---

## 数据与隐私

- 阅读点、专题与调度数据**默认保存在本地知识库**中
- 插件**不会主动上传**你的笔记内容
- 跨插件协作或外部服务相关调用，仅在对应功能被实际使用时发生

更详细的存储结构、迁移说明与拆分边界，见[相关文档](#相关文档)。

---

## 参与开发

```bash
npm install
npm run dev
```

常用检查：

```bash
npm run lint:obsidian
npm run check
npm run test
```

发布与版本同步流程见 [发布指南](./docs/RELEASE_GUIDE.md)。

---

## 相关文档

- [文档中心](./docs/README.md)
- [发布指南](./docs/RELEASE_GUIDE.md)
- [独立增量阅读插件开发边界标准](./docs/technical/STANDALONE_IR_DEVELOPMENT_BOUNDARY_STANDARD.md)
- [独立增量阅读插件拆分状态](./docs/technical/STANDALONE_IR_SPLIT_STATUS_2026-05-19.md)

---

## 说明

本仓库由较早的主插件工程拆分而来。若你在代码或文档中看到旧的 Weave 命名、兼容层或历史结构，请优先将其视为**拆分残留**或**跨插件协作层**，而非本插件的长期核心职责。

---

## 作者

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

如有问题或建议，欢迎在 [Issues](./issues) 中反馈。
