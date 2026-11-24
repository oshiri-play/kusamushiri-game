"use strict";

const SETTINGS = {
  duration: 45_000,
  regrow: 3_000,
  grassSpacing: 27,
  phone: { targetCells: 700, minSpacing: 15.5, maxSpacing: 20.5, actorScale: 0.75, shortViewport: 630 },
  tapRadius: 21,
  swipeRadius: 12,
  cow: { first: [2_800, 4_100], gap: [2_050, 2_600], max: 3, duration: 7_500, speed: 255, radius: 36, cadence: 100 },
  fire: { first: [5_500, 7_400], gap: [3_550, 4_650], max: 2, duration: 8_400, speed: 153, radius: 64.5,
    cadence: 1_330, warning: 825, lifetime: 1_640 },
  enemyMaxLoss: 0.53,
  fever: { threshold: 80, duration: 5_000, radius: 90 },
  combo: { window: 950, interval: 8, bonus: 3 },
  meteor: { window: [16_000, 25_000], count: 1, warning: 1_100, gap: 440, portion: 0.33 },
  water: { radius: 49, perSecond: 63, burst: 9, bonusEvery: 12, bonus: 8, hardChance: 0.22, stubbornChance: 0.17,
    density: 1.75, growth: 230 },
  finale: { seconds: 10, countdown: 5, closeRecord: 80, distantRecord: 260, goals: [120, 300, 600, 1_000, 1_500, 2_500] },
  challengeMax: 50_000,
};

const RULES_VERSION = "0.8";
const GRASS_TYPES = {
  normal: { points: 1, hits: 1 },
  hard: { points: 3, hits: 3 },
  stubborn: { points: 8, hits: Infinity },
};

const $ = (id) => document.getElementById(id);
const shell = document.querySelector(".shell");
const canvas = $("lawn");
const ctx = canvas.getContext("2d", { alpha: false });
const ground = document.createElement("canvas");
const groundCtx = ground.getContext("2d");
const grassSprites = LawnArt.grassSprites();
const ashSprites = LawnArt.scorchSprites();
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const phonePortrait = window.matchMedia("(max-width: 650px) and (orientation: portrait)");
const BEST_KEY = "kusamushiri.best.45s";
const LAST_RUN_KEY = "kusamushiri.lastRun.45s";
const SOUND_KEY = "kusamushiri.sound";
const bestFromStorage = Number(readStorage(BEST_KEY));
let best = Number.isSafeInteger(bestFromStorage) && bestFromStorage > 0 ? bestFromStorage : 0;
let muted = readStorage(SOUND_KEY) === "off";
let audio;
let lastPluck = -Infinity;
let lastImpact = -Infinity;
let width = 0;
let height = 0;
let pixelRatio = 0;
let columns = 0;
let rows = 0;
let gridSpacing = SETTINGS.grassSpacing;
let grass = [];
let state = "ready";
let score = 0;
let started = 0;
let frameId = 0;
let previousFrame = 0;
let lastSecond = -1;
let lastMeter = "";
let feverUntil = 0;
let feverMeter = 0;
let feverScore = 0;
let combo = 0;
let maxCombo = 0;
let lastClear = -Infinity;
let pointer = null;
let mower = null;
let actors = [];
let fires = [];
let particles = [];
let popups = [];
let notices = [];
let nextCow = 0;
let nextFire = 0;
let playRandom = Math.random;
let runSeed = 0;
let lastRun = readLastRun();
let lastRunGoal = 0;
let passedBest = false;
let feverCount = 0;
let meteorDue = Infinity;
let meteors = [];
const scorched = new Set();
const enemyClears = new Set();
let restored = 0;
let waterCredit = 0;
let waterTick = 0;
let spray = null;
let lastWaterHUD = "";
const challengeTarget = parseChallenge(location.search);

function readStorage(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function saveStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Keep the current session playable when storage is unavailable.
  }
}

function readLastRun() {
  try {
    const run = JSON.parse(readStorage(LAST_RUN_KEY));
    return run?.rulesVersion === RULES_VERSION && Number.isSafeInteger(run.score) && run.score >= 0 ? run : null;
  } catch {
    return null;
  }
}

function parseChallenge(search) {
  const values = new URLSearchParams(search).getAll("challenge");
  if (values.length !== 1 || !/^[1-9][0-9]{0,4}$/.test(values[0])) return 0;
  const target = Number(values[0]);
  return target <= SETTINGS.challengeMax ? target : 0;
}

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6D2B79F5) >>> 0;
    let bits = Math.imul(value ^ value >>> 15, value | 1);
    bits ^= bits + Math.imul(bits ^ bits >>> 7, bits | 61);
    return ((bits ^ bits >>> 14) >>> 0) / 0x100000000;
  };
}

function soundUI() {
  $("sound").setAttribute("aria-pressed", String(!muted));
  $("sound-icon").textContent = muted ? "×" : "♪";
  $("sound-label").textContent = muted ? "効果音 OFF" : "効果音 ON";
}

function unlockAudio() {
  if (muted) return;
  const Audio = window.AudioContext || window.webkitAudioContext;
  if (!Audio) return;
  try {
    audio ??= new Audio();
    if (audio.state !== "running") audio.resume().catch(() => {});
  } catch {
    audio = null;
  }
}

