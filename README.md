# Lackluster Video

A first-person PS1-era video store shift simulator. One sitting, one shift: 6:00 PM to close,
60 real minutes, accelerated. Rewind the returns, shelve the drop-offs, ring up the line, and
try to come out the other side with a promotion instead of a write-up.

```bash
npm install
npm run dev        # http://127.0.0.1:5173
npm run typecheck
npm run build
```

Click the canvas to capture the mouse. `WASD` move, `Shift` run, `E` interact, `Esc` release.

## Design pillars

**One shift is the whole game.** No campaign, no store economy, no staff scheduling. The hour
is the container, and the promotion at the end is the win condition. Anything that cannot be
resolved inside sixty minutes does not belong.

**Every mechanic lands on the scorecard.** `src/sim/Scorecard.ts` holds the only metrics that
exist — customers served, walkouts, rewind compliance, shelving accuracy, register errors. If a
proposed feature does not move one of those numbers, it is decoration and should be cut.

**Pressure comes from the clock, not from difficulty.** Jobs spawn faster as the shift wears on
(`src/sim/Tasks.ts`), so the last stretch before close is the peak. Jobs that time out convert
directly into the failures on your review.

**The titles are all parodies.** `src/data/catalog.ts` is original work that evokes era
archetypes without borrowing a real mark. Each entry carries a `vagueRequest` — how a customer
describes it without knowing the name — which is the hook for the recommendation mechanic.

## Layout

```
src/
  core/     Game state machine, shift clock, input
  render/   PS1 pipeline, palette, procedural box art
  world/    Store geometry, first-person controller
  sim/      Job board, scorecard
  ui/       HUD and screens
  data/     Film catalog
```

## The PS1 look

Three deliberate artifacts, all in `src/render/`:

1. **Affine texture mapping** — the console had no per-pixel perspective divide, so textures
   swim across large polygons. GPUs interpolate correctly, so `ps1Material.ts` defeats it:
   uvs are premultiplied by clip `w` and divided back in the fragment stage.
2. **Vertex snapping** — clip-space positions quantize to the internal grid, producing the
   characteristic jitter as the camera moves.
3. **A 320x240 framebuffer** — everything renders to a low-res target, gets crushed to 15-bit
   color with an ordered dither, then point-samples up to the window.

Lighting is per-vertex and wrapped rather than hard lambert, because a ceiling of fluorescent
troffers is closer to an area light than a sun — hard lambert leaves every shelf face black.

## Not built yet

The stations (`rewind`, `returns`, `register`, `restock`, `shelf`) currently resolve their job
on a single `E` press. Each is a placeholder for its own interaction: the rewind hold-and-watch
meter, the genre-and-alphabet shelving check, the register with late-fee decisions, and the
recommendation exchange driven by `vagueRequest`. Customers are not modeled yet — the register
job stands in for them. There is no audio.
