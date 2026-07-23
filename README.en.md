# Weave Incremental Reading

[中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#中文文档) | [English](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md#english) | [日本語](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ja.md) | [한국어](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ko.md) | [繁體中文](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.zh-TW.md) | [Русский](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.ru.md)

> Full bilingual documentation (Chinese first, then English) lives in **[README.md](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/blob/main/README.md)**. This file is the English-only mirror.

<div align="center">

**Turn “read later” into a reading queue you can actually finish**

Standalone Obsidian incremental reading — topics, reading points, calendar scheduling, and source resume

</div>

---
![QQ_1784229108205](https://github.com/user-attachments/assets/05b583f0-6485-45a9-9665-b7e4aa95f5ab)
![QQ_1784229164256](https://github.com/user-attachments/assets/649226dd-db4c-4529-95dd-a412898dfe1a)
![QQ20260717-031452-HD](https://github.com/user-attachments/assets/72411a43-638c-4ce8-80ff-8cf5fadbc8ae)

**Weave Incremental Reading** (plugin ID: `weave-incremental-reading`) is a **standalone** Obsidian plugin for incremental reading.

It helps you turn scattered material from Markdown notes, block links, PDF (with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus)), Canvas, web pages, and EPUB into a maintainable **reading-point queue**, organized by **topics** and advanced through a **calendar**—so content does not stay stuck in “saved but never read.”

The plugin works on its own and does **not** require the Weave main plugin. Install other Weave family plugins only when you need in-vault EPUB reading or memory-deck / card workflows.

---

## Three core concepts

| Concept | Meaning |
|---------|---------|
| **Reading point** | A single reading task with source traceability; open it from the queue to jump back to the original location. |
| **Topic (IRDeck)** | A container for reading points, stored as an `.irdeck` file in your vault. Group by subject or plan. |
| **Incremental reading calendar** | The main view: browse pending, scheduled, and overdue items by date and manage daily pace. |

---

## Core capabilities

- **Incremental reading calendar** — month heatmap and day queue; load, priority, and overdue items; continue-reading helpers
- **Unified “Add link”** — paste web URLs, wikilinks, block refs, PDF++ locations, Canvas nodes, EPUB locations; set name, topic, and first read day in one flow
- **Topics and reading points** — priority, suspend, archive; open `.irdeck` and switch between topic view and calendar
- **Scheduling and resume** — processing-flow / reading-list strategies, daily caps and time budget; auto next appearance after progress
- **Material import** — split/import from Markdown; premium: folder subscription, bulk PDF / EPUB chapter import
- **Source resume** — stable resume links for Markdown, PDF++, Canvas, web pages, and EPUB

---

## Quick start

1. Install and enable the plugin (see [Installation](#installation-and-updates))
2. Open the **incremental reading calendar** (ribbon calendar icon, or command **Open incremental reading calendar**)
3. Click **“+” / Add link** at the top of the calendar: paste source → edit name → choose topic → schedule first read day → save
4. Open today’s items from the calendar, resume at the source, mark progress; the plugin schedules the next appearance

Prefer **Add link** for daily use; selection commands and context menus remain available.

---

## Installation and updates

### Install from Releases (recommended today)

1. Open [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases) and download the latest assets
2. Create this folder in your vault:

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. Copy `main.js`, `manifest.json`, and `styles.css` from the **same** release into that folder
4. Enable **Weave Incremental Reading** under **Settings → Community plugins**

### Track updates with BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), add this repository and select **Weave Incremental Reading**.

### Obsidian Community Plugins directory

If the plugin is listed in the community directory, search for **Weave Incremental Reading** under **Settings → Community plugins**.

### Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** (see `minAppVersion` in `manifest.json`) |
| Platforms | Desktop and mobile |

---

## Relationship to the Weave family

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

## Free vs premium

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

## Data and privacy

- Reading points, topics, schedules, and settings stay in your **local vault** by default
- The plugin does **not** upload your note content proactively
- Cross-plugin calls (EPUB resume, license checks, etc.) happen only when you use those features
- Uninstalling does **not** automatically delete `.irdeck` files or reading-point data; use the data management tool or remove files manually

---

## Author

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

- Email: tutaoyuan8@outlook.com
- Issues: [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues)
- License: [GPL-3.0-or-later](LICENSE)

---

<div align="center">

**Make your reading queue move—not your bookmarks pile up.**

</div>
