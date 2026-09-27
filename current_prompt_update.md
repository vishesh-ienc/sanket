# Current Prompt Update — UI Overhaul, Live Code Word, Customisable Signals, Built-in Conversation

**Updated:** 2026-09-28
**Branch:** `feat/ui-overhaul` (stacked on `feat/complete-handoff`)
**Status:** COMPLETE ✅ — merged to `main` and pushed

## Requests handled
1. **"Improve the UI by a ton"** → Tailwind v4 + shadcn/ui app shell: sidebar (desktop) / bottom tabs (phone), five views
   (Monitor, Signals, Incidents, Demo, Settings), live activity feed with click-through detail sheets, light/dark/system themes.
2. **Live code-word detection** → on-device Web Speech (`processLocally`), cloud only by explicit opt-in (ADR 022).
3. **Scenario simulator without a live source** → scenarios now drive the engine on their own.
4. **Real alert delivery** → on hold, as requested.
5. **Teammate brief** (source-agnostic demo, customisable signals, pre-downloaded conversation built in) → Signals view,
   bundled 53 s TTS phone call with captions and transcript track, "any source" framing.

## Engine fixes discovered with real speech
- Code word now sustained ~15 s context instead of < 1 s (ADR 024).
- Incident latch hysteresis: 1 alert instead of 10 on the demo call (ADR 025).

## Plugins used
shadcn MCP/CLI (components) · 21st MCP (Teal Mist theme, layout references) · context7 (shadcn + Tailwind v4 Vite setup) ·
Playwright MCP (all browser verification) · web docs (MDN / WebAudio explainer for on-device speech).

## Results
- `npm test`: **730 passed, 0 failed** (13 suites) · `npm run lint`: clean · `npm run build`: clean
- Browser (Playwright MCP): demo call → alert, guided tour → evidence sheet, signals, settings, mobile 375 px, dark + light.

## Open items
See `docs/PROGRESS.md` → *Open Items / Needs Input* and *Pending Questions for the Team* (12 questions).
