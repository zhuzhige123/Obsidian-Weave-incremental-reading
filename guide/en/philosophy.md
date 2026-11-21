# Philosophy

Why Weave Incremental Reading is shaped this way—and what it is **not**.

## Saving is not reading

Bookmarks and clip folders store things. They rarely answer:

- What should I read today?
- What about yesterday’s overdue items?
- How do I continue through one long source split into many pieces?
- Can I return to the exact place I left?

This plugin turns materials into **reading points**, uses a **calendar** for daily rhythm, and keeps **resume links**—so the queue moves instead of rotting in a folder.

## Three design principles

### 1. Decide on the calendar; read in the source

The calendar handles day selection, load, priority, progress, reschedule, and suspend.  
The source handles reading. Opening a point routes to Markdown / PDF++ / Canvas / web / EPUB.

Do not treat a second in-plugin “reader” as the daily path. The path is **queue + resume**.

### 2. One primary capture path, many shortcuts

Daily capture should go through **Add link** on the calendar toolbar (commands may say **Add reading target**): one URL, selection, or node.

**Import** is for whole documents / book outlines → many points.  
**Folder subscription** is for an ongoing clip inbox (premium).

Many entries, one model: everything becomes a reading point in a topic and appears on the calendar.

### 3. Incremental reading ≠ spaced repetition (FSRS)

| | Weave Incremental Reading | Weave Review (main) |
|--|---------------------------|-------------------|
| Job | What to read, when it returns, how to resume | What to remember, when to review |
| Unit | Reading point + topic + calendar | Cards + decks |
| Feel | Universal default rhythm, time budget, daily cap, load defer | FSRS and study sessions |

Splitting “read queue” from “remember cards” is intentional. Scheduling in this plugin means **reading-point due dates**, not FSRS.

## Why topics (`.irdeck`)

Topics group points by plan and live as vault files—backupable, syncable, visible in the file explorer. Open an `.irdeck` to move between topic view and calendar. The topic chip on the month header filters **All** vs one topic.

Keep names stable so one plan does not fragment into many near-duplicate topics.

## Why resume location matters

Much of the value is continuing after interruption. Prefer stable locators when creating points (block IDs, PDF selections, Canvas node IDs, EPUB CFI/chapters).

## Free baseline vs premium depth

The product guarantees a free loop: **calendar + Markdown points + Add link + basic scheduling + continuous reading**.  
PDF/EPUB bulk chapters, subscription, deep strategy knobs, timers, analytics, associated notes, and similar features are premium extensions.

## Do not teach these as the daily path

| Item | Why |
|------|-----|
| Legacy main reading view | Removed; redirects to the calendar |
| Paragraph reading workbench | Experimental; not ready—use the calendar |
| Tag groups as a primary workflow | Still being improved |
| FSRS as this plugin’s scheduler | Belongs to Weave Review |

## Next

[Add reading points](add-reading-points.md) · [Calendar](calendar.md) · [Scheduling](scheduling.md)
