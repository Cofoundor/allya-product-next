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
  marketing: '#91d45f',
  hiring: '#d9a441',
  pr: '#a78bda',
  sales: '#5fbfa8',
  ops: '#6f9fd8',
  market: '#6f9fd8',
  customer: '#5fbfa8',
  revenue: '#d9a441',
  goals: '#91d45f',
  edge: '#a78bda',
};

const TAU = Math.PI * 2;

export interface NodeSpec {
  id: string;
  label: string;
  tier: 0 | 1 | 2;
  group: string;
  parent?: string;
  /** id of a WORK item this node mirrors — drives the "needs you" breathing */
  work?: string;
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
  /** 'web' fans leaves out from the centre; 'cluster' fans them around their parent */
  layout?: 'web' | 'cluster';
  /** true → nodes start fully drawn; false → they spring in */
  revealed?: boolean;
  radii?: Record<number, number>;
  scaleRange?: [number, number];
  thoughtEvery?: number;
  /** nodes that need the founder's eyes breathe */
  isLive?: (node: NodeSpec) => boolean;
  /** bias the ambient thought target */
  pickTarget?: (nodes: NodeSpec[]) => NodeSpec | undefined;
  /** a tap on a node opens its page — the brain re-centres and fogs the rest */
  onOpenNode?: (info: OpenNodeInfo) => void;
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
  const R = opts.radii ?? (layoutMode === 'web' ? { 0: 7, 1: 4.8, 2: 3.1 } : { 0: 8.5, 1: 5, 2: 3.3 });
  const [sMin, sMax] = opts.scaleRange ?? (layoutMode === 'web' ? [0.82, 1.5] : [0.85, 1.7]);
  const thoughtEvery = opts.thoughtEvery ?? 5;

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

