# Import and subscription

Use **Import reading materials** when a **whole** Markdown file, PDF outline, or EPUB outline should become many reading points.  
Use **folder subscription** (premium) when a clip/inbox folder should **keep topping up** a topic automatically.

Both differ from daily [Add reading points](add-reading-points.md): add is one item; import/subscription are batch or ongoing.

## When to import

| Import fits | Add link fits better |
|-------------|----------------------|
| Long note split by headings | One web article you just found |
| Book chapters from an outline | One Canvas node or PDF++ selection |
| Preview-then-confirm bulk create | One quick block ref |

**Entry:** calendar **More → Import reading materials**.

## Import steps

1. Choose files (**one batch = one type only**: `md` / `pdf` / `epub`)  
2. PDF / EPUB open an **outline** step so you can pick chapters  
3. Choose split mode and options  
4. **Preview** generated points, then confirm  

Results land in the chosen topic and enter the calendar by the initial schedule mode you pick.

## Formats and limits

### Markdown (free)

- Split by headings, blank lines, and similar rules  
- Whole-file mode can **reference** or **copy**  
- Compatibility import folder defaults to `plugin data folder / IR` (legacy path; you need not manage it by hand)

### PDF / EPUB (premium)

- Bookmark-style points from outlines with resume info  
- EPUB outline parsing depends on **Weave EPUB Reader**  
- Without premium, the entry may be hidden or shown locked  

For precise PDF selections, pair with **PDF++**. See [Source and resume](source-and-resume.md).

## Folder subscription (premium)

Pick a **Markdown** folder in the vault; the plugin scans and auto-adds matching new materials into a bound topic, then schedules them.

**Key difference from import:** import is a one-shot manual split; subscription keeps watching and topping up.

### Configure and sync

1. **Settings → Weave Incremental Reading → Basic → Subscribe clipping folders** — rules, folders, bound topics, initial schedule mode, bulk confirm threshold  
2. **Manual sync:** calendar **More → Update subscribed folders**, or the command **Update subscribed folders**  
3. Background sync also runs on startup and relevant vault changes  

### Initial schedule mode (important)

| Mode | Meaning |
|------|---------|
| **Add to today** | Pin new materials on today (not smoothed across the horizon) |
| **Schedule normally** | Place due dates by horizon / load rules |

### Limits

- Subscription targets **Markdown**; do not expect images or arbitrary binaries in the queue  
- Premium-gated; may be hidden or locked without activation  

## Best practices

1. Import once to plan a book; use Add link for later fragments  
2. Bind clips to one inbox topic and triage into real topics  
3. Preview splits—too fine raises daily-cap pressure; too coarse makes points huge  
4. Install **Weave EPUB Reader** for EPUB outline and resume  

## Related

[Add reading points](add-reading-points.md) · [Scheduling](scheduling.md) · [Weave family](weave-family.md)