function tone(from, to, duration, gain, delay = 0, wave = "sine") {
  if (muted || audio?.state !== "running") return;
  const oscillator = audio.createOscillator();
  const volume = audio.createGain();
  const start = audio.currentTime + delay;
  oscillator.type = wave;
  oscillator.frequency.setValueAtTime(from, start);
  oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  volume.gain.setValueAtTime(0.001, start);
  volume.gain.exponentialRampToValueAtTime(gain, start + 0.009);
  volume.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(volume);
  volume.connect(audio.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.01);
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function playRange(min, max) {
  return min + playRandom() * (max - min);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setState(next) {
  state = next;
  shell.dataset.state = next;
  document.body.classList.toggle("is-playing", next === "playing");
  $("intro").hidden = next !== "ready";
  $("result").hidden = next !== "result";
  $("field-tools").hidden = next !== "playing";
}

function seedGrass() {
  const phone = SETTINGS.phone;
  gridSpacing = phonePortrait.matches
    ? clamp(Math.sqrt(width * height / phone.targetCells), phone.minSpacing, phone.maxSpacing)
    : SETTINGS.grassSpacing;
  columns = Math.max(1, Math.round(width / gridSpacing));
  rows = Math.max(1, Math.round(height / gridSpacing));
  grass = Array.from({ length: columns * rows }, (_, index) => {
    const roll = playRandom();
    return {
      index,
      u: (index % columns + playRange(0.28, 0.72)) / columns,
      v: (Math.floor(index / columns) + playRange(0.28, 0.72)) / rows,
      type: roll < 0.69 ? "normal" : roll < 0.89 ? "hard" : "stubborn",
      sprite: Math.floor(random(0, grassSprites.normal.length)),
      size: random(0.85, 1.07),
      regrowsAt: 0,
      hits: 0,
      struckAt: -Infinity,
    };
  });
  placeGrass();
}

function placeGrass() {
  for (const tuft of grass) {
    tuft.x = tuft.u * width;
    tuft.y = tuft.v * height;
    if (tuft.extra) {
      tuft.extra.x = tuft.extra.u * width;
      tuft.extra.y = tuft.extra.v * height;
    }
  }
}

function paintGround() {
  ground.width = canvas.width;
  ground.height = canvas.height;
  groundCtx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  const wash = groundCtx.createLinearGradient(0, 0, width, height);
  wash.addColorStop(0, "#c8ed78");
  wash.addColorStop(0.46, "#a8d951");
  wash.addColorStop(1, "#83bc48");
  groundCtx.fillStyle = wash;
  groundCtx.fillRect(0, 0, width, height);

  groundCtx.save();
  groundCtx.scale(width / 1000, height / 550);
  groundCtx.strokeStyle = "#f0f5b527";
  groundCtx.lineWidth = 26;
  for (let stripe = -180; stripe < 1240; stripe += 78) {
    groundCtx.beginPath();
    groundCtx.moveTo(stripe - 162, 0);
    groundCtx.bezierCurveTo(stripe + 50, 178, stripe - 20, 380, stripe + 170, 550);
    groundCtx.stroke();
  }
  groundCtx.restore();

  for (let i = 0; i < 250; i++) {
    const x = ((i * 89.77) % 251) / 251 * width;
    const y = ((i * 53.49) % 241) / 241 * height;
    LawnArt.oval(groundCtx, x, y, i % 7 === 0 ? 2.2 : 1.1, 0.9,
      i % 7 === 0 ? "#fff3a9bb" : "#56824444");
  }
}

function syncPlayViewport() {
  if (!phonePortrait.matches) return;
  const viewport = window.visualViewport;
  const useVisualViewport = viewport?.height > 0 && Math.abs(viewport.scale - 1) < 0.01;
  const availableHeight = useVisualViewport ? viewport.height : window.innerHeight;
  if (useVisualViewport) {
    shell.style.setProperty("--play-viewport-height", Math.floor(viewport.height) + "px");
  } else {
    shell.style.removeProperty("--play-viewport-height");
  }
  shell.classList.toggle("short-play-viewport", availableHeight <= SETTINGS.phone.shortViewport);
}

function alignPointer(bounds) {
  if (!pointer) return;
  pointer.point.x += pointer.bounds.left - bounds.left;
  pointer.point.y += pointer.bounds.top - bounds.top;
  pointer.bounds = bounds;
}

function fitField(reseed = false, bounds = canvas.getBoundingClientRect()) {
  if (!bounds.width || !bounds.height) return;
  alignPointer(bounds);
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  const changed = bounds.width !== width || bounds.height !== height || ratio !== pixelRatio;
  if (changed) {
    const scaleX = bounds.width / (width || bounds.width);
    const scaleY = bounds.height / (height || bounds.height);
    for (const item of [...actors, ...fires, ...particles, ...popups, ...meteors]) {
      item.x *= scaleX;
      item.y *= scaleY;
      if (item.target) {
        item.target.x *= scaleX;
        item.target.y *= scaleY;
      }
    }
    if (mower) {
      mower.x *= scaleX;
      mower.y *= scaleY;
    }
    if (spray) {
      spray.x *= scaleX;
      spray.y *= scaleY;
    }
    width = bounds.width;
    height = bounds.height;
    pixelRatio = ratio;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintGround();
  }
  if (reseed || !grass.length || (changed && state === "ready")) seedGrass();
  else if (changed) placeGrass();
  if (state !== "playing") render(state === "ready" ? 0 : SETTINGS.duration);
}

function visitNear(minX, minY, maxX, maxY, visitor) {
  const left = clamp(Math.floor(minX / width * columns), 0, columns - 1);
  const right = clamp(Math.floor(maxX / width * columns), 0, columns - 1);
  const top = clamp(Math.floor(minY / height * rows), 0, rows - 1);
  const bottom = clamp(Math.floor(maxY / height * rows), 0, rows - 1);
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const tuft = grass[row * columns + col];
      visitor(tuft);
      if (tuft.extra) visitor(tuft.extra);
    }
  }
}

function notify(text, kind, elapsed, duration = 1_750) {
  const item = document.createElement("div");
  item.className = "notice " + kind;
  item.textContent = text;
  $("notices").append(item);
  notices.push({ item, until: elapsed + duration });
}

function activeFever(elapsed) {
  return elapsed < feverUntil;
}

function meteorIncoming() {
  return meteors.some((meteor) => !meteor.landed);
}

function tryFever(elapsed) {
  if (feverMeter < SETTINGS.fever.threshold || activeFever(elapsed) || meteorIncoming()) return false;
  activateFever(elapsed);
  return true;
}

function activateFever(elapsed) {
  feverMeter = 0;
  combo = 0;
  lastClear = -Infinity;
  feverUntil = elapsed + SETTINGS.fever.duration;
  feverCount++;
  mower = null;
  notify("草刈機フィーバー!!", "fever", elapsed, 1_600);
  scatter(width / 2, Math.min(height * 0.32, 170), elapsed);
  [262, 392, 523, 659, 784].forEach((note, index) => {
    tone(note, note * 1.03, 0.3, 0.055, index * 0.068, "triangle");
  });
  tone(140, 52, 0.42, 0.105, 0.22, "triangle");
}

function bestGap(total, target) {
  if (!target) return total ? "初記録ペース" : "記録なし";
  if (total === target) return "ベストタイ";
  return total < target ? "あと " + (target - total) + " 点" : "+" + (total - target) + " 点";
}

