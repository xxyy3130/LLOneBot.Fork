import React, { useEffect, useRef } from 'react';

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  baseRadius: number;
  scale: number;
  scaleSpeed: number;
  color: string;
  offscreenCanvas?: HTMLCanvasElement;
}

const MAX_SPEED = 1.2;

const AnimatedBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);
  const animationRef = useRef<number>();
  const lastTimeRef = useRef<number>(0);
  // 记录初始视口大小，避免输入法弹出时重新计算
  const initialSizeRef = useRef<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const targetFPS = 30;
    const frameInterval = 1000 / targetFPS;

    // 获取稳定的视口大小（使用 document.documentElement 避免输入法影响）
    const getStableSize = () => {
      // 优先使用初始大小，避免输入法弹出时的抖动
      if (initialSizeRef.current) {
        return initialSizeRef.current;
      }
      // 使用 documentElement 的尺寸，在移动端更稳定
      const width = Math.max(window.innerWidth, document.documentElement.clientWidth);
      const height = Math.max(window.innerHeight, document.documentElement.clientHeight);
      return { width, height };
    };

    const resizeCanvas = () => {
      const size = getStableSize();
      // 只在画布变大时更新，避免输入法弹出时缩小
      if (!initialSizeRef.current || size.width > canvas.width || size.height > canvas.height) {
        canvas.width = size.width;
        canvas.height = size.height;
        if (!initialSizeRef.current) {
          initialSizeRef.current = size;
        }
        ballsRef.current.forEach(ball => {
          ball.offscreenCanvas = createBallCanvas(ball);
        });
      }
    };

    const colors = [
      'rgba(139, 92, 246, 0.6)',
      'rgba(59, 130, 246, 0.6)',
      'rgba(236, 72, 153, 0.6)',
      'rgba(16, 185, 129, 0.6)',
      'rgba(245, 158, 11, 0.6)',
      'rgba(168, 85, 247, 0.6)',
      'rgba(14, 165, 233, 0.6)',
      'rgba(251, 113, 133, 0.6)',
    ];

    const createBallCanvas = (ball: Ball): HTMLCanvasElement => {
      const size = Math.ceil(ball.baseRadius * 2.5);
      const offscreen = document.createElement('canvas');
      offscreen.width = size;
      offscreen.height = size;
      const offCtx = offscreen.getContext('2d');
      if (!offCtx) return offscreen;

      const centerX = size / 2;
      const centerY = size / 2;
      const radius = ball.baseRadius;

      const gradient = offCtx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, ball.color.replace('0.6', '0.8'));
      gradient.addColorStop(0.5, ball.color);
      gradient.addColorStop(1, ball.color.replace('0.6', '0'));

      offCtx.fillStyle = gradient;
      offCtx.beginPath();
      offCtx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      offCtx.fill();

      return offscreen;
    };

    const initBalls = () => {
      const balls: Ball[] = [];
      const numBalls = 8;

      for (let i = 0; i < numBalls; i++) {
        const baseRadius = Math.random() * 80 + 60;
        let x = Math.random() * canvas.width;
        let y = Math.random() * canvas.height;

        let attempts = 0;
        while (attempts < 30) {
          const hasOverlap = balls.some(existing => {
            const dx = x - existing.x;
            const dy = y - existing.y;
            const minDistance = baseRadius + existing.baseRadius;
            return dx * dx + dy * dy < minDistance * minDistance;
          });
          if (!hasOverlap) break;
          x = Math.random() * canvas.width;
          y = Math.random() * canvas.height;
          attempts++;
        }

        const ball: Ball = {
          x,
          y,
          vx: (Math.random() - 0.5) * 0.8,
          vy: (Math.random() - 0.5) * 0.8,
          radius: baseRadius,
          baseRadius: baseRadius,
          scale: 1,
          scaleSpeed: Math.random() * 0.002 + 0.001,
          color: colors[Math.floor(Math.random() * colors.length)],
        };
        ball.offscreenCanvas = createBallCanvas(ball);
        balls.push(ball);
      }
      ballsRef.current = balls;
    };

    const checkCollision = (ball1: Ball, ball2: Ball) => {
      let dx = ball2.x - ball1.x;
      let dy = ball2.y - ball1.y;
      let distance = Math.sqrt(dx * dx + dy * dy);
      const minDistance = ball1.radius + ball2.radius;

      if (distance >= minDistance) return;

      if (distance < 0.0001) {
        const angle = Math.random() * Math.PI * 2;
        dx = Math.cos(angle) * 0.0001;
        dy = Math.sin(angle) * 0.0001;
        distance = 0.0001;
      }

      const nx = dx / distance;
      const ny = dy / distance;

      const overlap = minDistance - distance;
      const correction = overlap * 0.5;
      ball1.x -= nx * correction;
      ball1.y -= ny * correction;
      ball2.x += nx * correction;
      ball2.y += ny * correction;

      const rvx = ball2.vx - ball1.vx;
      const rvy = ball2.vy - ball1.vy;
      const velocityAlongNormal = rvx * nx + rvy * ny;

      if (velocityAlongNormal > 0) return;

      const restitution = 0.9;
      const impulse = -(1 + restitution) * velocityAlongNormal / 2;
      const impulseX = impulse * nx;
      const impulseY = impulse * ny;

      ball1.vx -= impulseX;
      ball1.vy -= impulseY;
      ball2.vx += impulseX;
      ball2.vy += impulseY;
    };

    const animate = (currentTime: number) => {
      animationRef.current = requestAnimationFrame(animate);

      const elapsed = currentTime - lastTimeRef.current;
      if (elapsed < frameInterval) return;
      lastTimeRef.current = currentTime - (elapsed % frameInterval);

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ballsRef.current.forEach((ball, i) => {
        ball.x += ball.vx;
        ball.y += ball.vy;

        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
        if (speed > MAX_SPEED) {
          const scale = MAX_SPEED / speed;
          ball.vx *= scale;
          ball.vy *= scale;
        }
        
        ball.scale += ball.scaleSpeed;
        if (ball.scale > 1.2 || ball.scale < 0.8) {
          ball.scaleSpeed = -ball.scaleSpeed;
        }
        ball.radius = ball.baseRadius * ball.scale;

        if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) {
          ball.vx = -ball.vx;
          ball.x = Math.max(ball.radius, Math.min(canvas.width - ball.radius, ball.x));
        }
        if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
          ball.vy = -ball.vy;
          ball.y = Math.max(ball.radius, Math.min(canvas.height - ball.radius, ball.y));
        }

        for (let j = i + 1; j < ballsRef.current.length; j++) {
          checkCollision(ball, ballsRef.current[j]);
        }

        if (ball.offscreenCanvas) {
          const size = ball.offscreenCanvas.width * ball.scale;
          ctx.drawImage(
            ball.offscreenCanvas,
            ball.x - size / 2,
            ball.y - size / 2,
            size,
            size
          );
        }
      });
    };

    // 防抖处理 resize，避免输入法弹出时频繁触发
    let resizeTimeout: ReturnType<typeof setTimeout> | null = null;
    const debouncedResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(resizeCanvas, 200);
    };

    resizeCanvas();
    window.addEventListener('resize', debouncedResize);
    initBalls();
    animationRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      if (resizeTimeout) clearTimeout(resizeTimeout);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
};

export default AnimatedBackground;
