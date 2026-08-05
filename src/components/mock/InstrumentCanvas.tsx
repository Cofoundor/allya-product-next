'use client';

import { useEffect, useRef } from 'react';
import type { Instrument, InstrumentItem } from '@/lib/api/types';

/* ============================================================
   The instrument — a floor's graph where position carries meaning.

   Same canvas for all five; the type decides what x, y and radius are
   made of. That's the whole idea: you should be able to read the state
   of a service from the shape before you read a single word.
   ============================================================ */

export interface Placed extends InstrumentItem {
  x: number;
  y: number;
  r: number;
}

const STATE_ALPHA: Record<string, number> = {
  'needs-you': 1,
  running: 0.78,
  scheduled: 0.6,
  shipped: 0.5,
  active: 0.8,
  idle: 0.3,
};

/** where each item sits, in 0..1 of the box — the encoding, per type */
export function place(inst: Instrument): Placed[] {
  const items = inst.items;
  const maxV = Math.max(1, ...items.map((i) => i.value));
  const lanes = Math.max(1, inst.lanes.length);

  return items.map((it, idx) => {
    const rel = it.value / maxV;
    switch (inst.type) {
      case 'timeline': {
        // x is when, y is the channel
        return { ...it, x: 0.08 + ((it.at + 1) / 2) * 0.84, y: (it.lane + 0.5) / lanes, r: 4 + rel * 7 };
      }
      case 'funnel': {
        // y is the stage; the band narrows as it goes down
        const t = it.at / Math.max(1, lanes - 1);
        const width = 0.72 - t * 0.44;
        const seen = items.filter((o) => o.at === it.at);
        const i = seen.indexOf(it);
        const spread = seen.length > 1 ? (i / (seen.length - 1) - 0.5) * width : 0;
        return { ...it, x: 0.5 + spread, y: 0.12 + t * 0.74, r: 5 + Math.sqrt(rel) * 22 };
      }
      case 'ladder': {
        // a column per role, rungs going up
        const t = it.at / 3;
        return { ...it, x: (it.lane + 0.5) / lanes, y: 0.86 - t * 0.68, r: 5 + Math.sqrt(rel) * 12 };
      }
      case 'radar': {
        // distance from the middle is how long since you spoke
        const a = (idx / items.length) * Math.PI * 2 - Math.PI / 2;
        const rad = 0.06 + it.at * 0.42;
        return { ...it, x: 0.5 + Math.cos(a) * rad, y: 0.5 + Math.sin(a) * rad * 1.5, r: 4 + rel * 6 };
      }
      default: {
        // mass: area is money. Big things centre, small things orbit.
        const a = (idx / items.length) * Math.PI * 2 - Math.PI / 2;
        const rad = 0.1 + (1 - Math.sqrt(rel)) * 0.32;
        return { ...it, x: 0.5 + Math.cos(a) * rad, y: 0.5 + Math.sin(a) * rad * 1.4, r: 8 + Math.sqrt(rel) * 40 };
      }
    }
  });
}