function updateWaterHUD() {
  const status = [state, scorched.size, restored].join("/");
  if (status === lastWaterHUD) return;
  $("water-status").textContent = scorched.size ? "なぞって復旧 · 残り " + scorched.size : restored ? "超豊作！！" : "焦げ跡もそのままなぞる";
  $("water-status").classList.toggle("active", Boolean(scorched.size));
  lastWaterHUD = status;
}

function playGoal() {
  if (challengeTarget) {
    if (score > challengeTarget) return "友達の記録を突破！";
    return "友達の記録まで " + (challengeTarget - score + 1) + " 点";
  }
  if (best && best - score <= SETTINGS.finale.distantRecord) return passedBest ? "新記録を更新中！" : "";
  if (lastRunGoal > score && lastRunGoal - score <= SETTINGS.finale.distantRecord) return "前回のスコア " + lastRunGoal + " 点へ";
  const milestone = SETTINGS.finale.goals.find((target) => target > score);
  return milestone ? "次の目標 " + milestone + " 点" : "";
}

function updateHUD(elapsed) {
  const seconds = Math.max(0, Math.ceil((SETTINGS.duration - elapsed) / 1000));
  if (seconds !== lastSecond) {
    $("time").textContent = seconds;
    const finale = seconds <= SETTINGS.finale.seconds && state === "playing";
    $("timer").classList.toggle("urgent", finale);
    $("field").classList.toggle("clutch", finale);
    const countdown = finale && seconds <= SETTINGS.finale.countdown && seconds > 0;
    $("countdown").hidden = !countdown;
    if (countdown) $("countdown").textContent = seconds;
    if (finale && lastSecond > SETTINGS.finale.seconds) notify("ラスト10秒！", "countdown", elapsed, 1_550);
    if (finale && (lastSecond > SETTINGS.finale.seconds || countdown)) tone(410 + (6 - seconds) * 32, 645, 0.12, 0.06);
    lastSecond = seconds;
  }
  const hot = state === "playing" && activeFever(elapsed);
  const remaining = hot ? Math.ceil((feverUntil - elapsed) / 100) * 100 : 0;
  const meter = [score, best, hot, remaining, feverMeter, feverScore, combo, state].join("/");
  if (meter !== lastMeter) {
    $("best").textContent = best;
    $("score").textContent = score;
    $("field").classList.toggle("fever", hot);
    $("progress").parentElement.classList.toggle("hot", hot);
    $("meter-label").textContent = hot ? "フィーバー残り" : "フィーバーゲージ";
    $("progress").max = hot ? SETTINGS.fever.duration : SETTINGS.fever.threshold;
    $("progress").value = hot ? remaining : feverMeter;
    const missing = Math.max(0, SETTINGS.fever.threshold - feverMeter);
    $("progress-text").textContent = hot ? (remaining / 1000).toFixed(1) + " 秒" :
      !missing ? "発動待ち" : "あと " + missing + " 点";
    $("combo").textContent = combo;
    $("fever-points").textContent = feverScore;
    $("best-gap").textContent = bestGap(score, best);
    $("play-goal").textContent = playGoal();
    lastMeter = meter;
  }
  updateWaterHUD();
}

function scoreFeedback(elapsed) {
  if (passedBest || !best || score <= best) return;
  passedBest = true;
  notify("NEW RECORD!", "new-record", elapsed, 1_450);
  scatter(width * 0.5, height * 0.22, elapsed);
  chord([440, 554, 659, 880], 0.05);
}

function chord(notes, gain) {
  notes.forEach((note, index) => tone(note, note * 1.08, 0.28, gain, index * 0.065, "triangle"));
}

function burst(x, y, elapsed, hot) {
  const count = reduceMotion.matches ? 1 : hot ? 6 : 3;
  for (let index = 0; index < count && particles.length < 240; index++) {
    particles.push({
      x, y, start: elapsed, vx: random(hot ? -100 : -47, hot ? 100 : 47), vy: random(hot ? -165 : -93, -36),
      life: 360, size: random(2.1, hot ? 6.1 : 4.2),
      color: hot ? (index % 2 ? "#d9ff61" : "#fff491") : index % 2 ? "#f7ffc0" : "#224531",
      spin: hot ? random(-12, 12) : 0,
    });
  }
}

function scatter(x, y, elapsed) {
  const count = reduceMotion.matches ? 12 : 48;
  const colors = ["#fff38d", "#ffc13b", "#ff5a9e", "#a7ff6c", "#66f2ff"];
  for (let index = 0; index < count && particles.length < 240; index++) {
    particles.push({
      x, y, start: elapsed, vx: random(-310, 310), vy: random(-200, 8), spin: random(-7, 7),
      size: random(3, 6.5), life: random(640, 1_090), color: colors[index % colors.length],
    });
  }
}

function floatScore(label, x, y, elapsed, hot) {
  if (popups.length === 20) popups.shift();
  popups.push({ label, x, y, start: elapsed, hot });
}

function attempt(tuft, elapsed, hot, gesture) {
  if (tuft.scar || tuft.regrowsAt > elapsed) return 0;
  const type = GRASS_TYPES[tuft.type];
  if (!hot && type.hits > 1) {
    if (gesture.has(tuft)) return 0;
    gesture.add(tuft);
    tuft.struckAt = elapsed;
    if (tuft.type === "hard") tuft.hits++;
    if (tuft.hits < type.hits) {
      burst(tuft.x, tuft.y - 7, elapsed, false);
      if (elapsed - lastImpact > 78) {
        tone(tuft.type === "hard" ? 245 : 130, 95, 0.085, 0.052, 0, "triangle");
        lastImpact = elapsed;
      }
      return 0;
    }
  }
  tuft.hits = 0;
  tuft.struckAt = -Infinity;
  tuft.regrowsAt = elapsed + SETTINGS.regrow;
  score += type.points;
  if (hot) feverScore += type.points;
  else {
    feverMeter += type.points;
    combo = elapsed - lastClear < SETTINGS.combo.window ? combo + 1 : 1;
    maxCombo = Math.max(maxCombo, combo);
    lastClear = elapsed;
    if (combo % SETTINGS.combo.interval === 0) score += SETTINGS.combo.bonus;
  }
  burst(tuft.x, tuft.y - 5, elapsed, hot);
  return type.points;
}

