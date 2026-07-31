# Allya — product UI (Next.js)

> ## 🔵 BUILD HERE
>
> The canonical Allya product codebase. All new product work goes in this repo.
>
> The zero-build prototype in [`../product`](../product) is **frozen** — it still serves the live
> Netlify site, but no new features go there. Not deployed yet; wiring a deploy for this app is
> open decision #1 in [`../README.md`](../README.md).

The interface founders use to work with **Allya** (by Zeroto10) — an AI execution partner: agents do the work, real experts approve it, nothing ships without you.

This is the Next.js port of the zero-build prototype in [`../product`](../product). Same design, same motion, same scripted beats — now on the App Router with React state instead of `innerHTML`.

## Run

```
npm install
npm run dev      # http://localhost:4322
```

**This app needs the API running.** Start [`../product-api`](../product-api) first:

```
uvicorn main:app --reload --port 8000   # from ../product-api
```

The base URL comes from `NEXT_PUBLIC_API_URL` (see `.env.example`). With the API down every
pane shows its own offline state and one "try again" brings the whole page back — but there
is no data without it. `npm run build && npm start` for production.

> The legacy prototype still serves on **4321** (`node ../product/server.mjs`). This app uses **4322** so the two can run side by side during the migration.

## Routes

| Route         | What it is |
| ------------- | ---------- |
| `/`           | The company brain — hub plus the five services. Tapping a service launches into it |
| `/[service]`  | One floor per service (`/marketing`, `/hiring`, `/pr`, `/sales`, `/ops`) — same shell, different surface |
| `/onboarding` | The six-question conversation that builds the company brain, then hands off into `/` |

`/[service]` is one dynamic route, not five pages: the layout, the graph, the work, the
words and the script all come from `GET /surfaces/{id}`. A slug the API doesn't know renders
a "there's no such floor" state. The static siblings (`/login`, `/onboarding`) still win.

**The launch.** Tapping a service node doesn't open a panel — the camera flies *into* it
while everything else streaks past and fogs out (`launchInto`), the route changes as the
flight ends, and the service page picks the same motion up mid-air (`arriveInto`) so the two
halves read as one move. The hand-off is a short-lived `sessionStorage` record
(`components/surface/launch.ts`); a reload or a slow trip just plays the normal intro.

**The two brain shapes.** `/` uses the `web` layout — hub, one ring, nothing else. A service
uses `spray`: the service anchored low, its single cord running down to the company node at
the bottom edge, and its whole tree thrown upward across the pane. That one cord is what
keeps a service floor part of the same brain rather than a second one.

The onboarding handoff is still a `localStorage` record (`allya.onboarding`), read in an
effect so the server HTML and first client paint agree.

## Layout

```
src/
  app/
    layout.tsx          root shell + next/font (Fraunces, Inter Tight)
    globals.css         design tokens + everything every route shares
    workspace.css       the two-pane shell, the brain box, the approval surface
    surface.css         a service floor: taller brain, direction rail, the whoosh, skeletons
    page.tsx            /            → the company brain
    [service]/          /marketing, /hiring, /pr, /sales, /ops
    onboarding/         /onboarding  → onboarding.css
  components/
    BrainCanvas.tsx     React shell around the canvas engine
    Transcript.tsx      the message thread, shared by every route
    Pressable.tsx       spring press-feedback wrappers
    surface/            SurfaceWorkspace (the shell), SurfaceCanvas, ReviewSheet, launch.ts
    workspace/          Island, WorkPane, ApprovalSheet, Composer, DotPage, KnowledgeFeed, PagePicker, Toast
    onboarding/         IntroScreen, ObComposer, Showcase, Onboarding (the state machine)
  lib/
    api/                client (fetch + cache + prefetch), types, resources, useResource
    spring.ts           the spring engine, momentum projection, rubber-banding
    brain.ts            the brain canvas engine (one copy, every surface)
    hooks.ts            reduced-motion / media queries / press / owned timers
    useConversation.ts  the transcript the server's beats play into
    onboarding-data.ts  the six questions + the deterministic reading of the answers
    handoff.ts          the localStorage bridge
```

**No backend-owned data lives in the frontend.** The brain graph, work items, review
sheets, knowledge facts, schedules, conversation scripts and every string on the page come
from the API; `lib/api/types.ts` mirrors `product-api/models.py`. The only placeholder
content the frontend owns is skeletons.

## What's imperative on purpose

Canvas pixels and gesture tracking don't belong in React state, so they aren't:

- **`lib/brain.ts`** owns the graph, the physics, the camera and the pointer bindings. React owns only the box around it — which is why the graph survives the ask → synthesis layout change, and the launch flight, without losing its state or momentum.
- **`ApprovalSheet`** tracks the drag 1:1 through refs and hands release velocity to a spring. React owns *which* item is open; the spring owns where the panel is.

Everything else — the transcript, the work list, the onboarding flow — is ordinary React state.

## Motion

Springs (response + damping, numerically integrated, interruptible) drive anything that can be interrupted: the approval panel, press feedback, the suggest popup, the KPI ticker, the toast. One-shot entrances — message bubbles, shipped rows, showcase cards — are CSS animations, which cost nothing per frame.

The brain loop runs at 30fps while something is happening and ~15fps for the idle drift, caps the canvas at 1.25× DPR, and only allocates gradients where they're visible. `prefers-reduced-motion` is honoured throughout.

## Try it

`/onboarding` → answer six questions, watch the brain grow a cluster per answer, then enter the workspace and see Allya greet you by company name.

In `/`: `⌘K` or `/` focuses the composer; type "newsletter" or "hiring". Click **Review →**, drag the panel by its grabber (flick to dismiss), approve, then **undo** inside the hold window.
