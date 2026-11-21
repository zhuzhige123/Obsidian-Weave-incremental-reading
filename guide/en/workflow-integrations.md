The three Weave plugins are designed as one Obsidian learning loop—**prepare materials → advance reading → make memory cards → consolidate with quizzes**—not three disconnected tools. This article starts from Incremental Reading and shows how it connects to the rest of the Weave family, Obsidian built-ins, and common community plugins. For the install matrix see `Ir-03c 与 Weave 系列的关系`; this page is about **how to wire them together**.

## The main story: enqueue first, deepen later
While browsing notes, turn an important passage into a traced link and **add it to incremental reading**, then keep reading—you do not have to finish it on the spot.

When you open the incremental reading calendar and today’s material list, points are already placed by schedule and priority. You rarely need to invent “what to read today”: open the top items, jump back to the source, and focus on that block. Compared with a first skim, this pass is better for deep thinking.

When done: mark progress, pick the next appearance, or archive—then continue.

If a point is worth remembering long-term, use **Weave Review** (manual or AI cards) to add it to a memory deck. **Cards made after a second, deeper pass are often higher quality and stick better.** Quizzes and exam groups stay on the Deck side. Incremental Reading owns **when to read again**; Deck owns **how to remember and check**.

That is the Weave series in Obsidian: materials enter a schedulable queue → deep read on the calendar → refine into cards and tests → jump back to sources when needed.

## Where each plugin sits in the loop
| Stage | Primary home |
|-------|----------------|
| Design / collect reading material | Clipping, RSS, import, folder subscription, “Add as reading point” entries |
| Read and resume | IR calendar + source (Markdown / PDF++ / Canvas / web / EPUB Reader) |
| Memory cards | Weave Review |
| Quizzes | Weave Review exam groups and related tools |

Install IR alone for the queue; add EPUB Reader for chapter resume; add Deck for cards and review. Install all three for the full loop.

## Collaboration inside Weave
### Weave Review
1. After opening a point from the calendar and thinking deeply, create cards from the same selection (manual or AI).
2. Prefer cards with source links (`we_source`, etc.) so review can jump back.
3. Do not treat Deck FSRS as IR scheduling—see `Ir-00a 设计理念`.

### Weave EPUB Reader
1. Reader selection toolbar / chapter menu → **Add to incremental reading** (highlights alone do not become points).
2. Calendar resume opens the reader at CFI / chapter.
3. Long books can also be split via IR import (premium) and resumed in the reader. See `Er-04c` on the Reader tab.

## Entries on Obsidian built-in surfaces
IR adds actions where you already work, with link shapes close to official habits:

1. **Canvas** — node menu → Add to incremental reading; or paste `[[board.canvas#^nodeId]]`.
2. **Official web viewer** — menu / selection → Add to incremental reading; or paste `https://…`.
3. **While reading Markdown** — command / hotkey to create a point from selection or capture Current location (block / line)—enqueue mid-read without abandoning the note.
4. **Official clipper (and similar) Markdown in the vault** — point a **folder subscription** (premium) at that folder, or Add link one note at a time.

Details: `Ir-01b 添加阅读点`, `Ir-02c 来源与续读`.

## Community plugins and adjacent flows
### RSS readers → folder subscription
Many RSS plugins save items as Markdown. Subscribe that folder in IR, bind a topic, and choose **Add to today** or **Schedule normally**. New clips enter the queue instead of only piling up on disk. See `Ir-01c 材料导入与订阅`.

### PDF++
Paste precise PDF++ selection / bookmark links into Add link, or import chapters from an outline (premium).

### Video Extended (and similar timestamp links)
Timestamp source links from video notes (wikilinks / embeds that jump to a moment) can be added via Add link. Opening the point returns to the note; Video Extended (or similar) resolves the timestamp—useful for lectures and shadowing (“revisit this minute later”). The link must open normally in Obsidian; follow Video Extended’s own timestamp syntax.

### Excalidraw
Drawings are usually linkable vault notes. Add a link to a drawing (or a related block) as a reading point to schedule “reorganize this map later”; after deep reading, use the drawing as associated material or card fodder. Paths follow Excalidraw conventions.

### Other
Any stable, openable Obsidian link (wikilink, block ref, officially supported locators) can usually enter the queue through unified Add link. Weave places entries at sensible junctions and keeps formats close to core Obsidian rather than a closed parallel system.

## A recommended day
1. While browsing / clipping / taking lecture notes: **Add reading point** on what matters (no need to deep-read immediately).
2. Open the **IR calendar**: follow the list, resume, think.
3. Worth remembering → Weave Review cards; need checks → exam tools.
4. Mark progress or reschedule / archive; continue.
5. EPUB, PDF, Canvas, web, video timestamps, Excalidraw—use the matching entry; everything lands on the same calendar.

## Related
1. `Ir-00a 设计理念` — philosophy and boundaries  
2. `Ir-01b` / `Ir-01c` — add, import, subscribe  
3. `Ir-02a` / `Ir-02b` / `Ir-02c` — calendar, scheduling, resume  
4. `Ir-03c 与 Weave 系列的关系` — install combinations  
5. Deck / Reader tutorials from the top plugin switcher (e.g. `Er-04c`, Deck create-card guides)