function distanceToStroke(x, y, from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const fraction = lengthSquared ? clamp(((x - from.x) * dx + (y - from.y) * dy) / lengthSquared, 0, 1) : 0;
  return (x - from.x - fraction * dx) ** 2 + (y - from.y - fraction * dy) ** 2;
}

function harvest(from, to, tap, gesture) {
  const elapsed = performance.now() - started;
  if (state !== "playing" || elapsed >= SETTINGS.duration) return;
  const hot = activeFever(elapsed);
  const wetPoint = scorched.size ? scorchedPointOnStroke(from, to) : null;
  if (!hot && tap && wetPoint) {
    waterStroke(from, to, elapsed, wetPoint);
    return;
  }
  const radius = hot ? SETTINGS.fever.radius : tap ? SETTINGS.tapRadius : SETTINGS.swipeRadius;
  const before = score;
  const comboBefore = combo;
  let basePoints = 0;
  let nearest = null;
  let nearestDistance = radius ** 2;
  visitNear(Math.min(from.x, to.x) - radius, Math.min(from.y, to.y) - radius + 5,
    Math.max(from.x, to.x) + radius, Math.max(from.y, to.y) + radius + 5, (tuft) => {
      const distance = distanceToStroke(tuft.x, tuft.y - 5, from, to);
      if (distance > radius ** 2) return;
      if (!hot && tap) {
        if (distance <= nearestDistance) {
          nearest = tuft;
          nearestDistance = distance;
        }
      } else {
        basePoints += attempt(tuft, elapsed, hot, gesture);
      }
    });
  if (nearest) basePoints += attempt(nearest, elapsed, false, gesture);
  if (hot) {
    mower = { ...to, facing: to.x === from.x ? mower?.facing ?? 1 : Math.sign(to.x - from.x),
      tilt: clamp((to.y - from.y) / 56, -0.27, 0.27) };
  } else if (tryFever(elapsed)) {
    mower = { ...to, facing: 1 };
  }
  if (score > before) {
    const bonus = score - before - basePoints;
    const finale = SETTINGS.duration - elapsed <= SETTINGS.finale.seconds * 1000;
    if (hot || finale || tap || basePoints >= 3 || bonus) floatScore("+" + basePoints, to.x, to.y, elapsed, hot || finale);
    if (bonus) {
      floatScore("コンボ +" + bonus, to.x, to.y - 26, elapsed, true);
      tone(440, 620, 0.16, 0.055, 0.05, "triangle");
    }
    if (elapsed - lastPluck > 47) {
      const pitch = 360 + Math.min(comboBefore, 24) * 11;
      tone(hot ? 100 : pitch, hot ? 240 : pitch * 0.73, hot ? 0.125 : 0.075,
        hot ? 0.071 : 0.05, 0, hot ? "triangle" : "sine");
      lastPluck = elapsed;
    }
    scoreFeedback(elapsed);
    updateHUD(elapsed);
  }
  if (wetPoint) waterStroke(from, to, elapsed, wetPoint);
}

function despawnGrass(x, y, radius, elapsed, until) {
  const limit = Math.floor((grass.length - scorched.size) * SETTINGS.enemyMaxLoss);
  let removed = 0;
  visitNear(x - radius, y - radius, x + radius, y + radius, (tuft) => {
    if (enemyClears.size >= limit || tuft.scar || tuft.type === "stubborn" || tuft.regrowsAt > elapsed) return;
    if ((tuft.x - x) ** 2 + (tuft.y - y) ** 2 > radius ** 2) return;
    tuft.regrowsAt = until;
    tuft.hits = 0;
    tuft.struckAt = -Infinity;
    enemyClears.add(tuft);
    removed++;
  });
  return removed;
}

function chooseTarget(kind, elapsed, origin) {
  const radius = kind === "fire" ? SETTINGS.fire.radius : SETTINGS.cow.radius * 1.7;
  const marginX = Math.min(radius + 4, width / 2);
  const marginY = Math.min(radius + 4, height / 2);
  let target;
  let richest = -Infinity;
  const samples = origin ? 4 : 6;
  for (let sample = 0; sample < samples; sample++) {
    const x = origin ? clamp(origin.x + origin.facing * 55 + playRange(-65, 65), marginX, width - marginX) :
      playRange(marginX, width - marginX);
    const y = origin ? clamp(origin.y + playRange(-72, 72), marginY, height - marginY) :
      playRange(marginY, height - marginY);
    let live = 0;
    visitNear(x - radius, y - radius, x + radius, y + radius, (tuft) => {
      if (tuft.scar || tuft.type === "stubborn" || tuft.regrowsAt > elapsed) return;
      if ((tuft.x - x) ** 2 + (tuft.y - y) ** 2 < radius ** 2) live++;
    });
    if (kind === "fire") {
      for (const fire of fires) if (Math.hypot(fire.x - x, fire.y - y) < radius) live -= 5;
    }
    if (live > richest) {
      richest = live;
      target = { x, y };
    }
  }
  return target;
}

function enter(kind, elapsed) {
  const left = playRandom() < 0.5;
  const x = left ? -45 : width + 45;
  actors.push({
    kind, x, y: playRange(height * 0.18, height * 0.83), target: chooseTarget(kind, elapsed),
    exitLeft: !left, facing: left ? 1 : -1, start: elapsed, actionAt: elapsed + 400,
    dustAt: elapsed, chewUntil: 0, mood: "grin", emoteUntil: 0,
  });
  if (kind === "cow") {
    const calls = actors.filter((actor) => actor.kind === kind).length === 1 || playRandom() < 0.36;
    if (calls) {
      actors.at(-1).emoteUntil = elapsed + 850;
      notify("暴走牛！ モォォ！！", "cow", elapsed, 1_200);
      tone(138, 72, 0.48, 0.07, 0, "triangle");
      tone(269, 140, 0.28, 0.035, 0.04, "sawtooth");
    }
  } else {
    notify("放火おじさん接近！", "fire", elapsed, 1_200);
    tone(210, 99, 0.22, 0.065, 0, "triangle");
    tone(540, 680, 0.16, 0.048, 0.12, "triangle");
  }
}

function enemyParticles(x, y, elapsed, leaves, direction) {
  const count = reduceMotion.matches ? (leaves ? 1 : 0) : leaves ? 4 : 2;
  for (let index = 0; index < count && particles.length < 240; index++) {
    particles.push({ x, y, start: elapsed, vx: direction * random(27, 82), vy: random(-58, -25),
      life: 470, size: random(2.6, 5.3), spin: random(-9, 9),
      color: leaves ? index % 2 ? "#dfff73" : "#4d902d" : "#c1ac83" });
  }
}

