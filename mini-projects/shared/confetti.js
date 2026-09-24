window.confetti = (() => {
    const COLORS = ['#7c5cff', '#22d3ee', '#34d399', '#f472b6', '#fbbf24'];
    const DURATION_MS = 2800;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    return function burst() {
        if (reducedMotion.matches) return;

        const canvas = document.createElement('canvas');
        canvas.className = 'confetti-canvas';
        document.body.appendChild(canvas);
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        canvas.width = innerWidth * dpr;
        canvas.height = innerHeight * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const pieces = Array.from({ length: 160 }, () => ({
            x: innerWidth / 2,
            y: innerHeight / 3,
            vx: (Math.random() - 0.5) * 16,
            vy: -Math.random() * 13 - 4,
            size: Math.random() * 6 + 5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            angle: Math.random() * Math.PI,
            spin: (Math.random() - 0.5) * 0.3,
        }));

        const start = performance.now();
        requestAnimationFrame(function frame(now) {
            ctx.clearRect(0, 0, innerWidth, innerHeight);
            for (const p of pieces) {
                p.vy += 0.35;
                p.vx *= 0.99;
                p.x += p.vx;
                p.y += p.vy;
                p.angle += p.spin;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(p.angle);
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                ctx.restore();
            }
            if (now - start < DURATION_MS) {
                requestAnimationFrame(frame);
            } else {
                canvas.remove();
            }
        });
    };
})();
