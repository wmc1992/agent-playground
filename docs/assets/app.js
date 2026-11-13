/* ============================================================
   星岚 · Stellar Playground
   交互逻辑：主题切换、滚动入场、粒子星图、参数控制。
   无框架、无依赖，直接运行。
   ============================================================ */

(() => {
  'use strict';

  const root = document.documentElement;
  const THEME_KEY = 'stellar-theme';
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  /* ---------------- 主题 ---------------- */

  const themeToggle = document.getElementById('theme-toggle');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const themeListeners = new Set();

  function applyTheme(theme, persist) {
    root.dataset.theme = theme;
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'light' ? '#f4f6ff' : '#05060f');
    }
    if (themeToggle) {
      themeToggle.setAttribute('aria-pressed', String(theme === 'light'));
      themeToggle.setAttribute(
        'aria-label',
        theme === 'light' ? '切换到深色主题' : '切换到浅色主题'
      );
    }
    if (persist) {
      try {
        localStorage.setItem(THEME_KEY, theme);
      } catch (error) {
        /* 隐私模式下忽略存储失败 */
      }
    }
  }

  function notifyThemeChange() {
    themeListeners.forEach((listener) => listener(root.dataset.theme));
  }

  function preferredInitialTheme() {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch (error) {
      /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }

  applyTheme(preferredInitialTheme(), false);

  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const next = root.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(next, true);
      notifyThemeChange();
    });
  }

  /* ---------------- 滚动入场 ---------------- */

  const revealElements = document.querySelectorAll('.reveal');

  if (revealElements.length) {
    if ('IntersectionObserver' in window && !reduceMotion.matches) {
      const revealObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          });
        },
        { threshold: 0.12, rootMargin: '0px 0px -6% 0px' }
      );
      revealElements.forEach((element) => revealObserver.observe(element));
    } else {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    }
  }

  /* ---------------- 粒子星图 ---------------- */

  const canvas = document.getElementById('sky');

  if (canvas) {
    initSky();
  }

  function initSky() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const wrap = canvas.parentElement;
    const hint = document.getElementById('canvas-hint');
    const fpsElement = document.getElementById('hud-fps');
    const hudCount = document.getElementById('hud-count');
    const countInput = document.getElementById('count');
    const countOutput = document.getElementById('count-value');
    const speedInput = document.getElementById('speed');
    const speedOutput = document.getElementById('speed-value');
    const hueInput = document.getElementById('hue');
    const hueOutput = document.getElementById('hue-value');
    const modeButtons = Array.from(document.querySelectorAll('.segmented button'));
    const runButton = document.getElementById('toggle-run');
    const resetButton = document.getElementById('reset');
    const copyButton = document.getElementById('copy-url');
    const copyStatus = document.getElementById('copy-status');

    const state = {
      running: !reduceMotion.matches,
      inView: true,
      mode: 'attract',
      count: 140,
      speed: 1,
      hue: 252,
      particles: [],
      pointer: { x: 0, y: 0, active: false },
      width: 0,
      height: 0,
      fps: 60,
    };

    let rafId = 0;
    let lastTimestamp = 0;
    let frames = 0;
    let fpsSince = 0;
    let hintTimer = 0;

    /* ---- 粒子 ---- */

    function makeParticle() {
      const angle = Math.random() * Math.PI * 2;
      const velocity = 0.18 + Math.random() * 0.5;
      return {
        x: Math.random() * state.width,
        y: Math.random() * state.height,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        r: 0.8 + Math.random() * 2.1,
        hueOffset: (Math.random() - 0.5) * 46,
        alpha: 0.5 + Math.random() * 0.45,
        halo: Math.random() < 0.28,
        phase: Math.random() * Math.PI * 2,
      };
    }

    function syncParticles() {
      const target = state.count;
      while (state.particles.length < target) {
        state.particles.push(makeParticle());
      }
      if (state.particles.length > target) {
        state.particles.length = target;
      }
    }

    function resetParticles() {
      state.particles = [];
      syncParticles();
    }

    /* ---- 尺寸与设备像素比 ---- */

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const dpr = clamp(window.devicePixelRatio || 1, 1, 2);
      const width = Math.max(1, Math.round(rect.width));
      const height = Math.max(1, Math.round(rect.height));

      state.width = width;
      state.height = height;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      state.particles.forEach((particle) => {
        particle.x = clamp(particle.x, 0, width);
        particle.y = clamp(particle.y, 0, height);
      });
    }

    /* ---- 模拟 ---- */

    function update(dt) {
      const step = clamp(dt / 16.667, 0.2, 2.5);
      const motion = 0.4 + state.speed * 0.9;
      const pointer = state.pointer;
      const interactionRadius = clamp(
        Math.min(state.width, state.height) * 0.34,
        120,
        230
      );
      const force = 0.55 * state.speed;

      state.particles.forEach((particle) => {
        particle.phase += 0.0025 * step;

        if (pointer.active) {
          const dx = pointer.x - particle.x;
          const dy = pointer.y - particle.y;
          const distance = Math.hypot(dx, dy);

          if (distance < interactionRadius && distance > 0.5) {
            const pull = 1 - distance / interactionRadius;
            const nx = dx / distance;
            const ny = dy / distance;

            if (state.mode === 'attract') {
              particle.vx += nx * pull * 0.9 * force;
              particle.vy += ny * pull * 0.9 * force;
            } else if (state.mode === 'repel') {
              particle.vx -= nx * pull * 0.9 * force;
              particle.vy -= ny * pull * 0.9 * force;
            } else {
              particle.vx += -ny * pull * 1.1 * force;
              particle.vy += nx * pull * 1.1 * force;
            }
          }
        }

        particle.vx *= 0.993;
        particle.vy *= 0.993;
        particle.vx += Math.cos(particle.phase) * 0.0025;
        particle.vy += Math.sin(particle.phase * 1.3) * 0.0025;

        const speed = Math.hypot(particle.vx, particle.vy);
        if (speed > 4) {
          particle.vx = (particle.vx / speed) * 4;
          particle.vy = (particle.vy / speed) * 4;
        }

        particle.x += particle.vx * step * motion;
        particle.y += particle.vy * step * motion;

        const margin = 14;
        if (particle.x < -margin) particle.x = state.width + margin;
        else if (particle.x > state.width + margin) particle.x = -margin;
        if (particle.y < -margin) particle.y = state.height + margin;
        else if (particle.y > state.height + margin) particle.y = -margin;
      });
    }

    /* ---- 绘制 ---- */

    function draw() {
      const width = state.width;
      const height = state.height;
      const light = root.dataset.theme === 'light';
      const hue = state.hue;

      ctx.clearRect(0, 0, width, height);

      // 指针光晕
      if (state.pointer.active) {
        const radius = 170;
        const glow = ctx.createRadialGradient(
          state.pointer.x,
          state.pointer.y,
          0,
          state.pointer.x,
          state.pointer.y,
          radius
        );
        const glowAlpha = light ? 0.1 : 0.16;
        const glowLightness = light ? 45 : 70;
        glow.addColorStop(0, `hsla(${hue}, 90%, ${glowLightness}%, ${glowAlpha})`);
        glow.addColorStop(1, `hsla(${hue}, 90%, ${glowLightness}%, 0)`);
        ctx.fillStyle = glow;
        ctx.fillRect(
          state.pointer.x - radius,
          state.pointer.y - radius,
          radius * 2,
          radius * 2
        );
      }

      // 星尘之间的连线（按透明度分桶，减少描边次数）
      const linkDistance = clamp(Math.min(width, height) * 0.24, 80, 150);
      const buckets = [[], [], []];
      const particles = state.particles;

      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const squared = dx * dx + dy * dy;
          if (squared > linkDistance * linkDistance) continue;
          const distance = Math.sqrt(squared);
          const strength = 1 - distance / linkDistance;
          const bucket = Math.min(2, Math.floor(strength * 3));
          buckets[bucket].push(a.x, a.y, b.x, b.y);
        }
      }

      const linkSaturation = light ? 62 : 85;
      const linkLightness = light ? 42 : 72;
      const baseAlpha = light ? 0.24 : 0.3;

      ctx.lineWidth = 1;
      buckets.forEach((coords, bucket) => {
        if (!coords.length) return;
        ctx.beginPath();
        for (let index = 0; index < coords.length; index += 4) {
          ctx.moveTo(coords[index], coords[index + 1]);
          ctx.lineTo(coords[index + 2], coords[index + 3]);
        }
        const alpha = baseAlpha * ((bucket + 1) / 3);
        ctx.strokeStyle = `hsla(${hue}, ${linkSaturation}%, ${linkLightness}%, ${alpha})`;
        ctx.stroke();
      });

      // 星尘
      const particleSaturation = light ? 66 : 90;
      const particleLightness = light ? 42 : 72;

      particles.forEach((particle) => {
        const particleHue = ((hue + particle.hueOffset) % 360 + 360) % 360;

        if (particle.halo) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.r * 3.2, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(${particleHue}, ${particleSaturation}%, ${particleLightness}%, 0.09)`;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${particleHue}, ${particleSaturation}%, ${particleLightness}%, ${particle.alpha})`;
        ctx.fill();
      });
    }

    /* ---- 动画循环 ---- */

    function shouldAnimate() {
      return state.running && state.inView && !document.hidden;
    }

    function frame(timestamp) {
      rafId = 0;
      if (!shouldAnimate()) return;

      if (!lastTimestamp) lastTimestamp = timestamp;
      const dt = clamp(timestamp - lastTimestamp, 0, 50);
      lastTimestamp = timestamp;

      update(dt);
      draw();
      measureFps(timestamp);

      rafId = requestAnimationFrame(frame);
    }

    function startLoop() {
      if (!rafId && shouldAnimate()) {
        lastTimestamp = 0;
        rafId = requestAnimationFrame(frame);
      }
    }

    function stopLoop() {
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function measureFps(timestamp) {
      frames += 1;
      if (!fpsSince) fpsSince = timestamp;
      if (timestamp - fpsSince < 500) return;
      state.fps = Math.round((frames * 1000) / (timestamp - fpsSince));
      if (fpsElement) fpsElement.textContent = String(state.fps);
      frames = 0;
      fpsSince = timestamp;
    }

    function redrawIfPaused() {
      if (!state.running) draw();
    }

    /* ---- 控件 ---- */

    function updateRangeFill(input) {
      const min = Number(input.min);
      const max = Number(input.max);
      const value = Number(input.value);
      const percent = ((value - min) / (max - min)) * 100;
      input.style.setProperty('--fill', `${percent}%`);
    }

    function setRunning(running) {
      state.running = running;
      if (runButton) {
        runButton.textContent = running ? '暂停' : '继续';
        runButton.setAttribute('aria-pressed', String(!running));
      }
      if (running) {
        startLoop();
      } else {
        stopLoop();
        draw();
      }
    }

    if (countInput) {
      countInput.addEventListener('input', () => {
        state.count = Number(countInput.value);
        if (countOutput) countOutput.textContent = String(state.count);
        if (hudCount) hudCount.textContent = String(state.count);
        syncParticles();
        redrawIfPaused();
      });
      updateRangeFill(countInput);
    }

    if (speedInput) {
      speedInput.addEventListener('input', () => {
        state.speed = Number(speedInput.value);
        if (speedOutput) speedOutput.textContent = state.speed.toFixed(1);
        updateRangeFill(speedInput);
      });
      updateRangeFill(speedInput);
    }

    if (hueInput) {
      hueInput.addEventListener('input', () => {
        state.hue = Number(hueInput.value);
        if (hueOutput) hueOutput.textContent = String(state.hue);
        updateRangeFill(hueInput);
        redrawIfPaused();
      });
      updateRangeFill(hueInput);
    }

    modeButtons.forEach((button) => {
      button.addEventListener('click', () => {
        state.mode = button.dataset.mode;
        modeButtons.forEach((other) => {
          other.setAttribute('aria-pressed', String(other === button));
        });
      });
    });

    if (runButton) {
      runButton.addEventListener('click', () => setRunning(!state.running));
      if (!state.running) {
        runButton.textContent = '继续';
        runButton.setAttribute('aria-pressed', 'true');
      }
    }

    if (resetButton) {
      resetButton.addEventListener('click', () => {
        state.mode = 'attract';
        state.count = 140;
        state.speed = 1;
        state.hue = 252;

        if (countInput) countInput.value = '140';
        if (countOutput) countOutput.textContent = '140';
        if (speedInput) speedInput.value = '1';
        if (speedOutput) speedOutput.textContent = '1.0';
        if (hueInput) hueInput.value = '252';
        if (hueOutput) hueOutput.textContent = '252';
        if (hudCount) hudCount.textContent = '140';

        [countInput, speedInput, hueInput].forEach((input) => {
          if (input) updateRangeFill(input);
        });

        modeButtons.forEach((button) => {
          button.setAttribute('aria-pressed', String(button.dataset.mode === 'attract'));
        });

        resetParticles();
        setRunning(true);
      });
    }

    if (copyButton) {
      let copyTimer = 0;
      copyButton.addEventListener('click', async () => {
        const url = copyButton.dataset.url || window.location.href;
        let copied = false;

        try {
          await navigator.clipboard.writeText(url);
          copied = true;
        } catch (error) {
          const helper = document.createElement('textarea');
          helper.value = url;
          helper.setAttribute('readonly', '');
          helper.style.position = 'fixed';
          helper.style.opacity = '0';
          document.body.appendChild(helper);
          helper.select();
          try {
            copied = document.execCommand('copy');
          } catch (fallbackError) {
            copied = false;
          }
          helper.remove();
        }

        if (copyStatus) {
          copyStatus.textContent = copied ? '链接已复制' : '复制失败，请手动复制上方地址';
          window.clearTimeout(copyTimer);
          copyTimer = window.setTimeout(() => {
            copyStatus.textContent = '';
          }, 2600);
        }
      });
    }

    /* ---- 指针交互 ---- */

    function pointAt(event) {
      const rect = canvas.getBoundingClientRect();
      state.pointer.x = event.clientX - rect.left;
      state.pointer.y = event.clientY - rect.top;
      state.pointer.active = true;

      if (hint && !hint.classList.contains('is-hidden')) {
        hint.classList.add('is-hidden');
        window.clearTimeout(hintTimer);
      }
    }

    canvas.addEventListener('pointermove', pointAt);
    canvas.addEventListener('pointerdown', (event) => {
      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId);
        } catch (error) {
          /* ignore */
        }
      }
      pointAt(event);
    });
    canvas.addEventListener('pointerup', () => {
      state.pointer.active = false;
    });
    canvas.addEventListener('pointercancel', () => {
      state.pointer.active = false;
    });
    canvas.addEventListener('pointerleave', () => {
      state.pointer.active = false;
    });

    /* ---- 观察器 ---- */

    if ('ResizeObserver' in window) {
      const resizeObserver = new ResizeObserver(() => {
        resize();
        draw();
      });
      resizeObserver.observe(wrap);
    } else {
      window.addEventListener('resize', () => {
        resize();
        draw();
      });
    }

    if ('IntersectionObserver' in window) {
      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          state.inView = entries.some((entry) => entry.isIntersecting);
          if (state.inView) startLoop();
          else stopLoop();
        },
        { threshold: 0.05 }
      );
      visibilityObserver.observe(wrap);
    }

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopLoop();
      else startLoop();
    });

    themeListeners.add(() => redrawIfPaused());

    /* ---- 启动 ---- */

    resize();
    resetParticles();
    draw();
    if (state.running) startLoop();
  }
})();
