# Introduction

Weave Incremental Reading turns materials from Markdown, block refs, PDF, Canvas, web pages, EPUB, and more into **schedulable, resumable, traceable** reading points. Topics and a calendar drive pace—so saving is not the same as reading.

It is a **standalone** incremental-reading controller: it does **not** require the Weave main plugin. Combine it with Weave EPUB Reader or Weave Review only when you need those capabilities.

## Three core concepts

| Concept | Meaning |
|---------|---------|
| **Reading point** | One reading task with source tracing; open it from the queue to jump back to the original location. |
| **Topic (`.irdeck`)** | A container for reading points, stored as a topic file in your vault. |
| **Incremental reading calendar** | The main view: browse pending, scheduled, and overdue points by date and manage daily pace. |

**Key differences:**

- A **reading point** is the unit of schedule and resume
- A **topic** owns grouping (a point belongs to one topic at a time)
- The **calendar** is where daily decisions happen

## Core capabilities

- **Unified Add link** — paste web URLs, wikilinks, block refs, PDF++, Canvas nodes, EPUB locations; set name, topic, and first day in one flow
- **Material import and folder subscription** — split Markdown; premium: PDF/EPUB chapters and folder auto-sync
- **Scheduling and resume** — universal default rhythm, daily caps and load smoothing; open to jump back to source
- **Continuous reading** — expand related points from the same source (free)
- **Associated notes** (premium) — curated links for PDF/EPUB; outbound links for Markdown/web
- **Source resume** — stable locators for Markdown, PDF++, Canvas, web, and EPUB

## Quick start

1. Install (Release / BRAT / community directory) and enable the plugin
2. Open the **incremental reading calendar**
3. Use **“+” / Add link** to create the first reading point
4. Open it from today, resume, mark progress, watch the next schedule

Prefer **Add link** for daily capture; use **Import reading materials** for whole documents or book outlines.

## Requirements

| Item | Requirement |
|------|-------------|
| Obsidian | ≥ 1.8.7 (see `minAppVersion` in `manifest.json`) |
| Platforms | Desktop and mobile |

## Free vs premium

**Calendar + Markdown reading-point main flow is free** in the current release.

| Free | Premium (activation required) |
|------|-------------------------------|
| Calendar and Markdown reading points | Bulk PDF / EPUB chapter import |
| Topics and point management (priority, suspend, archive) | Load & deferral, interleaving |
| Basic scheduling, today’s queue, resume | Folder subscription sync |
| Add link (MD, blocks, PDF++, etc.) | Analytics, reading timer, … |
| Markdown split import, data management | Associated notes and more |
| Continuous reading, Markdown focused reading | Tag groups (still being improved—do not rely on them) |

Locked premium entries may show a clear hint or a lock when **Show advanced feature preview** is on. Basic reading is unaffected.

If **Weave main plugin** is installed and activated, this plugin can **inherit** that license. Standalone activation: **Settings → Weave Incremental Reading → License**.

## Data and privacy (summary)

- Reading points, topics, schedule, and settings stay in the **local vault** by default
- The plugin does not actively upload your note bodies
- Uninstall does **not** auto-delete `.irdeck` data

See [Data and maintenance](data-and-maintenance.md).

## Next

- [Philosophy](philosophy.md) · [Add reading points](add-reading-points.md) · [Calendar](calendar.md)
