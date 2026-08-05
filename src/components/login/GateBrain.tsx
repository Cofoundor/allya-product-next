'use client';

/* ============================================================
   The brain behind the gate.

   The workspace brain in lib/brain.ts carries a camera, focus, drag,
   springs and a label de-overlap pass — everything a surface you can
   walk into needs, and all of it visible in how it draws. The gate
   needs none of it: it is purely ambient, sits behind a dark well,
   and is never touched except in passing.

   So this is the vanilla gate's own engine, ported as-is from
   product/login.js — a hub, five departments, their topics. It drifts,
   fires a thought along its edges now and then, and lights up under
   the pointer. Keep it in step with that file, not with brain.ts.
   ============================================================ */

import { useEffect, useRef } from 'react';

export interface GateNodeSpec {
  id: string;
  label: string;
  tier: number;
  group: string;
  parent?: string | null;
}

const GROUPS: Record<string, string> = {
  core: '#91d45f',
  product: '#91d45f',
  market: '#6f9fd8',
  traction: '#5fbfa8',
  model: '#d9a441',
  team: '#a78bda',
};

const TAU = Math.PI * 2;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

interface Node extends GateNodeSpec {
  x: number;
  y: number;
  hx: number;
  hy: number;
  vx: number;
  vy: number;
  /** excitement 0..1.4 — hover, or an arriving thought */
  ex: number;
  phase: number;
  /** the ring angle this node's parent sits at */
  a?: number;
}

interface Pulse {
  a: Node;
  b: Node;
  delay: number;
  t: number;
  dur: number;
}

interface Props {
  nodes: GateNodeSpec[];
  cross: [string, string][];
}

