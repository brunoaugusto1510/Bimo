// Bimo knowledge-graph field. Ambient mode = drifting background (multiply blend, no pointer
// events). Interactive mode = pan/zoom/tap graph for the Gráfico screen. Palette from tokens.
const PALETTE = ["#889299", "#889299", "#889299", "#a0aab2", "#dcd9dc"];
const SIGNAL = "#5e4bc0";
const LINK = "rgba(136,146,153,0.15)";

function GraphField({
  mode = "ambient",
  nodeCount = 90,
  opacity = 0.8,
  pulse = 0,
  grow = 0,
  nodes: named = null,
  selectedId = null,
  onSelect,
  style,
}) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const state = React.useRef({ nodes: [], flows: [], cam: { x: 0, y: 0, s: 1 }, w: 0, h: 0, R: 1, hit: [] });
  const interactive = mode === "interactive";

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const S = state.current;
    let raf;

    const resize = () => {
      S.w = canvas.clientWidth;
      S.h = canvas.clientHeight;
      canvas.width = S.w * dpr;
      canvas.height = S.h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      S.R = Math.min(S.w, S.h) * 0.62;
    };
    resize();

    const spawn = (i, fresh) => {
      const theta = Math.random() * Math.PI * 2;
      const r = (fresh ? 0.25 : Math.pow(Math.random(), 0.6)) * S.R;
      const roll = Math.random();
      return {
        id: "a" + i + "-" + Math.random().toString(36).slice(2, 6),
        x: S.w / 2 + r * Math.cos(theta),
        y: S.h / 2 + r * Math.sin(theta),
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.12,
        size: roll > 0.98 ? 3.2 : roll > 0.9 ? 2 : 1.1,
        color: roll > 0.94 ? SIGNAL : PALETTE[Math.floor(Math.random() * PALETTE.length)],
        born: fresh ? 0 : 1,
      };
    };

    S.nodes = Array.from({ length: nodeCount }, (_, i) => spawn(i, false));
    if (named) {
      S.named = named.map((n) => ({
        ...n,
        px: S.w / 2 + (n.x - 0.5) * S.R * 2.1,
        py: S.h / 2 + (n.y - 0.5) * S.R * 2.1,
        ph: Math.random() * 6.28,
      }));
    }

    let t = 0;
    const draw = () => {
      t += 0.003;
      ctx.clearRect(0, 0, S.w, S.h);
      const cam = S.cam;
      ctx.save();
      ctx.translate(S.w / 2, S.h / 2);
      ctx.scale(cam.s, cam.s);
      ctx.translate(-S.w / 2 + cam.x, -S.h / 2 + cam.y);

      ctx.lineWidth = 1 / cam.s;
      ctx.strokeStyle = LINK;
      const ns = S.nodes;
      for (let i = 0; i < ns.length; i++) {
        const a = ns[i];
        a.x += a.vx;
        a.y += a.vy;
        if (a.born < 1) a.born = Math.min(1, a.born + 0.02);
        const dx = a.x - S.w / 2;
        const dy = a.y - S.h / 2;
        if (Math.hypot(dx, dy) > S.R * 1.1) {
          a.vx *= -1;
          a.vy *= -1;
        }
        let links = 0;
        for (let j = i + 1; j < ns.length && links < 6; j++) {
          const b = ns[j];
          if (Math.hypot(a.x - b.x, a.y - b.y) < S.R * 0.22) {
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
            links++;
          }
        }
      }
      for (const n of ns) {
        ctx.beginPath();
        ctx.globalAlpha = 0.9 * n.born;
        ctx.fillStyle = n.color;
        ctx.arc(n.x, n.y, n.size * (1 + Math.sin(t * 3 + n.size * 9) * 0.06) * (0.4 + 0.6 * n.born), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // named nodes (interactive graph)
      S.hit = [];
      if (S.named) {
        ctx.lineWidth = 1 / cam.s;
        ctx.strokeStyle = "rgba(94,75,192,0.22)";
        for (const n of S.named) {
          for (const lid of n.links || []) {
            const m = S.named.find((o) => o.id === lid);
            if (!m) continue;
            ctx.beginPath();
            ctx.moveTo(n.px, n.py + Math.sin(t * 2 + n.ph) * 3);
            ctx.lineTo(m.px, m.py + Math.sin(t * 2 + m.ph) * 3);
            ctx.stroke();
          }
        }
        for (const n of S.named) {
          const y = n.py + Math.sin(t * 2 + n.ph) * 3;
          const on = n.id === selectedId;
          const r = (n.weight || 1) * 5.5;
          ctx.beginPath();
          ctx.fillStyle = on ? SIGNAL : "#fcf8fb";
          ctx.strokeStyle = on ? SIGNAL : "#6e7a6f";
          ctx.lineWidth = 1 / cam.s;
          ctx.arc(n.px, y, r, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
          if (on) {
            ctx.beginPath();
            ctx.strokeStyle = "rgba(94,75,192,0.35)";
            ctx.arc(n.px, y, r + 7 + Math.sin(t * 20) * 2, 0, Math.PI * 2);
            ctx.stroke();
          }
          if (on || (n.weight || 1) >= 1.2) {
            ctx.font = `500 ${11 / cam.s + 1}px Geist, system-ui, sans-serif`;
            ctx.fillStyle = on ? "#1b1b1d" : "#3e4a40";
            ctx.textAlign = "center";
            ctx.fillText(n.label, n.px, y + r + 14);
          }
          S.hit.push({ id: n.id, x: n.px, y: y, r: r + 10 });
        }
      }

      const flows = S.flows;
      for (let i = flows.length - 1; i >= 0; i--) {
        const f = flows[i];
        f.p += f.speed;
        if (f.p >= 1) {
          flows.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.fillStyle = SIGNAL;
        ctx.globalAlpha = 1 - Math.abs(f.p - 0.5);
        ctx.arc(f.a.x + (f.b.x - f.a.x) * f.p, f.a.y + (f.b.y - f.a.y) * f.p, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
      raf = requestAnimationFrame(draw);
    };
    draw();
    window.addEventListener("resize", resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [nodeCount, named, selectedId]);

  // reasoning particles
  React.useEffect(() => {
    const S = state.current;
    const ns = S.nodes;
    if (!pulse || !ns.length) return;
    for (let i = 0; i < 8; i++) {
      const a = ns[Math.floor(Math.random() * ns.length)];
      const b = ns[Math.floor(Math.random() * ns.length)];
      S.flows.push({ a, b, p: 0, speed: 0.012 + Math.random() * 0.012 });
    }
  }, [pulse]);

  // new nodes appear as the note grows
  React.useEffect(() => {
    const S = state.current;
    if (!grow || !S.w) return;
    const theta = Math.random() * Math.PI * 2;
    const r = 0.3 * S.R;
    const near = S.nodes[Math.floor(Math.random() * S.nodes.length)];
    S.nodes.push({
      id: "g" + grow,
      x: S.w / 2 + r * Math.cos(theta),
      y: S.h / 2 + r * Math.sin(theta),
      vx: (Math.random() - 0.5) * 0.1,
      vy: (Math.random() - 0.5) * 0.1,
      size: 2,
      color: SIGNAL,
      born: 0,
    });
    if (near) S.flows.push({ a: near, b: S.nodes[S.nodes.length - 1], p: 0, speed: 0.02 });
  }, [grow]);

  // pan / zoom / tap
  const drag = React.useRef(null);
  const handlers = interactive
    ? {
        onPointerDown: (e) => {
          drag.current = { x: e.clientX, y: e.clientY, moved: 0, cam: { ...state.current.cam } };
          e.currentTarget.setPointerCapture(e.pointerId);
        },
        onPointerMove: (e) => {
          const d = drag.current;
          if (!d) return;
          const dx = e.clientX - d.x;
          const dy = e.clientY - d.y;
          d.moved = Math.max(d.moved, Math.hypot(dx, dy));
          const S = state.current;
          S.cam.x = d.cam.x + dx / S.cam.s;
          S.cam.y = d.cam.y + dy / S.cam.s;
        },
        onPointerUp: (e) => {
          const d = drag.current;
          drag.current = null;
          if (!d || d.moved > 6) return;
          const S = state.current;
          const rect = wrapRef.current.getBoundingClientRect();
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          const wx = (mx - S.w / 2) / S.cam.s + S.w / 2 - S.cam.x;
          const wy = (my - S.h / 2) / S.cam.s + S.h / 2 - S.cam.y;
          const found = S.hit.find((h) => Math.hypot(h.x - wx, h.y - wy) < h.r);
          onSelect && onSelect(found ? found.id : null);
        },
        onWheel: (e) => {
          e.preventDefault();
          const S = state.current;
          S.cam.s = Math.max(0.6, Math.min(2.4, S.cam.s * (e.deltaY < 0 ? 1.08 : 0.93)));
        },
      }
    : {};

  return (
    <div
      ref={wrapRef}
      {...handlers}
      style={{
        position: "absolute",
        inset: 0,
        touchAction: interactive ? "none" : undefined,
        cursor: interactive ? "grab" : undefined,
        pointerEvents: interactive ? "auto" : "none",
        mixBlendMode: interactive ? undefined : "multiply",
        opacity: interactive ? 1 : opacity,
        ...style,
      }}
    >
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
    </div>
  );
}

window.GraphField = GraphField;