  const nodeR = (n: BrainNode) => R[n.tier] * S * (0.2 + n.rev * 0.8) * (1 + n.ex * 0.5);

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
      rev: revealed ? 1 : 0,
      phase: Math.random() * TAU,
    };
    nodes.push(n);
    nodeById[n.id] = n;
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

  /* ---- home positions ---- */
  function layout() {
    const cx = W / 2;
    const cy = H / 2;
    const hub = nodeById.co;
    if (hub) {
      hub.hx = cx;
      hub.hy = cy;
    }
    const depts = nodes.filter((n) => n.tier === 1);

    if (layoutMode === 'web') {
      // departments on an ellipse; leaves fan outward from the CENTRE with a
      // staggered radius, which reads as depth and keeps clusters apart
      const rx1 = W * 0.22;
      const ry1 = H * 0.3;
      const rx2 = W * 0.4;
      const ry2 = H * 0.4;
      depts.forEach((d, i) => {
        const a = -Math.PI / 2 + (i / Math.max(1, depts.length)) * TAU;
        d.hx = cx + Math.cos(a) * rx1;
        d.hy = cy + Math.sin(a) * ry1;
        d.angle = a;
      });
      depts.forEach((d) => {
        const leaves = nodes.filter((n) => n.parent === d.id);
        leaves.forEach((l, j) => {
          const a = (d.angle ?? 0) + (j - (leaves.length - 1) / 2) * 0.3;
          const depth = 1 + (j % 2) * 0.2;
          l.hx = cx + Math.cos(a) * rx2 * depth;
          l.hy = cy + Math.sin(a) * ry2 * depth;
        });
      });
    } else {
      // departments on an ellipse by appearance order; leaves fan around
      // their own parent, so a cluster arrives as one readable shape
      const rx1 = W * 0.26;
      const ry1 = H * 0.3;
      const rx2 = W * 0.19;
      const ry2 = H * 0.2;
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
    }

    nodes.forEach((n) => {
      if (n.x === 0 && n.y === 0) {
        n.x = n.hx;
        n.y = n.hy;
      }
    });
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
    // with nothing focused the camera sits at the centre of the box
    if (!focusNode) {
      cam.x = cam.xT = W / 2;
      cam.y = cam.yT = H / 2;
    }
    return true;
  }

  /* ---- thoughts ---- */
  function excite(n: BrainNode, amt: number) {
    n.ex = clamp(n.ex + amt, 0, 1.4);
    if (amt >= 0.5) ripples.push({ x: n.x, y: n.y, col: GROUPS[n.group] || '#91d45f', t: 0, r0: nodeR(n) });
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
    const leaves = nodes.filter((n) => n.tier === 2);
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
      .filter((n) => n.tier === 2)
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
    if (nodeById.co) nodeById.co.label = label || 'Your company';
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
    if (!n || !opts.onOpenNode) return;
    if (n.tier === 0) {
      // the hub is home — tapping it backs all the way out
      clearFocus();
      fireThought(n);
      return;
    }
    focusNode = n;
    cam.zT = n.tier === 1 ? 1.9 : 2.3;
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
      color: GROUPS[n.group] || '#91d45f',
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
    cam.xT = W / 2;
    cam.yT = H / 2;
    cam.zT = 1;
    cam.fogT = 0;
    start(); // the loop may have idled out while the page was up
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
      // it was a tap: open its page where that's wired up, else just think
      if (opts.onOpenNode) openNode(dragNode);
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
    // camera + fog follow the focused node
    if (focusNode) {
      cam.xT = focusNode.x;
      cam.yT = focusNode.y;
    }
    const k = 1 - Math.exp(-6.5 * dt);
    cam.x += (cam.xT - cam.x) * k;
    cam.y += (cam.yT - cam.y) * k;
    cam.z += (cam.zT - cam.z) * k;
    cam.fog += (cam.fogT - cam.fog) * k;
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
        g.addColorStop(0, hexA(GROUPS[a.group] || '#91d45f', (0.05 + a.ex * 0.3 + lit * 0.08) * vis));
        g.addColorStop(1, hexA(GROUPS[b.group] || '#91d45f', (0.05 + b.ex * 0.3 + lit * 0.08) * vis));
        ctx.strokeStyle = g;
      } else {
        ctx.strokeStyle = hexA(GROUPS[a.group] || '#91d45f', 0.05 * vis);
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
      tg.addColorStop(0, hexA('#b4e88a', 0));
      tg.addColorStop(1, hexA('#b4e88a', 0.6 * fade));
      ctx.strokeStyle = tg;
      ctx.lineWidth = 2 * S;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
      const hg = ctx.createRadialGradient(x, y, 0, x, y, 7 * S);
      hg.addColorStop(0, hexA('#eafbdc', 0.95 * fade));
      hg.addColorStop(1, hexA('#91d45f', 0));
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
      const col = GROUPS[n.group] || '#91d45f';
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
        hg.addColorStop(0, hexA(live ? '#91d45f' : col, (0.05 + glow * 0.16) * n.rev));
        hg.addColorStop(1, hexA(col, 0));
        ctx.fillStyle = hg;
        ctx.beginPath();
        ctx.arc(n.x, n.y, haloR, 0, TAU);
        ctx.fill();
      }

      // core — lighter centre for a lit look; flat fill for resting leaves
      const base = (hub ? 0.98 : n.tier === 1 ? 0.73 : 0.48) * n.rev;
      if (n.tier === 2 && n.ex < 0.02) {
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
        ctx.strokeStyle = hexA('#eafbdc', 0.6 * n.rev);
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

      // label
      const lAlpha = clamp(
        ((hub ? 0.9 : n.tier === 1 ? 0.58 : 0.34) + n.ex * 0.7 + breath * 0.4) * n.rev,
        0,
        1,
      );
      const size = (hub ? 12.7 : n.tier === 1 ? 11.2 : 10) * clamp(S, 0.9, 1.22);
      ctx.font = `${hub ? 600 : 500} ${size}px "Inter Tight", system-ui, sans-serif`;
      ctx.fillStyle = hexA(n.tier === 2 ? '#c7ccd4' : '#f3f4f6', lAlpha * fogOf(n));
      ctx.fillText(n.label, n.x, n.y + r + 3 * S);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
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