export function InstrumentCanvas({
  inst,
  accent,
  onPick,
  picked,
}: {
  inst: Instrument;
  accent: string;
  onPick: (id: string | null) => void;
  picked: string | null;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<Placed[]>([]);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    if (!box || !canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;

    const draw = () => {
      const W = box.clientWidth;
      const H = box.clientHeight;
      if (!W || !H) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);

      const pad = 26;
      const put = place(inst).map((p) => ({
        ...p,
        x: pad + p.x * (W - pad * 2),
        y: pad + p.y * (H - pad * 2),
      }));
      hitRef.current = put;

      // ---- the scaffolding that makes position readable ----
      ctx.font = '500 10px "Inter Tight", system-ui, sans-serif';
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.fillStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;

      if (inst.type === 'timeline') {
        inst.lanes.forEach((ln, i) => {
          const y = pad + ((i + 0.5) / inst.lanes.length) * (H - pad * 2);
          ctx.beginPath();
          ctx.moveTo(pad, y);
          ctx.lineTo(W - pad, y);
          ctx.stroke();
          ctx.textAlign = 'left';
          ctx.fillText(ln, pad, y - 8);
        });
        const now = pad + 0.5 * (W - pad * 2);
        ctx.strokeStyle = `${accent}55`;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(now, pad - 10);
        ctx.lineTo(now, H - pad + 6);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.textAlign = 'center';
        ctx.fillStyle = accent;
        ctx.fillText('now', now, pad - 15);
      } else if (inst.type === 'funnel' || inst.type === 'ladder') {
        const n = inst.lanes.length;
        inst.lanes.forEach((ln, i) => {
          if (inst.type === 'funnel') {
            const y = pad + (0.12 + (i / Math.max(1, n - 1)) * 0.74) * (H - pad * 2);
            ctx.beginPath();
            ctx.moveTo(pad, y);
            ctx.lineTo(W - pad, y);
            ctx.stroke();
            ctx.textAlign = 'left';
            ctx.fillText(ln, pad, y - 9);
          } else {
            const x = pad + ((i + 0.5) / n) * (W - pad * 2);
            ctx.beginPath();
            ctx.moveTo(x, pad);
            ctx.lineTo(x, H - pad);
            ctx.stroke();
            ctx.textAlign = 'center';
            ctx.fillText(ln, x, H - pad + 14);
          }
        });
      } else if (inst.type === 'radar') {
        [0.18, 0.32, 0.46].forEach((r, i) => {
          ctx.beginPath();
          ctx.ellipse(W / 2, H / 2, r * (W - pad * 2), r * 1.5 * (H - pad * 2), 0, 0, Math.PI * 2);
          ctx.stroke();
          if (i === 2) {
            ctx.textAlign = 'center';
            ctx.fillText('gone cold', W / 2, H / 2 - r * 1.5 * (H - pad * 2) - 8);
          }
        });
        ctx.fillStyle = accent;
        ctx.textAlign = 'center';
        ctx.fillText('this week', W / 2, H / 2 - 14);
      }

      // ---- the items ----
      for (const p of put) {
        const on = picked === p.id;
        const alpha = STATE_ALPHA[p.state] ?? 0.7;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r + 18);
        g.addColorStop(0, `${accent}${Math.round(alpha * 90).toString(16).padStart(2, '0')}`);
        g.addColorStop(1, `${accent}00`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r + 18, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `${accent}${Math.round(alpha * 255).toString(16).padStart(2, '0')}`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();

        if (p.state === 'needs-you' || on) {
          ctx.strokeStyle = on ? '#ffffff' : accent;
          ctx.lineWidth = on ? 2 : 1.4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        if (p.r > 13 || on || p.state === 'needs-you') {
          ctx.fillStyle = on ? '#f3f4f6' : 'rgba(243,244,246,0.72)';
          ctx.font = `${on ? 600 : 500} 11px "Inter Tight", system-ui, sans-serif`;
          ctx.textAlign = 'center';
          ctx.fillText(p.label, p.x, p.y + p.r + 15);
        }
      }
    };

    draw();
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    window.addEventListener('resize', onResize);

    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const hit = hitRef.current.find((p) => Math.hypot(x - p.x, y - p.y) < p.r + 10);
      canvas.style.cursor = hit ? 'pointer' : 'default';
    };
    const onDown = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const hit = hitRef.current.find((p) => Math.hypot(x - p.x, y - p.y) < p.r + 10);
      onPick(hit ? hit.id : null);
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    // the box is laid out after mount; probe until it has a size
    const probe = setInterval(draw, 500);
    return () => {
      window.removeEventListener('resize', onResize);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
      clearInterval(probe);
      cancelAnimationFrame(raf);
    };
  }, [inst, accent, picked, onPick]);

  return (
    <div className="inst-box" ref={boxRef}>
      <canvas ref={canvasRef} />
    </div>
  );
}
