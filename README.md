# Allya — product UI (Next.js)

The interface founders use to work with **Allya** (by Zeroto10) — an AI execution partner: agents do the work, real experts approve it, nothing ships without you.

This is the Next.js port of the zero-build prototype in [`../product`](../product). Same design, same motion, same scripted beats — now on the App Router with React state instead of `innerHTML`.

## Run

```
npm install
npm run dev      # http://localhost:4322
```

`npm run build && npm start` for production. Both routes prerender as static — there's no backend; conversations are scripted beats.

> The legacy prototype still serves on **4321** (`node ../product/server.mjs`). This app uses **4322** so the two can run side by side during the migration.

## Routes

| Route         | What it is |
| ------------- | ---------- |
| `/`           | The workspace — conversation left, live work panel right, approval surface over the top |
| `/onboarding` | The six-question conversation that builds the company brain, then hands off into `/` |

The handoff between them is a `localStorage` record (`allya.onboarding`), read in an effect so the server HTML and first client paint agree.

## Layout

```
src/
  app/
    layout.tsx          root shell + next/font (Fraunces, Inter Tight)
    globals.css         design tokens + everything both routes share
    page.tsx            /            → workspace.css
    onboarding/         /onboarding  → onboarding.css
  components/
    BrainCanvas.tsx     React shell around the canvas engine
    Transcript.tsx      the message thread, shared by both routes
    Pressable.tsx       spring press-feedback wrappers
    workspace/          Island, HomeCanvas, WorkPane, ApprovalSheet, Composer, Toast
    onboarding/         IntroScreen, ObComposer, Showcase, Onboarding (the state machine)
  lib/
    spring.ts           the spring engine, momentum projection, rubber-banding
    brain.ts            the company-brain canvas engine (one copy, both surfaces)
    hooks.ts            reduced-motion / media queries / press / owned timers
    useConversation.ts  the scripted transcript
    workspace-data.ts   work items, day plan, brain graph
    onboarding-data.ts  the six questions + the deterministic reading of the answers
    handoff.ts          the localStorage bridge
```

## What's imperative on purpose

Canvas pixels and gesture tracking don't belong in React state, so they aren't:

- **`lib/brain.ts`** owns the graph, the physics, and the pointer bindings. React owns only the box around it — which is why the graph survives the ask → synthesis layout change without losing its state or momentum.
- **`ApprovalSheet`** tracks the drag 1:1 through refs and hands release velocity to a spring. React owns *which* item is open; the spring owns where the panel is.

Everything else — the transcript, the work list, the onboarding flow — is ordinary React state.

## Motion

Springs (response + damping, numerically integrated, interruptible) drive anything that can be interrupted: the approval panel, press feedback, the suggest popup, the KPI ticker, the toast. One-shot entrances — message bubbles, shipped rows, showcase cards — are CSS animations, which cost nothing per frame.

The brain loop runs at 30fps while something is happening and ~15fps for the idle drift, caps the canvas at 1.25× DPR, and only allocates gradients where they're visible. `prefers-reduced-motion` is honoured throughout.

## Try it

`/onboarding` → answer six questions, watch the brain grow a cluster per answer, then enter the workspace and see Allya greet you by company name.

In `/`: `⌘K` or `/` focuses the composer; type "newsletter" or "hiring". Click **Review →**, drag the panel by its grabber (flick to dismiss), approve, then **undo** inside the hold window.
