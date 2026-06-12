# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## What this is

A **zero-build static site** for Nerve Media (a Beirut marketing studio). No bundler, no framework, no `package.json` — just `index.html`, `styles.css`, `app.js`, and an `assets/` folder, deployed to GitHub Pages. There are two surfaces:

- The public landing page (`index.html`).
- An admin page (`admin/`) that is a fully client-side, **offline-encrypted** bundle (see Admin below).

Both surfaces share `../styles.css` and `../app.js`; the admin page layers its own `admin.css` + `admin.js` on top.

## Commands

```bash
# Local preview (any static server works; the page needs to be served, not file://, for canvas + fonts)
npx serve .                      # or: python -m http.server 8000
# A preview config also exists at .Codex/launch.json (name: "nerve-static", port 4173).

# Regenerate the responsive hero images + OG share image after replacing the source photo
python scripts/gen-images.py     # needs Pillow; `pip install pillow-avif-plugin` adds AVIF output

# Regenerate the encrypted admin payload (admin/payload.js) from a source pricing HTML file
ADMIN_PASSWORD=... node tools/encrypt-admin.mjs <source.html> [admin/payload.js]
# Extracts <body> markup + first <script> from the source, AES-GCM encrypts the
# {css, html, script} bundle under a PBKDF2-SHA-256 key (600k iters), writes payload.js.
```

There is **no build, lint, or test step.** Deployment is automatic: pushing to `main` triggers `.github/workflows/static.yml`.

**The deploy is a filtered copy, not the whole repo.** The workflow assembles `_site` from only `index.html`, `styles.css`, `app.js`, `assets/`, and `admin/`. Dev-only files (`scripts/`, `README.md`, `AGENTS.md`, `ToDoList.txt`, `.Codex/`) stay in the repo but never reach Pages. **When you add a new top-level website file or folder, add it to the `Assemble site` step** or it won't be served.

**Cache-busting is manual and load-bearing.** Shared assets are referenced with a `?v=N` query (e.g. `styles.css?v=58`). When you edit `styles.css` or `app.js`, bump `?v=` in `index.html`. Note that `admin/index.html` pins its **own, independent** `?v=` numbers for the same shared files (plus `admin.css`, `admin.js`, `payload.js`) — bump those too if returning admins must pick up the change.

## Architecture

### Boot loader

`index.html` (public page only) opens with an opaque `#loader` overlay (brand wordmark + sweeping line, intentionally hardcoded black/white). app.js dismisses it when the hero image + fonts are ready — never sooner than 500ms, never later than 2.8s — by adding `body.is-ready` + `.is-done`, then removing the node. **`body.is-ready` gates the entire hero entrance choreography** (title rise, eyebrow/tagline/CTA/cue, mobile photo settle), so it plays as the loader wipes. Safety nets: a 6s CSS `loaderFailsafe` animation hides it if JS dies, a `<noscript>` style removes it without JS, and reduced-motion hides it via media query. Debug: `window.__nerveDebug.finishBoot()` dismisses it immediately (needed in hidden preview tabs).

### `app.js` — two independent IIFEs

