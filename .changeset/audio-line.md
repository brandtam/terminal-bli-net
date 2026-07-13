---
type: minor
category: Added
---

`os.audio.line()`: a raw line into the OS audio layer for apps that outgrow the chip voices

- Apps whose sound is the product — continuous tones, scheduled frequency sweeps, filtered noise — can take `os.audio.line()` instead of minting their own context: the one shared `AudioContext` plus a fresh `GainNode` routed under the master gain, so the OS mute/volume setting and hidden-tab suspend govern the app's whole graph for free. `close()` detaches it on window close; the call returns `null` before the first user gesture. The chip voices (`beep`/`blip`/`error`/`tone`) stay the default vocabulary. Documented in ADR 0006 (amended) and the "Writing an app" audio guide.
- The "Writing an app" type notes gain a rendering gotcha: column-aligned text in VT323 needs `font-variant-ligatures: none` — the font ships `fi`/`fl`/`ff` ligatures that collapse two characters into one cell and silently skew ASCII boxes.
