import React, { useEffect, useRef } from 'react';

type LayerConfig = {
  depth: number;
  speed: number;
  fontSize: number;
  opacity: number;
  blur: number;
  warpChance: number;
};

type RainColumn = {
  x: number;
  y: number;
  speed: number;
  length: number;
};

interface MatrixRainCanvasProps {
  active?: boolean;
}

const glyphs =
  '\u30a2\u30a6\u30a8\u30aa\u30ab\u30ad\u30af\u30b1\u30b3\u30b5\u30b7\u30b9\u30bb\u30bd\u30bf\u30c1\u30c4\u30c6\u30c8' +
  '\u30ca\u30cb\u30cc\u30cd\u30ce\u30cf\u30d2\u30d5\u30d8\u30db\u30de\u30df\u30e0\u30e1\u30e2\u30e4\u30e6\u30e8\u30e9' +
  '\u30ea\u30eb\u30ec\u30ed\u30ef\u30f0\u30f1\u30f2\u30f3' +
  'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$%#/+=<>!';

const layers: LayerConfig[] = [
  { depth: 0.35, speed: 70, fontSize: 12, opacity: 0.45, blur: 1.2, warpChance: 0.02 },
  { depth: 0.6, speed: 110, fontSize: 14, opacity: 0.65, blur: 1.8, warpChance: 0.04 },
  { depth: 0.95, speed: 170, fontSize: 18, opacity: 0.95, blur: 2.6, warpChance: 0.06 },
];

const MatrixRainCanvas: React.FC<MatrixRainCanvasProps> = ({ active = true }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    let isVisible = true;
    let lastTime = performance.now();
    const rainLayers: { config: LayerConfig; columns: RainColumn[] }[] = [];
    const dpr = Math.min(window.devicePixelRatio || 1, 1.8);

    const pickGlyph = () => glyphs.charAt(Math.floor(Math.random() * glyphs.length));

    const createColumns = (layer: LayerConfig, width: number, height: number) => {
      const streamGap = layer.fontSize * 1.1;
      const count = Math.floor(width / streamGap);
      const columns: RainColumn[] = [];
      for (let i = 0; i < count; i++) {
        columns.push({
          x: i * streamGap + Math.random() * 4,
          y: Math.random() * height,
          speed: layer.speed * (0.6 + Math.random() * 0.8),
          length: Math.floor(6 + Math.random() * 18),
        });
      }
      return columns;
    };

    const resize = () => {
      const { clientWidth, clientHeight } = container;
      canvas.width = clientWidth * dpr;
      canvas.height = clientHeight * dpr;
      canvas.style.width = `${clientWidth}px`;
      canvas.style.height = `${clientHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      rainLayers.length = 0;
      layers.forEach((layer) => {
        rainLayers.push({
          config: layer,
          columns: createColumns(layer, clientWidth, clientHeight),
        });
      });
    };

    const drawLayer = (layerConfig: LayerConfig, columns: RainColumn[], deltaSeconds: number, width: number, height: number) => {
      ctx.font = `${layerConfig.fontSize}px 'Share Tech Mono', monospace`;
      ctx.textBaseline = 'top';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.8)';
      ctx.shadowBlur = 8 * layerConfig.depth + layerConfig.blur * 2;

      for (const column of columns) {
        column.y += column.speed * deltaSeconds;

        if (Math.random() < layerConfig.warpChance * deltaSeconds * 60) {
          column.y += column.speed * 8 * deltaSeconds;
        }

        if (column.y > height + column.length * layerConfig.fontSize) {
          column.y = -Math.random() * 200;
        }

        const streamHeight = column.length * layerConfig.fontSize * 1.05;
        if (column.y - streamHeight > height) continue;

        for (let i = 0; i < column.length; i++) {
          const y = column.y - i * layerConfig.fontSize * 1.05;
          if (y < -40 || y > height + 40) continue;

          const head = i === 0;
          const alpha = Math.max(0.05, (1 - i / column.length) * layerConfig.opacity);
          const glow = head ? alpha * 1.2 : alpha * 0.8;

          ctx.fillStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.shadowColor = `rgba(56, 189, 248, ${glow})`;
          ctx.fillText(pickGlyph(), column.x, y);
        }
      }
    };

    const render = (now: number) => {
      if (!active || !isVisible) return;
      const { clientWidth, clientHeight } = container;
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fillRect(0, 0, clientWidth, clientHeight);

      rainLayers.forEach((layer) => drawLayer(layer.config, layer.columns, deltaSeconds, clientWidth, clientHeight));

      // Gentle oscillation to imply depth without following cursor
      const tiltX = Math.sin(now / 4500) * 3.5;
      const tiltY = Math.cos(now / 5200) * 4.5;
      container.style.setProperty('--tiltX', `${tiltX.toFixed(2)}deg`);
      container.style.setProperty('--tiltY', `${tiltY.toFixed(2)}deg`);

      animationFrameId = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      isVisible = document.visibilityState === 'visible';
      if (isVisible && active) {
        lastTime = performance.now();
        animationFrameId = requestAnimationFrame(render);
      }
    };

    resize();
    animationFrameId = requestAnimationFrame(render);

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [active]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full pointer-events-none [transform-style:preserve-3d]"
      style={{
        transform: 'perspective(1200px) rotateX(var(--tiltX, 6deg)) rotateY(var(--tiltY, -4deg)) scale(1.05)',
        filter: 'drop-shadow(0 0 8px rgba(56, 189, 248, 0.25))',
      }}
    >
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/30" />
    </div>
  );
};

export default MatrixRainCanvas;
