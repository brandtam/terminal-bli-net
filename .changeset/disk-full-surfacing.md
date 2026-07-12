---
type: patch
category: Fixed
---

Surface storage failures instead of losing state silently — the disk now says "disk full"

- A localStorage quota failure while saving preferences, window layout, or the disk manifest now raises a retro "Disk Full" dialog (once per session) with a shortcut to the Trash, instead of silently dropping the write.
- Terminal OS checks the browser's storage estimate on boot and after every new file lands on disk; crossing ~80% of the quota shows a one-time "Disk Almost Full" warning. Browsers that don't report an estimate are handled quietly.
- System Maintenance gains a Disk Capacity panel: a browser-storage gauge plus live Terminal HD numbers (files, folders, text bytes, clip/blob bytes, total).
- Camera: the clip limit is now honestly 30 seconds — the code allowed 60 while the About box promised 10. Camera also warns before saving a clip that would nearly fill the disk, offering Save Anyway or Discard.
