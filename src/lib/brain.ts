/* ============================================================
   The company brain — Allya's model of the business, made touchable.

   A labeled graph: a hub (your company), its departments, and the
   concrete things under them. It holds a clean shape, drifts gently,
   fires "thoughts" along its edges, and reacts to touch — hover excites
   a node and ripples to neighbours, drag moves it 1:1, tap sends a
   thought.

   One engine serves both surfaces:
   - the workspace brain starts whole ('web' layout, nodes revealed)
   - the onboarding brain starts as a lone hub and GROWS a cluster per
     answer ('cluster' layout, nodes spring in via `rev`)

   Performance: the loop runs at 30fps while something is happening and
   ~15fps for the idle drift; gradients are only allocated where they're
   actually visible; layout is probed twice a second, not per frame.
   ============================================================ */

import { Spring, clamp, prefersReducedMotion } from './spring';

export const GROUPS: Record<string, string> = {
  core: '#91d45f',
  // marketing used to share the hub's lime, which made the company brain and
  // the marketing floor indistinguishable. It sits in burnt sienna now —
  // still the only warm red in the family, and its eight branch tints (and
  // so email's and WhatsApp's) are spun out of this one value.
  marketing: '#9A4C32',
  hiring: '#d9a441',
  pr: '#a78bda',
  sales: '#5fbfa8',
  ops: '#6f9fd8',
  market: '#6f9fd8',
  customer: '#5fbfa8',
  revenue: '#d9a441',
  goals: '#91d45f',
  edge: '#a78bda',

  /* the sign-in gate's graph — the company as an outsider meets it
     (core and market above already carry the right tints) */
  product: '#91d45f',
  traction: '#5fbfa8',
  model: '#d9a441',
  team: '#a78bda',

  /* branch tints — a service page gives each of its directions one, so a
     cluster reads as a place and not just a shade of its parent */
  b1: '#a78bda',
  b2: '#91d45f',
  b3: '#63c2d6',
  b4: '#d9a441',
  b5: '#5fbfa8',
  b6: '#6f9fd8',
  b7: '#d98a8a',
  b8: '#c9b478',
};

const TAU = Math.PI * 2;

export interface NodeSpec {
  id: string;
  label: string;
  /** 0 hub, 1 department, 2 leaf — 3 exists only under an expanded department */
  tier: 0 | 1 | 2 | 3;
  group: string;
  parent?: string;
  /** what the canvas calls it, when the full name is too wide for the ring.
      Everything else — the dot page, the rail — still uses `label`. */
  short?: string;
  /** id of a WORK item this node mirrors — drives the "needs you" breathing */
  work?: string;
  /** starts unborn in an otherwise-revealed graph; `reveal(id)` grows it in */
  hidden?: boolean;
  /** this node is a place of its own — tapping it launches, it doesn't open */
  surface?: string;
  /** a placeholder until this floor's onboarding fills it in — drawn faintly */
  provisional?: boolean;
}

interface BrainNode extends NodeSpec {
  x: number;
  y: number;
  hx: number;
  hy: number;
  vx: number;
  vy: number;
  /** excitement 0..1.4 — hover, tap, an arriving thought */
  ex: number;
  /** reveal 0..1 — springs to 1 as the node grows in */
  rev: number;
  phase: number;
  angle?: number;
  /** label visibility 0..1 — fades toward 0 when occluded by a higher-priority label */
  lv: number;
  /** cached label width in CSS px (set at resize) */
  lw: number;
  /** how many children hang off it — a node with a tree under it carries
      more visual weight than a leaf at the same depth */
  kids: number;
}

export interface Cluster {
  id: string;
  label: string;
  group: string;
  leaves?: string[];
}

export interface BrainOptions {
  nodes?: NodeSpec[];
  cross?: [string, string][];
  /** 'web' fans leaves out from the centre; 'cluster' fans them around their
      parent; 'spray' anchors one node low, keeps the single cord to its
      parent below it, and throws its whole tree up across the pane */
  layout?: 'web' | 'cluster' | 'spray';
  /** the node 'spray' anchors on */
  anchorId?: string;
  /** true → nodes start fully drawn; false → they spring in */
  revealed?: boolean;
  radii?: Record<number, number>;
  scaleRange?: [number, number];
  /** angular gap between sibling leaves — tighten it when there are many
      departments, or neighbouring clusters interleave */
  leafSpread?: number;
  /** scales how far leaves sit from the hub — pull them in when their
      labels are long enough to run off the edge */
  leafReach?: number;
  thoughtEvery?: number;
  /** the hue this surface is wearing — thoughts travelling the edges, the
      breathing of live nodes. Defaults to the company's lime. */
  accent?: string;
  /** group → colour, layered over GROUPS: a floor spins its branch tints out
      of its own accent rather than taking the shared rainbow */
  groupColors?: Record<string, string>;
  /** nodes that need the founder's eyes breathe */
  isLive?: (node: NodeSpec) => boolean;
  /** bias the ambient thought target */
  pickTarget?: (nodes: NodeSpec[]) => NodeSpec | undefined;
  /** a tap on a node opens its page — the brain re-centres and fogs the rest */
  onOpenNode?: (info: OpenNodeInfo) => void;
  /** a tap on a node that carries a `surface` doesn't open a panel — it
      leaves. The caller decides when to actually navigate. */
  onLaunch?: (id: string, surface: string) => void;
}

/** what a tapped node hands to the page that grows out of it */
export interface OpenNodeInfo {
  id: string;
  label: string;
  tier: number;
  group: string;
  color: string;
  work?: string;
  parent: string | null;
  children: { id: string; label: string; work?: string }[];
  /** where the dot sits on screen, so the page can grow from that point */
  origin: [number, number];
}

export interface BrainHandle {
  start(): void;
  stop(): void;
  destroy(): void;
  resize(): boolean;
  fireThought(target?: BrainNode): void;
  seedHub(label: string): void;
  setHubLabel(label: string): void;
  grow(cluster: Cluster): void;
  bloom(): void;
  setThoughts(on: boolean): void;
  readonly nodeCount: number;
  /** the finale ramps this so the graph grows as it wakes */
  setZoom(z: number, snap?: boolean): void;
  readonly zoom: number;
  /** open a node's page — re-centres the camera and fogs the rest */
  openNode(id: string): void;
  clearFocus(): void;
  readonly focus: string | null;
  /** send a thought toward a cluster (or anywhere) — used by the MCQs */
  pulse(id?: string): void;
  /** grow a node that was seeded `hidden` (with its edge to its parent) */
  reveal(id: string): void;
  /** glide the camera onto a node — no fog, nothing "opens"; pass null to
      frame the whole graph again */
  frame(id: string | null, zoom?: number, snap?: boolean): void;
  /** fly into a node and leave — `done` fires as the flight ends, which is
      when the caller should change route */
  launchInto(id: string, done?: () => void): void;
  /** pick that flight up on the other side, mid-air */
  arriveInto(id: string): void;
  /** add/relabel a single leaf so an MCQ answer shows up in the graph */
  upsertSatellite(parentId: string, slotKey: string, label: string): void;
  removeSatellite(slotKey: string): void;
  /** dev: force N settled frames + a draw (preview tabs throttle rAF) */
  tickOnce(frames?: number, dt?: number): void;
}

