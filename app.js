(function () {
  const root = document.documentElement;
  const body = document.body;
  const year = document.getElementById("currentYear");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  const pulseItems = Array.from(document.querySelectorAll("[data-pulse-item]"));
  const lightZones = Array.from(document.querySelectorAll(".light-zone"));
  const magneticItems = Array.from(document.querySelectorAll(".magnetic"));
  let scrollTicking = false;
  let activePulseIndex = 0;

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const updateScroll = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = clamp(window.scrollY / maxScroll, 0, 1);
    root.style.setProperty("--scroll", progress.toFixed(4));

    const lightActive = lightZones.some((zone) => {
      const rect = zone.getBoundingClientRect();
      const centerLine = window.innerHeight * 0.48;
      return rect.top < centerLine && rect.bottom > centerLine;
    });

    body.classList.toggle("is-light", lightActive);
    scrollTicking = false;
  };

  const requestScrollUpdate = () => {
    if (scrollTicking) return;
    scrollTicking = true;
    window.requestAnimationFrame(updateScroll);
  };

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
  );

  revealItems.forEach((item) => revealObserver.observe(item));
  updateScroll();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate, { passive: true });

  const chainPulse = (source) => {
    if (reducedMotion || pulseItems.length === 0) return;

    const rect = source.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    const ordered = pulseItems
      .map((item) => {
        const itemRect = item.getBoundingClientRect();
        const itemX = itemRect.left + itemRect.width / 2;
        const itemY = itemRect.top + itemRect.height / 2;
        return {
          item,
          delay: Math.hypot(itemX - x, itemY - y) * 0.18,
          left: `${clamp(x - itemRect.left, 0, itemRect.width)}px`,
          top: `${clamp(y - itemRect.top, 0, itemRect.height)}px`,
        };
      })
      .sort((a, b) => a.delay - b.delay)
      .slice(0, 10);

    ordered.forEach(({ item, delay, left, top }) => {
      window.setTimeout(() => {
        item.style.setProperty("--pulse-inset", `${top} auto auto ${left}`);
        item.classList.remove("pulse-now");
        void item.offsetWidth;
        item.classList.add("pulse-now");
      }, delay);
    });
  };

  pulseItems.forEach((item) => {
    item.addEventListener("pointerenter", () => chainPulse(item));
    item.addEventListener("focusin", () => chainPulse(item));
  });

  if (!reducedMotion && pulseItems.length > 0) {
    window.setInterval(() => {
      const item = pulseItems[activePulseIndex % pulseItems.length];
      activePulseIndex += 1;
      if (!item) return;
      const rect = item.getBoundingClientRect();
      if (rect.bottom < 0 || rect.top > window.innerHeight) return;
      chainPulse(item);
    }, 3200);
  }

  magneticItems.forEach((item) => {
    item.addEventListener("pointermove", (event) => {
      const rect = item.getBoundingClientRect();
      const x = (event.clientX - rect.left - rect.width / 2) * 0.16;
      const y = (event.clientY - rect.top - rect.height / 2) * 0.16;
      item.style.transform = `translate(${x}px, ${y}px)`;
    });

    item.addEventListener("pointerleave", () => {
      item.style.transform = "";
    });
  });

  const canvas = document.getElementById("nerveCanvas");
  if (!(canvas instanceof HTMLCanvasElement) || reducedMotion) {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let strands = [];
  let branches = [];
  let pulses = [];
  let rafId = 0;
  const pointer = { x: -9999, y: -9999, active: false };

  const randomBetween = (min, max) => min + Math.random() * (max - min);

  const buildNetwork = () => {
    strands = [];
    branches = [];
    pulses = [];
    const count = Math.round(clamp(width / 110, 8, 16));

    for (let index = 0; index < count; index += 1) {
      const fromLeft = index % 2 === 0;
      const start = {
        x: fromLeft ? randomBetween(-width * 0.08, width * 0.2) : randomBetween(width * 0.8, width * 1.08),
        y: randomBetween(height * 0.08, height * 0.92),
      };
      const end = {
        x: fromLeft ? randomBetween(width * 0.52, width * 1.08) : randomBetween(-width * 0.08, width * 0.48),
        y: randomBetween(height * 0.04, height * 0.96),
      };
      const bend = randomBetween(-0.34, 0.34);
      const control = {
        x: (start.x + end.x) / 2 + width * bend,
        y: (start.y + end.y) / 2 + randomBetween(-height * 0.22, height * 0.22),
      };

      strands.push({
        start,
        end,
        control,
        seed: Math.random(),
        width: randomBetween(0.55, 1.55),
      });
    }

    strands.forEach((strand, index) => {
      const branchCount = 2 + Math.round(Math.random() * 3);
      for (let branchIndex = 0; branchIndex < branchCount; branchIndex += 1) {
        const anchorT = randomBetween(0.18, 0.82);
        const anchor = pointOnCurve(strand, anchorT);
        const direction = (index % 2 === 0 ? 1 : -1) * (branchIndex % 2 === 0 ? 1 : -1);
        const length = randomBetween(width * 0.05, width * 0.16);
        const angle = randomBetween(-0.9, 0.9) + direction * randomBetween(0.42, 1.05);
        const end = {
          x: anchor.x + Math.cos(angle) * length,
          y: anchor.y + Math.sin(angle) * length * 0.72,
        };
        const control = {
          x: (anchor.x + end.x) / 2 + Math.cos(angle + Math.PI / 2) * length * randomBetween(-0.18, 0.18),
          y: (anchor.y + end.y) / 2 + Math.sin(angle + Math.PI / 2) * length * randomBetween(-0.18, 0.18),
        };

        branches.push({
          start: anchor,
          control,
          end,
          seed: Math.random(),
          width: randomBetween(0.35, 0.9),
        });
      }

      pulses.push({
        strand,
        seed: Math.random(),
        speed: randomBetween(0.0001, 0.00022),
        length: randomBetween(0.07, 0.15),
      });

      if (index % 3 === 0) {
        const branch = branches[branches.length - 1];
        if (branch) {
          pulses.push({
            strand: branch,
            seed: Math.random(),
            speed: randomBetween(0.00014, 0.00026),
            length: randomBetween(0.08, 0.16),
          });
        }
      }
    });
  };

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    buildNetwork();
  };

  const pointOnCurve = (strand, t) => {
    const inv = 1 - t;
    return {
      x: inv * inv * strand.start.x + 2 * inv * t * strand.control.x + t * t * strand.end.x,
      y: inv * inv * strand.start.y + 2 * inv * t * strand.control.y + t * t * strand.end.y,
    };
  };

  const drawCurve = (curve, growth, time, opacity, lineWidth) => {
    context.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
    context.lineWidth = lineWidth;
    context.beginPath();
    context.moveTo(curve.start.x, curve.start.y);

    const steps = 36;
    for (let step = 1; step <= steps; step += 1) {
      const t = (step / steps) * growth;
      const point = pointOnCurve(curve, t);
      point.y += Math.sin(time * 0.0015 + step * 0.38 + curve.seed * 12) * 2.6;
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  };

  const drawStrands = (time) => {
    const load = clamp(time / 1300, 0, 1);
    const scroll = Number.parseFloat(getComputedStyle(root).getPropertyValue("--scroll")) || 0;

    strands.forEach((strand, index) => {
      const growth = clamp(load * 1.2 - index * 0.018, 0, 1);
      if (growth <= 0) return;

      const mid = pointOnCurve(strand, 0.5);
      const distance = Math.hypot(pointer.x - mid.x, pointer.y - mid.y);
      const hover = pointer.active ? clamp(1 - distance / 260, 0, 1) : 0;
      const shimmer = (Math.sin(time * 0.0018 + strand.seed * 8) + 1) * 0.5;
      const opacity = 0.1 + shimmer * 0.08 + hover * 0.2 + scroll * 0.04;
      drawCurve(strand, growth, time, opacity, strand.width + hover * 0.8);
    });

    branches.forEach((branch, index) => {
      const growth = clamp(load * 1.28 - index * 0.006, 0, 1);
      if (growth <= 0) return;
      const shimmer = (Math.sin(time * 0.002 + branch.seed * 10) + 1) * 0.5;
      drawCurve(branch, growth, time, 0.065 + shimmer * 0.055, branch.width);
    });
  };

  const drawSignal = (curve, startT, length, alpha) => {
    const steps = 12;
    const gradientStart = pointOnCurve(curve, startT);
    const gradientEnd = pointOnCurve(curve, clamp(startT + length, 0, 1));
    const gradient = context.createLinearGradient(gradientStart.x, gradientStart.y, gradientEnd.x, gradientEnd.y);
    gradient.addColorStop(0, `rgba(255, 255, 255, 0)`);
    gradient.addColorStop(0.48, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(1, `rgba(255, 255, 255, 0)`);

    context.strokeStyle = gradient;
    context.lineWidth = 2.2;
    context.beginPath();
    for (let step = 0; step <= steps; step += 1) {
      const t = clamp(startT + (length * step) / steps, 0, 1);
      const point = pointOnCurve(curve, t);
      if (step === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
  };

  const drawPulses = (time) => {
    pulses.forEach((pulse, index) => {
      const t = (time * pulse.speed + pulse.seed + index * 0.03) % 1;
      const chain = (Math.sin(time * 0.003 - index * 0.62) + 1) * 0.5;
      drawSignal(pulse.strand, t, pulse.length, 0.34 + chain * 0.42);
    });
  };

  const drawPointerAura = () => {
    if (!pointer.active) return;
    context.strokeStyle = "rgba(255, 255, 255, 0.16)";
    context.lineWidth = 1;
    context.beginPath();
    context.moveTo(pointer.x - 42, pointer.y);
    context.quadraticCurveTo(pointer.x - 10, pointer.y - 16, pointer.x + 42, pointer.y);
    context.stroke();
  };

  const draw = (time) => {
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    //drawPointerAura();
    drawStrands(time);
    drawPulses(time);
    rafId = window.requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  window.addEventListener(
    "pointermove",
    (event) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.active = true;
    },
    { passive: true }
  );
  window.addEventListener("pointerleave", () => {
    pointer.active = false;
  });

  rafId = window.requestAnimationFrame(draw);
  window.addEventListener("pagehide", () => window.cancelAnimationFrame(rafId));
})();
