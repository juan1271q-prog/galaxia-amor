(() => {
  "use strict";

  const canvas = document.getElementById("galaxy-canvas");
  const context = canvas.getContext("2d");
  const welcomeScreen = document.getElementById("welcome-screen");
  const surpriseButton = document.getElementById("surprise-button");
  const experience = document.getElementById("experience");
  const audio = document.getElementById("birthday-music");
  const musicToggle = document.getElementById("music-toggle");
  const musicIcon = document.getElementById("music-icon");
  const phrases = [...document.querySelectorAll(".phrase")];
  const zoomInButton = document.getElementById("zoom-in");
  const zoomOutButton = document.getElementById("zoom-out");
  const resetCameraButton = document.getElementById("reset-camera");

  const TAU = Math.PI * 2;
  const isMobile = window.innerWidth < 768;
  const STAR_COUNT = isMobile ? 430 : 720;
  const GALAXY_COUNT = isMobile ? 190 : 340;
  const HEART_COUNT = isMobile ? 150 : 220;
  const ORBIT_COUNT = isMobile ? 32 : 58;
  const perspective = 500;
  const stars = [];
  const galaxyParticles = [];
  const heartParticles = [];
  const orbitParticles = [];
  const effects = [];
  const shootingStars = [];
  const activePointers = new Map();
  const pointer = { x: 0, y: 0, down: false, moved: false, startX: 0, startY: 0 };
  const camera = { zoom: 1, targetZoom: 1, rotationX: 0, rotationY: 0 };
  const cameraVelocity = { x: 0, y: 0 };
  const rings = [
    { radius: 190, flatten: 0.24, tilt: -0.12, rotation: 0, speed: 0.004, alpha: 0.42 },
    { radius: 154, flatten: 0.18, tilt: 0.38, rotation: 1, speed: -0.002, alpha: 0.34 },
    { radius: 122, flatten: 0.3, tilt: -0.48, rotation: 2, speed: 0.001, alpha: 0.3 },
    { radius: 92, flatten: 0.2, tilt: 0.66, rotation: 2.7, speed: -0.003, alpha: 0.26 }
  ];

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let started = false;
  let heartProgress = 0;
  let lastFrame = 0;
  let rotationX = 0;
  let rotationY = 0;
  let rotationZ = 0;
  let galaxyRotation = 0;
  let phraseIndex = 0;
  const visiblePhraseIndexes = [];
  let nextShootingStar = 5000;
  let pinchDistance = 0;

  const random = (min, max) => Math.random() * (max - min) + min;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function createStars() {
    stars.length = 0;
    for (let index = 0; index < STAR_COUNT; index += 1) {
      const layer = index % 3;
      stars.push({
        x: random(-width / 2, width / 2),
        y: random(-height / 2, height / 2),
        z: layer === 0 ? random(480, 900) : layer === 1 ? random(230, 480) : random(55, 230),
        layer,
        radius: layer === 0 ? random(0.3, 0.8) : layer === 1 ? random(0.65, 1.35) : random(1, 2.1),
        alpha: layer === 0 ? random(0.24, 0.62) : random(0.38, 0.95),
        speed: layer === 0 ? random(0.008, 0.02) : layer === 1 ? random(0.018, 0.045) : random(0.035, 0.075),
        twinkle: random(0.7, 2.5),
        phase: random(0, TAU),
        parallax: layer === 0 ? 0.12 : layer === 1 ? 0.28 : 0.55
      });
    }
  }

  function createGalaxy() {
    galaxyParticles.length = 0;
    for (let index = 0; index < GALAXY_COUNT; index += 1) {
      const arm = index % 4;
      const radius = Math.pow(Math.random(), 0.64) * Math.min(width, height) * 0.42 + 25;
      galaxyParticles.push({
        angle: random(0, TAU) + arm * TAU / 4,
        radius,
        z: random(-55, 55) * (radius / Math.min(width, height)),
        arm,
        spread: random(-0.12, 0.12),
        speed: random(0.00012, 0.00036),
        size: random(0.45, 1.8),
        alpha: random(0.18, 0.7),
        phase: random(0, TAU)
      });
    }
  }

  function heartPoint(t) {
    return {
      x: 16 * Math.pow(Math.sin(t), 3),
      y: 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)
    };
  }

  function createHeart() {
    heartParticles.length = 0;
    const scale = Math.min(width, height) * 0.0118;
    for (let index = 0; index < HEART_COUNT; index += 1) {
      const point = heartPoint(index / HEART_COUNT * TAU);
      const fill = Math.sqrt(random(0.08, 1));
      heartParticles.push({
        x: point.x * scale * fill + random(-1.5, 1.5),
        y: -point.y * scale * fill + random(-1.5, 1.5),
        z: random(-42, 42),
        size: random(1, 2.6),
        alpha: random(0.52, 1),
        hue: random(326, 352),
        phase: random(0, TAU),
        speed: random(0.6, 1.2)
      });
    }

    orbitParticles.length = 0;
    for (let index = 0; index < ORBIT_COUNT; index += 1) {
      orbitParticles.push({
        angle: random(0, TAU),
        radius: random(52, Math.min(width, height) * 0.2),
        speed: random(0.00015, 0.0005),
        tilt: random(0.28, 0.9),
        plane: index % 3,
        size: random(0.8, 2.2),
        alpha: random(0.4, 0.9),
        phase: random(0, TAU)
      });
    }
  }

  function sceneCenter() {
    return { x: width / 2, y: height * 0.47 };
  }

  function transformPoint(point, extra = {}) {
    let x = point.x;
    let y = point.y;
    let z = point.z;
    const rx = (extra.rotationX || 0) + camera.rotationX;
    const ry = (extra.rotationY || 0) + camera.rotationY;
    const rz = extra.rotationZ || 0;
    let cos = Math.cos(ry);
    let sin = Math.sin(ry);
    let nextX = x * cos - z * sin;
    let nextZ = x * sin + z * cos;
    x = nextX;
    z = nextZ;
    cos = Math.cos(rx);
    sin = Math.sin(rx);
    let nextY = y * cos - z * sin;
    z = y * sin + z * cos;
    y = nextY;
    cos = Math.cos(rz);
    sin = Math.sin(rz);
    nextX = x * cos - y * sin;
    nextY = x * sin + y * cos;
    x = nextX;
    y = nextY;
    const scale = perspective / (perspective + z);
    return { x: x * scale * camera.zoom, y: y * scale * camera.zoom, z, scale };
  }

  function drawStars(time, delta) {
    const center = sceneCenter();
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const star of stars) {
      star.z -= star.speed * delta;
      if (star.z < 35) star.z = 900;
      const projection = transformPoint({
        x: star.x + pointer.x * star.parallax * 30,
        y: star.y + pointer.y * star.parallax * 18,
        z: star.z
      });
      const alpha = star.alpha * (0.76 + Math.sin(time * 0.001 * star.twinkle + star.phase) * 0.24);
      const radius = star.radius * projection.scale * camera.zoom;
      const x = center.x + projection.x;
      const y = center.y + projection.y;
      if (x < -8 || x > width + 8 || y < -8 || y > height + 8) continue;
      context.beginPath();
      context.fillStyle = `rgba(255, 220, 241, ${alpha})`;
      context.shadowBlur = star.layer === 2 ? 10 : star.layer === 1 ? 5 : 2;
      context.shadowColor = "rgba(255, 79, 164, 0.9)";
      context.arc(x, y, Math.max(0.25, radius), 0, TAU);
      context.fill();
    }
    context.restore();
  }

  function drawNebulaLights(time) {
    const center = sceneCenter();
    const radius = Math.min(width, height) * 0.44;
    const glow = context.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);
    glow.addColorStop(0, "rgba(255, 21, 135, 0.1)");
    glow.addColorStop(0.42, "rgba(128, 12, 89, 0.045)");
    glow.addColorStop(1, "rgba(0, 0, 0, 0)");
    context.fillStyle = glow;
    context.fillRect(0, 0, width, height);
    for (let index = 0; index < 7; index += 1) {
      const angle = time * 0.00008 + index * 0.9;
      const orbit = Math.min(width, height) * (0.2 + index * 0.027);
      const x = center.x + Math.cos(angle) * orbit;
      const y = center.y + Math.sin(angle) * orbit * 0.56;
      const spark = context.createRadialGradient(x, y, 0, x, y, 24 + index * 3);
      spark.addColorStop(0, "rgba(255, 124, 192, 0.3)");
      spark.addColorStop(1, "rgba(255, 32, 139, 0)");
      context.fillStyle = spark;
      context.fillRect(x - 40, y - 40, 80, 80);
    }
  }

  function drawGalaxy(time, delta) {
    const center = sceneCenter();
    const points = [];
    for (const particle of galaxyParticles) {
      particle.angle += particle.speed * delta;
      const angle = particle.angle + galaxyRotation + particle.arm * 0.18 + particle.spread;
      points.push({
        particle,
        ...transformPoint({
          x: Math.cos(angle) * particle.radius,
          y: Math.sin(angle) * particle.radius * 0.44,
          z: particle.z + Math.sin(angle * 2) * 18
        }, { rotationX: 0.1, rotationY: 0.08 })
      });
    }
    points.sort((first, second) => first.z - second.z);
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const point of points) {
      const particle = point.particle;
      const alpha = particle.alpha * (0.76 + Math.sin(time * 0.0015 + particle.phase) * 0.24);
      context.beginPath();
      context.fillStyle = `rgba(255, ${120 + particle.arm * 13}, ${190 + particle.arm * 8}, ${alpha})`;
      context.shadowBlur = 5;
      context.shadowColor = "rgba(255, 45, 150, 0.65)";
      context.arc(center.x + point.x, center.y + point.y, particle.size * point.scale, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  function drawPlatform(time, delta) {
    const center = sceneCenter();
    const y = center.y + Math.min(width, height) * 0.235;
    const pulse = 1 + Math.sin(time * 0.002) * 0.035;
    const size = Math.min(width, height) / 700;
    context.save();
    context.translate(center.x, y);
    context.scale(pulse * camera.zoom, 0.22 * camera.zoom);
    context.globalCompositeOperation = "lighter";
    for (const ring of rings) {
      ring.rotation += ring.speed * delta / 16.67;
      context.save();
      context.rotate(ring.rotation + camera.rotationY * ring.tilt);
      context.scale(1, ring.flatten);
      context.beginPath();
      context.strokeStyle = `rgba(255, ${110 + ring.alpha * 80}, ${180 + ring.alpha * 60}, ${ring.alpha})`;
      context.lineWidth = 1.1 + size;
      context.shadowBlur = 16;
      context.shadowColor = "rgba(255, 20, 137, 0.88)";
      context.ellipse(0, 0, ring.radius * size, ring.radius * size * (1 + ring.tilt * 0.22), 0, 0, TAU);
      context.stroke();
      context.restore();
    }
    context.restore();
  }

  function drawHeart(time) {
    const center = sceneCenter();
    const beat = 1 + Math.sin(time * 0.0042) * 0.028;
    const visibleCount = Math.floor(heartParticles.length * heartProgress);
    const heartScale = Math.min(width, height) * 0.0095;
    const points = [];
    for (let index = 0; index < visibleCount; index += 1) {
      const particle = heartParticles[index];
      const projection = transformPoint({ x: particle.x * beat, y: particle.y * beat, z: particle.z }, {
        rotationX: rotationX + Math.sin(rotationY * 0.7) * 0.12,
        rotationY,
        rotationZ
      });
      points.push({ particle, projection });
    }
    points.sort((first, second) => first.projection.z - second.projection.z);
    context.save();
    context.globalCompositeOperation = "lighter";
    context.beginPath();
    for (let index = 0; index <= 96; index += 1) {
      const outline = heartPoint(index / 96 * TAU);
      const projection = transformPoint({ x: outline.x * heartScale * beat, y: -outline.y * heartScale * beat, z: 0 }, {
        rotationX: rotationX + Math.sin(rotationY * 0.7) * 0.12,
        rotationY,
        rotationZ
      });
      const x = center.x + projection.x;
      const y = center.y + projection.y;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.closePath();
    context.strokeStyle = "rgba(255, 73, 166, 0.5)";
    context.lineWidth = 1.15;
    context.shadowBlur = 16;
    context.shadowColor = "rgba(255, 17, 129, 0.9)";
    context.stroke();
    for (const point of points) {
      const particle = point.particle;
      const shimmer = 0.76 + Math.sin(time * 0.002 * particle.speed + particle.phase) * 0.24;
      context.beginPath();
      context.fillStyle = `hsla(${particle.hue}, 100%, 72%, ${particle.alpha * shimmer})`;
      context.shadowBlur = 10;
      context.shadowColor = "rgba(255, 22, 133, 0.95)";
      context.arc(center.x + point.projection.x, center.y + point.projection.y, particle.size * point.projection.scale, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  function drawOrbitParticles(time, delta, frontLayer) {
    const center = sceneCenter();
    const points = [];
    for (const particle of orbitParticles) {
      particle.angle += particle.speed * delta;
      const x = Math.cos(particle.angle) * particle.radius;
      const y = Math.sin(particle.angle) * particle.radius * (particle.plane === 1 ? 0.22 : 0.55);
      const z = particle.plane === 2 ? Math.sin(particle.angle) * particle.radius : Math.sin(particle.angle) * particle.radius * particle.tilt;
      points.push({ particle, projection: transformPoint({ x, y, z }, { rotationX: particle.plane === 1 ? 0.75 : 0, rotationY: particle.plane === 2 ? 0.7 : 0 }) });
    }
    points.sort((first, second) => first.projection.z - second.projection.z);
    context.save();
    context.globalCompositeOperation = "lighter";
    for (const point of points) {
      const isFront = point.projection.z >= 0;
      if (isFront !== frontLayer) continue;
      const particle = point.particle;
      const alpha = particle.alpha * (0.72 + Math.sin(time * 0.002 + particle.phase) * 0.28);
      context.beginPath();
      context.fillStyle = `rgba(255, 116, 190, ${alpha})`;
      context.shadowBlur = 8;
      context.shadowColor = "rgba(255, 25, 143, 0.85)";
      context.arc(center.x + point.projection.x, center.y + point.projection.y, particle.size * point.projection.scale, 0, TAU);
      context.fill();
    }
    context.restore();
  }

  function drawShootingStars(delta) {
    nextShootingStar -= delta;
    if (nextShootingStar <= 0) {
      shootingStars.push({ x: random(width * 0.08, width * 0.65), y: random(height * 0.08, height * 0.42), life: 0, maxLife: 75, speed: random(5, 8) });
      nextShootingStar = random(4000, 10000);
    }
    context.save();
    context.globalCompositeOperation = "lighter";
    for (let index = shootingStars.length - 1; index >= 0; index -= 1) {
      const star = shootingStars[index];
      star.x += star.speed;
      star.y += star.speed * 0.42;
      star.life += 1;
      const alpha = 1 - star.life / star.maxLife;
      context.beginPath();
      context.strokeStyle = `rgba(255, 186, 224, ${alpha})`;
      context.lineWidth = 1.4;
      context.shadowBlur = 9;
      context.shadowColor = "rgba(255, 53, 151, 0.9)";
      context.moveTo(star.x, star.y);
      context.lineTo(star.x - 42, star.y - 18);
      context.stroke();
      if (star.life > star.maxLife) shootingStars.splice(index, 1);
    }
    context.restore();
  }

  function addEffect(x, y, amount = 12, special = false) {
    const symbols = ["❤", "💕", "💗", "✨", "⭐"];
    const total = special ? amount * 2 : amount;
    for (let index = 0; index < total; index += 1) {
      const angle = random(-Math.PI, 0);
      const speed = random(0.5, special ? 3.4 : 2.4);
      effects.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - random(0.3, 1.3), life: random(45, special ? 115 : 90), maxLife: special ? 115 : 90, size: random(10, special ? 23 : 18), symbol: symbols[Math.floor(Math.random() * symbols.length)] });
    }
  }

  function drawEffects() {
    context.save();
    context.textAlign = "center";
    context.textBaseline = "middle";
    for (let index = effects.length - 1; index >= 0; index -= 1) {
      const effect = effects[index];
      effect.x += effect.vx;
      effect.y += effect.vy;
      effect.vy -= 0.008;
      effect.life -= 1;
      if (effect.life <= 0) {
        effects.splice(index, 1);
        continue;
      }
      context.globalAlpha = clamp(effect.life / effect.maxLife, 0, 1);
      context.font = `${effect.size}px serif`;
      context.shadowBlur = 12;
      context.shadowColor = "rgba(255, 26, 136, 0.9)";
      context.fillStyle = "#ff9ac9";
      context.fillText(effect.symbol, effect.x, effect.y);
    }
    context.restore();
  }

  function mostrarFrase(scheduleNext = true) {
    if (!phrases.length) return;
    if (visiblePhraseIndexes.length >= 6) {
      const oldestIndex = visiblePhraseIndexes.shift();
      phrases[oldestIndex].classList.remove("is-visible");
    }
    const phrase = phrases[phraseIndex];
    const positions = [[5, 30], [76, 30], [3, 66], [79, 66], [13, 78], [67, 78], [4, 45], [82, 45], [22, 86], [55, 86], [14, 24], [72, 24], [2, 56], [84, 56], [26, 74], [57, 74], [11, 70], [70, 70], [20, 91], [47, 91], [8, 38], [87, 38], [30, 82], [64, 82], [18, 65], [73, 58], [40, 88]];
    const [left, top] = positions[phraseIndex % positions.length];
    phrase.style.left = `${left}%`;
    phrase.style.top = `${top}%`;
    phrase.style.right = "auto";
    phrase.classList.add("is-visible");
    visiblePhraseIndexes.push(phraseIndex);
    phraseIndex = (phraseIndex + 1) % phrases.length;
    if (scheduleNext) window.setTimeout(mostrarFrase, 2800);
  }

  function iniciarFrases() {
    phrases.forEach((phrase) => phrase.classList.remove("is-visible"));
    visiblePhraseIndexes.length = 0;
    phraseIndex = 0;
    for (let index = 0; index < 5; index += 1) {
      window.setTimeout(() => mostrarFrase(false), 450 + index * 420);
    }
    window.setTimeout(mostrarFrase, 3600);
  }

  function updateCamera() {
    camera.zoom += (camera.targetZoom - camera.zoom) * 0.08;
    camera.rotationX += (cameraVelocity.x - camera.rotationX) * 0.04;
    camera.rotationY += (cameraVelocity.y - camera.rotationY) * 0.04;
    cameraVelocity.x *= 0.94;
    cameraVelocity.y *= 0.94;
  }

  async function iniciarMusica() {
    try {
      audio.currentTime = 0;
      await audio.play();
      console.log("Música reproduciéndose correctamente");
      setMusicState(true);
    } catch (error) {
      console.error("No se pudo reproducir la música:", error);
      setMusicState(false);
    }
  }

  function setMusicState(isPlaying) {
    musicIcon.textContent = isPlaying ? "♫" : "🔇";
    musicToggle.setAttribute("aria-label", isPlaying ? "Pausar música" : "Reproducir música");
    musicToggle.setAttribute("aria-pressed", String(isPlaying));
  }

  function startExperience() {
    if (started) return;
    started = true;
    welcomeScreen.classList.add("is-hidden");
    experience.classList.add("is-visible");
    heartProgress = 0;
    iniciarMusica();
    iniciarFrases();
  }

  function toggleMusic(event) {
    event.stopPropagation();
    if (!started) return;
    if (audio.paused) {
      audio.play().then(() => setMusicState(true)).catch((error) => console.error("No se pudo reproducir la música:", error));
    } else {
      audio.pause();
      setMusicState(false);
    }
  }

  function resetCamera() {
    camera.targetZoom = 1;
    camera.rotationX = 0;
    camera.rotationY = 0;
    cameraVelocity.x = 0;
    cameraVelocity.y = 0;
    pointer.x = 0;
    pointer.y = 0;
  }

  function adjustZoom(amount) {
    camera.targetZoom = clamp(camera.targetZoom + amount, 0.5, 2.5);
  }

  function pointerDistance() {
    const points = [...activePointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  function handlePointerDown(event) {
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    canvas.setPointerCapture(event.pointerId);
    if (activePointers.size === 2) {
      pinchDistance = pointerDistance();
      pointer.down = false;
      return;
    }
    pointer.down = true;
    pointer.moved = false;
    pointer.startX = event.clientX;
    pointer.startY = event.clientY;
  }

  function handlePointerMove(event) {
    const previous = activePointers.get(event.pointerId);
    activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pointer.x = clamp((event.clientX - width / 2) / (width / 2), -1, 1);
    pointer.y = clamp((event.clientY - height / 2) / (height / 2), -1, 1);
    if (activePointers.size >= 2) {
      const currentDistance = pointerDistance();
      if (pinchDistance && currentDistance) adjustZoom((currentDistance - pinchDistance) * 0.0025);
      pinchDistance = currentDistance;
      event.preventDefault();
      return;
    }
    if (!pointer.down || !previous) return;
    const movementX = event.clientX - previous.x;
    const movementY = event.clientY - previous.y;
    if (Math.hypot(event.clientX - pointer.startX, event.clientY - pointer.startY) > 7) pointer.moved = true;
    cameraVelocity.y = clamp(cameraVelocity.y + movementX * 0.0018, -0.8, 0.8);
    cameraVelocity.x = clamp(cameraVelocity.x + movementY * 0.0018, -0.8, 0.8);
    event.preventDefault();
  }

  function handlePointerUp(event) {
    activePointers.delete(event.pointerId);
    if (activePointers.size < 2) pinchDistance = 0;
    if (pointer.down && !pointer.moved && started) addEffect(event.clientX, event.clientY, 11);
    pointer.down = false;
  }

  function animate(time) {
    const delta = Math.min(time - lastFrame || 16.67, 50);
    lastFrame = time;
    rotationY += 0.003 * delta / 16.67;
    rotationZ += 0.001 * delta / 16.67;
    rotationX += 0.00025 * delta / 16.67;
    galaxyRotation += 0.0008 * delta / 16.67;
    updateCamera();
    context.clearRect(0, 0, width, height);
    if (started) {
      drawNebulaLights(time);
      drawStars(time, delta);
      drawGalaxy(time, delta);
      drawPlatform(time, delta);
      drawOrbitParticles(time, delta, false);
      if (heartProgress < 1) heartProgress = Math.min(1, heartProgress + delta * 0.00038);
      drawHeart(time);
      drawOrbitParticles(time, 0, true);
      drawShootingStars(delta);
      drawEffects();
    }
    window.requestAnimationFrame(animate);
  }

  resizeCanvas();
  createStars();
  createGalaxy();
  createHeart();
  audio.volume = 0.7;
  setMusicState(false);
  window.requestAnimationFrame(animate);

  audio.addEventListener("error", () => {
    console.error("Error cargando assets/audio/musica.mp3");
  });
  surpriseButton.addEventListener("click", startExperience);
  musicToggle.addEventListener("click", toggleMusic);
  zoomInButton.addEventListener("click", () => adjustZoom(0.2));
  zoomOutButton.addEventListener("click", () => adjustZoom(-0.2));
  resetCameraButton.addEventListener("click", resetCamera);
  canvas.addEventListener("wheel", (event) => {
    event.preventDefault();
    adjustZoom(event.deltaY < 0 ? 0.18 : -0.18);
  }, { passive: false });
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove, { passive: false });
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);
  canvas.addEventListener("dblclick", (event) => {
    if (started) addEffect(event.clientX, event.clientY, 20, true);
  });

  window.addEventListener("resize", () => {
    resizeCanvas();
    createStars();
    createGalaxy();
    createHeart();
  });
})();