function hexA(hex: string, a: number) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${clamp(a, 0, 1)})`;
}

/* ---- the branch family ----
   A service floor's directions used to take a fixed eight-colour rainbow,
   which read as "some graph" rather than "the PR floor". These are spun out
   of the floor's own hue instead: eight members close enough to belong to one
   colour, far enough apart to stay eight distinct places. */
function toHsl(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const hue =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [hue * 60, s, l];
}

function hsl(h: number, s: number, l: number) {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + ((h % 360) + 360) / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** b1…b8 spun out of one accent — the palette a service floor wears */
export function branchTints(accent: string): Record<string, string> {
  const [h, s, l] = toHsl(accent);
  const spin = [-34, 20, -16, 36, 0, -50, 52, 10];
  const lift = [0.06, -0.05, -0.1, 0.02, 0.1, -0.02, -0.07, 0.14];
  const out: Record<string, string> = {};
  spin.forEach((dh, i) => {
    out[`b${i + 1}`] = hsl(h + dh, clamp(s * 0.92, 0.28, 0.62), clamp(l + lift[i], 0.42, 0.78));
  });
  return out;
}

function lighten(hex: string) {
  const h = hex.replace('#', '');
  const mix = (c: number) => Math.round(c + (255 - c) * 0.4);
  const part = (i: number) =>
    mix(parseInt(h.slice(i, i + 2), 16))
      .toString(16)
      .padStart(2, '0');
  return `#${part(0)}${part(2)}${part(4)}`;
}

