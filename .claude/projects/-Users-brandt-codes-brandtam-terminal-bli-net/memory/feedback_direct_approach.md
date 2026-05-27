---
name: feedback-direct-approach
description: Try the user's suggested approach first instead of proposing alternatives; say upfront when something isn't possible
metadata:
  type: feedback
---

When the user asks for a specific approach (e.g., canvas-based distortion, transform scale), try it directly instead of substituting CSS workarounds or alternative techniques. If something is technically impossible (e.g., barrel distortion on cross-origin iframes), say so immediately — don't burn multiple rounds discovering it.

**Why:** Multiple rounds of "that didn't work" / "that's not what I asked for" during the VCR TV/screen convex effect work. The user asked for canvas, got CSS overlays. Asked for scaling, got aspect-ratio hacks. The final solution (transform: scale on a fixed-size unit) was what they were driving at from the start.

**How to apply:** Lead with honest constraints, then implement the user's requested approach. Don't substitute your preferred technique when the user has specified one.
