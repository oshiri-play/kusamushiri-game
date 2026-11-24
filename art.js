"use strict";

const LawnArt = (() => {
  const ink = "#202039";
  const greens = ["#29763c", "#267641", "#157447", "#397f30", "#0e6443", "#467522"];

  function path(ctx, points, fill, stroke, width = 2) {
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    if (fill) {
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function oval(ctx, x, y, rx, ry, fill, stroke, width = 2.8, angle = 0) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, angle, 0, Math.PI * 2);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = width;
      ctx.stroke();
    }
  }

  function box(ctx, x, y, w, h, radius, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.fillStyle = fill;
    ctx.fill();
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 2.7;
      ctx.stroke();
    }
  }

  function grassSprites() {
    function make(paint) {
      const sprite = document.createElement("canvas");
      sprite.width = 48;
      sprite.height = 48;
      const ctx = sprite.getContext("2d");
      paint(ctx);
      return sprite;
    }
    return {
      normal: greens.map((green, index) => make((ctx) => paintGrass(ctx, 24, 33, 1.6, green, index % 2 ? -1 : 1))),
      hard: make(paintHard),
      stubborn: make(paintStubborn),
    };
  }

  function paintHard(ctx) {
    ctx.lineJoin = "round";
    oval(ctx, 24, 34, 13, 4, "#3e22664b");
    path(ctx, [[19, 30], [9, 18], [18, 20], [17, 9], [24, 15], [30, 6], [30, 20], [38, 14], [32, 31]], "#ad92ff", ink, 2.4);
    path(ctx, [[11, 29], [18, 24], [29, 24], [37, 28], [35, 36], [15, 36]], "#6544ad", ink, 2.4);
    path(ctx, [[16, 31], [25, 28], [30, 30]], null, "#d5cbff", 1.7);
  }

  function paintStubborn(ctx) {
    ctx.lineJoin = "round";
    oval(ctx, 24, 34, 15, 5, "#6f284141");
    path(ctx, [[19, 16], [13, 5], [22, 8], [25, 3], [29, 9], [36, 6], [29, 19]], "#ffd05a", ink, 2.2);
    path(ctx, [[14, 29], [7, 38], [19, 34], [22, 42], [27, 35], [39, 38], [33, 28]], "#f55d82", ink, 2.2);
    oval(ctx, 24, 22, 12, 12, "#ee4579", ink, 2.5);
    path(ctx, [[15, 18], [21, 21], [18, 24], [15, 22]], "#fff7de", ink, 1.2);
    path(ctx, [[27, 21], [33, 18], [33, 22], [30, 24]], "#fff7de", ink, 1.2);
    path(ctx, [[20, 29], [24, 26], [28, 29]], null, ink, 1.9);
  }

  function blade(ctx, bend, top, base, color) {
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.quadraticCurveTo(bend * 0.34, top * 0.72, bend, top);
    ctx.quadraticCurveTo(bend * 0.88, top * 0.49, base, 0.45);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  function paintGrass(ctx, x, y, scale, green, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    oval(ctx, 0, 0.8, 8, 2.5, "#3c70312f");
    blade(ctx, -9, -11, -2, green);
    blade(ctx, 8.5, -11.5, 3, green);
    blade(ctx, -0.5, -16.5, 2.9, green);
    blade(ctx, 10, -5.8, 3.2, "#86aa45");
    ctx.restore();
  }

  function cow(ctx, x, y, scale, facing = 1, phase = 0, chewing = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    const step = Math.sin(phase) * 10;
    const chomp = chewing ? 0.45 + 0.55 * Math.abs(Math.sin(phase * 2.5)) : 0.12;
    oval(ctx, -3, 22, 42, 7, "#21463740");
    for (const [leg, swing] of [[-26, step], [-14, -step], [8, -step], [19, step]]) {
      path(ctx, [[leg - 4, 0], [leg + 5, 2], [leg + swing + 6, 19], [leg + swing - 3, 19]], "#fff1d9", ink, 2.7);
      path(ctx, [[leg + swing - 2, 18], [leg + swing + 5, 18]], null, ink, 4.2);
    }
    path(ctx, [[-32, -12], [-46, -18], [-50, -12 - step * 0.4]], null, ink, 3.2);
    oval(ctx, -50, -10 - step * 0.4, 5.5, 3.4, "#3a2e46");
    oval(ctx, -9, -8, 32, 19, "#fff7e5", ink, 3.1);
    oval(ctx, -12, 1, 21, 7, "#e9ddc9");
    oval(ctx, -28, -10, 11, 14, "#40334c", null, 0, -0.43);
    oval(ctx, -6, -23, 12, 4.4, "#40334c");
    oval(ctx, 10, -3, 7, 5.2, "#68576a", null, 0, 0.22);
    oval(ctx, 13, -27, 11, 5.2, "#a18b91", ink, 2.7, 0.45);
    oval(ctx, 36, -29, 10.5, 5, "#f6a7a3", ink, 2.7, -0.5);
    path(ctx, [[16, -28], [7, -42], [9, -30], [18, -24]], "#ffcf87", ink, 2.6);
    path(ctx, [[29, -31], [37, -43], [37, -33], [32, -24]], "#ffcf87", ink, 2.6);
    oval(ctx, 25, -20, 16, 17, "#fff7e5", ink, 3);
    oval(ctx, 26, -20, 8, 8.7, "#fff", ink, 2);
    oval(ctx, 29.5, -19.4, 3, 4, ink);
    path(ctx, [[20, -30], [24, -34], [30, -30]], null, ink, 2.2);
    oval(ctx, 23, -7, 5.5 + 4 * chomp, 4.2 + 2 * chomp, "#ffa7a6", ink, 1.8);
    oval(ctx, 36, -8 + 4 * chomp, 12, 4.5 + 6 * chomp, "#51283f", ink, 2.5);
    if (chewing) oval(ctx, 37, 0, 6, 3, "#f68493");
    oval(ctx, 37, -11 + 2 * chomp, 14, 7.4, "#ffa6aa", ink, 2.8);
    oval(ctx, 38, -11 + 2 * chomp, 1.8, 2.7, ink, null, 0, -0.25);
    oval(ctx, 47, -10 + 2 * chomp, 1.9, 2.5, ink, null, 0, 0.24);
    if (chewing) path(ctx, [[48, -1], [55, -8], [53, 1]], "#cfff70", ink, 1.3);
    ctx.restore();
  }

  function gardener(ctx, x, y, scale, facing = 1, phase = 0, mood = "grin") {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale * facing, scale);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const step = Math.sin(phase) * 5;
    oval(ctx, 0, 24, 27, 6, "#21463735");
    path(ctx, [[-14, 0], [-15 + step, 19], [-21 + step, 21]], null, ink, 10);
    path(ctx, [[8, 0], [14 - step, 17], [20 - step, 21]], null, ink, 10);
    const laugh = mood === "laugh";
    const warning = mood === "warn";
    const frustrated = mood === "frustrated";
    ctx.translate(0, laugh ? Math.sin(phase * 1.6) * 5 - 3 : 0);
    box(ctx, -21, -27, 39, 37, 11, "#617ea4", ink);
    path(ctx, [[-19, -25], [-15, 7], [13, 8], [12, -26]], "#ee8757", ink);
    path(ctx, [[-11, -19], [5, -19]], null, "#f9ba7d", 2);
    const hand = laugh ? [25, -35] : warning ? [31, -16] : [24, -13];
    const arm = [[9, -20], [21, laugh ? -15 : -8], hand];
    path(ctx, arm, null, ink, 12);
    path(ctx, arm, null, "#f5bd8a", 7);
    if (laugh || warning) oval(ctx, hand[0], hand[1], 5.5, 5, "#ffcf9d", ink, 2);
    oval(ctx, -3, -37, 17, 15, "#f7c89c", ink);
    oval(ctx, 13, -39, 5, 3, "#f7c89c", ink, 1.8);
    oval(ctx, 9, -37, 4.2, 2.8, "#ee8e7c");
    if (laugh) {
      path(ctx, [[-4, -42], [1, -45], [6, -42]], null, ink, 2.3);
      oval(ctx, 4, -34, 8.5, 8 + Math.abs(Math.sin(phase * 2)) * 1.8, "#52263c", ink, 2.1);
      oval(ctx, 5, -30, 4, 2.1, "#f78a91");
      path(ctx, [[-1, -37], [9, -37], [7, -34], [0, -34]], "#fff6e5");
    } else {
      oval(ctx, 3, -42, 2.5, 2.8, ink);
      path(ctx, warning ? [[-4, -48], [7, -43]] : [[-4, -45], [3, -49], [8, -46]], null, ink, 2.3);
      if (frustrated) path(ctx, [[-3, -30], [2, -34], [8, -34], [11, -30]], null, ink, 2.6);
      else path(ctx, [[-3, -35], [13, -36], [8, -29], [1, -29]], "#fff6e5", ink, 2.3);
    }
    path(ctx, [[-22, -48], [-15, -62], [3, -63], [13, -47]], "#f5cc65", ink, 2.8);
    oval(ctx, -4, -47, 25, 5.4, "#ffe284", ink);
    ctx.restore();
  }

  function flame(ctx, x, y, scale, phase = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const sway = Math.sin(phase) * 3;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.bezierCurveTo(-13, 0, -15, -13, -7, -23);
    ctx.quadraticCurveTo(-6, -16, -3, -17);
    ctx.quadraticCurveTo(4 + sway, -25, 2 + sway, -34);
    ctx.bezierCurveTo(14, -24, 19, -2, 0, 0);
    ctx.fillStyle = "#ec6629";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(1, -2);
    ctx.bezierCurveTo(-8, -3, -5, -13, 3 + sway, -21);
    ctx.bezierCurveTo(12, -9, 10, -3, 1, -2);
    ctx.fillStyle = "#ffde67";
    ctx.fill();
    ctx.restore();
  }

  function mower(ctx, x, y, scale, facing = 1, phase = 0) {
    ctx.save();
    ctx.translate(x, y + Math.sin(phase) * 1.4);
    ctx.scale(scale * facing, scale);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    oval(ctx, 0, 9, 30, 7, "#21463732");
    path(ctx, [[-10, -2], [-25, -26], [-38, -27]], null, ink, 4);
    box(ctx, -23, -10, 54, 16, 7, "#fa426f", ink);
    box(ctx, -12, -22, 29, 17, 5, "#ffce40", ink);
    path(ctx, [[-1, -18], [7, -18], [3, -13], [10, -13], [0, -7], [2, -12], [-3, -12]], "#fff6b4", null);
    for (const wheel of [-15, 22]) {
      oval(ctx, wheel, 6, 8, 8, ink);
      oval(ctx, wheel, 6, 3, 3, "#f5db97");
    }
    ctx.restore();
  }

  function impact(ctx, x, y, hits, type, age) {
    if (age < 260) {
      ctx.globalAlpha = Math.max(0, 1 - age / 260);
      const start = type === "stubborn" ? "#ffed90" : "#f6eaff";
      oval(ctx, x, y - 8, 13 + age / 55, 8 + age / 65, "#fff5", start, 2);
      ctx.globalAlpha = 1;
    }
    if (hits) {
      for (let index = 0; index < 3; index++) {
        oval(ctx, x - 5 + index * 5, y + 3, 2.1, 2.1, index < hits ? "#fff0a3" : "#37304e", ink, 0.6);
      }
    }
  }

  function fireWarning(ctx, x, y, radius, remaining) {
    ctx.save();
    oval(ctx, x, y, radius, radius, "#ff452c3e", "#25192d", 5);
    ctx.setLineDash([6, 6]);
    oval(ctx, x, y, radius, radius, "#ff452c10", "#ffda6d", 3);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.arc(x, y, radius - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    ctx.strokeStyle = "#fff2b0";
    ctx.lineWidth = 3;
    ctx.stroke();
    box(ctx, x - 25, y - 14, 50, 24, 7, "#3a2141", ink);
    ctx.font = "bold 13px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff3ba";
    ctx.fillText("点火", x, y + 3);
    ctx.restore();
  }

  function turbo(ctx, x, y, radius, facing, phase, tilt = 0) {
    ctx.save();
    oval(ctx, x, y, radius, radius, "#fff07536", "#5e2748", 6);
    oval(ctx, x, y, radius - 2, radius - 2, "#ffb83c26", "#fff4ab", 3);
    for (let index = 0; index < 4; index++) {
      const angle = phase * 0.38 + index * Math.PI / 2;
      sparkle(ctx, x + Math.cos(angle) * (radius - 10), y + Math.sin(angle) * (radius - 10), 9, "#fff6ad");
    }
    path(ctx, [[x - facing * 32, y + 4], [x - facing * 79, y + 9], [x - facing * 60, y - 2],
      [x - facing * 86, y - 6], [x - facing * 36, y - 14]], "#ffb43d", ink, 2.8);
    ctx.translate(x, y);
    ctx.rotate(tilt);
    mower(ctx, facing * 8, 3, 1.7, facing, phase);
    ctx.restore();
  }

  function scorch(ctx, x, y, w, h, index) {
    const tones = ["#342433", "#3d2934", "#422b34", "#31252d"];
    ctx.fillStyle = tones[index % tones.length];
    ctx.fillRect(x, y, w + 0.25, h + 0.25);
    path(ctx, [[x + w * 0.10, y + h * 0.69], [x + w * 0.4, y + h * 0.33],
      [x + w * 0.55, y + h * 0.53], [x + w * 0.83, y + h * 0.28]], null, "#67414c", 1.05);
    oval(ctx, x + w * 0.65, y + h * 0.74, 1.5, 1, "#c1695b");
  }

  function scorchSprites() {
    return Array.from({ length: 4 }, (_, index) => {
      const sprite = document.createElement("canvas");
      sprite.width = 32;
      sprite.height = 32;
      scorch(sprite.getContext("2d"), 0, 0, 32, 32, index);
      return sprite;
    });
  }

  function rock(ctx, x, y, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.lineJoin = "round";
    path(ctx, [[-16, -7], [-66, -55], [-38, -46], [-46, -66], [16, -21], [21, -7]],
      "#ff557a", ink, 2.8);
    path(ctx, [[-14, -6], [-49, -46], [-26, -34], [-31, -46], [18, -13]], "#ffad47");
    path(ctx, [[-17, -7], [-8, -21], [8, -24], [25, -12], [26, 8], [16, 21], [-3, 23], [-17, 12]],
      "#9c5968", ink, 3);
    path(ctx, [[-13, -6], [-4, -18], [7, -20], [19, -10], [9, -7], [1, 8], [-12, 4]], "#ed8b6b");
    oval(ctx, 13, 8, 6, 4.5, "#573348", ink, 1.5, -0.42);
    oval(ctx, -6, 8, 3.5, 3, "#52334a");
    ctx.restore();
  }

  function meteorApproach(ctx, x, y, rx, ry, remaining, still) {
    ctx.save();
    oval(ctx, x, y, rx, ry, "#d8274f37", "#451935", 7);
    ctx.setLineDash([9, 6]);
    oval(ctx, x, y, rx - 1, ry - 1, "#ed315812", "#ffb6a2", 4);
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.ellipse(x, y, Math.max(1, rx - 9), Math.max(1, ry - 9), 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * remaining);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ffe7a1";
    ctx.stroke();
    path(ctx, [[x, y - 18], [x + 18, y + 15], [x - 18, y + 15]], "#ffebac", ink, 2.5);
    ctx.fillStyle = ink;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("!", x, y + 10);
    const approach = still ? 0.68 : 1 - remaining ** 1.7;
    rock(ctx, x - (1 - approach) * rx * 0.72, (y + 33) * approach - 43,
      Math.min(2.45, 1.15 + Math.min(rx, ry) / 128) * (0.73 + approach * 0.27));
    ctx.restore();
  }

  function meteorImpact(ctx, x, y, rx, ry, age, scarCount, still) {
    ctx.save();
    if (age < 900) {
      const progress = age / 900;
      ctx.globalAlpha = 1 - progress;
      const wave = still ? 0.86 : 0.36 + progress;
      oval(ctx, x, y, rx * wave, ry * wave, "#ff924234", "#ffce70", 6);
      oval(ctx, x, y, rx * wave * 0.82, ry * wave * 0.82, "#ffab5024", "#ff995ab0", 3);
      sparkle(ctx, x, y, Math.min(rx, ry) * (still ? 0.32 : (1 - progress) * 0.84), "#ffcb64");
      for (let i = 0; i < 10; i++) {
        const angle = i * Math.PI / 5;
        const reach = wave * 0.84;
        sparkle(ctx, x + Math.cos(angle) * reach * rx, y + Math.sin(angle) * reach * ry, 9, "#ffb45e");
      }
    }
    if (scarCount) {
      for (let i = 0; i < (still ? 3 : 8); i++) {
        const drift = still ? i * 0.22 : (age / 1_850 + i / 8) % 1;
        ctx.globalAlpha = (age < 900 ? 0.55 : 0.37) * (1 - drift);
        const off = (i % 4 - 1.5) * rx * 0.25;
        oval(ctx, x + off + drift * 21, y + Math.sin(i * 4) * ry * 0.34 - drift * 72,
          13 + drift * 16, 9 + drift * 14, i % 2 ? "#cca5a6" : "#a79cab");
      }
    }
    ctx.restore();
  }

  function water(ctx, x, y, radius, age, still) {
    ctx.save();
    const decay = 1 - age / 340;
    ctx.globalAlpha = decay;
    oval(ctx, x, y, radius, radius, "#46dffe39", "#d1fcff", 3);
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3 + (still ? 0 : age / 80);
      const distance = radius * (0.27 + (i % 3) * 0.23);
      oval(ctx, x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, 2.8, 5.6, "#a8fbff", "#3470ad", 1.1, angle);
    }
    ctx.restore();
  }

  function points(ctx, text, x, y, hot, alpha, width) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, alpha);
    ctx.font = '1000 ' + (hot ? 27 : 19) + 'px "Arial Black", system-ui, sans-serif';
    const margin = ctx.measureText(text).width / 2 + 5;
    x = Math.max(margin, Math.min(x, width - margin));
    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    ctx.strokeStyle = ink;
    ctx.lineWidth = hot ? 5.5 : 3.5;
    ctx.strokeText(text, x, y);
    ctx.fillStyle = hot ? "#ffe260" : "#edffc4";
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  function sparkle(ctx, x, y, size, color) {
    path(ctx, [[x, y - size], [x + size * 0.25, y - size * 0.24], [x + size, y],
      [x + size * 0.25, y + size * 0.24], [x, y + size], [x - size * 0.25, y + size * 0.24],
      [x - size, y], [x - size * 0.25, y - size * 0.24]], color);
  }

  function label(ctx, value, x, y, angle, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.font = '900 17px "Yu Gothic", Meiryo, sans-serif';
    ctx.textAlign = "center";
    const width = ctx.measureText(value).width + 24;
    box(ctx, -width / 2, -18, width, 31, 13, color, ink);
    ctx.fillStyle = ink;
    ctx.fillText(value, 0, 4);
    ctx.restore();
  }

  function reaction(ctx, text, x, y, cow) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.76, 0.76);
    label(ctx, text, 0, 0, cow ? -0.08 : 0.09, cow ? "#e7ffa2" : "#ffb3a1");
    ctx.restore();
  }

  function cover(ctx, width, height, compact) {
    const scale = compact ? Math.min(width / 325, height / 390) * 0.69 : Math.min(width / 1050, height / 510) * 1.08;
    ctx.save();
    ctx.translate(width * (compact ? 0.54 : 0.73), height * (compact ? 0.79 : 0.56));
    ctx.scale(scale, scale);
    path(ctx, [[-205, -34], [-167, -60], [-196, -119], [-122, -99], [-97, -157], [-47, -114],
      [29, -159], [55, -118], [151, -153], [141, -102], [216, -103], [179, -51], [218, -21],
      [179, 16], [213, 74], [147, 66], [164, 122], [91, 100], [44, 139], [-11, 113],
      [-70, 143], [-90, 105], [-176, 119], [-151, 70], [-218, 50], [-179, 19]], "#ffe773", ink, 4.6);
    oval(ctx, -12, 58, 157, 40, "#d5a84f5e", null, 0, -0.1);
    for (let i = 0; i < 6; i++) {
      oval(ctx, 25 + i * 9, 21 + (i % 2) * 12, 15, 7, "#f8d167");
    }
    cow(ctx, -49, 13, 2.12, -1, 0.74, true);
    gardener(ctx, 89, -1, 1.58, 1, 0.35, "laugh");
    flame(ctx, 154, -20, 1.33);
    mower(ctx, 52, 80, 1.3);
    sparkle(ctx, -158, -72, 15, "#fff9d7");
    sparkle(ctx, 162, 26, 15, "#ffef9c");
    sparkle(ctx, -124, 57, 9, "#fff9d7");
    sparkle(ctx, 7, -92, 10, "#fff9d7");
    label(ctx, "モォォ！！", -88, -101, -0.12, "#fff4d7");
    label(ctx, "ガハハハ！", 145, -82, 0.12, "#ff9cba");
    rock(ctx, 71, -151, 1.46);
    ctx.restore();
  }

  return { grassSprites, cow, gardener, flame, sparkle, cover, oval, impact, fireWarning, turbo, points,
    scorchSprites, meteorApproach, meteorImpact, water, reaction };
})();
