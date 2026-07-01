import React, { useEffect, useRef } from 'react';

interface Point {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
}

interface TransferArtProps {
  progress: number; // 0 to 100
  speed: number;    // bytes per second
  className?: string;
}

export const TransferArt: React.FC<TransferArtProps> = ({ progress, speed, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });
  const pointsRef = useRef<Point[]>([]);
  const requestRef = useRef<number | null>(null);

  // Initialize points
  useEffect(() => {
    const points: Point[] = [];
    const count = 40;
    for (let i = 0; i < count; i++) {
      points.push({
        x: Math.random() * 800,
        y: Math.random() * 200,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 2 + 1,
      });
    }
    pointsRef.current = points;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const handleResize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const points = pointsRef.current;
      const mouse = mouseRef.current;
      
      // Speed multiplier based on transfer speed (normalized roughly)
      // 1MB/s = 1.0 multiplier, 10MB/s = 2.0 multiplier, etc.
      const speedMult = Math.min(3, 1 + speed / 10_000_000);
      
      // Color based on progress
      const hue = 260 + (progress / 100) * 40; // Shift from purple to pink-ish
      const color = `hsla(${hue}, 70%, 60%,`;

      // Update and draw points
      for (let i = 0; i < points.length; i++) {
        const p = points[i];

        // Move
        p.x += p.vx * speedMult;
        p.y += p.vy * speedMult;

        // Bounce
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        // Mouse interaction
        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80) {
          const force = (80 - dist) / 80;
          p.x += (dx / dist) * force * 2;
          p.y += (dy / dist) * force * 2;
        }

        // Draw point
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `${color} 0.5)`;
        ctx.fill();

        // Draw lines
        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j];
          const dx2 = p.x - p2.x;
          const dy2 = p.y - p2.y;
          const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

          if (dist2 < 100) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `${color} ${0.2 * (1 - dist2 / 100)})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [progress, speed]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    }
  };

  const handleMouseLeave = () => {
    mouseRef.current = { x: -1000, y: -1000 };
  };

  return (
    <div className={`relative w-full h-32 mb-4 overflow-hidden rounded-2xl bg-white/5 border border-white/10 ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full cursor-crosshair"
      />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="text-[10px] uppercase tracking-[0.2em] text-white/20 font-bold">
          Data Stream Visualization
        </div>
      </div>
    </div>
  );
};
