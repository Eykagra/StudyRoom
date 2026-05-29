import { useEffect, useRef } from 'react';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

// Lightweight confetti — pure CSS + JS, no library needed
function Confetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const colors = ['#6366f1', '#8b5cf6', '#a78bfa', '#34d399', '#fbbf24', '#f472b6'];
    const pieces = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * -canvas.height,
      w: Math.random() * 8 + 4,
      h: Math.random() * 4 + 2,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 2,
      vy: Math.random() * 3 + 1.5,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15,
      opacity: 1,
    }));

    let frame;
    let tick = 0;

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      tick++;
      pieces.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.angle += p.spin;
        if (tick > 80) p.opacity = Math.max(0, p.opacity - 0.012);

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });

      if (pieces.some((p) => p.opacity > 0)) {
        frame = requestAnimationFrame(draw);
      }
    }

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
}

export default function SessionEndModal({ durationSeconds, onDismiss }) {
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="relative card w-full max-w-sm text-center overflow-hidden py-10">
        <Confetti />

        {/* Content sits above canvas */}
        <div className="relative z-10">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-xl font-semibold text-zinc-100 mb-1">Session complete!</h2>
          <p className="text-muted text-sm mb-6">You studied for</p>

          <div className="inline-block bg-surface-2 border border-border rounded-xl px-8 py-4 mb-8">
            <p className="text-3xl font-semibold text-accent tabular-nums">
              {formatDuration(durationSeconds)}
            </p>
          </div>

          <p className="text-xs text-zinc-500 mb-6">
            {durationSeconds >= 3600
              ? 'Incredible focus. You crushed it.'
              : durationSeconds >= 1800
              ? 'Solid session. Keep the momentum going.'
              : durationSeconds >= 600
              ? 'Good work. Every minute counts.'
              : 'A start is a start. Keep going!'}
          </p>

          <button onClick={onDismiss} className="btn-primary px-8">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
