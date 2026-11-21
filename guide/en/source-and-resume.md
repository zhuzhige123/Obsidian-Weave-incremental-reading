# Source and resume

Each reading point stores a stable **resume link** and **source kind**. Opening from the calendar routes by type and locates the original position when possible.

## Principles

1. Prefer **locatable** info at create time (block ID, page selection, node ID, CFI, …)  
2. Resume quality depends on built-in or companion capabilities being available  
3. Moves/renames can cause “missing source”—fix links or recreate the point  

## By type

### Obsidian Markdown

| | |
|--|--|
| **Add** | `[[Note#^blockId]]`, line anchors, Current location, or selection quick-create |
| **Resume** | Open the note and scroll to block/line, with locate highlight when available |
| **Requires** | Native Obsidian Markdown |

**Markdown focused reading** (settings, free) dims surrounding blocks so you can focus in any note.

### PDF (PDF++)

| | |
|--|--|
| **Add** | Paste PDF++ selection/bookmark links; or import chapters from an outline (premium) |
| **Resume** | Open the PDF and resolve page/selection anchors |
| **Requires** | Obsidian PDF; precise selections work best with [PDF++](https://github.com/RyotaUshio/obsidian-pdf-plus) |

### Canvas nodes

| | |
|--|--|
| **Add** | Node menu, or paste `[[board.canvas#^nodeId]]` |
| **Resume** | Open the canvas and highlight by node ID |
| **Requires** | Built-in Obsidian Canvas |

### Obsidian browser (web)

| | |
|--|--|
| **Add** | Web Viewer “Add to incremental reading”, or paste `https://…`; usually creates a reading-note carrier |
| **Resume** | Open the URL in Obsidian’s browser |
| **Requires** | Built-in web viewer |

If the excerpt carrier is missing, menus may offer recreate (associated-notes entry can be premium-gated).

### Weave EPUB Reader

| | |
|--|--|
| **Add** | Reader selection → Add to incremental reading, or paste an EPUB location link. **Highlights alone do not become reading points.** |
| **Resume** | `obsidian://weave-epub-reader` opens the book at CFI/chapter |
| **Requires** | [Weave EPUB Reader](weave-family.md) |

Bulk chapter import also depends on EPUB Reader outlines (premium).

## Associated notes (premium, split by type)

Context menu → **Associated notes**.

| Type | Behavior |
|------|----------|
| **PDF / EPUB** | Curated links: open, append, create, set primary, remove, … |
| **Markdown / web** | Open source note and browse outbound related notes; web can open the original URL |

A Notes badge may appear when links exist. Without activation the entry may be hidden or locked.

## Best practices

1. Create block IDs before adding Markdown points  
2. Use PDF++ selection links for important PDF passages  
3. Add EPUB from selections—don’t assume highlight = queued  
4. Fix missing-source warnings soon after renames  

## Related

[Add reading points](add-reading-points.md) · [Weave family](weave-family.md) · [Troubleshooting](troubleshooting.md)