export default function GateBrain({ nodes: spec, cross }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // read once — the graph is built at mount and never re-seeded
  const specRef = useRef({ spec, cross });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { spec, cross } = specRef.current;
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let W = 0;
    let H = 0;
    let S = 1;
    let dpr = 1;
    const nodes: Node[] = [];
    const byId: Record<string, Node> = {};
    const edges: [string, string][] = [];

    spec.forEach((s) => {
      const n: Node = { ...s, x: 0, y: 0, hx: 0, hy: 0, vx: 0, vy: 0, ex: 0, phase: Math.random() * TAU };
      nodes.push(n);
      byId[n.id] = n;
      if (s.parent) edges.push([s.parent, s.id]);
    });
    cross.forEach(([a, b]) => edges.push([a, b]));

    const R: Record<number, number> = { 0: 7, 1: 4.6, 2: 3 };
    const nodeR = (n: Node) => R[n.tier] * S * (1 + n.ex * 0.5);

    function resize() {
      const w = innerWidth;
      const h = innerHeight;
      if (!w || !h) return false;
      dpr = Math.min(devicePixelRatio || 1, 1.5);
      W = w;
      H = h;
      S = clamp(Math.min(W, H) / 300, 0.9, 1.9);
      canvas!.width = W * dpr;
      canvas!.height = H * dpr;
      canvas!.style.width = W + 'px';
      canvas!.style.height = H + 'px';
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      layout();
      return true;
    }

    /* the hub sits centre; departments ring it wide enough that the gate's
       dark well falls between the hub and the leaves */
    function layout() {
      const cx = W / 2;
      const cy = H / 2;
      const rx1 = W * 0.3;
      const ry1 = H * 0.26;
      const rx2 = W * 0.16;
      const ry2 = H * 0.17;
      byId.co.hx = cx;
      byId.co.hy = cy;
      const t1 = nodes.filter((n) => n.tier === 1);
      t1.forEach((d, i) => {
        const a = -Math.PI / 2 + (i / t1.length) * TAU;
        d.hx = cx + Math.cos(a) * rx1;
        d.hy = cy + Math.sin(a) * ry1;
        d.a = a;
      });
      t1.forEach((d) => {
        const leaves = nodes.filter((n) => n.parent === d.id);
        const gap = leaves.length > 3 ? 0.42 : 0.62;
        leaves.forEach((l, j) => {
          const a = d.a! + (j - (leaves.length - 1) / 2) * gap;
          l.hx = d.hx + Math.cos(a) * rx2;
          l.hy = d.hy + Math.sin(a) * ry2;
        });
      });
      if (!nodes[0].x) nodes.forEach((n) => ((n.x = n.hx), (n.y = n.hy)));
    }

    let pulses: Pulse[] = [];
    let clock = 0;
    const excite = (n: Node, a: number) => {
      n.ex = clamp(n.ex + a, 0, 1.4);
    };
    function fireThought(target?: Node) {
      const leaves = nodes.filter((n) => n.tier === 2);
      const t = target || leaves[(Math.random() * leaves.length) | 0];
      const path: Node[] = [];
      let c: Node | null = t;
      while (c) {
        path.push(c);
        c = c.parent ? byId[c.parent] : null;
      }
      path.reverse();
      for (let i = 0; i < path.length - 1; i++) {
        pulses.push({ a: path[i], b: path[i + 1], delay: i * 0.15, t: 0, dur: 0.55 + Math.random() * 0.25 });
      }
    }

    function sim(dt: number) {
      const time = performance.now() / 1000;
      for (const n of nodes) {
        const amp = n.tier === 0 ? 1.6 : 4.5;
        const tx = n.hx + Math.sin(time * 0.5 + n.phase) * amp;
        const ty = n.hy + Math.cos(time * 0.42 + n.phase) * amp;
        n.vx += (tx - n.x) * 32 * dt;
        n.vy += (ty - n.y) * 32 * dt;
      }
      for (const [aid, bid] of edges) {
        const a = byId[aid];
        const b = byId[bid];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const rest = Math.hypot(b.hx - a.hx, b.hy - a.hy);
        const f = (d - rest) * 9;
        const ux = dx / d;
        const uy = dy / d;
        a.vx += ux * f * dt;
        a.vy += uy * f * dt;
        b.vx -= ux * f * dt;
        b.vy -= uy * f * dt;
      }
      const fr = Math.exp(-5.2 * dt);
      for (const n of nodes) {
        n.vx *= fr;
        n.vy *= fr;
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        n.ex = Math.max(0, n.ex - dt * 1.1);
      }
    }

    function hexA(hex: string, a: number) {
      const h = hex.replace('#', '');
      return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${clamp(a, 0, 1)})`;
    }
    function lighten(hex: string) {
      const h = hex.replace('#', '');
      const m = (c: number) => Math.round(c + (255 - c) * 0.4);
      const hx = (c: number) => m(c).toString(16).padStart(2, '0');
      return `#${hx(parseInt(h.slice(0, 2), 16))}${hx(parseInt(h.slice(2, 4), 16))}${hx(parseInt(h.slice(4, 6), 16))}`;
    }

    function draw() {
      const c = ctx!;
      c.clearRect(0, 0, W, H);
      for (const [aid, bid] of edges) {
        const a = byId[aid];
        const b = byId[bid];
        const lit = Math.max(a.ex, b.ex);
        c.strokeStyle = lit > 0.03 ? hexA(GROUPS[a.group], 0.06 + lit * 0.22) : hexA(GROUPS[a.group], 0.06);
        c.lineWidth = (0.8 + lit) * S;
        c.beginPath();
        c.moveTo(a.x, a.y);
        c.lineTo(b.x, b.y);
        c.stroke();
      }
      for (const s of pulses) {
        if (s.delay > 0) continue;
        const t = clamp(s.t, 0, 1);
        const x = s.a.x + (s.b.x - s.a.x) * t;
        const y = s.a.y + (s.b.y - s.a.y) * t;
        const fade = Math.sin(t * Math.PI);
        const g = c.createRadialGradient(x, y, 0, x, y, 7 * S);
        g.addColorStop(0, hexA('#eafbdc', 0.9 * fade));
        g.addColorStop(1, hexA('#91d45f', 0));
        c.fillStyle = g;
        c.beginPath();
        c.arc(x, y, 7 * S, 0, TAU);
        c.fill();
      }
      c.textAlign = 'center';
      c.textBaseline = 'top';
      for (const n of nodes) {
        const col = GROUPS[n.group];
        const hub = n.tier === 0;
        const r = nodeR(n);
        const glow = (hub ? 1 : 0) + n.ex;
        if (hub || glow > 0.03) {
          const hr = r + (hub ? 22 : 10) * S + n.ex * 12 * S;
          const g = c.createRadialGradient(n.x, n.y, 0, n.x, n.y, hr);
          g.addColorStop(0, hexA(col, 0.05 + glow * 0.15));
          g.addColorStop(1, hexA(col, 0));
          c.fillStyle = g;
          c.beginPath();
          c.arc(n.x, n.y, hr, 0, TAU);
          c.fill();
        }
        const base = hub ? 0.95 : n.tier === 1 ? 0.7 : 0.46;
        c.fillStyle = n.ex > 0.02 ? hexA(lighten(col), clamp(base + n.ex * 0.5, 0, 1)) : hexA(col, base);
        c.beginPath();
        c.arc(n.x, n.y, r, 0, TAU);
        c.fill();

        const lA = clamp((hub ? 0.9 : n.tier === 1 ? 0.6 : 0.42) + n.ex * 0.7, 0, 1);
        c.font = `${hub ? 600 : 500} ${(hub ? 13 : n.tier === 1 ? 11.5 : 10) * clamp(S, 0.9, 1.25)}px "Inter Tight", system-ui, sans-serif`;
        c.fillStyle = hexA(n.tier === 2 ? '#c7ccd4' : '#f3f4f6', lA);
        c.fillText(n.label, n.x, n.y + r + 3 * S);
      }
    }

    // hover lights a node up — the graph stays touchable around the gate
    const onPointerMove = (e: PointerEvent) => {
      let best: Node | null = null;
      let bd = 1e9;
      for (const n of nodes) {
        const d = Math.hypot(e.clientX - n.x, e.clientY - n.y);
        if (d < nodeR(n) + 16 && d < bd) {
          best = n;
          bd = d;
        }
      }
      if (best && best.ex < 0.3) {
        excite(best, 0.7);
        if (best.parent) fireThought(best);
      }
    };

    let raf = 0;
    let last = 0;
    let probeAt = 0;
    function frame(now: number) {
      raf = requestAnimationFrame(frame);
      // a size probe twice a second — a resize that lands before this runs
      // (or an orientation change) never reaches the listener below
      if (now >= probeAt) {
        probeAt = now + 500;
        if (W !== innerWidth || H !== innerHeight) resize();
      }
      if (now - last < 33) return;
      let dt = (now - last) / 1000;
      last = now;
      if (dt > 0.08) dt = 0.08;
      sim(dt);
      clock += dt;
      if (clock > 2.8) {
        clock = 0;
        fireThought();
      }
      for (const s of pulses) {
        if (s.delay > 0) s.delay -= dt;
        else s.t += dt / s.dur;
      }
      pulses = pulses.filter((s) => s.t < 1);
      draw();
    }
    function start() {
      if (!resize()) {
        raf = requestAnimationFrame(start);
        return;
      }
      if (reduceMotion) {
        draw();
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const onResize = () => {
      if (resize() && reduceMotion) draw();
    };
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf && !reduceMotion) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    addEventListener('pointermove', onPointerMove, { passive: true });
    addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    start();

    /* dev handle, mirroring the vanilla page's window.__loginBrain — a preview
       tab throttles rAF to zero, so timed motion can only be stepped */
    const handle = {
      fireThought,
      resize,
      draw,
      get nodeCount() {
        return nodes.length;
      },
      tickOnce(frames = 60, dt = 1 / 30) {
        for (let i = 0; i < frames; i++) sim(dt);
        draw();
      },
    };
    if (process.env.NODE_ENV !== 'production') {
      (window as unknown as { __loginBrain?: typeof handle }).__loginBrain = handle;
    }

    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('pointermove', onPointerMove);
      removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas id="brain" ref={canvasRef} aria-hidden="true" />;
}