function updateActors(elapsed, step) {
  for (const tuft of enemyClears) if (tuft.regrowsAt <= elapsed) enemyClears.delete(tuft);
  if (elapsed >= nextCow && actors.filter((actor) => actor.kind === "cow").length < SETTINGS.cow.max) {
    enter("cow", elapsed);
    nextCow = elapsed + playRange(...SETTINGS.cow.gap);
  }
  if (elapsed >= nextFire && actors.filter((actor) => actor.kind === "fire").length < SETTINGS.fire.max) {
    enter("fire", elapsed);
    nextFire = elapsed + playRange(...SETTINGS.fire.gap);
  }
  actors = actors.filter((actor) => {
    const config = SETTINGS[actor.kind];
    const leaving = elapsed - actor.start >= config.duration;
    const target = leaving ? { x: actor.exitLeft ? -65 : width + 65, y: actor.y } : actor.target;
    const dx = target.x - actor.x;
    const dy = target.y - actor.y;
    const distance = Math.hypot(dx, dy);
    if (leaving && distance < 2) return false;
    if (distance < 2) actor.target = chooseTarget(actor.kind, elapsed);
    if (distance > 0) {
      const advance = Math.min(distance, config.speed * step * (leaving ? 2.3 : 1));
      actor.x += dx / distance * advance;
      actor.y += dy / distance * advance;
      if (Math.abs(dx) > 1) actor.facing = Math.sign(dx);
    }
    if (actor.kind === "cow" && elapsed >= actor.dustAt) {
      enemyParticles(actor.x - actor.facing * 23, actor.y + 13, elapsed, false, -actor.facing);
      actor.dustAt = elapsed + 115;
    }
    if (leaving || elapsed < actor.actionAt || actor.x < 10 || actor.x > width - 10) return true;
    if (actor.kind === "cow") {
      const x = clamp(actor.x + actor.facing * 27, 0, width);
      const removed = despawnGrass(x, actor.y + 3, config.radius, elapsed, elapsed + SETTINGS.regrow);
      if (removed) {
        actor.chewUntil = elapsed + 210;
        enemyParticles(x, actor.y - 6, elapsed, true, actor.facing);
      }
    } else {
      const ignitesAt = elapsed + config.warning;
      actor.mood = "warn";
      actor.emoteUntil = ignitesAt;
      fires.push({
        ...chooseTarget("fire", elapsed, actor),
        ignitesAt, actor,
        until: ignitesAt + config.lifetime,
        lit: false,
      });
    }
    actor.actionAt = elapsed + config.cadence;
    return true;
  });
  fires = fires.filter((fire) => {
    if (elapsed >= fire.until) return false;
    if (!fire.lit && elapsed >= fire.ignitesAt) {
      fire.lit = true;
      const removed = despawnGrass(fire.x, fire.y, SETTINGS.fire.radius, elapsed, fire.until + SETTINGS.regrow);
      fire.fizzled = !removed;
      if (fire.actor) {
        fire.actor.mood = removed ? "laugh" : "frustrated";
        fire.actor.emoteUntil = elapsed + 830;
      }
      if (removed) {
        tone(150, 68, 0.22, 0.058, 0, "triangle");
        [172, 201, 160].forEach((pitch, index) => tone(pitch, pitch * 0.64, 0.145, 0.046, index * 0.115, "sawtooth"));
      } else {
        tone(250, 111, 0.25, 0.032, 0, "triangle");
      }
    }
    return true;
  });
}

function meteorFootprints(elapsed) {
  const config = SETTINGS.meteor;
  const count = clamp(Math.floor(config.count), 1, 3);
  const portion = clamp(config.portion, 0.05, 0.42);
  const spread = Math.sqrt(portion / (count * Math.PI));
  const total = Math.round(grass.length * portion);
  const available = new Set(grass);
  const start = (index) => Math.floor(total * index / count);
  const distance = (tuft, u, v) => ((tuft.index % columns + 0.5) / columns - u) ** 2 +
    ((Math.floor(tuft.index / columns) + 0.5) / rows - v) ** 2;
  return Array.from({ length: count }, (_, index) => {
    const u = playRange(spread + 0.02, 0.98 - spread);
    const v = playRange(spread + 0.02, 0.98 - spread);
    const targets = [...available].sort((a, b) => distance(a, u, v) - distance(b, u, v))
      .slice(0, start(index + 1) - start(index));
    for (const tuft of targets) available.delete(tuft);
    return { x: u * width, y: v * height, spread, targets,
      approachAt: elapsed + index * config.gap, landsAt: elapsed + config.warning + index * config.gap,
      landed: false, scarCount: 0 };
  });
}

function updateMeteors(elapsed) {
  const config = SETTINGS.meteor;
  if (elapsed >= meteorDue && !activeFever(elapsed)) {
    meteorDue = Infinity;
    meteors = meteorFootprints(elapsed);
    notify("超巨大隕石接近！！", "meteor", elapsed, config.warning + (meteors.length - 1) * config.gap);
    [330, 425, 530].forEach((pitch, index) => tone(pitch, pitch * 1.59, 0.21, 0.067, index * 0.28, "triangle"));
    tone(115, 180, 0.72, 0.045, 0, "sawtooth");
  }
  for (const meteor of meteors) {
    if (meteor.landed || elapsed < meteor.landsAt) continue;
    meteor.landed = true;
    meteor.impactAt = elapsed;
    const step = Math.max(1, Math.ceil(meteor.targets.length / 30));
    meteor.targets.forEach((tuft, index) => {
      if (index % step === 0 && !reduceMotion.matches) {
        enemyParticles(tuft.x, tuft.y, elapsed, true, Math.sign(tuft.x - meteor.x));
      }
      tuft.scar = meteor;
      tuft.hits = 0;
      tuft.struckAt = -Infinity;
      scorched.add(tuft);
      enemyClears.delete(tuft);
      meteor.scarCount++;
    });
    meteor.targets = [];
    notify("ドゴォォォン！！", "impact", elapsed, 650);
    if (!meteorIncoming()) notify("草原の3分の1が消滅！！", "recovery", elapsed, 2_100);
    tone(142, 31, 0.58, 0.12, 0, "triangle");
    tone(238, 52, 0.27, 0.045, 0.035, "sawtooth");
  }
}