1. **Nerve canvas** (`#nerveCanvas`): a seeded, procedural "neural network" drawn on a 2D canvas (primaries → branches → twigs, plus stars and a light source). The network build + first layer bake are **deferred to `requestIdleCallback`** (timeout 600ms; the CSS `.background-field` gradient covers the gap) so they never block first paint — `ensureLayers()`/`draw()` guard on `paths.length` until then. The desktop rAF loop is **self-throttling and idle-sleeping** — it stops repainting after a grace period of stillness and is re-woken by scroll / `resize` / `visibilitychange` / `pageshow` via `wakeCanvas()`. It publishes the current theme lightness as `window.__themeLuma`. **Compact viewports (≤760px or coarse pointer) have NO background rAF loop at all**: `renderLayers()` pre-bakes the network into three depth-bucketed offscreen canvases plus a source-glow sprite (compositor-promoted elements inside `.nerve-field`), and the parallax is a CSS `calc(var(--scroll) * …)` transform. On compact, `--scroll` is written to the **`.nerve-field` element, not `:root`** (a root write invalidated the whole document's style every scroll frame). Layers re-render only when the theme channel flips (snapped on compact) or the viewport height drifts past the baked margin — keep it that way; per-path stroking on phones was the lag. Debug/test hooks: `window.__nerveDebug.snapshot()/.renderOnce()/.syncScroll()` (the latter two run a draw frame / the scroll spine synchronously — needed in hidden preview tabs where rAF never fires).

2. **Scroll-FX system** (`body.fx`): one rAF tick that maps scroll position + velocity into CSS custom properties (`--hero-p`, `--servo`, `--endp`) and class state. **All visual effects live in CSS scoped under `body.fx`** — the JS only sets variables and toggles classes. The fx IIFE **returns early for `admin-body`** and the `fx` class is added **only when** `prefers-reduced-motion` is unset; without it the page is fully static and readable. The tick idles itself after ~30 still frames. **Two motion plans split at 960px:** wide layouts get the scroll-linked scrubs (pinned services sweep + counter, pinned method stages + meter + crosshair, manifesto phrase/polarizer band, velocity springs); compact layouts do **no per-frame section work** — manifesto phrases (`.is-in`), the polarizer wave (`.is-wave` + per-word `--wi` stagger), the riser entrance for service cards **and** method steps (`.is-in` + `--reveal-delay` stagger, with number/dot energize accents), and the method stage band are all IntersectionObserver-driven, the springs are zeroed, and a scroll frame writes at most `--hero-p`. Touch press feedback (`:active` transforms) lives in the `pointer: coarse` block. The hero title splits per-character on desktop but **per-word on touch/compact** (`data-animate="words"`); the contact number scramble is one rAF pass (shorter on touch), not intervals. `--hero-p` is written on the `.hero` element, not `:root`, because all of its consumers live inside the hero. Fx debug hooks: `window.__nerveFx.pump()/.remeasure()/.snapshot()`. Motion timing tokens (`--ease-out`, `--ease-snap`, `--duration-*`, `--stagger-*`) live in `:root` — new animations should pick from them.

### Theme system — everything tints from a handful of variables

Color is **not hardcoded.** The palette is driven by `--theme-bg-rgb` / `--theme-fg-rgb` / `--theme-inverse-rgb` triplets (plus opacity vars like `--theme-grid-opacity`). `setThemeFromScroll()` in `app.js` computes a 0→1 lightness as the reader passes through the `#method` section and rewrites those channels, toggling `body.is-light`. Consequence: **new components must color themselves via `rgb(var(--theme-fg-rgb))`, `rgb(var(--theme-bg-rgb))`, `rgb(var(--theme-inverse-rgb))`** so they invert correctly through the scroll crossover. Hardcoded `#000`/`#fff` will break the light zone.

Two perf rules inside that function: its geometry (`methodTop`, `docMaxScroll`, …) is **cached** by `measureThemeGeom()` (re-run on load/fonts/debounced resize) — never read `offsetTop`/`scrollHeight` per scroll frame; and on touch/narrow devices (`lowPowerMotion`) the lightness is **snapped to 0/1 with hysteresis** instead of scrubbed, because every element consumes the registered theme channels and continuously re-animating them was a full-page style recalc per scroll frame. The 360ms `:root` transition override in `styles.css` (mobile media block) is what makes that snap read as a deliberate cut.

### HTML ↔ JS ↔ CSS wiring is by `data-*` hooks

The fx system finds its targets through attributes, not IDs: `data-reveal`, `data-split` (hero title), `data-polarize` (manifesto copy), `data-method-pin` / `data-method-track` / `data-meter-fill` / `data-crosshair`, `data-services-pin` / `data-services-grid` / `data-services-count`. Adding/removing these attributes is how you opt elements into the motion system.

### Performance invariants (don't regress these)

- Per-frame work happens **only during active scroll** (both loops idle/sleep otherwise). Keep it that way.
- **Never** call `getComputedStyle` or read layout (`offset*`, `getBoundingClientRect`) inside the fx tick except for the unavoidable scroll-position rect. Stable geometry is measured once in `measureGeom()` (re-run on load/resize) and cached.

### Image pipeline

`scripts/gen-images.py` derives, from `assets/nerve-media-beirut-shoot.jpeg` (the 2400×3200 master), AVIF + WebP at 800/1200/1600 widths, a 1200px JPEG fallback, and a 1200×630 `nerve-media-og.jpg` share card. `index.html` serves them via `<picture>` with `srcset`/`sizes` (`(max-width: 960px) 100vw, 62vw`); the master JPEG remains only as the largest fallback. Re-run the script if the source photo changes.

## Admin (`admin/`)

`admin/index.html` is a **separate page** (`body.admin-body`) that reuses the shared `../styles.css` and `../app.js`, plus its own `admin.css`, `admin.js`, and `payload.js`. This is why `app.js`/`styles.css` carry `admin-body` / `is-pricing-open` branches (for canvas + theme) — **do not delete those when cleaning up the public page.**

The login flow lives entirely in **`admin/admin.js`** (not `app.js`) and is fully offline (CSP `connect-src 'none'`): username `admin` + password → PBKDF2-SHA-256 key → **AES-GCM decryption** of `window.NERVE_ADMIN_PAYLOAD` (in `payload.js`) into a `{ css, html, script }` bundle that is injected into the page. The password never leaves the browser; it simply decrypts an embedded blob. Logging in calls `setPricingTheme()`, switching to the light "pricing" palette via `is-pricing-open` + `is-light`; the login screen uses `setLoginTheme()` (dark).

That `payload.js` blob is produced offline by **`tools/encrypt-admin.mjs`** (the encrypt counterpart to `admin.js`'s decrypt) — re-run it (see Commands) to change the pricing content or password. It strips the source's `<header>` and rewrites a couple of copy strings, so don't hand-edit `payload.js`.

Editing shared `styles.css`/`app.js` therefore affects **both** surfaces — verify the admin login screen and its light theme still render after changes.
