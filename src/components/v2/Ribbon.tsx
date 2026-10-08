import { useEffect, useRef, type CSSProperties } from "react";

const COLORS = [
  [47, 107, 255],
  [107, 61, 255],
  [225, 58, 212],
  [255, 140, 90],
];

/** Slow-moving gradient ribbons drawn on a low-res canvas; CSS blurs it into a glow. */
export function Ribbon({ style }: { style?: CSSProperties }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let visible = true;

    const size = () => {
      const box = canvas.getBoundingClientRect();
      if (!box.width) return;
      canvas.width = Math.round(box.width / 3);
      canvas.height = Math.round(box.height / 3);
    };

    const draw = (t: number) => {
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 4; i++) {
        const a = COLORS[i];
        const b = COLORS[(i + 1) % 4];
        const g = ctx.createLinearGradient(0, 0, W, 0);
        g.addColorStop(0, `rgba(${a},0)`);
        g.addColorStop(0.35, `rgba(${a},.55)`);
        g.addColorStop(0.7, `rgba(${b},.6)`);
        g.addColorStop(1, `rgba(${b},.1)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        const base = H * (0.28 + i * 0.12);
        const amp = H * (0.12 + i * 0.02);
        const speed = 0.00022 * (i + 1.4);
        const phase = i * 1.7;
        for (let px = 0; px <= W; px += 8) {
          const u = px / W;
          const y =
            base +
            Math.sin(u * 4.2 + t * speed + phase) * amp +
            Math.sin(u * 9 + t * speed * 1.7 + phase) * amp * 0.3 -
            u * H * 0.22;
          if (px) ctx.lineTo(px, y);
          else ctx.moveTo(px, y);
        }
        for (let px = W; px >= 0; px -= 8) {
          const u = px / W;
          ctx.lineTo(px, base + H * 0.16 + Math.sin(u * 3.4 + t * speed * 1.3 + phase + 1) * amp * 0.9 - u * H * 0.2);
        }
        ctx.closePath();
        ctx.fill();
      }
    };

    const loop = (t: number) => {
      if (visible) draw(t);
      raf = requestAnimationFrame(loop);
    };

    size();
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    io.observe(canvas);
    window.addEventListener("resize", size);
    if (reduced) draw(4000);
    else raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener("resize", size);
    };
  }, []);

  return <canvas ref={ref} className="ribbon" style={style} aria-hidden="true" />;
}
