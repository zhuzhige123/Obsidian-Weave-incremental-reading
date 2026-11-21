# Troubleshooting

Find by symptom. If stuck, open a [GitHub Issue](https://github.com/zhuzhige123/Obsidian-Weave-incremental-reading/issues) with Obsidian version, plugin version, and platform (desktop / mobile).

## Calendar and lists

### Can’t find the calendar

- Command palette: **Open incremental reading calendar**  
- Confirm the plugin is enabled  
- Legacy “main reading” entries should redirect to the calendar—use the calendar as the only main UI  

### New topic missing from search / directory briefly

- Reopen the calendar sidebar; indexes refresh  
- Confirm the `.irdeck` is under the configured data root `points/`  
- Use data management to verify readability  

### Archived / suspended items linger

Current builds should update hide rules immediately. If not: confirm the action stuck, switch days or reopen the calendar, then report repro steps.

### Mobile toolbar or list scroll issues

Upgrade to a build that includes mobile sidebar / `nav-header` fixes; check themes that heavily restyle leaf headers.

## Add and import

### Paste not recognized

- Check completeness (`https://`, `[[…]]`, PDF++ links, `*.canvas#^nodeId`)  
- Don’t mix md/pdf/epub in one import batch  
- EPUB locations need Weave EPUB Reader enabled when created  

### PDF / EPUB import unavailable

- Activate premium, or enable advanced preview to see the locked entry  
- EPUB outlines need Weave EPUB Reader  

### Subscription ignores new files

- Folder must be **Markdown**  
- Rule bound to a topic and enabled?  
- Run **Update subscribed folders** manually  
- Premium required  

### “Add to today” items appear later in the week

- Check **Add to today** vs **Schedule normally**  
- Only the latter spreads due across the horizon  

## Resume and sources

### Missing source / won’t open

- File moved, renamed, or deleted?  
- PDF++ / EPUB / Canvas node / block ID still valid?  

### EPUB resume fails

- Install and enable **Weave EPUB Reader**  
- Point must store a location link, not only a title  
- Highlights alone are not reading points  

### PDF opens but not the selection

- Add via **PDF++** selection/bookmark links  
- Path-only points can’t restore a precise selection  

## Scheduling and state

### Rarely returns / returns too often

- Check Processing vs Reading list and interval-related settings  
- Suspended or archived?  
- Daily cap / time budget blocking release?  

### Expected FSRS behavior

This plugin is not FSRS. Use **Weave Review** for spaced repetition. See [Philosophy](philosophy.md).

### Tag groups do nothing

Still being improved—use topics, priority, and basic scheduling instead.

## License

### Premium locked

- Activate under **Settings → License**, or inherit from an activated main plugin  
- Advanced preview shows entries; activation is still required to use them  

### Main plugin licensed but IR still locked

- Confirm main plugin activation and inheritance support  
- Reload plugins or restart Obsidian  

## Data

### Topics missing after machine switch

- Synced the data root (`weave Incremental reading/` by default)?  
- Settings path matches the real folder?  

### Legacy point formats remain

- Use **Data management** to unify/migrate  
- Delete old adjacent temp editor files if any; newer temps belong under the data root `editor/`  

## Related

[Data and maintenance](data-and-maintenance.md) · [Source and resume](source-and-resume.md) · [Settings](settings.md)