function scarAt(point) {
  if (point.x < 0 || point.x >= width || point.y < 0 || point.y >= height) return false;
  const index = Math.floor(point.y / height * rows) * columns + Math.floor(point.x / width * columns);
  return Boolean(grass[index]?.scar);
}

function scorchedPointOnStroke(from, to) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const cell = Math.min(width / columns, height / rows);
  const samples = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (cell * 0.4)));
  for (let index = samples; index >= 0; index--) {
    const mix = index / samples;
    const point = { x: from.x + dx * mix, y: from.y + dy * mix };
    if (scarAt(point)) return point;
  }
  return null;
}

function restoredType() {
  const { stubbornChance, hardChance } = SETTINGS.water;
  const roll = playRandom();
  return roll < stubbornChance ? "stubborn" : roll < stubbornChance + hardChance ? "hard" : "normal";
}

function restoreGrass(tuft, elapsed) {
  tuft.scar.scarCount--;
  tuft.scar = null;
  scorched.delete(tuft);
  tuft.regrowsAt = elapsed;
  tuft.wetAt = elapsed;
  tuft.type = restoredType();
  if (playRandom() < clamp(SETTINGS.water.density - 1, 0, 1)) {
    const col = tuft.index % columns;
    const row = Math.floor(tuft.index / columns);
    const u = (col + (tuft.u * columns - col < 0.5 ? 0.82 : 0.18)) / columns;
    const v = (row + (tuft.v * rows - row < 0.5 ? 0.81 : 0.19)) / rows;
    tuft.extra = { u, v, x: u * width, y: v * height,
      type: restoredType(), sprite: (tuft.sprite + 2) % grassSprites.normal.length, size: 0.68,
      regrowsAt: elapsed, wetAt: elapsed, hits: 0, struckAt: -Infinity };
  }
}

function waterStroke(from, to, elapsed, wetPoint = to) {
  const config = SETTINGS.water;
  const rateScale = clamp(width * height / 560_000, 0.52, 1.26) * (SETTINGS.grassSpacing / gridSpacing) ** 2;
  waterCredit = Math.min(config.burst, waterCredit + Math.max(0, elapsed - waterTick) * config.perSecond * rateScale / 1000);
  waterTick = Math.max(waterTick, elapsed);
  const radius = config.radius;
  spray = { ...wetPoint, start: elapsed };
  if (waterCredit < 1) return;
  const before = restored;
  visitNear(Math.min(from.x, to.x) - radius, Math.min(from.y, to.y) - radius,
    Math.max(from.x, to.x) + radius, Math.max(from.y, to.y) + radius, (tuft) => {
      if (waterCredit < 1 || !tuft.scar || distanceToStroke(tuft.x, tuft.y, from, to) > radius ** 2) return;
      if (fires.some((fire) => fire.lit && !fire.fizzled && (tuft.x - fire.x) ** 2 + (tuft.y - fire.y) ** 2 <= SETTINGS.fire.radius ** 2)) return;
      waterCredit--;
      restored++;
      restoreGrass(tuft, elapsed);
      burst(tuft.x, tuft.y - 3, elapsed, false);
    });
  if (before === restored) return;
  const bonus = (Math.floor(restored / config.bonusEvery) - Math.floor(before / config.bonusEvery)) * config.bonus;
  if (bonus) {
    score += bonus;
    floatScore("再生 +" + bonus, wetPoint.x, wetPoint.y, elapsed, true);
    chord([392, 523, 698], 0.033);
    scoreFeedback(elapsed);
  } else if (elapsed - lastImpact > 125) {
    tone(292, 500, 0.095, 0.037, 0, "triangle");
    lastImpact = elapsed;
  }
  if (before === 0) notify("草、大復活！！", "recovery", elapsed, 1_150);
  if (!scorched.size) {
    notify("超豊作！！", "recovery", elapsed, 1_500);
    scatter(wetPoint.x, wetPoint.y, elapsed);
    chord([440, 587, 784], 0.04);
  }
  updateHUD(elapsed);
}

function drawTuft(tuft, elapsed, spacing, still) {
  if (tuft.scar || elapsed < tuft.regrowsAt) return;
  const wet = elapsed - (tuft.wetAt ?? -Infinity) < SETTINGS.water.growth;
  const growth = tuft.regrowsAt && !still ? clamp((elapsed - tuft.regrowsAt) / SETTINGS.water.growth, wet ? 0.16 : 0.3, 1) : 1;
  const size = clamp(spacing * 1.51, 23, 48) * tuft.size * growth;
  const impact = elapsed - tuft.struckAt;
  const bounce = impact < 260 && !still ? Math.sin(impact / 22) * (1 - impact / 260) * 5 : 0;
  const sprite = tuft.type === "normal" ? grassSprites.normal[tuft.sprite] : grassSprites[tuft.type];
  ctx.drawImage(sprite, tuft.x - size / 2 + bounce, tuft.y - size * 0.6875, size, size);
  if (tuft.hits || impact < 260) LawnArt.impact(ctx, tuft.x, tuft.y, tuft.hits, tuft.type, impact);
}