export function createBrain(canvas: HTMLCanvasElement, box: HTMLElement, opts: BrainOptions = {}): BrainHandle {
  const ctx = canvas.getContext('2d')!;
  const layoutMode = opts.layout ?? 'web';
  const revealed = opts.revealed ?? true;
  const R =
    opts.radii ??
    (layoutMode === 'cluster' ? { 0: 8.5, 1: 5, 2: 3.3 } : { 0: 7, 1: 4.8, 2: 3.1, 3: 2.7 });
  const [sMin, sMax] = opts.scaleRange ?? (layoutMode === 'cluster' ? [0.85, 1.7] : [0.82, 1.5]);
  /** tier 3 only exists under an expanded department; everything else falls back */
  const radiusOf = (t: number) => R[t] ?? R[2];
  /* a node with a tree under it reads as a place, not a thought — so weight
     is by depth AND by whether anything hangs off it */
  const labelSize = (n: BrainNode) =>
    n.tier === 0 ? 12.7 : n.tier === 1 ? 11.2 : n.kids ? 10.8 : n.tier === 3 ? 9.4 : 10;
  const thoughtEvery = opts.thoughtEvery ?? 5;
  // a thought travelling the edges is the surface's colour, not always lime
  const ACCENT = opts.accent ?? '#91d45f';
  const PALETTE: Record<string, string> = { ...GROUPS, ...(opts.groupColors ?? {}) };
  const colorOf = (group: string) => PALETTE[group] || ACCENT;
  const ACCENT_LIT = lighten(ACCENT);
  const ACCENT_PALE = lighten(ACCENT_LIT);

  let W = 0;
  let H = 0;
  let dpr = 1;
  let S = 1;

  const nodes: BrainNode[] = [];
  const nodeById: Record<string, BrainNode> = {};
  const edges: [string, string][] = [];

  // camera: when a node is opened the graph re-centres on it and everything
  // that isn't the focus or a neighbour fogs back. All four ease toward *T.
  const cam = { x: 0, y: 0, z: 1, fog: 0, xT: 0, yT: 0, zT: 1, fogT: 0 };
  let focusNode: BrainNode | null = null;
  /** the camera rides this node without fogging anything — used by the
      intro, which travels the trunk before the branch opens */
  let panNode: BrainNode | null = null;
  let baseZoom = 1;
  let lastLabelT = 0;
  /** 0..1 motion blur: while it's up, every node trails a speed line away
      from wherever the camera is heading. This is the whoosh. */
  let warp = 0;
  /** the camera is mid-flight — a layout probe must not snap it home */
  let camFlying = false;

  // world ↔ screen (the camera puts cam.x/y at the centre of the box)
  const toScreen = (x: number, y: number): [number, number] => [
    (x - cam.x) * cam.z + W / 2,
    (y - cam.y) * cam.z + H / 2,
  ];
  const toWorld = (px: number, py: number): [number, number] => [
    (px - W / 2) / cam.z + cam.x,
    (py - H / 2) / cam.z + cam.y,
  ];

  // how lit a node stays once something is focused: the focus itself, then
  // its parent/children, then everything else drops back into the fog
  function fogOf(n: BrainNode) {
    if (!focusNode) return 1;
    let rel = 0.12;
    if (n === focusNode) rel = 1;
    else if (n.parent === focusNode.id || focusNode.parent === n.id) rel = 0.42;
    return 1 - cam.fog * (1 - rel);
  }
  /** id → neighbour ids, so hover doesn't rescan every edge */
  const adj: Record<string, string[]> = {};

  let pulses: { a: BrainNode; b: BrainNode; delay: number; t: number; dur: number; hit?: boolean }[] = [];
  let ripples: { x: number; y: number; col: string; t: number; r0: number }[] = [];
  let thoughtClock = 0;
  let thoughtsOn = true;
  const tSeed = Math.random() * 1000;
  const revealSprings = new Set<Spring>();

  const nodeR = (n: BrainNode) => radiusOf(n.tier) * S * (0.2 + n.rev * 0.8) * (1 + n.ex * 0.5);

  function link(a: string, b: string) {
    edges.push([a, b]);
    (adj[a] ||= []).push(b);
    (adj[b] ||= []).push(a);
  }

  function addNode(spec: NodeSpec) {
    const parent = spec.parent ? nodeById[spec.parent] : null;
    const n: BrainNode = {
      ...spec,
      x: parent ? parent.x : W / 2,
      y: parent ? parent.y : H / 2,
      hx: W / 2,
      hy: H / 2,
      vx: 0,
      vy: 0,
      ex: 0,
      rev: revealed && !spec.hidden ? 1 : 0,
      phase: Math.random() * TAU,
      lv: 1,
      lw: 0,
      kids: 0,
    };
    nodes.push(n);
    nodeById[n.id] = n;
    measureLabel(n);
    if (parent) parent.kids += 1;
    if (spec.parent && nodeById[spec.parent]) link(spec.parent, n.id);
    if (!revealed) {
      const s = new Spring(0, {
        response: 0.62,
        damping: 0.72,
        onframe: (p, _v, settled) => {
          n.rev = p;
          if (settled) revealSprings.delete(s);
        },
      });
      revealSprings.add(s);
      s.to(1);
    }
    return n;
  }

  /** grow one node that was seeded `hidden` — its edge fades up with it */
  function revealNode(id: string) {
    const n = nodeById[id];
    if (!n || n.rev >= 1) return;
    const s = new Spring(n.rev, {
      response: 0.6,
      damping: 0.74,
      onframe: (p, _v, settled) => {
        n.rev = p;
        if (settled) revealSprings.delete(s);
      },
    });
    revealSprings.add(s);
    // it grows out of its parent, so it starts there and springs to its home
    const parent = n.parent ? nodeById[n.parent] : null;
    if (parent) {
      n.x = parent.x;
      n.y = parent.y;
    }
    s.to(1);
    start();
  }

  /* ---- home positions ---- */
  function layout() {
    const cx = W / 2;
    const cy = H / 2;
    /* "co" is the company's id and the hub in every graph the API sends,
       but the engine's real rule is tier 0 — a graph cropped to one
       direction has its own hub and would otherwise never be placed, and
       a node that is never placed sits in the corner at (0,0). */
    const hub = nodeById.co ?? nodes.find((n) => n.tier === 0);
    if (hub) {
      hub.hx = cx;
      hub.hy = cy;
    }
    const depts = nodes.filter((n) => n.tier === 1);

    if (layoutMode === 'web') {
      // departments on an ellipse; leaves fan outward from the CENTRE with a
      // staggered radius, which reads as depth and keeps clusters apart
      const reach = opts.leafReach ?? 1;
      const rx1 = W * 0.22;
      const ry1 = H * 0.3;
      const rx2 = W * 0.4 * reach;
      const ry2 = H * 0.4 * reach;
      depts.forEach((d, i) => {
        const a = -Math.PI / 2 + (i / Math.max(1, depts.length)) * TAU;
        d.hx = cx + Math.cos(a) * rx1;
        d.hy = cy + Math.sin(a) * ry1;
        d.angle = a;
      });
      // keep sibling leaves inside their own slice of the ring
      const spread = opts.leafSpread ?? 0.3;
      depts.forEach((d) => {
        const leaves = nodes.filter((n) => n.parent === d.id);
        leaves.forEach((l, j) => {
          const a = (d.angle ?? 0) + (j - (leaves.length - 1) / 2) * spread;
          const depth = 1 + (j % 2) * 0.2;
          l.hx = cx + Math.cos(a) * rx2 * depth;
          l.hy = cy + Math.sin(a) * ry2 * depth;
        });
      });
    } else if (layoutMode === 'spray') {
      /* One service, opened. The anchor sits low with its single cord running
         down to the company node at the very bottom edge — that one link is
         what keeps this the same brain and not a second one — and its whole
         tree is thrown upward across the rest of the pane. Nothing but the
         cord lives below the anchor. */
      const reach = opts.leafReach ?? 1;
      const a = opts.anchorId ? nodeById[opts.anchorId] : null;
      if (!a) return;

      a.hx = cx;
      a.hy = H * 0.78;
      const root = a.parent ? nodeById[a.parent] : null;
      if (root) {
        root.hx = cx;
        /* not flush with the edge: the root is the way back up, so it has
           to be a dot you can actually hit. Half of it hanging out of the
           box made the cord look right and the tap impossible. */
        root.hy = H * 0.94;
      }

      const branches = nodes.filter((n) => n.parent === a.id);
      const up = -Math.PI / 2;
      // a wide fan needs the room; four branches would look stretched in it
      const span = Math.PI * (branches.length >= 6 ? 0.86 : 0.62);
      const step = span / Math.max(1, branches.length - 1);
      const spread = opts.leafSpread ?? 0.3;

      branches.forEach((b, i) => {
        const ang = branches.length === 1 ? up : up + (i - (branches.length - 1) / 2) * step;
        // alternate the ring depth so neighbouring labels aren't shoulder to shoulder
        const dd = 1 + (i % 2) * 0.12;
        b.hx = a.hx + Math.cos(ang) * W * 0.3 * dd;
        b.hy = a.hy + Math.sin(ang) * H * 0.26 * dd;
        b.angle = ang;
        const kids = nodes.filter((n) => n.parent === b.id);
        kids.forEach((k, j) => {
          const ka = ang + (j - (kids.length - 1) / 2) * spread;
          const depth = 1 + (j % 2) * 0.14;
          k.hx = a.hx + Math.cos(ka) * W * 0.34 * depth * reach;
          k.hy = a.hy + Math.sin(ka) * H * 0.62 * depth * reach;
        });
      });
    } else {
      // departments on an ellipse by appearance order; leaves fan around
      // their own parent, so a cluster arrives as one readable shape
      /* The ring follows the box, but only so far: on a tall narrow column
         a pure H-relative radius stretches two clusters into a vertical line
         with a void between them. Cap the vertical reach against the width. */
      const rx1 = W * 0.27;
      const ry1 = Math.min(H * 0.3, W * 0.38);
      const rx2 = W * 0.19;
      const ry2 = Math.min(H * 0.2, W * 0.25);
      depts.forEach((d, i) => {
        const a = -Math.PI / 2 + (i / Math.max(1, depts.length)) * TAU;
        d.hx = cx + Math.cos(a) * rx1;
        d.hy = cy + Math.sin(a) * ry1;
        d.angle = a;
      });
      depts.forEach((d) => {
        const leaves = nodes.filter((n) => n.parent === d.id);
        const gap = leaves.length > 3 ? 0.34 : 0.5;
        const reach = leaves.length > 3 ? 1.25 : 1;
        leaves.forEach((l, j) => {
          const a = (d.angle ?? 0) + (j - (leaves.length - 1) / 2) * gap;
          l.hx = d.hx + Math.cos(a) * rx2 * reach;
          l.hy = d.hy + Math.sin(a) * ry2 * reach;
        });
      });
      /* A cluster at the top of the ring lands its leaves at y≈0 — on the
         edge, halo clipped, label with nowhere to go. Keep everything inside
         a margin big enough for the dot and the line under it. */
      const pad = 30 * clamp(S, 0.8, 1.4);
      nodes.forEach((n) => {
        n.hx = clamp(n.hx, pad, Math.max(pad, W - pad));
        n.hy = clamp(n.hy, pad, Math.max(pad, H - pad));
      });
    }

    nodes.forEach((n) => {
      if (n.x === 0 && n.y === 0) {
        n.x = n.hx;
        n.y = n.hy;
      }
    });
  }

  /* The interface's face, under the name it was actually registered with.
     next/font hashes the family ("__Inter_Tight_a1b2c3"), so asking canvas
     for "Inter Tight" quietly got us the system fallback — wider type than
     the rest of the UI, which is half of why the labels crowded. */
  const uiFace = (() => {
    const v =
      typeof window === 'undefined'
        ? ''
        : getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
    return `${v ? `${v}, ` : ''}"Inter Tight", system-ui, sans-serif`;
  })();
  const faceOf = (weight: number, px: number) => `${weight} ${px}px ${uiFace}`;

  /* A label's width IS its claim on the screen: the de-overlap pass, and the
     clamp that keeps a name inside the box, both read n.lw. A node that has
     never been measured claims nothing, so it lands on top of whatever is
     already there and runs off the edge — which is what every node added
     after load was doing. Measure on the way in, and again on resize. */
  function measureLabel(n: BrainNode) {
    ctx.font = faceOf(n.tier === 0 ? 600 : 500, labelSize(n) * clamp(S, 0.9, 1.22));
    n.lw = ctx.measureText(n.short ?? n.label).width;
  }

  /** re-taken whenever the box changes size — and again once the webfont
      has actually landed, since the first pass can beat it */
  function measureLabels() {
    for (const n of nodes) measureLabel(n);
  }

  /* The box wears HTML over the canvas — its title row, its way back out.
     The graph can't see any of it, so names drifted under the chrome and
     tangled with it. Their rectangles are taken here, in canvas space, and
     handed to the label pass as occupied ground. Anything tall enough to be
     a sheet rather than a strip is skipped: an overlay must not blank every
     label in the graph on its way open. */
  let chrome: { l: number; r: number; t: number; b: number }[] = [];
  function measureChrome() {
    const cr = canvas.getBoundingClientRect();
    chrome = [];
    for (const el of Array.from(box.children)) {
      if (el === canvas) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.height > H * 0.25) continue;
      chrome.push({ l: r.left - cr.left - 5, r: r.right - cr.left + 5, t: r.top - cr.top - 4, b: r.bottom - cr.top + 4 });
    }
  }

  function resize() {
    const w = box.clientWidth;
    const h = box.clientHeight;
    if (!w || !h) return false;
    // capped at 1.25 — 2x quadruples the pixel work for no visible gain here
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    W = w;
    H = h;
    S = clamp(Math.min(W, H) / 300, sMin, sMax);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    layout();
    measureLabels();
    measureChrome();
    // with nothing focused or tracked the camera sits at the centre of the box
    if (!focusNode && !panNode) {
      cam.xT = W / 2;
      cam.yT = H / 2;
      if (!camFlying) {
        cam.x = cam.xT;
        cam.y = cam.yT;
      }
    }
    return true;
  }

  /* ---- thoughts ---- */
  function excite(n: BrainNode, amt: number) {
    n.ex = clamp(n.ex + amt, 0, 1.4);
    if (amt >= 0.5) ripples.push({ x: n.x, y: n.y, col: colorOf(n.group), t: 0, r0: nodeR(n) });
  }

  function fireEdge(a: BrainNode, b: BrainNode, delay = 0) {
    pulses.push({ a, b, delay, t: 0, dur: 0.5 + Math.random() * 0.25 });
  }

  function pathToHub(n: BrainNode) {
    const path: BrainNode[] = [];
    let cur: BrainNode | null = n;
    while (cur) {
      path.push(cur);
      cur = cur.parent ? nodeById[cur.parent] ?? null : null;
    }
    return path.reverse();
  }

  function defaultTarget(): BrainNode | undefined {
    if (opts.pickTarget) return opts.pickTarget(nodes) as BrainNode | undefined;
    // a thought lands on a leaf — whatever depth the leaves happen to be at
    const leaves = nodes.filter((n) => n.tier > 0 && !n.kids && n.rev > 0.9);
    const pool = leaves.length ? leaves : nodes;
    return pool[(Math.random() * pool.length) | 0];
  }

  function fireThought(target?: BrainNode) {
    const t = target || defaultTarget();
    if (!t) return;
    const path = pathToHub(t);
    for (let i = 0; i < path.length - 1; i++) fireEdge(path[i], path[i + 1], i * 0.16);
    if (path[0]) excite(path[0], 0.5);
  }

  function bloom() {
    nodes
      .filter((n) => n.tier > 0 && !n.kids)
      .forEach((n, i) => window.setTimeout(() => fireThought(n), i * 90));
  }

  /* ---- growth (onboarding) ---- */
  function seedHub(label: string) {
    if (!resize()) {
      requestAnimationFrame(() => seedHub(label));
      return;
    }
    addNode({ id: 'co', label: label || 'Your company', tier: 0, group: 'core' });
    layout();
    const hub = nodeById.co;
    hub.x = hub.hx;
    hub.y = hub.hy;
    excite(hub, 0.6);
    start();
  }

  function setHubLabel(label: string) {
    if (!nodeById.co) return;
    nodeById.co.label = label || 'Your company';
    measureLabel(nodeById.co);
  }

  function grow(cluster: Cluster) {
    resize();
    addNode({ id: cluster.id, label: cluster.label, tier: 1, group: cluster.group, parent: 'co' });
    const leaves = (cluster.leaves || []).filter(Boolean).slice(0, 5);
    leaves.forEach((lf, i) =>
      addNode({ id: `${cluster.id}_l${i}`, label: lf, tier: 2, group: cluster.group, parent: cluster.id }),
    );
    layout();
    excite(nodeById[cluster.id], 0.9);
    window.setTimeout(() => fireThought(nodeById[cluster.id]), 90);
    leaves.forEach((_, i) =>
      window.setTimeout(() => fireThought(nodeById[`${cluster.id}_l${i}`]), 240 + i * 200),
    );
  }

  /* ---- interaction ---- */
  let hoverNode: BrainNode | null = null;
  let dragNode: BrainNode | null = null;
  let grabDX = 0;
  let grabDY = 0;
  let pHist: { t: number; x: number; y: number }[] = [];

  function nodeAt(px: number, py: number) {
    let best: BrainNode | null = null;
    let bestD = 1e9;
    for (const n of nodes) {
      const d = Math.hypot(px - n.x, py - n.y);
      const hit = nodeR(n) + 13 / cam.z; // keep the touch target ~constant on screen
      if (d < hit && d < bestD) {
        best = n;
        bestD = d;
      }
    }
    return best;
  }

  // pointer → world, so hit-testing keeps working while the camera is moved
  const localPt = (e: PointerEvent): [number, number] => {
    const r = canvas.getBoundingClientRect();
    return toWorld(e.clientX - r.left, e.clientY - r.top);
  };

  /* ---- tap a dot: the brain re-centres on it, everything else fogs out,
     and its page grows out of the node ---- */
  function openNode(n: BrainNode | null | undefined) {
    if (!n) return;
    // a node that owns a surface is a destination, not a panel
    if (n.surface && opts.onLaunch) {
      opts.onLaunch(n.id, n.surface);
      return;
    }
    if (!opts.onOpenNode) return;
    if (n.tier === 0) {
      // the hub is home — tapping it backs all the way out
      clearFocus();
      fireThought(n);
      return;
    }
    focusNode = n;
    cam.zT = baseZoom * (n.tier === 1 ? 1.9 : n.tier === 2 ? 2.3 : 2.6);
    cam.fogT = 1;
    excite(n, 1.2);
    fireThought(n);
    const [sx, sy] = toScreen(n.x, n.y);
    const r = canvas.getBoundingClientRect();
    opts.onOpenNode({
      id: n.id,
      label: n.label,
      tier: n.tier,
      group: n.group,
      color: colorOf(n.group),
      work: n.work,
      parent: n.parent ? (nodeById[n.parent]?.label ?? null) : null,
      children: nodes
        .filter((m) => m.parent === n.id)
        .map((m) => ({ id: m.id, label: m.label, work: m.work })),
      origin: [r.left + sx, r.top + sy],
    });
  }

  function clearFocus() {
    focusNode = null;
    if (!panNode) {
      cam.xT = W / 2;
      cam.yT = H / 2;
    }
    cam.zT = baseZoom;
    cam.fogT = 0;
    start(); // the loop may have idled out while the page was up
  }

  /* Glide the camera onto a node without opening anything — the intro walks
     the trunk this way, then hands the frame back to the whole graph. */
  function frameOn(id: string | null, zoom = 1, snap = false) {
    resize(); // a snap before the first layout would frame world (0,0)
    baseZoom = zoom;
    cam.zT = zoom;
    panNode = id ? nodeById[id] ?? null : null;
    if (!panNode) {
      cam.xT = W / 2;
      cam.yT = H / 2;
    } else {
      cam.xT = panNode.x;
      cam.yT = panNode.y;
    }
    if (snap || prefersReducedMotion()) {
      cam.x = cam.xT;
      cam.y = cam.yT;
      cam.z = cam.zT;
      camFlying = false;
    }
    start();
  }

  /* ---- leaving, and arriving ----------------------------------------
     A service node isn't a panel, it's a place. Tapping one flies the camera
     into it: the graph converges on that node, everything else streaks past
     and fogs out, and the caller changes route as the flight ends. The page
     you land on calls arriveInto() to pick the same motion up mid-air, so the
     two halves read as one move rather than a navigation. */

  function launchInto(id: string, done?: () => void) {
    const n = nodeById[id];
    if (!n) {
      done?.();
      return;
    }
    if (prefersReducedMotion()) {
      done?.();
      return;
    }
    focusNode = n;
    panNode = null;
    camFlying = true;
    cam.zT = 3.4;
    cam.fogT = 1;
    excite(n, 1.4);
    warp = 1;
    // the whole graph throws a thought at it on the way out
    nodes.forEach((o, i) => {
      if (o !== n) window.setTimeout(() => fireEdge(o, n, 0), i * 14);
    });
    start();
    window.setTimeout(() => done?.(), 520);
  }

  function arriveInto(id: string) {
    const n = nodeById[id];
    if (!n) return;
    if (!resize() || prefersReducedMotion()) {
      frameOn(null, 1, true);
      return;
    }
    // land still moving: pushed in on the anchor, streaks decaying...
    panNode = n;
    cam.x = cam.xT = n.x;
    cam.y = cam.yT = n.y;
    cam.z = cam.zT = 2.4;
    cam.fog = cam.fogT = 0;
    warp = 0.8;
    // ...then coast out to the settled frame
    frameOn(null, 1);
    camFlying = true;
    start();
  }

  const onPointerMove = (e: PointerEvent) => {
    const [px, py] = localPt(e);
    if (dragNode) {
      dragNode.x = px - grabDX;
      dragNode.y = py - grabDY;
      dragNode.vx = 0;
      dragNode.vy = 0;
      pHist.push({ t: performance.now(), x: px, y: py });
      if (pHist.length > 5) pHist.shift();
      return;
    }
    const n = nodeAt(px, py);
    if (n !== hoverNode) {
      hoverNode = n;
      if (n) {
        excite(n, 0.7);
        (adj[n.id] || []).forEach((id) => fireEdge(n, nodeById[id], 0));
      }
    }
    canvas.style.cursor = n ? 'pointer' : 'grab';
  };

  const onPointerDown = (e: PointerEvent) => {
    const [px, py] = localPt(e);
    const n = nodeAt(px, py);
    if (n) {
      dragNode = n;
      grabDX = px - n.x;
      grabDY = py - n.y;
      pHist = [{ t: performance.now(), x: px, y: py }];
      canvas.setPointerCapture(e.pointerId);
      excite(n, 0.5);
    } else {
      fireThought(); // tap on empty space — Allya puts a thought
    }
  };

  const endDrag = () => {
    if (!dragNode) return;
    // hand release velocity back to the node, then it springs home
    if (pHist.length > 1) {
      const a = pHist[0];
      const b = pHist[pHist.length - 1];
      const dt = (b.t - a.t) / 1000;
      if (dt > 0) {
        dragNode.vx = ((b.x - a.x) / dt) * 0.02;
        dragNode.vy = ((b.y - a.y) / dt) * 0.02;
      }
    }
    const moved =
      pHist.length > 1 &&
      Math.hypot(pHist[pHist.length - 1].x - pHist[0].x, pHist[pHist.length - 1].y - pHist[0].y);
    if (!moved || moved * cam.z < 4) {
      // it was a tap: open or launch where that's wired up, else just think
      if (opts.onOpenNode || opts.onLaunch) openNode(dragNode);
      else fireThought(dragNode);
    }
    dragNode = null;
  };

  const onPointerLeave = () => {
    hoverNode = null;
  };

  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', onPointerLeave);

  /* ---- simulation ---- */
  const K_HOME = 34;
  const K_EDGE = 10;
  const DAMP = 5.2;

  function step(dt: number) {
    // gentle drift of the home targets keeps it alive
    const time = performance.now() / 1000 + tSeed;
    for (const n of nodes) {
      if (n === dragNode) continue;
      const amp = n.tier === 0 ? 1.5 : 4;
      const tx = n.hx + Math.sin(time * 0.5 + n.phase) * amp;
      const ty = n.hy + Math.cos(time * 0.42 + n.phase) * amp;
      n.vx += (tx - n.x) * K_HOME * dt;
      n.vy += (ty - n.y) * K_HOME * dt;
    }
    // edge springs — the web reacts when a node is pulled
    for (const [aid, bid] of edges) {
      const a = nodeById[aid];
      const b = nodeById[bid];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.001;
      const rest = Math.hypot(b.hx - a.hx, b.hy - a.hy);
      const f = (d - rest) * K_EDGE;
      const ux = dx / d;
      const uy = dy / d;
      if (a !== dragNode) {
        a.vx += ux * f * dt;
        a.vy += uy * f * dt;
      }
      if (b !== dragNode) {
        b.vx -= ux * f * dt;
        b.vy -= uy * f * dt;
      }
    }
    const fr = Math.exp(-DAMP * dt);
    for (const n of nodes) {
      if (n === dragNode) continue;
      n.vx *= fr;
      n.vy *= fr;
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    }
    for (const n of nodes) n.ex = Math.max(0, n.ex - dt * 1.1);
    // camera + fog follow the focused node; failing that, whatever the
    // intro has asked the camera to ride
    if (focusNode) {
      cam.xT = focusNode.x;
      cam.yT = focusNode.y;
    } else if (panNode) {
      cam.xT = panNode.x;
      cam.yT = panNode.y;
    }
    const k = 1 - Math.exp(-6.5 * dt);
    cam.x += (cam.xT - cam.x) * k;
    cam.y += (cam.yT - cam.y) * k;
    cam.z += (cam.zT - cam.z) * k;
    cam.fog += (cam.fogT - cam.fog) * k;
    // once a flight has coasted to a stop, layout probes may recentre again
    if (
      camFlying &&
      !focusNode &&
      !panNode &&
      Math.abs(cam.x - cam.xT) < 0.6 &&
      Math.abs(cam.y - cam.yT) < 0.6 &&
      Math.abs(cam.z - cam.zT) < 0.01
    ) {
      camFlying = false;
    }
  }

  /* ---- draw ---- */
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const time = performance.now() / 1000;

    // one camera for both jobs: with no focus it scales about the centre of
    // the box (the onboarding finale's growth); with a focus it re-centres on
    // that node and zooms in. Hairlines divide by cam.z so strokes keep their
    // weight. Matches toScreen/toWorld exactly.
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(cam.z, cam.z);
    ctx.translate(-cam.x, -cam.y);

    // edges: gradient strands only while lit — a resting edge sits at ~5%
    // alpha, which a flat stroke renders identically for a fraction of the cost
    for (const [aid, bid] of edges) {
      const a = nodeById[aid];
      const b = nodeById[bid];
      const vis = Math.min(a.rev, b.rev);
      const lit = Math.max(a.ex, b.ex);
      ctx.globalAlpha = Math.max(fogOf(a), fogOf(b));
      if (lit > 0.03) {
        const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        g.addColorStop(0, hexA(colorOf(a.group), (0.05 + a.ex * 0.3 + lit * 0.08) * vis));
        g.addColorStop(1, hexA(colorOf(b.group), (0.05 + b.ex * 0.3 + lit * 0.08) * vis));
        ctx.strokeStyle = g;
      } else {
        ctx.strokeStyle = hexA(colorOf(a.group), 0.05 * vis);
      }
      ctx.lineWidth = ((0.8 + lit * 1.2) * S) / cam.z;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // ripples: a ring blooms where you touched
    for (const rp of ripples) {
      const rr = rp.r0 + rp.t * 42 * S;
      ctx.strokeStyle = hexA(rp.col, (1 - rp.t) * 0.4);
      ctx.lineWidth = (1.4 * S) / cam.z;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, rr, 0, TAU);
      ctx.stroke();
    }

    // pulses: a bright thought with a comet trail
    for (const s of pulses) {
      if (s.delay > 0) continue;
      const t = clamp(s.t, 0, 1);
      const x = s.a.x + (s.b.x - s.a.x) * t;
      const y = s.a.y + (s.b.y - s.a.y) * t;
      const tt = Math.max(0, t - 0.16);
      const px = s.a.x + (s.b.x - s.a.x) * tt;
      const py = s.a.y + (s.b.y - s.a.y) * tt;
      const fade = Math.sin(t * Math.PI);
      const tg = ctx.createLinearGradient(px, py, x, y);
      tg.addColorStop(0, hexA(ACCENT_LIT, 0));
      tg.addColorStop(1, hexA(ACCENT_LIT, 0.6 * fade));
      ctx.strokeStyle = tg;
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      const hg = ctx.createRadialGradient(x, y, 0, x, y, 7 * S);
      hg.addColorStop(0, hexA(ACCENT_PALE, 0.95 * fade));
      hg.addColorStop(1, hexA(ACCENT, 0));
      ctx.fillStyle = hg;
      ctx.beginPath();
      ctx.arc(x, y, 7 * S, 0, TAU);
      ctx.fill();
    }

    // nodes: soft halo + luminous core; labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (const n of nodes) {
      if (n.rev < 0.02) continue;
      const col = colorOf(n.group);
      const hub = n.tier === 0;
      ctx.globalAlpha = fogOf(n);
      const live = opts.isLive?.(n) ?? false;
      const breath = live ? 0.5 + 0.5 * Math.sin(time * 2.4 + n.phase) : 0;
      const r = nodeR(n) * (hub ? 1 + 0.05 * Math.sin(time * 1.6) : 1);
      const glow = (hub ? 1 : 0) + n.ex + breath;

      // halo — resting halos are ~5% alpha, not worth a gradient each frame
      if (hub || glow > 0.03) {
        const haloR = r + (hub ? 26 : 11) * S + n.ex * 12 * S + breath * 8 * S;
        const hg = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, haloR);
        hg.addColorStop(0, hexA(live ? ACCENT : col, (0.05 + glow * 0.16) * n.rev));
        hg.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, TAU);
        ctx.fill();
      }

      // core — lighter centre for a lit look; flat fill for resting leaves
      const base = (hub ? 0.98 : n.tier === 1 ? 0.73 : n.kids ? 0.62 : 0.48) * n.rev * (n.provisional ? 0.42 : 1);
      if (n.tier >= 2 && !n.kids && n.ex < 0.02) {
        ctx.fillStyle = hexA(col, base);
      } else {
        const cg = ctx.createRadialGradient(n.x - r * 0.3, n.y - r * 0.3, 0, n.x, n.y, r);
        cg.addColorStop(0, hexA(lighten(col), clamp(base + n.ex * 0.5, 0, 1)));
        cg.addColorStop(1, hexA(col, clamp(base + n.ex * 0.4, 0, 1)));
        ctx.fillStyle = cg;
      }
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, TAU);
      ctx.fill();
      if (hub) {
        ctx.lineWidth = (1.5 * S) / cam.z;
        ctx.strokeStyle = hexA(ACCENT_PALE, 0.6 * n.rev);
        ctx.stroke();
      }

      // the focused node keeps a bright ring while its page is up
      if (n === focusNode && cam.fog > 0.02) {
        ctx.lineWidth = (1.2 * S) / cam.z;
        ctx.strokeStyle = hexA(lighten(col), 0.5 * cam.fog);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r + (7 * S) / cam.z, 0, TAU);
        ctx.stroke();
      }

    }
    ctx.globalAlpha = 1;
    ctx.restore();

    /* ---- the whoosh: speed lines in screen space ----
       Everything trails away from wherever the camera is flying, at its own
       alpha rather than the fogged one — the streak IS the motion, and it
       should stay bright while the thing it came from drops back. */
    if (warp > 0.01) {
      const [ox, oy] = focusNode ? toScreen(focusNode.x, focusNode.y) : [W / 2, H / 2];
      ctx.lineCap = 'round';
      for (const n of nodes) {
        if (n.rev < 0.02 || n === focusNode) continue;
        const [sx, sy] = toScreen(n.x, n.y);
        let dx = sx - ox;
        let dy = sy - oy;
        const d = Math.hypot(dx, dy);
        if (d < 1) continue;
        dx /= d;
        dy /= d;
        const len = Math.min(190, 26 + d * 0.7) * warp;
        const col = colorOf(n.group);
        const g = ctx.createLinearGradient(sx, sy, sx + dx * len, sy + dy * len);
        g.addColorStop(0, hexA(col, 0.6 * warp));
        g.addColorStop(1, hexA(col, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = Math.max(1, nodeR(n) * cam.z * 0.85);
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dx * len, sy + dy * len);
        ctx.stroke();
      }
      ctx.lineCap = 'butt';
    }

    // ---- labels: greedy de-overlap in screen space ----
    const lnow = performance.now();
    const ldt = lastLabelT ? Math.min(0.1, (lnow - lastLabelT) / 1000) : 0;
    lastLabelT = lnow;
    // labels are claimed shallowest first, and a node with a tree under it
    // outranks a leaf at the same depth — a branch you can walk into should
    // never lose its name to one of its own siblings' thoughts
    const order = nodes.slice().sort((a, b) => (a.tier - b.tier) || ((b.kids ? 1 : 0) - (a.kids ? 1 : 0)) || ((b.ex + (opts.isLive?.(b) ? 0.5 + 0.5 * Math.sin(time * 2.4 + b.phase) : 0)) - (a.ex + (opts.isLive?.(a) ? 0.5 + 0.5 * Math.sin(time * 2.4 + a.phase) : 0))));
    type Box = { l: number; r: number; t: number; b: number };
    const placed: Box[] = [...chrome];
    /* the dots are occupied space too. Without this a leaf's name lands
       straight across someone else's circle, which is what made the web
       read as a tangle rather than a graph. A node never blocks its own
       name — that one sits just under its own dot by design. */
    const dots: { box: Box; n: BrainNode }[] = [];
    for (const n of nodes) {
      if (n.rev < 0.02) continue;
      const [sx, sy] = toScreen(n.x, n.y);
      const rr = nodeR(n) * cam.z + 2.5;
      dots.push({ box: { l: sx - rr, r: sx + rr, t: sy - rr, b: sy + rr }, n });
    }
    const hits = (a: Box, b: Box) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin = 'round';
    for (const n of order) {
      if (n.rev < 0.02) continue;
      const hub = n.tier === 0;
      const live = opts.isLive?.(n) ?? false;
      const breath = live ? 0.5 + 0.5 * Math.sin(time * 2.4 + n.phase) : 0;
      const fs = labelSize(n) * clamp(S, 0.9, 1.22);
      const w = n.lw || 0;
      const r = nodeR(n) * (hub ? 1 + 0.05 * Math.sin(time * 1.6) : 1);
      const [nsx, nsy] = toScreen(n.x, n.y);
      const nsr = r * cam.z;
      const lx = clamp(nsx, w / 2 + 4, W - w / 2 - 4);
      const mk = (y: number): Box => ({ l: lx - w / 2 - 6, r: lx + w / 2 + 6, t: y - 4, b: y + fs + 4 });

      /* how loud this name would be if it got a slot. A label the fog has
         taken down to nothing must not hold a seat: it used to claim its
         box anyway and quietly cost a lit neighbour its name. */
      const rest = (hub ? 0.9 : n.tier === 1 ? 0.55 : n.kids ? 0.5 : 0.3) * (n.provisional ? 0.55 : 1);
      const loud = clamp(rest + n.ex * 0.7 + breath * 0.4, 0, 1) * fogOf(n);
      if (loud < 0.035) {
        n.lv = n.lv === undefined ? 0 : n.lv + (0 - n.lv) * Math.min(1, ldt * 22);
        continue;
      }
      /* a place outranks a thought: a branch may sit across a leaf's dot
         rather than go unnamed, but never across another name */
      const branch = n.tier <= 1 || !!n.kids;
      /* the hub and the node the layout is built around name the place you
         are standing in. Those two never lose their labels — on a sprayed
         floor the anchor sits directly under its own fan of thoughts, and
         it was losing its name to them. */
      const named = hub || n.id === opts.anchorId;
      const fits = (bx: Box) =>
        // wholly inside the box — half a sentence sliding under the edge
        // was most of what made this look unfinished
        bx.l >= 0 &&
        bx.r <= W &&
        bx.t >= 0 &&
        bx.b <= H &&
        !placed.some(p => hits(bx, p)) &&
        !dots.some(d => d.n !== n && !(branch && d.n.tier >= 2) && hits(bx, d.box));

      /* below the dot, then above it — a name that can't sit on one side
         usually has room on the other, and trying both keeps far more of
         them on screen now that the circles are in the way */
      const below = nsy + nsr + 3 * S;
      const above = nsy - nsr - 3 * S - fs;
      const slots = below + fs > H - 2 ? [above, below] : [below, above];
      let ly = slots[0];
      let box = mk(ly);
      let free = fits(box);
      if (!free) {
        ly = slots[1];
        box = mk(ly);
        free = fits(box);
      }
      /* a name that must be shown takes its first slot anyway — but only
         after both were tried honestly, so two of them never stack. On a
         sprayed floor that's the anchor keeping its name under its own fan
         of thoughts, and the root keeping its place at the bottom edge. */
      if (!free && named) {
        ly = slots[0];
        box = mk(ly);
        free = true;
      }
      if (free) placed.push(box);
      const target = free ? 1 : 0;
      /* out fast, in slow. A name that has lost its slot is still drawn
         while it fades, and at the same speed both ways the loser and the
         winner sit on top of each other for a moment — which is exactly
         the smear the graph got whenever the camera moved. */
      const rate = target ? 8 : 22;
      n.lv = n.lv === undefined ? target : n.lv + (target - n.lv) * Math.min(1, ldt * rate);
      if (n.lv < 0.02) continue;
      const la = loud * n.lv;
      ctx.font = faceOf(hub ? 600 : 500, fs);
      // a bed of page-black under the text: the strands and glows run behind
      // every name, and without it the thin type frays against them
      ctx.lineWidth = 3.5;
      ctx.strokeStyle = hexA('#0a0a0a', 0.78 * la);
      ctx.strokeText(n.short ?? n.label, lx, ly);
      ctx.fillStyle = hexA(n.tier >= 2 ? '#c7ccd4' : '#f3f4f6', la);
      ctx.fillText(n.short ?? n.label, lx, ly);
    }
  }

  /* ---- loop ---- */
  let raf = 0;
  let last = 0;
  let boxHidden = false;
  let probeAt = 0;
  let destroyed = false;

  function advance(dt: number) {
    // substep so the springs stay stable at the lower frame rate
    const sub = dt > 0.04 ? 2 : 1;
    for (let i = 0; i < sub; i++) step(dt / sub);
    thoughtClock += dt;
    if (thoughtsOn && thoughtClock > thoughtEvery && nodes.length > 1) {
      thoughtClock = 0;
      fireThought();
    }
    for (const s of pulses) {
      if (s.delay > 0) {
        s.delay -= dt;
      } else {
        s.t += dt / s.dur;
        if (s.t >= 0.5 && !s.hit) {
          s.hit = true;
          excite(s.b, 0.6);
        }
      }
    }
    pulses = pulses.filter((s) => s.t < 1);
    for (const rp of ripples) rp.t += dt / 0.7;
    ripples = ripples.filter((rp) => rp.t < 1);
    if (warp > 0) warp = Math.max(0, warp - dt * 1.7);
  }

  function frame(now: number) {
    if (!raf) return;
    raf = requestAnimationFrame(frame);

    // layout probes force reflow — twice a second is plenty
    if (now >= probeAt) {
      probeAt = now + 500;
      boxHidden = !box.offsetParent;
      if (!boxHidden && (W !== box.clientWidth || H !== box.clientHeight)) resize();
    }
    if (boxHidden) {
      last = now;
      return;
    }

    // 30fps while something is happening, ~15fps for the idle drift
    const active =
      dragNode ||
      hoverNode ||
      pulses.length ||
      ripples.length ||
      revealSprings.size ||
      warp > 0.01 ||
      Math.abs(cam.zT - cam.z) > 0.002 ||
      Math.abs(cam.fogT - cam.fog) > 0.002 ||
      Math.abs(cam.xT - cam.x) > 0.4 ||
      Math.abs(cam.yT - cam.y) > 0.4 ||
      nodes.some((n) => n.ex > 0.02);
    if (now - last < (active ? 33 : 66)) return;

    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.08) dt = 0.08;
    if (!prefersReducedMotion()) advance(dt);
    draw();
  }

  function start() {
    if (raf || destroyed) return;
    if (!resize()) {
      requestAnimationFrame(start);
      return;
    }
    if (prefersReducedMotion()) {
      draw(); // static graph, no loop
      return;
    }
    last = performance.now();
    probeAt = 0;
    raf = requestAnimationFrame(frame);
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  const onResize = () => {
    if (resize() && prefersReducedMotion()) draw();
  };
  const onVisibility = () => (document.hidden ? stop() : start());
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  // the first measure can happen before the webfont swaps in; take them again
  document.fonts?.ready.then(() => {
    if (!destroyed) measureLabels();
  });

  // seed the initial graph
  (opts.nodes || []).forEach((spec) => addNode(spec));
  (opts.cross || []).forEach(([a, b]) => {
    if (nodeById[a] && nodeById[b]) link(a, b);
  });

  return {
    start,
    stop,
    resize,
    fireThought,
    seedHub,
    setHubLabel,
    grow,
    bloom,
    setThoughts(on: boolean) {
      thoughtsOn = on;
    },
    get nodeCount() {
      return nodes.length;
    },
    // with no focused node the camera sits at the box centre, so this just
    // scales the graph in place — the onboarding finale's growth
    setZoom(z: number, snap?: boolean) {
      cam.zT = z;
      if (snap || prefersReducedMotion()) cam.z = z;
    },
    get zoom() {
      return cam.z;
    },
    openNode(id: string) {
      openNode(nodeById[id]);
    },
    clearFocus,
    get focus() {
      return focusNode ? focusNode.id : null;
    },
    pulse(id?: string) {
      fireThought(id ? nodeById[id] : undefined);
    },
    reveal: revealNode,
    frame: frameOn,
    launchInto,
    arriveInto,
    // an MCQ answer plants a labelled leaf; changing the answer relabels the
    // same node, clearing it removes it
    upsertSatellite(parentId: string, slotKey: string, label: string) {
      const parent = nodeById[parentId] || nodeById.co;
      if (!parent) return;
      const id = `mcq_${slotKey}`;
      let n = nodeById[id];
      if (n) {
        n.label = label;
      } else {
        n = addNode({ id, label, tier: 2, group: parent.group, parent: parent.id });
      }
      layout();
      excite(n, 0.9);
      window.setTimeout(() => {
        if (nodeById[id]) fireThought(nodeById[id]);
      }, 60);
    },
    removeSatellite(slotKey: string) {
      const id = `mcq_${slotKey}`;
      const n = nodeById[id];
      if (!n) return;
      const i = nodes.indexOf(n);
      if (i >= 0) nodes.splice(i, 1);
      delete nodeById[id];
      for (let k = edges.length - 1; k >= 0; k--) {
        if (edges[k][0] === id || edges[k][1] === id) edges.splice(k, 1);
      }
      layout();
      fireThought();
    },
    tickOnce(frames = 1, dt = 1 / 60) {
      if (!resize()) return;
      for (let i = 0; i < frames; i++) advance(dt);
      draw();
    },
    destroy() {
      destroyed = true;
      stop();
      revealSprings.forEach((s) => s.stop());
      revealSprings.clear();
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointerup', endDrag);
      canvas.removeEventListener('pointercancel', endDrag);
      canvas.removeEventListener('pointerleave', onPointerLeave);
    },
  };
}
