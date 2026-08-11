import { useEffect, useRef } from "react";

/**
 * Ambient "command center" backdrop: purple radial glow, masked grid,
 * drifting particles, a cursor aura brush and a film-grain overlay.
 * Mounted once at the root so every page inherits the aesthetic.
 */
export function WowBackground() {
  const auraRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // cursor aura (lerped follow)
  useEffect(() => {
    const el = auraRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let tx = window.innerWidth / 2;
    let ty = window.innerHeight / 2;
    let x = tx;
    let y = ty;
    let raf = 0;
    const onMove = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
    const loop = () => {
      x += (tx - x) * 0.12;
      y += (ty - y) * 0.12;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      raf = requestAnimationFrame(loop);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    raf = requestAnimationFrame(loop);
    return () => { window.removeEventListener("mousemove", onMove); cancelAnimationFrame(raf); };
  }, []);

  // particle field
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.innerWidth < 720) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    type P = { x: number; y: number; vx: number; vy: number; r: number; a: number; hue: number };
    let particles: P[] = [];

    const seed = () => {
      const count = Math.min(72, Math.round((w * h) / 26000));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.16,
        vy: -0.05 - Math.random() * 0.16,
        r: 0.6 + Math.random() * 1.8,
        a: 0.12 + Math.random() * 0.4,
        hue: Math.random() > 0.5 ? 276 : 300,
      }));
    };

    const resize = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    };

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -12) { p.y = h + 12; p.x = Math.random() * w; }
        if (p.x < -12) p.x = w + 12;
        if (p.x > w + 12) p.x = -12;
        ctx.beginPath();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 78%, ${p.a})`;
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener("resize", resize);
    raf = requestAnimationFrame(tick);
    return () => { window.removeEventListener("resize", resize); cancelAnimationFrame(raf); };
  }, []);

  return (
    <>
      <div className="wow-glow" aria-hidden />
      <div className="wow-grid" aria-hidden />
      <canvas id="wow-particles" ref={canvasRef} aria-hidden />
      <div className="wow-aura" ref={auraRef} aria-hidden />
      <div className="wow-noise" aria-hidden />
    </>
  );
}