function render(elapsed) {
  if (!width || !height) return;
  ctx.drawImage(ground, 0, 0, width, height);
  const hot = activeFever(elapsed);
  const still = reduceMotion.matches;
  const finale = state === "playing" && SETTINGS.duration - elapsed <= SETTINGS.finale.seconds * 1000;
  if (hot || finale) {
    ctx.fillStyle = hot ? "#ffb2449c" : "#ee77603b";
    ctx.fillRect(0, 0, width, height);
  }
  const spacing = Math.min(width / columns, height / rows);
  const tileWidth = width / columns;
  const tileHeight = height / rows;
  for (const tuft of scorched) {
    ctx.drawImage(ashSprites[tuft.index % ashSprites.length], tuft.index % columns * tileWidth,
      Math.floor(tuft.index / columns) * tileHeight, tileWidth + 0.35, tileHeight + 0.35);
  }
  for (const tuft of grass) {
    drawTuft(tuft, elapsed, spacing, still);
    if (tuft.extra && !tuft.scar) drawTuft(tuft.extra, elapsed, spacing, still);
  }

  for (const fire of fires) {
    if (!fire.lit || fire.fizzled) continue;
    const phase = (elapsed - fire.ignitesAt) / 110;
    ctx.globalAlpha = clamp((fire.until - elapsed) / 240, 0, 1);
    LawnArt.oval(ctx, fire.x, fire.y + 3, SETTINGS.fire.radius * 0.8, 13, "#77542e57");
    for (const [dx, dy, scale] of [[-34, -3, 0.9], [-11, -13, 1.18], [15, -7, 1.05], [38, 7, 0.75], [4, 15, 0.89]]) {
      LawnArt.flame(ctx, fire.x + dx, fire.y + dy, scale, still ? 0 : phase + dx);
    }
    ctx.globalAlpha = 1;
  }
  for (const actor of actors) {
    const cow = actor.kind === "cow";
    const scale = phonePortrait.matches ? SETTINGS.phone.actorScale : 1;
    const phase = still ? 0 : elapsed / (cow ? 35 : 63);
    if (cow) LawnArt.cow(ctx, actor.x, actor.y, 0.89 * scale, actor.facing, phase, elapsed < actor.chewUntil);
    else LawnArt.gardener(ctx, actor.x, actor.y, 0.84 * scale, actor.facing, phase, elapsed < actor.emoteUntil ? actor.mood : "grin");
    if (elapsed < actor.emoteUntil && actor.x > 10 && actor.x < width - 10) {
      const message = cow ? "モォォ!!" : actor.mood === "laugh" ? "ガハハハ！" :
        actor.mood === "frustrated" ? "しまった！" : "";
      if (message) LawnArt.reaction(ctx, message, clamp(actor.x, 44, width - 44), Math.max(21, actor.y - 54 * scale), cow);
    }
  }
  for (const fire of fires) {
    if (!fire.lit) LawnArt.fireWarning(ctx, fire.x, fire.y, SETTINGS.fire.radius,
      (fire.ignitesAt - elapsed) / SETTINGS.fire.warning);
  }
  for (const meteor of meteors) {
    const rx = width * meteor.spread;
    const ry = height * meteor.spread;
    if (meteor.landed) {
      LawnArt.meteorImpact(ctx, meteor.x, meteor.y, rx, ry, elapsed - meteor.impactAt, meteor.scarCount, still);
    } else if (elapsed >= meteor.approachAt) {
      LawnArt.meteorApproach(ctx, meteor.x, meteor.y, rx, ry, (meteor.landsAt - elapsed) / SETTINGS.meteor.warning, still);
    }
  }
  if (spray && elapsed - spray.start < 340) {
    LawnArt.water(ctx, spray.x, spray.y, SETTINGS.water.radius, elapsed - spray.start, still);
  }
  if (mower && hot) {
    const phase = reduceMotion.matches ? 0 : elapsed / 50;
    LawnArt.turbo(ctx, mower.x, mower.y, SETTINGS.fever.radius, mower.facing, phase, reduceMotion.matches ? 0 : mower.tilt);
  }
  for (const particle of particles) {
    const age = (elapsed - particle.start) / 1000;
    ctx.globalAlpha = clamp(1 - (elapsed - particle.start) / particle.life, 0, 1);
    const x = particle.x + (reduceMotion.matches ? 0 : particle.vx * age);
    const y = particle.y + (reduceMotion.matches ? 0 : particle.vy * age + 170 * age * age);
    if (particle.spin) LawnArt.oval(ctx, x, y, particle.size, particle.size * 0.46, particle.color, null, 0, particle.spin * age);
    else LawnArt.sparkle(ctx, x, y, particle.size, particle.color);
  }
  ctx.globalAlpha = 1;
  for (const popup of popups) {
    const age = (elapsed - popup.start) / 620;
    LawnArt.points(ctx, popup.label, popup.x,
      Math.max(25, popup.y - (reduceMotion.matches ? 16 : 15 + 47 * age)), popup.hot, 1 - age, width);
  }
  if (state === "ready") LawnArt.cover(ctx, width, height, matchMedia("(max-width: 650px)").matches);
}

function frame(now) {
  if (state !== "playing") return;
  const elapsed = Math.max(0, now - started);
  if (elapsed >= SETTINGS.duration) {
    finish();
    return;
  }
  const step = Math.min(50, Math.max(0, now - previousFrame)) / 1000;
  previousFrame = now;
  updateActors(elapsed, step);
  updateMeteors(elapsed);
  tryFever(elapsed);
  if (pointer && scorched.size && scarAt(pointer.point)) waterStroke(pointer.point, pointer.point, elapsed);
  particles = particles.filter((particle) => elapsed - particle.start < particle.life);
  popups = popups.filter((popup) => elapsed - popup.start < 620);
  if (elapsed - lastClear >= SETTINGS.combo.window) combo = 0;
  notices = notices.filter(({ item, until }) => {
    if (until > elapsed) return true;
    item.remove();
    return false;
  });
  updateHUD(elapsed);
  render(elapsed);
  frameId = requestAnimationFrame(frame);
}

function releasePointer() {
  if (pointer && canvas.hasPointerCapture(pointer.id)) canvas.releasePointerCapture(pointer.id);
  pointer = null;
}

function start(seed) {
  unlockAudio();
  cancelAnimationFrame(frameId);
  releasePointer();
  score = 0;
  feverMeter = 0;
  feverScore = 0;
  combo = 0;
  maxCombo = 0;
  lastClear = -Infinity;
  feverUntil = 0;
  lastSecond = -1;
  lastPluck = -Infinity;
  lastImpact = -Infinity;
  runSeed = Number.isInteger(seed) && seed >= 0 && seed <= 0xFFFFFFFF ? seed :
    window.crypto?.getRandomValues(new Uint32Array(1))[0] ?? Math.floor(Math.random() * 0x100000000);
  playRandom = seededRandom(runSeed);
  lastRunGoal = lastRun?.score ?? 0;
  passedBest = false;
  feverCount = 0;
  meteorDue = playRange(...SETTINGS.meteor.window) - SETTINGS.meteor.warning;
  meteors = [];
  scorched.clear();
  enemyClears.clear();
  restored = 0;
  waterCredit = SETTINGS.water.burst;
  waterTick = 0;
  spray = null;
  mower = null;
  actors = [];
  fires = [];
  particles = [];
  popups = [];
  notices = [];
  $("notices").replaceChildren();
  nextCow = playRange(...SETTINGS.cow.first);
  nextFire = playRange(...SETTINGS.fire.first);
  window.scrollTo(0, 0);
  setState("playing");
  syncPlayViewport();
  fitField(true);
  started = performance.now();
  previousFrame = started;
  updateHUD(0);
  render(0);
  tone(330, 555, 0.16, 0.065);
  frameId = requestAnimationFrame(frame);
}

