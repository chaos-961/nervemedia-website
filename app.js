(function () {
  const root = document.documentElement;
  const body = document.body;
  const year = document.getElementById("currentYear");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactViewport = window.matchMedia("(max-width: 700px)").matches;
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const lowPowerMotion = compactViewport || coarsePointer;

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
  const pulseItems = Array.from(document.querySelectorAll("[data-pulse-item]"));
  const lightZones = Array.from(document.querySelectorAll(".light-zone"));
  let scrollTicking = false;
  let scrollProgress = 0;
  let scrollVelocity = 0;
  let lastScrollY = window.scrollY;
  let requestNerveDraw = () => {};
  let wakeNerveDraw = () => {};

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const updateScroll = () => {
    const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const progress = clamp(window.scrollY / maxScroll, 0, 1);
    const scrollDelta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    scrollProgress = progress;
    scrollVelocity = scrollVelocity * 0.68 + scrollDelta * 0.32;
    root.style.setProperty("--scroll", progress.toFixed(4));

    const lightActive = lightZones.some((zone) => {
      const rect = zone.getBoundingClientRect();
      const enterLine = window.innerHeight * 0.82;
      const exitLine = window.innerHeight * 0.14;
      return rect.top < enterLine && rect.bottom > exitLine;
    });

    body.classList.toggle("is-light", lightActive);
    wakeNerveDraw(lowPowerMotion ? 160 : 260);
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
      .slice(0, lowPowerMotion ? 5 : 10);

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

  // --- Hero title: split into characters with a staggered rise ---
  if (!reducedMotion) {
    const splitTargets = Array.from(document.querySelectorAll("[data-split]"));
    let charIndex = 0;
    splitTargets.forEach((target) => {
      const text = target.textContent;
      target.textContent = "";
      text.split("").forEach((letter) => {
        const span = document.createElement("span");
        span.className = "char";
        span.textContent = letter;
        span.style.animationDelay = `${0.18 + charIndex * 0.045}s`;
        target.appendChild(span);
        charIndex += 1;
      });
    });
  }

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let resizeTimer = 0;
  let animationFrame = 0;
  let frameTimer = 0;
  let lastFrameTime = 0;
  let activeUntil = 0;
  let paths = [];
  let stars = [];
  let source = { x: 0, y: 0 };
  let networkWidth = 0;
  let networkHeight = 0;
  let networkMode = "";
  let networkBuilds = 0;
  let networkSignature = "";
  let randomValue = Math.random;

  const canvas = document.getElementById("nerveCanvas");
  window.__nerveDebug = {
    snapshot: () => ({
      width,
      height,
      pixelRatio,
      backingWidth: canvas ? canvas.width : 0,
      backingHeight: canvas ? canvas.height : 0,
      pathCount: paths.length,
      starCount: stars.length,
      networkBuilds,
      networkSignature,
      networkWidth,
      networkHeight,
      networkMode,
      scrollProgress,
      canvasReady: false,
    }),
  };

  if (!canvas || canvas.tagName !== "CANVAS" || typeof canvas.getContext !== "function") {
    return;
  }

  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  const makeRandom = (seed) => {
    let value = seed >>> 0;
    return () => {
      value += 0x6d2b79f5;
      let next = value;
      next = Math.imul(next ^ (next >>> 15), next | 1);
      next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
      return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
    };
  };
  const randomBetween = (min, max) => min + randomValue() * (max - min);
  const choose = (items) => items[Math.floor(randomValue() * items.length)];
  const isCompactCanvas = () => window.innerWidth <= 760 || coarsePointer;

  const makeJaggedPath = (start, end, steps, jag, bias = 0) => {
    const points = [];
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps;
      const ease = 1 - Math.pow(1 - t, 1.28);
      const taper = Math.sin(t * Math.PI);
      const x = start.x + (end.x - start.x) * ease + randomBetween(-jag.x, jag.x) * taper;
      const y = start.y + (end.y - start.y) * t + randomBetween(-jag.y, jag.y) * taper + bias * taper;
      points.push({ x, y });
    }
    points[0] = start;
    points[points.length - 1] = end;
    return points;
  };

  const addStar = (point, depth, power, seed = randomValue()) => {
    const rays = Math.round(randomBetween(6, 11));
    stars.push({
      x: point.x,
      y: point.y,
      depth,
      power,
      seed,
      rays,
      rayLengths: Array.from({ length: rays }, () => randomBetween(0.8, 2.05)),
      radius: randomBetween(7, 18) * power,
    });
  };

  const addPath = (points, kind, depth, lineWidth, seed = randomValue()) => {
    paths.push({ points, kind, depth, lineWidth, seed });
  };

  const writeProofState = () => {
    root.dataset.nervePixelRatio = pixelRatio.toFixed(2);
    root.dataset.nerveBacking = canvas ? `${canvas.width}x${canvas.height}` : "0x0";
    root.dataset.nervePaths = String(paths.length);
    root.dataset.nerveStars = String(stars.length);
    root.dataset.nerveBuilds = String(networkBuilds);
    root.dataset.nerveSignature = networkSignature;
    root.dataset.nerveMode = networkMode;
    root.dataset.nerveCanvasReady = String(canvasReady);
  };

  let canvasReady = true;

  const getPalette = () => {
    const light = body.classList.contains("is-light");
    return {
      light,
      rgb: light ? "0, 0, 0" : "255, 255, 255",
      baseScale: light ? 2.2 : 1.4,
      haloScale: light ? 0.7 : 1.6,
      starScale: light ? 1.2 : 1.5,
      sourceScale: light ? 0.14 : 0.36,
      compositeOp: light ? "source-over" : "lighter",
    };
  };

  const wakeCanvas = (duration = 420) => {
    activeUntil = Math.max(activeUntil, performance.now() + duration);
    requestNerveDraw();
  };
  wakeNerveDraw = wakeCanvas;

  const shiftedPoints = (path, time, compact) => {
    const velocity = clamp(scrollVelocity, -150, 150);
    const drift = scrollProgress * height * (0.1 + path.depth * 0.24);
    const wave = reducedMotion ? 0 : Math.sin(time * 0.00042 + path.seed * 12) * width * 0.004 * path.depth;
    const spark = reducedMotion ? 0 : Math.sin(time * 0.0024 + path.seed * 26) * 0.95 * path.depth;

    const points = path.points.map((point, index) => {
      const local = index / Math.max(1, path.points.length - 1);
      const x = point.x + wave * (0.4 + local) + velocity * 0.014 * path.depth;
      const y = point.y - drift + spark * Math.sin(local * Math.PI * 2 + path.seed) + velocity * 0.018 * path.depth;
      return { x, y };
    });

    return points;
  };

  const pointAtPath = (points, t) => {
    const target = clamp(t, 0, 1) * (points.length - 1);
    const index = Math.min(points.length - 2, Math.floor(target));
    const localT = target - index;
    const start = points[index];
    const end = points[index + 1];
    return {
      x: start.x + (end.x - start.x) * localT,
      y: start.y + (end.y - start.y) * localT,
    };
  };

  const drawPolyline = (points) => {
    context.beginPath();
    points.forEach((point, index) => {
      if (index === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    });
    context.stroke();
  };

  const drawPulse = (points, t, length, alpha, lineWidth, palette) => {
    const startT = clamp(t - length * 0.5, 0, 1);
    const endT = clamp(t + length * 0.5, 0, 1);
    if (endT <= startT) return;

    const start = pointAtPath(points, startT);
    const end = pointAtPath(points, endT);
    const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
    gradient.addColorStop(0, `rgba(${palette.rgb}, 0)`);
    gradient.addColorStop(0.45, `rgba(${palette.rgb}, ${alpha})`);
    gradient.addColorStop(0.55, `rgba(${palette.rgb}, ${palette.light ? 0.72 : 1})`);
    gradient.addColorStop(1, `rgba(${palette.rgb}, 0)`);

    context.strokeStyle = gradient;
    context.lineWidth = lineWidth;
    context.beginPath();

    const steps = 8;
    for (let step = 0; step <= steps; step += 1) {
      const point = pointAtPath(points, startT + ((endT - startT) * step) / steps);
      if (step === 0) {
        context.moveTo(point.x, point.y);
      } else {
        context.lineTo(point.x, point.y);
      }
    }
    context.stroke();
  };

  const drawStar = (star, time, compact, palette) => {
    const velocity = clamp(scrollVelocity, -150, 150);
    const flicker = reducedMotion ? 1 : 0.82 + Math.sin(time * 0.003 + star.seed * 20) * 0.18;
    const x = star.x + Math.sin(time * 0.00042 + star.seed * 9) * width * 0.003 * star.depth + velocity * 0.014 * star.depth;
    const y = star.y - scrollProgress * height * (0.1 + star.depth * 0.24) + velocity * 0.018 * star.depth;
    const radius = star.radius * flicker;

    if (y < -radius * 4 || y > height + radius * 4 || x < -radius * 4 || x > width + radius * 4) return;

    const gradient = context.createRadialGradient(x, y, 0, x, y, radius * 2.2);
    gradient.addColorStop(0, `rgba(${palette.rgb}, ${0.7 * star.power * palette.starScale})`);
    gradient.addColorStop(0.18, `rgba(${palette.rgb}, ${0.28 * star.power * palette.starScale})`);
    gradient.addColorStop(1, `rgba(${palette.rgb}, 0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius * 2.2, 0, Math.PI * 2);
    context.fill();

    context.strokeStyle = `rgba(${palette.rgb}, ${(compact ? 0.36 : 0.56) * palette.starScale})`;
    context.lineWidth = Math.max(0.7, star.power);
    context.beginPath();
    for (let ray = 0; ray < (compact ? Math.min(star.rays, 6) : star.rays); ray += 1) {
      const angle = (Math.PI * 2 * ray) / star.rays + star.seed * Math.PI;
      const rayLength = radius * star.rayLengths[ray] * (compact ? 0.72 : 1);
      context.moveTo(x - Math.cos(angle) * radius * 0.18, y - Math.sin(angle) * radius * 0.18);
      context.lineTo(x + Math.cos(angle) * rayLength, y + Math.sin(angle) * rayLength);
    }
    context.stroke();

    context.fillStyle = `rgba(${palette.rgb}, ${palette.light ? 0.72 : 0.96})`;
    context.beginPath();
    context.arc(x, y, Math.max(1.1, radius * 0.16), 0, Math.PI * 2);
    context.fill();
  };

  const drawSource = (time, compact, palette) => {
    const pulse = reducedMotion ? 1 : 0.92 + Math.sin(time * 0.002) * 0.08;
    const x = source.x + Math.sin(time * 0.0008) * width * 0.006;
    const y = source.y + Math.cos(time * 0.0007) * height * 0.018 - scrollProgress * height * 0.08;
    const radius = Math.max(width, height) * (compact ? 0.18 : 0.22) * pulse;
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);

    gradient.addColorStop(0, `rgba(${palette.rgb}, ${palette.sourceScale})`);
    gradient.addColorStop(0.26, `rgba(${palette.rgb}, ${palette.sourceScale * 0.58})`);
    gradient.addColorStop(1, `rgba(${palette.rgb}, 0)`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  };

  const buildNetwork = () => {
    const compact = isCompactCanvas();
    const primaryCount = compact ? 30 : 22;
    const branchPerPrimary = compact ? 5 : 4;
    const microPerPrimary = compact ? 2 : 2;
    // Full height spread — nerves fan from top to bottom like the reference
    const seed = Math.round(width * 17 + height * 3 + (compact ? 1009 : 2003));
    randomValue = makeRandom(seed);
    networkWidth = width;
    networkHeight = height;
    networkMode = compact ? "compact" : "desktop";
    networkBuilds += 1;
    const originY = height * 0.5;
    const verticalSpan = height * (compact ? 3.35 : 3.6);

    paths = [];
    stars = [];
    source = { x: width * (compact ? 1.28 : 1.38), y: originY };

    for (let index = 0; index < primaryCount; index += 1) {
      const spread = (index / Math.max(1, primaryCount - 1) - 0.5) * verticalSpan;
      const endpoint = {
        x: compact ? randomBetween(-width * 0.24, width * 0.86) : randomBetween(-width * 0.22, width * 0.58),
        y: originY + spread + randomBetween(-height * 0.08, height * 0.08),
      };
      const start = {
        x: width * (compact ? randomBetween(0.96, 1.42) : randomBetween(1.12, 1.52)),
        y: originY + spread * randomBetween(0.08, 0.28) + randomBetween(-height * 0.18, height * 0.18),
      };
      const primary = makeJaggedPath(
        start,
        endpoint,
        Math.round(randomBetween(compact ? 6 : 9, compact ? 10 : 14)),
        { x: width * (compact ? 0.028 : 0.038), y: height * (compact ? 0.022 : 0.032) },
        randomBetween(-height * 0.06, height * 0.06)
      );
      // Thick bright primaries — closer to reference weight
      const depth = randomBetween(0.82, 1);
      addPath(primary, "primary", depth, randomBetween(compact ? 2.05 : 2.2, compact ? 4.15 : 4.8), randomValue());
      addStar(choose(primary.slice(1, 3)), depth, randomBetween(compact ? 0.82 : 0.9, compact ? 1.35 : 1.6));
      if (!compact || index % 2 === 0) {
        addStar(choose(primary.slice(3, -2)), depth * 0.85, randomBetween(compact ? 0.42 : 0.5, compact ? 0.86 : 1.0));
      }

      for (let branch = 0; branch < branchPerPrimary; branch += 1) {
        // More branching near the source (right side) — higher anchorIndex = closer to start
        const anchorBias = randomValue() > 0.35 ? randomBetween(0.48, 0.94) : randomBetween(0.1, 0.55);
        const anchorIndex = Math.floor(anchorBias * (primary.length - 2)) + 1;
        const anchor = primary[Math.min(anchorIndex, primary.length - 2)];
        const side = randomValue() > 0.5 ? 1 : -1;
        const branchLength = randomBetween(width * 0.1, width * (compact ? 0.31 : 0.34)) * depth;
        const branchEnd = {
          x: anchor.x - branchLength * randomBetween(0.3, 0.9),
          y: anchor.y + side * branchLength * randomBetween(0.2, 0.7),
        };
        const branchPath = makeJaggedPath(
          anchor,
          branchEnd,
          Math.round(randomBetween(4, compact ? 8 : 9)),
          { x: width * 0.022, y: height * 0.02 }
        );
        const branchDepth = depth * randomBetween(0.52, 0.82);
        addPath(branchPath, "branch", branchDepth, randomBetween(0.68, compact ? 1.55 : 1.6), randomValue());

        // Stars at every branch junction
        addStar(anchor, branchDepth, randomBetween(0.5, compact ? 0.95 : 1.1));

        // Two levels of twigs per branch
        for (let twig = 0; twig < 2; twig += 1) {
          const twigAnchor = choose(branchPath.slice(1, -1));
          const twigLength = branchLength * randomBetween(0.18, 0.42);
          const twigSide = randomValue() > 0.5 ? 1 : -1;
          const twigPath = makeJaggedPath(
            twigAnchor,
            {
              x: twigAnchor.x - twigLength * randomBetween(0.3, 0.85),
              y: twigAnchor.y + twigSide * twigLength * randomBetween(0.15, 0.55),
            },
            Math.round(randomBetween(3, 6)),
            { x: width * 0.014, y: height * 0.013 }
          );
          addPath(twigPath, "twig", branchDepth * 0.72, randomBetween(0.32, compact ? 0.74 : 0.82), randomValue());
          if (randomValue() > 0.38) {
            addStar(twigAnchor, branchDepth * 0.6, randomBetween(0.28, compact ? 0.5 : 0.7));
          }
        }
      }

      for (let micro = 0; micro < microPerPrimary; micro += 1) {
        const anchor = choose(primary.slice(1, -1));
        const length = randomBetween(width * 0.05, width * (compact ? 0.12 : 0.2));
        addPath(
          makeJaggedPath(
            anchor,
            {
              x: anchor.x + randomBetween(-length, length * 0.3),
              y: anchor.y + randomBetween(-length * 0.5, length * 0.5),
            },
            Math.round(randomBetween(3, 5)),
            { x: width * 0.01, y: height * 0.01 }
          ),
          "micro",
          depth * randomBetween(0.32, 0.58),
          randomBetween(0.18, compact ? 0.4 : 0.58),
          randomValue()
        );
      }
    }

    stars = stars
      .sort((a, b) => b.power - a.power)
      .slice(0, compact ? 92 : 58);
    networkSignature = `${networkMode}:${paths.length}:${stars.length}:${Math.round(source.x)}:${Math.round(source.y)}:${paths
      .slice(0, 8)
      .map((path) => `${path.kind}:${Math.round(path.points[0].x)},${Math.round(path.points[0].y)}`)
      .join("|")}`;
    writeProofState();
  };

  const draw = (time = performance.now()) => {
    animationFrame = 0;
    if (document.hidden) {
      return;
    }

    const compact = isCompactCanvas();
    const active = !reducedMotion;
    // Steady ~24fps on desktop, ~15fps on mobile — smooth for ambient motion, far cheaper.
    const frameGap = compact ? 42 : 42;

    if (active && time - lastFrameTime < frameGap) {
      requestNerveDraw(Math.max(16, frameGap - (time - lastFrameTime)));
      return;
    }

    lastFrameTime = time;

    const motion = reducedMotion ? 0 : clamp(Math.abs(scrollVelocity) / 110, 0, 1);
    const palette = getPalette();
    context.clearRect(0, 0, width, height);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.globalCompositeOperation = palette.compositeOp;

    drawSource(time, compact, palette);

    paths.forEach((path, index) => {
      const points = shiftedPoints(path, time, compact);
      const baseAlpha = path.kind === "primary" ? 0.72 : path.kind === "branch" ? 0.42 : 0.22;
      const haloAlpha = path.kind === "primary" ? 0.18 : path.kind === "branch" ? 0.07 : 0.035;
      const flicker = active ? 0.88 + Math.sin(time * 0.0026 + path.seed * 30) * 0.12 : 1;

      // Halo only on the heavier primary/branch strokes in dark mode (skips thousands of cheap-but-additive twig passes).
      if (!palette.light && path.kind !== "twig" && path.kind !== "micro") {
        context.strokeStyle = `rgba(${palette.rgb}, ${(haloAlpha * flicker + motion * 0.03) * palette.haloScale})`;
        context.lineWidth = path.lineWidth * (compact ? 2.2 : 3.2);
        drawPolyline(points);
      }

      context.strokeStyle = `rgba(${palette.rgb}, ${(baseAlpha * flicker + motion * 0.07) * palette.baseScale})`;
      context.lineWidth = path.lineWidth;
      drawPolyline(points);

      if (active && index % (compact ? 10 : 6) === 0) {
        const t = (time * (compact ? 0.00012 : 0.00018) * (1.2 + path.seed) + path.seed + scrollProgress * 0.6) % 1;
        drawPulse(
          points,
          t,
          compact ? 0.1 : 0.13,
          compact ? 0.28 : 0.48,
          path.lineWidth + (compact ? 0.55 : 1.05),
          palette
        );
      }
    });

    stars.forEach((star) => drawStar(star, time, compact, palette));
    context.globalCompositeOperation = "source-over";

    scrollVelocity *= compact ? 0.62 : 0.72;
    requestNerveDraw();
  };

  requestNerveDraw = (delay = 0) => {
    if (animationFrame || frameTimer) return;

    if (delay > 0) {
      frameTimer = window.setTimeout(() => {
        frameTimer = 0;
        requestNerveDraw();
      }, delay);
      return;
    }

    animationFrame = window.requestAnimationFrame(draw);
  };

  const resize = (forceRebuild = false) => {
    const compact = isCompactCanvas();
    const nextWidth = window.innerWidth;
    const nextHeight = window.innerHeight;
    const nextPixelRatio = Math.min(window.devicePixelRatio || 1, compact ? 2 : 1.5);
    const widthChanged = Math.abs(nextWidth - width) > 1;
    const pixelRatioChanged = Math.abs(nextPixelRatio - pixelRatio) > 0.01;
    const modeChanged = networkMode !== "" && networkMode !== (compact ? "compact" : "desktop");
    const shouldRebuild = forceRebuild || paths.length === 0 || widthChanged || pixelRatioChanged || modeChanged;

    pixelRatio = nextPixelRatio;
    width = nextWidth;
    height = nextHeight;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    if (shouldRebuild) {
      buildNetwork();
    }
    if (animationFrame) {
      window.cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    }
    if (frameTimer) {
      window.clearTimeout(frameTimer);
      frameTimer = 0;
    }
    writeProofState();
    requestNerveDraw();
  };

  const requestResize = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(resize, 140);
  };

  window.__nerveDebug = {
    snapshot: () => ({
      width,
      height,
      pixelRatio,
      backingWidth: canvas.width,
      backingHeight: canvas.height,
      pathCount: paths.length,
      starCount: stars.length,
      networkBuilds,
      networkSignature,
      networkWidth,
      networkHeight,
      networkMode,
      scrollProgress,
      canvasReady: true,
    }),
  };

  resize(true);
  window.addEventListener("resize", requestResize, { passive: true });
  window.addEventListener("pageshow", () => wakeCanvas(260));
})();
