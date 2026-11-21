# Weave Incremental Reading

[中文说明](README.md) · [English](#overview)

<div align="center">

![Weave series](https://github.com/user-attachments/assets/a52c0875-9296-4dfd-bf94-114a225f2972)

![Weave series](https://github.com/user-attachments/assets/86b1adbd-d1e2-411f-842d-24402a3c054d)

![Weave Incremental Reading](https://github.com/user-attachments/assets/93ae9bdd-84d8-4f7e-b0f9-6ede5924a518)

**Turn “read later” into a queue you can actually finish**

Standalone Obsidian incremental reading · topics · calendar scheduling · source resume

</div>

---

## Overview

**Weave Incremental Reading** (plugin ID: `weave-incremental-reading`) is a standalone Obsidian plugin for incremental reading.

It gathers Markdown, block refs, PDF, Canvas, web pages, EPUB, and more into traceable **reading points**, groups them in **topics**, and advances them with a **calendar**—so saving is not the same as reading. Open an item to jump back to the source and continue. Progress and topics are stored as vault files; your data stays local.

Use it alone—it does **not** require the Weave main plugin. Add other Weave family plugins only when you need in-vault EPUB reading or memory-deck / card workflows.

Full docs: [guide/](guide/README.md) ([English](guide/en/index.md) · [中文](guide/zh/index.md)). In-plugin help is also available from the calendar.

---

## Three core concepts

| Concept | Meaning |
|---------|---------|
| **Reading point** | The smallest unit of scheduling and resume: one reading task with source traceability. |
| **Topic (`.irdeck`)** | A container for reading points, stored as a topic file in the vault. |
| **Incremental reading calendar** | The daily home: browse pending, scheduled, and overdue items by date and manage pace. |

---

## What you can do

- **Incremental reading calendar** — month heatmap and day queue; priority, overdue, and continue-reading helpers
- **Unified Add link** — paste web URLs, wikilinks, block refs, PDF++, Canvas, or EPUB locations; set name, topic, and first read day in one flow
- **Topics and reading points** — priority, suspend, archive; switch between topic view and calendar
- **Scheduling and resume** — universal default rhythm, daily caps and time budget; auto next appearance after progress
- **Material import** — split/import from Markdown; premium: folder subscription and bulk PDF / EPUB chapter import
- **Paragraph reading workbench** (premium) — focused paragraph reading and scheduling, with random roam and scope settings
- **Source resume** — stable resume links for Markdown, PDF++, Canvas, web pages, and EPUB

---

## Quick start

1. Install and enable the plugin (see [Installation](#installation-and-updates))
2. Open the **incremental reading calendar** (ribbon calendar icon, or command **Open incremental reading calendar**)
3. Click **“+” / Add link**: paste source → name → choose topic → schedule first read day → save
4. Open today’s items, resume at the source, mark progress; the plugin schedules the next appearance

Prefer **Add link** for daily use; use material import for whole documents or books. Selection commands and context menus remain available.

---

## Installation and updates

### Install from Releases (recommended)

1. Open [Releases](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/releases) and download the latest assets
2. Create this folder in your vault:

   ```text
   .obsidian/plugins/weave-incremental-reading/
   ```

3. Copy `main.js`, `manifest.json`, and `styles.css` from the **same** release into that folder
4. Enable **Weave Incremental Reading** under **Settings → Community plugins**

### Track with BRAT

If you use [BRAT](https://github.com/TfTHacker/obsidian42-brat), add this repository and select **Weave Incremental Reading**.

### Community Plugins directory

If listed, search for **Weave Incremental Reading** under **Settings → Community plugins**.

### Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | **≥ 1.8.7** (see `minAppVersion` in `manifest.json`) |
| Platforms | Desktop and mobile |

---

## Weave family

There are exactly three Weave plugins. They compose around **read → capture → schedule → review**, with clear boundaries:

| Plugin | Responsibility |
|--------|----------------|
| **Weave Incremental Reading** (this plugin) | Reading points, topics, calendar scheduling, resume and source navigation |
| **Weave Review** (main plugin) | Memory decks, question banks, excerpt-to-card, FSRS review |
| **Weave EPUB Reader** | In-vault EPUB reading, excerpts, and chapter location |

- Incremental reading only → this plugin alone
- EPUB chapter resume → this plugin + Weave EPUB Reader
- Cards and spaced review → this plugin + Weave Review
- Full loop → all three

External collaboration: **PDF++** for PDF selection / location links via **Add link**.

---

## Free vs premium

The calendar and Markdown reading-point workflow are **free** and cover everyday incremental reading.

| Free | Premium (license required) |
|------|----------------------------|
| Calendar, topics, Markdown reading points, basic scheduling | Paragraph reading workbench and random-roam scope |
| Today’s queue, resume, Add link | PDF / EPUB chapter reading-point import |
| Markdown material import, data management | Load & deferral, interleaved learning |
| Load-tuning knobs, Markdown block focus mode | Folder subscription auto-sync |
| Analytics entry and Activity trend tab | Quantity / timing / priority / future-load charts |
| Basic settings such as YAML tag sync | Tag groups, reading timer, associated notes |

Locked features are clearly marked; the core flow still works without a license. If **Weave Review** is installed and activated, this plugin can inherit that license. Standalone activation: **Settings → Weave Incremental Reading → License**.

---

## Data and privacy

- Reading points, topics, schedules, and settings stay in your **local vault** by default
- The plugin does **not** upload note content proactively
- Cross-plugin calls (EPUB resume, license checks, etc.) happen only when those features are used
- Uninstalling does **not** automatically delete `.irdeck` files or reading-point data; use the data management tool or remove files manually

---

## Docs and support

| Resource | Link |
|----------|------|
| User guide | [guide/](guide/README.md) |
| Changelog | [CHANGELOG.md](CHANGELOG.md) |
| Issues | [Issues](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues) |
| License | [GPL-3.0-or-later](LICENSE) |

---

## Author

**Rabbit (zhuzhige)** — [GitHub](https://github.com/zhuzhige123)

Email: tutaoyuan8@outlook.com

---

<div align="center">

**Make your reading queue move—not your bookmarks pile up.**

</div>