function shareURL(total) {
  const intent = new URL("https://twitter.com/intent/tweet");
  const story = restored ? "暴走牛と放火おじさん、巨大隕石！ 焼け野原の" + restored + "区画を復活させた。" :
    "暴走牛と放火おじさんが乱入、隕石で草原の3分の1が消し飛んだ。";
  intent.searchParams.set("text", "草むしり45秒チャレンジで" + total + "点！\n" + story +
    "\nこの記録を超えられる？\n#草むしりチャレンジ");
  const configured = document.querySelector('link[rel="canonical"]').getAttribute("href");
  let publicURL;
  if (configured && /^https?:\/\//i.test(configured)) {
    try { publicURL = new URL(configured); } catch { /* fall back to the current page */ }
  }
  if (!publicURL && /^https?:$/.test(location.protocol) && !["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
    publicURL = new URL(".", location.href);
  }
  if (publicURL) {
    publicURL.searchParams.delete("challenge");
    if (total > 0 && total <= SETTINGS.challengeMax) publicURL.searchParams.set("challenge", total);
    intent.searchParams.set("url", publicURL.href);
  }
  return intent.href;
}

function celebrate(record) {
  const confetti = $("record-confetti");
  confetti.replaceChildren();
  if (!record) return;
  const colors = ["#ffe574", "#fd9f54", "#ff77c2", "#9efc69", "#80f2ec"];
  for (let index = 0; index < 28; index++) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", random(1, 99) + "%");
    piece.style.setProperty("--y", random(3, 93) + "%");
    piece.style.setProperty("--angle", random(-145, 145) + "deg");
    piece.style.setProperty("--delay", random(0, 0.27) + "s");
    piece.style.setProperty("--color", colors[index % colors.length]);
    confetti.append(piece);
  }
}

function finish() {
  releasePointer();
  const previousBest = best;
  const record = score > best;
  if (record) {
    best = score;
    saveStorage(BEST_KEY, String(best));
  }
  lastRun = { rulesVersion: RULES_VERSION, seed: runSeed, score, feverScore, feverCount, maxCombo, restored,
    duration: SETTINGS.duration, finishedAt: new Date().toISOString() };
  saveStorage(LAST_RUN_KEY, JSON.stringify(lastRun));
  const gap = previousBest - score;
  $("record").hidden = !record;
  $("result").classList.toggle("has-record", record);
  celebrate(record);
  $("total").textContent = score;
  $("result-best").textContent = best;
  $("result-gap").textContent = record ? previousBest ? "前ベスト +" + (score - previousBest) + " 点" : "初記録！" :
    previousBest && gap >= 0 && gap < SETTINGS.finale.closeRecord ? "新記録まであと " + (gap + 1) + " 点！" : bestGap(score, previousBest);
  $("result-challenge").hidden = !challengeTarget;
  if (challengeTarget) $("result-challenge").textContent = score > challengeTarget ? "友達の記録を突破！" :
    "友達の記録まであと " + (challengeTarget - score + 1) + " 点";
  $("result-fever").textContent = feverScore;
  $("result-combo").textContent = maxCombo;
  $("result-water").textContent = restored;
  $("share").href = shareURL(score);
  $("notices").replaceChildren();
  setState("result");
  updateHUD(SETTINGS.duration);
  fitField();
  $("result-title").focus({ preventScroll: true });
  tone(record ? 440 : 325, record ? 659 : 220, 0.24, 0.068);
  if (record) chord([523, 659, 784, 1_047], 0.065);
}

function pointOf(event, bounds) {
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

canvas.addEventListener("pointerdown", (event) => {
  if (state !== "playing" || event.button !== 0 || (pointer && pointer.id !== event.pointerId)) return;
  event.preventDefault();
  const bounds = canvas.getBoundingClientRect();
  fitField(false, bounds);
  canvas.setPointerCapture(event.pointerId);
  const point = pointOf(event, bounds);
  pointer = { id: event.pointerId, point, bounds, gesture: new Set() };
  harvest(point, point, true, pointer.gesture);
});

function trackPointer(event) {
  if (pointer?.id !== event.pointerId) return;
  fitField();
  const events = event.getCoalescedEvents?.() ?? [];
  for (const sample of [...events, event]) {
    const point = pointOf(sample, pointer.bounds);
    if (point.x === pointer.point.x && point.y === pointer.point.y) continue;
    harvest(pointer.point, point, false, pointer.gesture);
    pointer.point = point;
  }
}

window.addEventListener("pointermove", (event) => {
  if (pointer?.id !== event.pointerId) return;
  if (event.pointerType === "mouse" && !(event.buttons & 1)) {
    releasePointer();
    return;
  }
  trackPointer(event);
});
window.addEventListener("pointerup", (event) => {
  if (pointer?.id !== event.pointerId) return;
  trackPointer(event);
  // The browser automatically releases pointer capture after pointerup.
  pointer = null;
});
window.addEventListener("pointercancel", (event) => {
  if (pointer?.id === event.pointerId) pointer = null;
});
canvas.addEventListener("contextmenu", (event) => {
  if (state === "playing") event.preventDefault();
});
window.addEventListener("blur", releasePointer);
window.addEventListener("resize", syncPlayViewport);
window.visualViewport?.addEventListener("resize", syncPlayViewport);
document.addEventListener("visibilitychange", () => {
  if (state === "playing" && performance.now() - started >= SETTINGS.duration) {
    cancelAnimationFrame(frameId);
    finish();
  }
});
$("sound").addEventListener("click", () => {
  muted = !muted;
  saveStorage(SOUND_KEY, muted ? "off" : "on");
  soundUI();
  unlockAudio();
  tone(380, 490, 0.1, 0.055);
});
$("start").addEventListener("click", start);
$("retry").addEventListener("click", start);
new ResizeObserver(() => fitField()).observe(canvas);
$("challenge").hidden = !challengeTarget;
if (challengeTarget) $("challenge").textContent = "友達の記録 " + challengeTarget + " 点に挑戦！";
soundUI();
updateHUD(0);
fitField();
