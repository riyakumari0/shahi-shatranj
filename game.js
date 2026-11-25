/*
 * Shahi Shatranj — the 3D court.
 * Draws the board, the pieces, the painted garden around them, the
 * animations and the drone camera, and connects everything to chess.js.
 */
(async function main() {
  'use strict';

  const $ = (id) => document.getElementById(id);
  let THREE, OrbitControls, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ OrbitControls } = await import('three/addons/controls/OrbitControls.js'));
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (err) {
    console.error(err);
    $('loadErr').textContent = 'Could not load the 3D library. Please check your internet connection and reload the page.';
    return;
  }
  try {
    await Promise.race([
      Promise.all([document.fonts.load('700 40px Cinzel'), document.fonts.load('700 20px "Cinzel Decorative"')]),
      new Promise((r) => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* fonts are optional */ }

  const Chess = window.Chess;
  const game = new Chess();
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MOTION = reduceMotion ? 0.35 : 1;

  /* ------------------------------------------------------------------ */
  /*  Court lore                                                         */
  /* ------------------------------------------------------------------ */
  const VS = '︎';
  const GLYPH = {
    w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
    b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
  };
  const NAME = { k: 'King', q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight', p: 'Pawn' };
  const LORE = {
    k: { title: 'Padishah — the Emperor', rule: 'Moves one square in any direction. Must never be left in check. Once per game may castle with a rook that has not moved.' },
    q: { title: 'Malika — the Empress', rule: 'The mightiest of the court: moves any distance in a straight line or along a diagonal.' },
    r: { title: 'Rukh — the Fortress', rule: 'Moves any distance along a row or a column. Joins the king when he castles.' },
    b: { title: 'Wazir — the Counsellor', rule: 'Moves any distance diagonally, so keeps forever to one colour of square.' },
    n: { title: 'Aswar — the Royal Cavalier', rule: 'Leaps in an L: two squares one way, then one to the side. The only piece that jumps over others.' },
    p: { title: 'Sipahi — the Foot Soldier', rule: 'Marches forward one square (two on the first march), captures one square diagonally, may capture en passant, and is promoted on the far rank.' },
  };
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const glyph = (c, t) => GLYPH[c][t] + VS;

  /* ------------------------------------------------------------------ */
  /*  Renderer, scene, camera                                            */
  /* ------------------------------------------------------------------ */
  const canvas = $('scene');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xd8cc9e, 30, 78);
  const camera = new THREE.PerspectiveCamera(38, innerWidth / innerHeight, 0.5, 420);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  scene.add(new THREE.HemisphereLight(0xfff0d0, 0x4a6a35, 0.85));
  const sun = new THREE.DirectionalLight(0xffe1b0, 2.4);
  sun.position.set(7, 15, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 2, far: 40 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  const rimLight = new THREE.DirectionalLight(0xaec4ff, 0.7);
  rimLight.position.set(-9, 7, -11);
  scene.add(rimLight);

  const GROUND = -0.95;
  const Y = new THREE.Vector3(0, 1, 0);
  const target = new THREE.Vector3(0, 0.15, 0);

  /* ------------------------------------------------------------------ */
  /*  Painted textures (all drawn by code, nothing to download)          */
  /* ------------------------------------------------------------------ */
  let seed = 11;
  const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function toTex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }
  function rosette(g, cx, cy, R, petals, fill, alpha) {
    g.save(); g.globalAlpha = alpha; g.translate(cx, cy); g.fillStyle = fill;
    for (let i = 0; i < petals; i++) {
      g.rotate((Math.PI * 2) / petals);
      g.beginPath(); g.ellipse(R * 0.5, 0, R * 0.5, R * 0.17, 0, 0, Math.PI * 2); g.fill();
    }
    g.beginPath(); g.arc(0, 0, R * 0.17, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  function flower(g, x, y, s, petal, centre) {
    g.save(); g.translate(x, y);
    g.strokeStyle = '#2f6b3a'; g.lineWidth = s * 0.12;
    g.beginPath(); g.moveTo(0, s * 1.6); g.quadraticCurveTo(s * 0.2, s * 0.8, 0, 0); g.stroke();
    g.fillStyle = '#3f8a4a';
    g.beginPath(); g.ellipse(-s * 0.45, s * 1.05, s * 0.42, s * 0.16, 0.6, 0, 7); g.fill();
    g.beginPath(); g.ellipse(s * 0.45, s * 0.95, s * 0.42, s * 0.16, -0.6, 0, 7); g.fill();
    g.fillStyle = petal;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      g.beginPath(); g.ellipse(Math.cos(a) * s * 0.45, Math.sin(a) * s * 0.45, s * 0.38, s * 0.2, a, 0, 7); g.fill();
    }
    g.fillStyle = centre; g.beginPath(); g.arc(0, 0, s * 0.2, 0, 7); g.fill();
    g.restore();
  }

  function boardTexture() {
    const S = 1024, q = 128;
    const [c, g] = mkCanvas(S, S);
    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const x = f * q, y = (7 - r) * q, dark = (f + r) % 2 === 0;
        if (dark) {
          const gr = g.createRadialGradient(x + q / 2, y + q / 2, 6, x + q / 2, y + q / 2, q * 0.78);
          gr.addColorStop(0, '#3a5fb4'); gr.addColorStop(1, '#22418c');
          g.fillStyle = gr; g.fillRect(x, y, q, q);
          for (let i = 0; i < 16; i++) {
            g.fillStyle = rand() < 0.5 ? `rgba(18,32,86,${0.08 + rand() * 0.12})` : `rgba(90,130,215,${0.06 + rand() * 0.1})`;
            g.beginPath(); g.ellipse(x + rand() * q, y + rand() * q, 6 + rand() * 24, 3 + rand() * 10, rand() * 3, 0, 7); g.fill();
          }
          for (let i = 0; i < 30; i++) {
            g.fillStyle = `rgba(245,212,130,${0.35 + rand() * 0.55})`;
            g.fillRect(x + 4 + rand() * (q - 8), y + 4 + rand() * (q - 8), 1 + rand() * 1.8, 1 + rand() * 1.8);
          }
          rosette(g, x + q / 2, y + q / 2, q * 0.3, 8, '#efcf73', 0.2);
          g.strokeStyle = 'rgba(243,217,139,.42)';
        } else {
          const gr = g.createRadialGradient(x + q / 2, y + q / 2, 6, x + q / 2, y + q / 2, q * 0.78);
          gr.addColorStop(0, '#f1ddb1'); gr.addColorStop(1, '#e0c38e');
          g.fillStyle = gr; g.fillRect(x, y, q, q);
          for (let i = 0; i < 3; i++) {
            g.strokeStyle = `rgba(150,105,55,${0.1 + rand() * 0.12})`;
            g.lineWidth = 0.6 + rand() * 1.3;
            g.beginPath(); g.moveTo(x + rand() * q, y);
            g.bezierCurveTo(x + rand() * q, y + q * 0.33, x + rand() * q, y + q * 0.66, x + rand() * q, y + q);
            g.stroke();
          }
          rosette(g, x + q / 2, y + q / 2, q * 0.28, 8, '#b5533c', 0.11);
          g.strokeStyle = 'rgba(150,100,40,.3)';
        }
        g.lineWidth = 1.5; g.strokeRect(x + 7.5, y + 7.5, q - 15, q - 15);
      }
    }
    g.strokeStyle = '#c99c3e'; g.lineWidth = 2.5;
    for (let i = 1; i < 8; i++) {
      g.beginPath(); g.moveTo(i * q, 0); g.lineTo(i * q, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * q); g.lineTo(S, i * q); g.stroke();
    }
    return toTex(c);
  }

  function frameTexture() {
    const S = 1024, B = (S * 0.8) / 9.6;
    const [c, g] = mkCanvas(S, S);
    const gr = g.createLinearGradient(0, 0, S, S);
    gr.addColorStop(0, '#6a1a16'); gr.addColorStop(0.5, '#82241a'); gr.addColorStop(1, '#5a1512');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rand() * 0.07})`; g.fillRect(rand() * S, rand() * S, 2, 2); }
    const box = (inset, w, col) => { g.strokeStyle = col; g.lineWidth = w; g.strokeRect(inset, inset, S - 2 * inset, S - 2 * inset); };
    box(5, 4, '#d4a73a'); box(11, 1.5, '#f3d98b'); box(B - 5, 3.5, '#d4a73a'); box(B - 11, 1.3, '#f3d98b');
    // pearl rows
    g.fillStyle = '#f3d98b';
    for (const inset of [19, B - 19]) {
      for (let t = inset; t <= S - inset; t += 13) {
        for (const [px, py] of [[t, inset], [t, S - inset], [inset, t], [S - inset, t]]) { g.beginPath(); g.arc(px, py, 1.8, 0, 7); g.fill(); }
      }
    }
    // diamonds between labels
    const diamond = (x, y) => { g.save(); g.translate(x, y); g.rotate(Math.PI / 4); g.fillStyle = '#d4a73a'; g.fillRect(-5, -5, 10, 10); g.restore(); };
    for (let i = 1; i < 8; i++) {
      const p = ((0.8 + i) / 9.6) * S;
      diamond(p, B / 2); diamond(p, S - B / 2); diamond(B / 2, p); diamond(S - B / 2, p);
    }
    // corner rosettes
    for (const [x, y] of [[B / 2, B / 2], [S - B / 2, B / 2], [B / 2, S - B / 2], [S - B / 2, S - B / 2]]) {
      rosette(g, x, y, 30, 8, '#d4a73a', 1);
      g.fillStyle = '#1d3a8a'; g.beginPath(); g.arc(x, y, 7, 0, 7); g.fill();
    }
    // coordinates
    g.font = '700 38px Cinzel, Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = 4; g.fillStyle = '#f6dc92';
    const label = (t, x, y, rot) => { g.save(); g.translate(x, y); g.rotate(rot); g.fillText(t, 0, 2); g.restore(); };
    for (let i = 0; i < 8; i++) {
      const p = ((0.8 + i + 0.5) / 9.6) * S;
      label('abcdefgh'[i], p, S - B / 2, 0); label('abcdefgh'[i], p, B / 2, Math.PI);
      label(String(8 - i), B / 2, p, 0); label(String(8 - i), S - B / 2, p, Math.PI);
    }
    return toTex(c);
  }

  function marbleTexture() {
    const S = 512; const [c, g] = mkCanvas(S, S);
    g.fillStyle = '#f2ece0'; g.fillRect(0, 0, S, S);
    for (let i = 0; i < 18; i++) {
      g.strokeStyle = `rgba(120,110,100,${0.05 + rand() * 0.1})`; g.lineWidth = 0.5 + rand() * 2;
      g.beginPath(); g.moveTo(rand() * S, 0);
      g.bezierCurveTo(rand() * S, S * 0.3, rand() * S, S * 0.7, rand() * S, S); g.stroke();
    }
    // pietra-dura star inlay grid
    for (let y = 64; y < S; y += 128) for (let x = 64; x < S; x += 128) {
      rosette(g, x, y, 34, 8, '#b5533c', 0.22);
      rosette(g, x, y, 18, 6, '#1f6b55', 0.25);
    }
    return toTex(c, [3, 3]);
  }

  function bandTexture() {
    const W = 1024, H = 96; const [c, g] = mkCanvas(W, H);
    g.fillStyle = '#f3ede1'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d4a73a'; g.fillRect(0, 4, W, 4); g.fillRect(0, H - 8, W, 4);
    g.fillStyle = '#1d1712'; g.fillRect(0, 10, W, 2); g.fillRect(0, H - 12, W, 2);
    const cols = [['#b93a26', '#f0c94a'], ['#1d3a8a', '#f3d98b'], ['#c0567a', '#f0c94a']];
    for (let i = 0; i < 8; i++) {
      const x = 64 + i * 128;
      const [p, ce] = cols[i % 3];
      flower(g, x, 40, 15, p, ce);
      g.fillStyle = '#d4a73a'; g.beginPath(); g.arc(x + 64, 48, 4, 0, 7); g.fill();
    }
    return toTex(c, [4, 1]);
  }

  function lacquerTexture() {
    const W = 512, H = 32; const [c, g] = mkCanvas(W, H);
    g.fillStyle = '#6e1c17'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#d4a73a'; g.fillRect(0, 2, W, 3); g.fillRect(0, H - 5, W, 3);
    for (let x = 8; x < W; x += 16) { g.beginPath(); g.arc(x, H / 2, 2.2, 0, 7); g.fill(); }
    return toTex(c, [4, 1]);
  }

  function gardenTexture() {
    const S = 2048, R = 70, k = S / (2 * R);
    const [c, g] = mkCanvas(S, S);
    const toPx = (u) => S / 2 + u * k;
    const gr = g.createRadialGradient(S / 2, S / 2, 50, S / 2, S / 2, S / 2);
    gr.addColorStop(0, '#5e8c43'); gr.addColorStop(0.6, '#6f9150'); gr.addColorStop(1, '#a8a66e');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
    // grass tufts & flowers, as in a painted garden
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(40,80,35,${0.15 + rand() * 0.25})`;
      const x = rand() * S, y = rand() * S;
      g.fillRect(x, y, 1.5, 3 + rand() * 3);
    }
    const fc = ['#f6ecd2', '#d9534f', '#f0c94a', '#e58fb1', '#ffffff', '#c0392b'];
    for (let i = 0; i < 7000; i++) {
      g.fillStyle = fc[(rand() * fc.length) | 0]; g.globalAlpha = 0.75;
      g.beginPath(); g.arc(rand() * S, rand() * S, 0.9 + rand() * 1.8, 0, 7); g.fill();
    }
    g.globalAlpha = 1;
    // sandstone terrace with white grid
    const t0 = toPx(-8.5), t1 = toPx(8.5);
    g.fillStyle = '#b8583e'; g.fillRect(t0, t0, t1 - t0, t1 - t0);
    g.strokeStyle = 'rgba(245,232,210,.85)'; g.lineWidth = 2;
    for (let u = -8.5; u <= 8.5; u += 1) {
      g.beginPath(); g.moveTo(toPx(u), t0); g.lineTo(toPx(u), t1); g.stroke();
      g.beginPath(); g.moveTo(t0, toPx(u)); g.lineTo(t1, toPx(u)); g.stroke();
    }
    for (let a = -8; a <= 8; a += 2) for (let b = -8; b <= 8; b += 2) rosette(g, toPx(a), toPx(b), 7, 8, '#f3ead8', 0.8);
    g.strokeStyle = '#f3ead8'; g.lineWidth = 5; g.strokeRect(t0, t0, t1 - t0, t1 - t0);
    // four water channels of the char-bagh
    const water = (x0, y0, x1, y1) => {
      g.fillStyle = '#e6d6b4'; g.fillRect(x0 - 14, y0 - 14, x1 - x0 + 28, y1 - y0 + 28);
      g.fillStyle = '#3c93ae'; g.fillRect(x0, y0, x1 - x0, y1 - y0);
      g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 1.5;
      const horiz = x1 - x0 > y1 - y0;
      for (let s = 0; s < (horiz ? x1 - x0 : y1 - y0); s += 9) {
        g.beginPath();
        if (horiz) { g.arc(x0 + s, (y0 + y1) / 2, 6, Math.PI * 1.1, Math.PI * 1.9); }
        else { g.arc((x0 + x1) / 2, y0 + s, 6, Math.PI * 0.6, Math.PI * 1.4); }
        g.stroke();
      }
    };
    const w = 0.8 * k;
    water(toPx(8.8), S / 2 - w, toPx(48), S / 2 + w);
    water(toPx(-48), S / 2 - w, toPx(-8.8), S / 2 + w);
    water(S / 2 - w, toPx(8.8), S / 2 + w, toPx(48));
    water(S / 2 - w, toPx(-48), S / 2 + w, toPx(-8.8));
    // octagonal pools
    for (const [u, v] of [[18, 0], [-18, 0], [0, 18], [0, -18]]) {
      g.fillStyle = '#e6d6b4'; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(toPx(u) + Math.cos(a) * 2.6 * k, toPx(v) + Math.sin(a) * 2.6 * k); }
      g.fill();
      g.fillStyle = '#3c93ae'; g.beginPath();
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + Math.PI / 8; g.lineTo(toPx(u) + Math.cos(a) * 2.1 * k, toPx(v) + Math.sin(a) * 2.1 * k); }
      g.fill();
      rosette(g, toPx(u), toPx(v), 18, 8, '#f6ecd2', 0.8);
    }
    return toTex(c);
  }

  function skyTexture() {
    const W = 2048, H = 1024; const [c, g] = mkCanvas(W, H);
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, '#0c1a4d'); gr.addColorStop(0.2, '#1b3c8f'); gr.addColorStop(0.36, '#3f74be');
    gr.addColorStop(0.45, '#a3c6d6'); gr.addColorStop(0.495, '#f1dca8'); gr.addColorStop(0.52, '#dccf9f');
    gr.addColorStop(0.6, '#a9ad78'); gr.addColorStop(1, '#5d7a45');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    const wrap = (x, fn) => { for (const dx of [-W, 0, W]) fn(x + dx); };
    // golden sun with wavy rays
    wrap(W * 0.12, (x) => {
      const y = 300;
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(243,200,90,.85)';
      for (let i = 0; i < 24; i++) {
        g.rotate(Math.PI / 12);
        g.beginPath(); g.moveTo(40, -6); g.quadraticCurveTo(62, -14, 78, 0); g.quadraticCurveTo(62, 14, 40, 6); g.fill();
      }
      const sg = g.createRadialGradient(0, 0, 4, 0, 0, 46); sg.addColorStop(0, '#fff3c4'); sg.addColorStop(1, '#e8b347');
      g.fillStyle = sg; g.beginPath(); g.arc(0, 0, 44, 0, 7); g.fill();
      g.strokeStyle = '#b07a1c'; g.lineWidth = 2; g.stroke();
      g.restore();
    });
    // stylised curling clouds outlined in gold
    const cloud = (x, y, s) => {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = 'rgba(255,250,236,.95)'; g.strokeStyle = '#d4a73a'; g.lineWidth = 2.2;
      const blobs = [[-46, 6, 16], [-24, -6, 22], [4, -12, 26], [32, -4, 20], [52, 6, 14], [-4, 8, 20], [24, 9, 17]];
      g.beginPath(); for (const [bx, by, br] of blobs) { g.moveTo(bx + br, by); g.arc(bx, by, br, 0, 7); }
      g.fill();
      for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br, Math.PI * 1.05, Math.PI * 1.95); g.stroke(); }
      g.beginPath(); g.arc(-56, 10, 9, -0.5, Math.PI * 1.2); g.stroke();
      g.beginPath(); g.arc(62, 12, 7, Math.PI * 1.8, Math.PI * 3.1); g.stroke();
      g.restore();
    };
    for (let i = 0; i < 16; i++) {
      const x = rand() * W, y = 120 + rand() * 270, s = 0.7 + rand() * 0.9;
      wrap(x, (xx) => cloud(xx, y, s));
    }
    // birds
    g.strokeStyle = 'rgba(30,25,40,.55)'; g.lineWidth = 2;
    for (let i = 0; i < 22; i++) {
      const x = rand() * W, y = 250 + rand() * 170, s = 4 + rand() * 4;
      g.beginPath(); g.moveTo(x - s, y - s * 0.4); g.quadraticCurveTo(x - s * 0.4, y - s * 0.7, x, y); g.quadraticCurveTo(x + s * 0.4, y - s * 0.7, x + s, y - s * 0.4); g.stroke();
    }
    // distant hills, palaces and cypress silhouettes along the horizon
    const hills = (base, amp, col, f1, f2, ph) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) {
        const t = (x / W) * Math.PI * 2;
        g.lineTo(x, base - amp * (0.6 * Math.sin(t * f1 + ph) + 0.4 * Math.sin(t * f2 + ph * 2)) - amp);
      }
      g.lineTo(W, H); g.fill();
    };
    hills(500, 14, '#a9bfa6', 5, 13, 0.3);
    const palace = (x, y, s) => {
      g.save(); g.translate(x, y); g.scale(s, s);
      g.fillStyle = '#efd9bf';
      g.fillRect(-40, -20, 80, 20);
      g.beginPath(); g.moveTo(-18, -20); g.bezierCurveTo(-22, -46, -2, -50, 0, -62); g.bezierCurveTo(2, -50, 22, -46, 18, -20); g.fill();
      for (const mx of [-38, 38]) { g.fillRect(mx - 2.5, -48, 5, 30); g.beginPath(); g.arc(mx, -48, 4, Math.PI, 0); g.fill(); }
      for (const cx of [-26, 26]) { g.beginPath(); g.arc(cx, -20, 7, Math.PI, 0); g.fill(); }
      g.fillStyle = '#c9a043'; g.fillRect(-0.8, -70, 1.6, 9);
      g.fillStyle = 'rgba(120,80,60,.35)'; for (let ax = -32; ax <= 32; ax += 10) g.fillRect(ax - 2, -14, 4, 10);
      g.restore();
    };
    for (const [x, s] of [[W * 0.33, 0.9], [W * 0.71, 0.7], [W * 0.92, 0.55]]) wrap(x, (xx) => palace(xx, 497, s));
    hills(508, 9, '#87a27b', 7, 17, 1.7);
    g.fillStyle = '#2f5a3c';
    for (let i = 0; i < 90; i++) {
      const x = rand() * W, h = 16 + rand() * 22, y = 512 - rand() * 8;
      wrap(x, (xx) => { g.beginPath(); g.moveTo(xx, y - h); g.quadraticCurveTo(xx + 5, y - h * 0.4, xx + 3, y); g.lineTo(xx - 3, y); g.quadraticCurveTo(xx - 5, y - h * 0.4, xx, y - h); g.fill(); });
    }
    return toTex(c);
  }

  function spriteTexture(draw, size = 128) {
    const [c, g] = mkCanvas(size, size); draw(g, size);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* ------------------------------------------------------------------ */
  /*  The garden and the marble platform                                 */
  /* ------------------------------------------------------------------ */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(200, 64, 32),
    new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide, fog: false, depthWrite: false }));
  sky.rotation.y = -0.6;
  scene.add(sky);

  const ground = new THREE.Mesh(new THREE.CircleGeometry(70, 96),
    new THREE.MeshStandardMaterial({ map: gardenTexture(), roughness: 0.95, envMapIntensity: 0.3 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = GROUND; ground.receiveShadow = true;
  scene.add(ground);

  const marbleTop = new THREE.MeshStandardMaterial({ map: marbleTexture(), roughness: 0.35, envMapIntensity: 0.5 });
  const marbleSide = new THREE.MeshStandardMaterial({ map: bandTexture(), roughness: 0.4, envMapIntensity: 0.5 });
  const lacquerSide = new THREE.MeshStandardMaterial({ map: lacquerTexture(), roughness: 0.3, envMapIntensity: 0.6 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd9ad48, metalness: 1, roughness: 0.27, envMapIntensity: 1.15 });
  const sideMats = (side, top) => [side, side, top, top, side, side];

  const step2 = new THREE.Mesh(new THREE.BoxGeometry(12.6, 0.28, 12.6), sideMats(marbleSide, marbleTop));
  step2.position.y = GROUND + 0.14;
  const step1 = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.32, 11.4), sideMats(marbleSide, marbleTop));
  step1.position.y = -0.51;
  const frameBox = new THREE.Mesh(new THREE.BoxGeometry(9.6, 0.32, 9.6), sideMats(lacquerSide, lacquerSide));
  frameBox.position.y = -0.19;
  const frameTop = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 9.6),
    new THREE.MeshStandardMaterial({ map: frameTexture(), roughness: 0.32, envMapIntensity: 0.6 }));
  frameTop.rotation.x = -Math.PI / 2; frameTop.position.y = -0.026;
  const rim = new THREE.Mesh(new THREE.BoxGeometry(8.18, 0.06, 8.18), goldMat);
  rim.position.y = -0.035;
  const boardTop = new THREE.Mesh(new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ map: boardTexture(), roughness: 0.28, metalness: 0.02, envMapIntensity: 0.55 }));
  boardTop.rotation.x = -Math.PI / 2;
  for (const m of [step2, step1, frameBox, frameTop, rim, boardTop]) { m.receiveShadow = true; scene.add(m); }
  frameBox.castShadow = true; step1.castShadow = true;

  // Gold corner finials on the platform
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 0.5, 16), goldMat); p.position.y = 0.25;
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), goldMat); b.position.y = 0.58;
    const t = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 12), goldMat); t.position.y = 0.78;
    f.add(p, b, t); f.position.set(sx * 5.4, -0.35, sz * 5.4);
    f.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    scene.add(f);
  }

  // Pavilions (chhatris) and cypress trees
  const sandstone = new THREE.MeshStandardMaterial({ color: 0xb5573e, roughness: 0.8 });
  const whiteMarble = new THREE.MeshStandardMaterial({ color: 0xf3ede2, roughness: 0.45, envMapIntensity: 0.5 });
  function chhatri() {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(2, 0.3, 2), sandstone); base.position.y = 0.15;
    g.add(base);
    for (const x of [-0.72, 0.72]) for (const z of [-0.72, 0.72]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 1.5, 12), whiteMarble);
      col.position.set(x, 1.05, z); g.add(col);
    }
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.2, 1.9), sandstone); top.position.y = 1.9; g.add(top);
    const eave = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.05, 2.3), whiteMarble); eave.position.y = 1.78; g.add(eave);
    const dome = new THREE.Mesh(new THREE.LatheGeometry(
      [[0, 0], [0.62, 0], [0.7, 0.2], [0.67, 0.45], [0.52, 0.72], [0.3, 0.92], [0.1, 1.04], [0, 1.07]].map(([x, y]) => new THREE.Vector2(x, y)), 32), whiteMarble);
    dome.position.y = 2.0; g.add(dome);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 10), goldMat); fin.position.y = 3.25; g.add(fin);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), goldMat); ball.position.y = 3.08; g.add(ball);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const c = chhatri(); c.position.set(sx * 9.2, GROUND, sz * 9.2); c.rotation.y = Math.PI / 4; scene.add(c);
  }
  const cypressGeo = new THREE.LatheGeometry([[0, 0], [0.38, 0.25], [0.5, 0.9], [0.46, 1.7], [0.33, 2.5], [0.14, 3.1], [0, 3.4]].map(([x, y]) => new THREE.Vector2(x, y)), 8);
  const cypressMat = new THREE.MeshStandardMaterial({ color: 0x2c5b39, roughness: 0.9, flatShading: true });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3b22, roughness: 1 });
  function cypress(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.4, 6), trunkMat); trunk.position.y = 0.2;
    const crown = new THREE.Mesh(cypressGeo, cypressMat); crown.position.y = 0.3;
    g.add(trunk, crown); g.position.set(x, GROUND, z); g.scale.setScalar(s);
    crown.castShadow = true;
    scene.add(g);
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2 + Math.PI / 20;
    if (Math.abs(Math.sin(a * 2)) < 0.18) continue;
    cypress(Math.cos(a) * 15.5, Math.sin(a) * 15.5, 1 + (i % 3) * 0.15);
  }
  for (const d of [22, 27, 32, 37]) for (const s of [-1, 1]) {
    cypress(d, s * 1.9, 1.2); cypress(-d, s * 1.9, 1.2); cypress(s * 1.9, d, 1.2); cypress(s * 1.9, -d, 1.2);
  }

  /* ------------------------------------------------------------------ */
  /*  The courtiers (chess pieces)                                       */
  /* ------------------------------------------------------------------ */
  const PIECE_SCALE = 0.94;
  const MAT = {
    w: {
      body: new THREE.MeshPhysicalMaterial({ color: 0xfbf1dc, roughness: 0.33, clearcoat: 0.6, clearcoatRoughness: 0.3, envMapIntensity: 0.6 }),
      jewel: new THREE.MeshPhysicalMaterial({ color: 0xc8102e, roughness: 0.08, clearcoat: 1, emissive: 0x3a0008, envMapIntensity: 1.4 }),
      ink: 0x2b1709,
    },
    b: {
      body: new THREE.MeshPhysicalMaterial({ color: 0x221a15, roughness: 0.22, clearcoat: 1, clearcoatRoughness: 0.08, envMapIntensity: 0.95 }),
      jewel: new THREE.MeshPhysicalMaterial({ color: 0x0fa565, roughness: 0.08, clearcoat: 1, emissive: 0x022a16, envMapIntensity: 1.4 }),
      ink: 0x9a7424,
    },
  };
  const INK = {};
  function inkMaterial(color) {
    if (INK[color]) return INK[color];
    const m = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed += normalize(normal) * 0.0135;');
    };
    INK[color] = m;
    return m;
  }

  const V2 = (pts) => pts.map(([x, y]) => new THREE.Vector2(x, y));
  const arc = (cy, r, a0, a1, n) => {
    const out = [];
    for (let i = 0; i <= n; i++) { const a = THREE.MathUtils.degToRad(a0 + ((a1 - a0) * i) / n); out.push([Math.max(0, r * Math.cos(a)), cy + r * Math.sin(a)]); }
    return out;
  };
  const BASE = [[0, 0], [0.37, 0], [0.385, 0.02], [0.385, 0.05], [0.365, 0.072], [0.335, 0.082], [0.335, 0.1], [0.31, 0.118], [0.285, 0.13]];
  const PROFILE = {
    p: BASE.concat([[0.24, 0.16], [0.19, 0.2], [0.155, 0.27], [0.13, 0.36], [0.12, 0.43], [0.2, 0.455], [0.205, 0.475], [0.13, 0.495], [0.095, 0.52]], arc(0.64, 0.15, -55, 90, 14)),
    r: BASE.concat([[0.27, 0.16], [0.235, 0.2], [0.215, 0.28], [0.2, 0.58], [0.21, 0.62], [0.27, 0.66], [0.285, 0.7], [0.285, 0.86], [0.205, 0.86], [0.205, 0.8], [0, 0.8]]),
    n: BASE.concat([[0.27, 0.16], [0.23, 0.21], [0.21, 0.27], [0, 0.29]]),
    b: BASE.concat([[0.25, 0.16], [0.195, 0.22], [0.15, 0.32], [0.125, 0.48], [0.13, 0.56], [0.215, 0.595], [0.215, 0.615], [0.135, 0.645], [0.15, 0.69], [0.195, 0.76], [0.21, 0.82], [0.2, 0.88], [0.165, 0.94], [0.115, 0.995], [0.06, 1.04], [0.022, 1.08], [0, 1.1]]),
    q: BASE.concat([[0.27, 0.16], [0.21, 0.22], [0.165, 0.32], [0.135, 0.5], [0.125, 0.7], [0.135, 0.8], [0.235, 0.845], [0.235, 0.87], [0.145, 0.9], [0.15, 0.95], [0.195, 1.02], [0.235, 1.09], [0.225, 1.11], [0.13, 1.06], [0, 1.06]]),
    k: BASE.concat([[0.28, 0.16], [0.22, 0.22], [0.175, 0.34], [0.145, 0.56], [0.135, 0.78], [0.15, 0.9], [0.255, 0.95], [0.255, 0.975], [0.155, 1.0], [0.165, 1.06], [0.215, 1.15], [0.245, 1.22], [0.235, 1.24], [0.15, 1.2], [0, 1.2]]),
  };
  const GEO = {};
  const geo = (key, make) => GEO[key] || (GEO[key] = make());

  function buildPiece(color, type) {
    const M = MAT[color];
    const inner = new THREE.Group();
    const add = (g, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(g, mat); m.position.set(x, y, z); inner.add(m); return m; };
    const ring = (r, tube, y) => { const m = add(geo(`ring${r}_${tube}`, () => new THREE.TorusGeometry(r, tube, 12, 56)), goldMat, 0, y, 0); m.rotation.x = Math.PI / 2; return m; };
    const ball = (r, mat, x, y, z) => add(geo(`ball${r}`, () => new THREE.SphereGeometry(r, 20, 14)), mat, x, y, z);

    add(geo('lathe' + type, () => new THREE.LatheGeometry(V2(PROFILE[type]), 56)), M.body);
    ring(0.338, 0.016, 0.09);

    if (type === 'p') {
      ring(0.203, 0.018, 0.465);
      ball(0.035, goldMat, 0, 0.8, 0);
    } else if (type === 'r') {
      ring(0.205, 0.016, 0.6);
      ring(0.288, 0.014, 0.69);
      const cren = geo('cren', () => new THREE.BoxGeometry(0.115, 0.1, 0.08));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const m = add(cren, M.body, Math.cos(a) * 0.245, 0.905, Math.sin(a) * 0.245);
        m.rotation.y = -a - Math.PI / 2;
      }
      add(geo('rdome', () => new THREE.SphereGeometry(0.125, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2)), goldMat, 0, 0.8, 0);
      ball(0.03, goldMat, 0, 0.94, 0);
    } else if (type === 'n') {
      const head = add(geo('horse', () => {
        // side profile of a noble horse's head, facing +x
        const P = (x, y) => new THREE.Vector2(x - 0.08, y);
        const shape = new THREE.Shape();
        shape.moveTo(-0.25, 0.26);
        shape.lineTo(0.09, 0.26);                                            // neck base
        shape.quadraticCurveTo(0.2, 0.34, 0.16, 0.46);                       // chest
        shape.quadraticCurveTo(0.14, 0.56, 0.24, 0.6);                       // throat to jaw
        shape.quadraticCurveTo(0.34, 0.6, 0.42, 0.6);                        // under the jaw
        shape.quadraticCurveTo(0.5, 0.61, 0.5, 0.67);                        // chin & mouth
        shape.quadraticCurveTo(0.52, 0.74, 0.46, 0.77);                      // nose tip
        shape.quadraticCurveTo(0.36, 0.82, 0.27, 0.9);                       // bridge of the nose
        shape.quadraticCurveTo(0.2, 0.96, 0.16, 1.0);                        // forehead
        shape.lineTo(0.15, 1.14);                                            // ear front
        shape.lineTo(0.07, 1.02);                                            // ear back
        shape.quadraticCurveTo(-0.04, 1.03, -0.12, 0.97);                    // poll & crest
        shape.quadraticCurveTo(-0.27, 0.84, -0.3, 0.6);                      // mane
        shape.quadraticCurveTo(-0.32, 0.4, -0.25, 0.26);                     // back of the neck
        const pts = shape.getPoints(10).map((p) => P(p.x, p.y));
        const moved = new THREE.Shape(pts);
        const g = new THREE.ExtrudeGeometry(moved, { depth: 0.17, bevelEnabled: true, bevelThickness: 0.055, bevelSize: 0.035, bevelSegments: 4, curveSegments: 10 });
        g.translate(0, 0, -0.085);
        g.computeVertexNormals();
        return g;
      }), M.body);
      head.userData.knightHead = true;
      for (const z of [-0.132, 0.132]) ball(0.032, M.jewel, 0.15, 0.86, z);              // eyes
      for (const [x, y] of [[-0.18, 0.97], [-0.27, 0.88], [-0.33, 0.77], [-0.36, 0.65], [-0.37, 0.53], [-0.36, 0.41], [-0.33, 0.31]]) ball(0.045, goldMat, x, y, 0); // gold-studded mane
      const strap = add(geo('strap', () => new THREE.BoxGeometry(0.035, 0.2, 0.3)), goldMat, 0.31, 0.7, 0);     // noseband
      strap.rotation.z = 0.45;
      ball(0.04, goldMat, 0.02, 1.0, 0);                                                   // plume jewel between the ears
      ring(0.215, 0.016, 0.24);
    } else if (type === 'b') {
      ring(0.217, 0.017, 0.605);
      const sash = ring(0.205, 0.013, 0.83); sash.rotation.x = Math.PI / 2 + 0.5;
      ball(0.045, goldMat, 0, 1.13, 0);
      ball(0.03, M.jewel, 0, 0.83, 0.205);
    } else if (type === 'q') {
      ring(0.237, 0.017, 0.857);
      ring(0.217, 0.02, 1.07);
      ring(0.14, 0.012, 0.5);
      for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; ball(0.036, goldMat, Math.cos(a) * 0.228, 1.125, Math.sin(a) * 0.228); }
      const dome = ball(0.135, goldMat, 0, 1.05, 0); dome.scale.y = 0.85;
      ball(0.055, M.jewel, 0, 1.2, 0);
    } else if (type === 'k') {
      ring(0.257, 0.017, 0.962);
      ring(0.228, 0.022, 1.19);
      add(geo('kdome', () => new THREE.LatheGeometry(V2([[0, 1.18], [0.17, 1.18], [0.185, 1.25], [0.15, 1.32], [0.08, 1.39], [0.03, 1.42], [0, 1.43]]), 40)), goldMat);
      add(geo('crossV', () => new THREE.BoxGeometry(0.05, 0.21, 0.05)), goldMat, 0, 1.53, 0);
      add(geo('crossH', () => new THREE.BoxGeometry(0.155, 0.05, 0.05)), goldMat, 0, 1.56, 0);
      for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2 + Math.PI / 4; ball(0.034, M.jewel, Math.cos(a) * 0.245, 1.2, Math.sin(a) * 0.245); }
    }

    // ink outlines like a miniature painter's brush line
    const ink = inkMaterial(M.ink);
    for (const m of inner.children.slice()) {
      m.castShadow = true; m.receiveShadow = true;
      const o = new THREE.Mesh(m.geometry, ink);
      o.position.copy(m.position); o.rotation.copy(m.rotation); o.scale.copy(m.scale);
      o.userData.outline = true;
      inner.add(o);
    }
    inner.scale.setScalar(PIECE_SCALE);
    const outer = new THREE.Group();
    outer.add(inner);
    outer.userData = { type, color };
    return outer;
  }
  const PROTO = {};
  function makePiece(ch) {
    const color = Chess.colorOf(ch), type = ch.toLowerCase();
    const key = color + type;
    if (!PROTO[key]) PROTO[key] = buildPiece(color, type);
    const g = PROTO[key].clone(true);
    // knights stand three-quarter turned so their noble profile is visible from both sides
    g.userData = { type, color, sq: -1, baseRotY: type === 'n' ? (color === 'w' ? Math.PI / 2 + 0.9 : -Math.PI / 2 + 0.9) : (color === 'w' ? 0 : Math.PI) };
    g.rotation.y = g.userData.baseRotY;
    g.traverse((o) => { if (o.isMesh) o.userData.owner = g; });
    return g;
  }

  const pieceRoot = new THREE.Group(); scene.add(pieceRoot);
  const graveRoot = new THREE.Group(); scene.add(graveRoot);
  const pieceAt = new Array(64).fill(null);
  const sqPos = (sq) => new THREE.Vector3((sq & 7) - 3.5, 0, 3.5 - (sq >> 3));
  const gallery = { w: 0, b: 0 };
  function gallerySlot(capturer, i) {
    return capturer === 'w' ? new THREE.Vector3(5.22, -0.35, 3.6 - i * 0.52) : new THREE.Vector3(-5.22, -0.35, -3.6 + i * 0.52);
  }

  function placeInGallery(obj, capturer) {
    const pos = gallerySlot(capturer, gallery[capturer]++);
    obj.position.copy(pos);
    obj.quaternion.setFromAxisAngle(Y, obj.userData.baseRotY);
    obj.scale.setScalar(0.5);
    obj.userData.sq = -1;
    graveRoot.add(obj);
  }

  function rebuildPieces() {
    for (const root of [pieceRoot, graveRoot]) while (root.children.length) root.remove(root.children[0]);
    pieceAt.fill(null);
    gallery.w = 0; gallery.b = 0;
    for (let sq = 0; sq < 64; sq++) {
      const p = game.get(sq);
      if (!p) continue;
      const g = makePiece(p);
      g.position.copy(sqPos(sq));
      g.userData.sq = sq;
      pieceRoot.add(g);
      pieceAt[sq] = g;
    }
    for (const m of game.played) if (m.captured) placeInGallery(makePiece(m.captured), m.color);
  }

  /* ------------------------------------------------------------------ */
  /*  Square markers                                                     */
  /* ------------------------------------------------------------------ */
  const MARK_TEX = {
    dot: spriteTexture((g, s) => {
      const c = s / 2;
      const gr = g.createRadialGradient(c, c, 0, c, c, 34); gr.addColorStop(0, 'rgba(255,236,160,.75)'); gr.addColorStop(1, 'rgba(255,220,120,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
      g.fillStyle = '#f7d774'; g.strokeStyle = 'rgba(70,35,5,.8)'; g.lineWidth = 3;
      g.beginPath(); g.arc(c, c, 17, 0, 7); g.fill(); g.stroke();
      g.fillStyle = '#fff6d6'; g.beginPath(); g.arc(c - 4, c - 4, 5, 0, 7); g.fill();
    }),
    ring: spriteTexture((g, s) => {
      const c = s / 2;
      g.strokeStyle = 'rgba(70,20,5,.75)'; g.lineWidth = 15; g.beginPath(); g.arc(c, c, 52, 0, 7); g.stroke();
      g.strokeStyle = '#e0452b'; g.lineWidth = 10; g.beginPath(); g.arc(c, c, 52, 0, 7); g.stroke();
      g.strokeStyle = '#f7d774'; g.lineWidth = 2.5; g.beginPath(); g.arc(c, c, 45, 0, 7); g.stroke();
      g.beginPath(); g.arc(c, c, 59, 0, 7); g.stroke();
    }),
    sel: spriteTexture((g, s) => {
      g.shadowColor = '#ffd76a'; g.shadowBlur = 16; g.strokeStyle = '#ffe089'; g.lineWidth = 8;
      g.strokeRect(10, 10, s - 20, s - 20);
      g.shadowBlur = 0; g.fillStyle = 'rgba(255,215,106,.25)'; g.fillRect(10, 10, s - 20, s - 20);
    }),
    last: spriteTexture((g, s) => {
      g.fillStyle = 'rgba(240,170,50,.34)'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,215,120,.85)'; g.lineWidth = 4; g.strokeRect(6, 6, s - 12, s - 12);
    }),
    check: spriteTexture((g, s) => {
      const c = s / 2; const gr = g.createRadialGradient(c, c, 4, c, c, c);
      gr.addColorStop(0, 'rgba(255,60,40,.95)'); gr.addColorStop(0.55, 'rgba(220,30,20,.55)'); gr.addColorStop(1, 'rgba(200,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, s, s);
    }),
    hover: spriteTexture((g, s) => {
      g.strokeStyle = 'rgba(255,250,230,.9)'; g.lineWidth = 4; g.strokeRect(8, 8, s - 16, s - 16);
    }),
    tint: spriteTexture((g, s) => {
      g.fillStyle = 'rgba(255,214,110,.3)'; g.fillRect(4, 4, s - 8, s - 8);
      g.strokeStyle = 'rgba(255,226,140,.75)'; g.lineWidth = 3; g.strokeRect(5, 5, s - 10, s - 10);
    }),
  };
  const MARK_Y = { last: 0.004, check: 0.005, tint: 0.0055, sel: 0.006, hover: 0.007, dot: 0.009, ring: 0.009 };
  const markGeo = new THREE.PlaneGeometry(1, 1);
  const marks = {};
  for (const kind of Object.keys(MARK_TEX)) {
    marks[kind] = { mat: new THREE.MeshBasicMaterial({ map: MARK_TEX[kind], transparent: true, depthWrite: false, fog: false }), meshes: [] };
  }
  // move dots are never hidden behind a tall courtier
  marks.dot.mat.depthTest = false;
  marks.dot.order = 10;
  function setMarks(kind, squares) {
    const M = marks[kind];
    while (M.meshes.length < squares.length) {
      const m = new THREE.Mesh(markGeo, M.mat);
      m.rotation.x = -Math.PI / 2; m.renderOrder = M.order || 2;
      scene.add(m); M.meshes.push(m);
    }
    M.meshes.forEach((m, i) => {
      if (i < squares.length) { m.visible = true; m.position.copy(sqPos(squares[i])); m.position.y = MARK_Y[kind]; }
      else m.visible = false;
    });
  }
  function refreshStaticMarks() {
    const last = game.played[game.played.length - 1];
    setMarks('last', last ? [last.from, last.to] : []);
    setMarks('check', game.inCheck() ? [game.kings[game.turn]] : []);
  }

  /* ------------------------------------------------------------------ */
  /*  Animation helpers                                                  */
  /* ------------------------------------------------------------------ */
  const anims = [];
  const animate = (dur, fn) => new Promise((res) => anims.push({ t0: performance.now(), dur: Math.max(1, dur * MOTION), fn, res }));
  function tickAnims(now) {
    for (let i = anims.length - 1; i >= 0; i--) {
      const a = anims[i];
      const k = Math.min(1, (now - a.t0) / a.dur);
      a.fn(k);
      if (k >= 1) { anims.splice(i, 1); a.res(); }
    }
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms * MOTION));
  const E = {
    inOutCubic: (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    inOutSine: (k) => -(Math.cos(Math.PI * k) - 1) / 2,
    outBack: (k) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
    outCubic: (k) => 1 - Math.pow(1 - k, 3),
  };
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpAngle = (a, b, t) => { let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; return a + d * t; };

  const _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _qc = new THREE.Quaternion();
  function setPose(obj, yaw, leanAxis, lean, rollAxis, roll) {
    _qc.setFromAxisAngle(Y, yaw);
    _qa.setFromAxisAngle(leanAxis, lean);
    _qb.setFromAxisAngle(rollAxis, roll);
    obj.quaternion.copy(_qa).multiply(_qb).multiply(_qc);
  }

  // Sparkles of gold dust
  const sparkTex = spriteTexture((g, s) => {
    const c = s / 2; const gr = g.createRadialGradient(c, c, 0, c, c, c);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.25, 'rgba(255,225,140,.85)'); gr.addColorStop(1, 'rgba(255,200,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, s, s);
    g.strokeStyle = 'rgba(255,250,220,.9)'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(c, 6); g.lineTo(c, s - 6); g.moveTo(6, c); g.lineTo(s - 6, c); g.stroke();
  }, 64);
  const sparks = [];
  function sparkle(pos, n, color = 0xffe08a, spread = 0.6, life = 1200, up = 1.4) {
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3), v = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      p[i * 3] = pos.x + (Math.random() - 0.5) * 0.3; p[i * 3 + 1] = pos.y + Math.random() * 0.3; p[i * 3 + 2] = pos.z + (Math.random() - 0.5) * 0.3;
      const a = Math.random() * Math.PI * 2, s = Math.random() * spread;
      v[i * 3] = Math.cos(a) * s; v[i * 3 + 1] = up * (0.4 + Math.random()); v[i * 3 + 2] = Math.sin(a) * s;
    }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    const m = new THREE.PointsMaterial({ map: sparkTex, color, size: 0.18, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    const pts = new THREE.Points(g, m);
    scene.add(pts);
    sparks.push({ pts, v, born: performance.now(), life });
  }
  function tickSparks(now, dt) {
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i], t = (now - s.born) / s.life;
      if (t >= 1) { scene.remove(s.pts); s.pts.geometry.dispose(); s.pts.material.dispose(); sparks.splice(i, 1); continue; }
      const arr = s.pts.geometry.attributes.position.array;
      for (let j = 0; j < arr.length; j += 3) {
        s.v[j + 1] -= 1.6 * dt;
        arr[j] += s.v[j] * dt; arr[j + 1] += s.v[j + 1] * dt; arr[j + 2] += s.v[j + 2] * dt;
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
      s.pts.material.opacity = 1 - t * t;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  How each courtier walks                                            */
  /* ------------------------------------------------------------------ */
  function strideDuration(type, dist) {
    switch (type) {
      case 'k': return 900 + 260 * dist;
      case 'q': return 700 + 150 * dist;
      case 'r': return 520 + 170 * dist;
      case 'b': return 520 + 150 * dist;
      case 'n': return 900;
      default: return 480 + 260 * dist;
    }
  }

  function stride(obj, from, to, type) {
    const a = sqPos(from), b = sqPos(to), dist = a.distanceTo(b);
    const dir = b.clone().sub(a).normalize();
    const leanAxis = new THREE.Vector3().crossVectors(Y, dir).normalize();
    const base = obj.userData.baseRotY, y0 = obj.position.y;
    const face = Math.atan2(-dir.z, dir.x);
    obj.userData.moving = true;
    return animate(strideDuration(type, dist), (k) => {
      let px = E.inOutSine(k), lift = 0, lean = 0, roll = 0, yaw = base, squash = 1;
      switch (type) {
        case 'k': { // slow royal procession, then a gracious nod
          const steps = Math.max(2, Math.round(dist * 2));
          px = E.inOutSine(clamp01(k / 0.82));
          lift = Math.abs(Math.sin(px * Math.PI * steps)) * 0.06;
          roll = Math.sin(px * Math.PI * steps) * 0.06;
          lean = 0.07 * Math.sin(px * Math.PI);
          if (k > 0.82) lean += Math.sin(((k - 0.82) / 0.18) * Math.PI) * 0.24;
          break;
        }
        case 'q': { // gliding pirouette and a curtsy
          px = E.inOutCubic(clamp01(k / 0.85));
          lift = Math.sin(px * Math.PI) * 0.3;
          yaw = base + px * Math.PI * 2;
          lean = Math.sin(px * Math.PI) * 0.1;
          if (k > 0.85) squash = 1 - Math.sin(((k - 0.85) / 0.15) * Math.PI) * 0.07;
          break;
        }
        case 'b': { // measured diagonal steps
          const steps = Math.max(1, Math.round(dist / Math.SQRT2));
          px = E.inOutSine(k);
          lift = Math.abs(Math.sin(px * Math.PI * steps)) * 0.14;
          roll = Math.sin(px * Math.PI * steps) * 0.05;
          lean = 0.13 * Math.sin(k * Math.PI);
          break;
        }
        case 'n': { // the cavalier turns, rears, leaps and lands
          const tIn = E.inOutSine(clamp01(k / 0.16)), tOut = E.inOutSine(clamp01((k - 0.84) / 0.16));
          yaw = lerpAngle(lerpAngle(base, face, tIn), base, tOut);
          const lk = clamp01((k - 0.14) / 0.72);
          px = E.inOutSine(lk);
          lift = Math.sin(lk * Math.PI) * 1.0;
          if (k < 0.14) lean = -0.38 * Math.sin((k / 0.14) * Math.PI);
          else lean = -0.32 * Math.sin(lk * Math.PI * 2);
          if (k > 0.86) squash = 1 - Math.sin(((k - 0.86) / 0.14) * Math.PI) * 0.08;
          break;
        }
        case 'r': { // the heavy fortress rumbles forward
          px = E.inOutCubic(k);
          const env = Math.sin(k * Math.PI);
          roll = Math.sin(k * Math.PI * 22) * 0.02 * env;
          lift = Math.abs(Math.sin(k * Math.PI * 22)) * 0.012 * env;
          lean = 0.04 * env;
          break;
        }
        default: { // the soldier marches
          const steps = Math.max(1, Math.round(dist));
          px = E.inOutSine(k);
          lift = Math.abs(Math.sin(px * Math.PI * steps)) * 0.13;
          lean = 0.1 * Math.sin(k * Math.PI);
          roll = Math.sin(px * Math.PI * steps * 2) * 0.03;
        }
      }
      obj.position.lerpVectors(a, b, px);
      obj.position.y = lift + y0 * (1 - clamp01(k * 4));
      setPose(obj, yaw, leanAxis, lean, dir, roll);
      obj.scale.set(1, squash, 1);
    }).then(() => {
      obj.position.copy(b);
      obj.quaternion.setFromAxisAngle(Y, base);
      obj.scale.set(1, 1, 1);
      obj.userData.moving = false;
    });
  }

  // A captured courtier bows, yields and retires to the gallery beside the board
  async function yieldPiece(obj, pushDir, capturer) {
    obj.userData.moving = true;
    const mats = [];
    obj.traverse((o) => {
      if (!o.isMesh) return;
      if (o.userData.outline) { o.visible = false; return; }
      o.material = o.material.clone(); o.material.transparent = true; mats.push(o.material);
    });
    const dir = pushDir.lengthSq() > 0 ? pushDir.clone().normalize() : new THREE.Vector3(0, 0, 1);
    const axis = new THREE.Vector3().crossVectors(Y, dir).normalize();
    const q0 = obj.quaternion.clone(), start = obj.position.clone();
    sparkle(start.clone().setY(0.35), 30, 0xffd98a, 0.9, 900, 1.1);
    await animate(780, (k) => {
      const e = E.inOutSine(k);
      _qa.setFromAxisAngle(axis, e * 1.5);
      obj.quaternion.copy(_qa).multiply(q0);
      obj.position.copy(start).addScaledVector(dir, e * 0.4);
      obj.position.y = Math.sin(k * Math.PI) * 0.12;
      for (const m of mats) m.opacity = 1 - e * e;
    });
    pieceRoot.remove(obj);
    placeInGallery(obj, capturer);
    const rest = obj.position.clone();
    await animate(420, (k) => {
      obj.position.y = rest.y + (1 - E.outCubic(k)) * 0.8;
      for (const m of mats) m.opacity = k;
    });
    obj.traverse((o) => { if (o.isMesh && o.userData.outline) o.visible = true; });
    for (const m of mats) { m.opacity = 1; m.transparent = false; }
    obj.userData.moving = false;
  }

  async function promote(pawn, m) {
    Sound.promote();
    const pos = sqPos(m.to);
    sparkle(pos.clone().setY(0.3), 70, 0xffe08a, 1.1, 1500, 2);
    await animate(450, (k) => { pawn.scale.setScalar(Math.max(0.001, 1 - k)); pawn.rotation.y = pawn.userData.baseRotY + k * 5; pawn.position.y = k * 0.4; });
    pieceRoot.remove(pawn);
    const np = makePiece(m.color === 'w' ? m.promotion.toUpperCase() : m.promotion);
    np.position.copy(pos); np.userData.sq = m.to; np.scale.setScalar(0.001);
    pieceRoot.add(np); pieceAt[m.to] = np;
    await animate(700, (k) => {
      np.scale.setScalar(Math.max(0.001, E.outBack(k)));
      np.rotation.y = np.userData.baseRotY + (1 - E.outCubic(k)) * 5;
      np.position.y = Math.sin(k * Math.PI) * 0.35;
    });
    np.scale.setScalar(1); np.position.y = 0; np.rotation.y = np.userData.baseRotY;
  }

  function tremble(obj, ms = 600) {
    if (!obj || obj.userData.moving) return;
    const base = obj.userData.baseRotY, axis = new THREE.Vector3(1, 0, 0);
    return animate(ms, (k) => {
      if (obj.userData.moving) return;
      setPose(obj, base, axis, Math.sin(k * Math.PI * 9) * 0.06 * (1 - k), new THREE.Vector3(0, 0, 1), Math.sin(k * Math.PI * 7) * 0.05 * (1 - k));
    }).then(() => { if (!obj.userData.moving) obj.quaternion.setFromAxisAngle(Y, base); });
  }

  function topple(obj) {
    if (!obj) return;
    obj.userData.moving = true;
    const base = obj.userData.baseRotY, axis = new THREE.Vector3(1, 0, 0.4).normalize();
    return animate(1600, (k) => {
      const e = k < 0.3 ? Math.sin((k / 0.3) * Math.PI * 3) * 0.08 : E.outBack((k - 0.3) / 0.7) * 1.38;
      setPose(obj, base, axis, e, new THREE.Vector3(0, 0, 1), 0);
      obj.position.y = k > 0.3 ? Math.sin(((k - 0.3) / 0.7) * Math.PI) * 0.08 + 0.05 * clamp01((k - 0.3) / 0.7) : 0;
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Sound — small synthesised court sounds                             */
  /* ------------------------------------------------------------------ */
  const Sound = {
    ctx: null, on: true, noiseBuf: null,
    ensure() {
      if (!this.ctx) {
        try {
          this.ctx = new (window.AudioContext || window.webkitAudioContext)();
          const len = this.ctx.sampleRate * 0.3;
          this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
          const d = this.noiseBuf.getChannelData(0);
          for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        } catch (e) { this.ctx = null; }
      }
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    },
    env(gain, t, a, d, v) {
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(v, t + a);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    },
    tone(f, d, type = 'sine', v = 0.12, delay = 0, slide) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + delay;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + d);
      o.connect(g).connect(c.destination);
      this.env(g, t, 0.006, d, v);
      o.start(t); o.stop(t + d + 0.05);
    },
    knock(v = 0.4, freq = 1200, d = 0.08, delay = 0) {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime + delay;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.4;
      const g = c.createGain();
      s.connect(f).connect(g).connect(c.destination);
      this.env(g, t, 0.003, d, v);
      s.start(t); s.stop(t + d + 0.05);
    },
    move() { this.knock(0.55, 1300, 0.07); this.tone(200, 0.13, 'triangle', 0.12, 0, 150); },
    capture() { this.knock(0.6, 700, 0.12); this.tone(130, 0.3, 'sine', 0.2, 0, 80); this.tone(1568, 0.5, 'sine', 0.04, 0.04); this.tone(2093, 0.6, 'sine', 0.025, 0.09); },
    select() { this.tone(1046, 0.08, 'sine', 0.045); },
    deny() { this.tone(180, 0.12, 'triangle', 0.06); },
    check() { this.tone(587, 0.5, 'triangle', 0.1); this.tone(880, 0.6, 'triangle', 0.08, 0.09); this.tone(1175, 0.7, 'sine', 0.05, 0.18); },
    castle() { this.knock(0.5, 1100, 0.07); this.knock(0.5, 900, 0.07, 0.2); this.tone(392, 0.4, 'triangle', 0.06, 0.1); },
    promote() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.08, i * 0.09)); },
    win() { [392, 440, 494, 587, 659, 784, 988].forEach((f, i) => this.tone(f, 0.7, 'triangle', 0.08, i * 0.14)); },
    draw() { [523, 494, 440, 392].forEach((f, i) => this.tone(f, 0.6, 'sine', 0.07, i * 0.18)); },
    whoosh() {
      if (!this.on || !this.ctx) return;
      const c = this.ctx, t = c.currentTime;
      const s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 0.8;
      f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(1400, t + 1.1); f.frequency.exponentialRampToValueAtTime(350, t + 2.4);
      const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.9); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.5);
      s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + 2.6);
    },
  };

  /* ------------------------------------------------------------------ */
  /*  Camera — orbit by hand, or the drone flight between the courts     */
  /* ------------------------------------------------------------------ */
  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(target);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.rotateSpeed = 0.6;
  controls.minDistance = 7; controls.minPolarAngle = 0.05; controls.maxPolarAngle = 1.32;
  const VIEW_PHI = 0.9;
  function viewRadius() {
    const t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const panels = innerWidth > 900 ? 2 * ((innerWidth <= 1180 ? 240 : 290) + 56) : 0;
    const aspect = Math.max(0.3, (innerWidth - panels) / innerHeight);
    return Math.max(13.5, 4.9 / (t * aspect));
  }
  controls.maxDistance = Math.max(26, viewRadius() + 8);
  const sideTheta = (c) => (c === 'w' ? 0 : Math.PI);
  camera.position.setFromSphericalCoords(30, 0.95, 0.9).add(target);
  camera.lookAt(target);

  const flight = { active: false, token: 0 };
  function flyTo(theta, phi, radius, dur = 2600, arcLift = true) {
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    let d = theta - s.theta;
    d = ((d + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
    if (Math.abs(Math.abs(d) - Math.PI) < 0.02) d = Math.PI;
    const amount = arcLift ? Math.min(1, Math.abs(d) / Math.PI) : 0;
    const tok = ++flight.token;
    flight.active = true; controls.enabled = false; controls.autoRotate = false;
    if (amount > 0.3) Sound.whoosh();
    return animate(dur, (k) => {
      if (tok !== flight.token) return;
      const e = E.inOutCubic(k), b = Math.sin(Math.PI * k);
      const th = s.theta + d * e;
      const ph = Math.max(0.06, lerp(s.phi, phi, e) - b * 0.5 * amount);
      const r = lerp(s.radius, radius, e) + b * 3.4 * amount;
      camera.position.setFromSphericalCoords(r, ph, th).add(target);
      camera.up.set(0, 1, 0);
      camera.lookAt(target);
      camera.rotateZ(-b * 0.08 * Math.sign(d) * amount); // the drone banks into the turn
    }).then(() => {
      if (tok !== flight.token) return;
      camera.up.set(0, 1, 0);
      flight.active = false; controls.enabled = true; controls.update();
    });
  }
  const viewSide = () => (S.mode === 'ai' ? S.human : game.turn);
  const flyToSide = (c, dur = 2600) => flyTo(sideTheta(c), VIEW_PHI, viewRadius(), dur, true);

  /* ------------------------------------------------------------------ */
  /*  Game state and flow                                                */
  /* ------------------------------------------------------------------ */
  const S = { mode: 'ai', human: 'w', level: 2, drone: true, busy: false, over: false, thinking: false, selected: -1, selMoves: [], token: 0, started: false, topView: false, result: null };
  let settling = [];
  const isHumanTurn = () => S.mode === 'pvp' || game.turn === S.human;
  const courtName = (c) => (c === 'w' ? 'White' : 'Black');
  function sideLabel(c) {
    if (S.mode === 'ai') return c === S.human ? 'You' : 'The Vizier';
    return `${courtName(c)} Court`;
  }

  function select(sq) {
    if (S.selected >= 0 && pieceAt[S.selected]) settling.push(pieceAt[S.selected]);
    S.selected = sq;
    S.selMoves = game.moves(sq);
    setMarks('sel', [sq]);
    setMarks('dot', S.selMoves.filter((m) => !m.captured).map((m) => m.to));
    setMarks('ring', [...new Set(S.selMoves.filter((m) => m.captured).map((m) => m.to))]);
    setMarks('tint', [...new Set(S.selMoves.filter((m) => !m.captured).map((m) => m.to))]);
    settling = settling.filter((p) => p !== pieceAt[sq]);
    showCard(sq);
    if (S.selMoves.length) Sound.select();
    else { Sound.deny(); setStatus(`This ${NAME[game.get(sq).toLowerCase()].toLowerCase()} has no legal move right now.`); }
  }
  function deselect() {
    if (S.selected >= 0 && pieceAt[S.selected]) settling.push(pieceAt[S.selected]);
    S.selected = -1; S.selMoves = [];
    setMarks('sel', []); setMarks('dot', []); setMarks('ring', []); setMarks('tint', []);
  }

  async function onSquare(hit) {
    if (!S.started || S.busy || S.over || !isHumanTurn()) return;
    if (!hit) { deselect(); return; }
    const sq = hit.sq;
    if (S.selected >= 0) {
      const cands = S.selMoves.filter((m) => m.to === sq);
      if (cands.length) {
        let promotion = null;
        if (cands[0].promotion) {
          promotion = await askPromotion(game.turn);
          if (!promotion) return;
        }
        const from = S.selected;
        S.selected = -1;
        setMarks('sel', []); setMarks('dot', []); setMarks('ring', []); setMarks('tint', []);
        await commitMove({ from, to: sq, promotion });
        return;
      }
    }
    const p = game.get(sq);
    if (p && Chess.colorOf(p) === game.turn) { if (sq === S.selected) deselect(); else select(sq); }
    else {
      if (S.selected >= 0 && p == null) Sound.deny();
      deselect();
      if (p) showCard(sq);
    }
  }

  async function commitMove(spec) {
    const tok = S.token;
    const m = game.move(spec);
    if (!m) return;
    S.busy = true; setStatus('');
    setMarks('hover', []);
    updateUI();
    await animateMove(m);
    if (tok !== S.token) return;
    await afterMove(m, tok);
  }

  async function animateMove(m) {
    const mover = pieceAt[m.from];
    pieceAt[m.from] = null;
    const victimSq = m.flags === 'e' ? m.to + (m.color === 'w' ? -8 : 8) : m.captured ? m.to : -1;
    const victim = victimSq >= 0 ? pieceAt[victimSq] : null;
    if (victim) { pieceAt[victimSq] = null; victim.userData.sq = -1; }
    pieceAt[m.to] = mover; mover.userData.sq = m.to;
    settling = settling.filter((p) => p !== mover);
    const type = m.piece.toLowerCase();
    const dur = strideDuration(type, sqPos(m.from).distanceTo(sqPos(m.to))) * MOTION;
    const jobs = [stride(mover, m.from, m.to, type)];
    if (victim) {
      const push = sqPos(m.to).sub(sqPos(m.from)).setY(0);
      jobs.push(wait((dur / MOTION) * (type === 'n' ? 0.8 : 0.66)).then(() => { Sound.capture(); return yieldPiece(victim, push, m.color); }));
    }
    if (m.flags === 'k' || m.flags === 'q') {
      const rf = m.flags === 'k' ? m.to + 1 : m.to - 2, rt = m.flags === 'k' ? m.to - 1 : m.to + 1;
      const rook = pieceAt[rf];
      pieceAt[rf] = null; pieceAt[rt] = rook; rook.userData.sq = rt;
      jobs.push(wait(380).then(() => stride(rook, rf, rt, 'r')));
    }
    await Promise.all(jobs);
    if (m.promotion) await promote(pieceAt[m.to], m);
    if (m.flags === 'k' || m.flags === 'q') Sound.castle();
    else if (!victim && !m.promotion) Sound.move();
  }

  async function afterMove(m, tok) {
    deselect();
    refreshStaticMarks();
    const st = game.status();
    S.busy = false;
    updateUI();
    if (st.over) { await endGame(st, tok); return; }
    if (st.check) {
      Sound.check(); toast('Check!');
      tremble(pieceAt[game.kings[game.turn]]);
    }
    if (S.mode === 'pvp' && S.drone) { S.topView = false; syncButtons(); await flyToSide(game.turn); }
    if (tok !== S.token) return;
    if (S.mode === 'ai' && game.turn !== S.human) await vizierMove(tok);
  }

  async function vizierMove(tok) {
    S.busy = true; S.thinking = true; updateUI();
    await wait(380);
    if (tok !== S.token) return;
    const t0 = performance.now();
    const best = game.bestMove(S.level);
    const spent = performance.now() - t0;
    if (spent < 650) await wait(650 - spent);
    if (tok !== S.token) return;
    S.thinking = false;
    if (!best) { S.busy = false; updateUI(); return; }
    setMarks('sel', [best.from]);
    await wait(260);
    if (tok !== S.token) return;
    await commitMove({ from: best.from, to: best.to, promotion: best.promotion });
  }

  async function endGame(st, tok) {
    S.over = true; S.result = st; updateUI();
    let title, text, crest;
    if (st.reason === 'checkmate') {
      const loserKing = pieceAt[game.kings[game.turn]];
      toast('Checkmate!');
      title = 'Checkmate';
      crest = glyph(st.winner, 'k');
      if (S.mode === 'ai') text = st.winner === S.human ? 'Victory! The Vizier bows before your command of the board.' : 'The Vizier has cornered your king. Study the board and try again.';
      else text = `The ${courtName(st.winner)} Court triumphs — the ${courtName(game.turn).toLowerCase()} king has no escape.`;
      topple(loserKing);
      const kp = sqPos(game.kings[st.winner]);
      for (let i = 0; i < 3; i++) setTimeout(() => sparkle(kp.clone().setY(1.2), 60, 0xffe08a, 1.4, 1800, 2.2), i * 380);
      Sound.win();
    } else {
      toast('Draw');
      title = 'A Draw';
      crest = '⚖' + VS;
      const why = {
        stalemate: 'Stalemate — the side to move has no legal move but is not in check.',
        'insufficient material': 'Neither court has enough pieces left to deliver checkmate.',
        'threefold repetition': 'The same position has appeared three times.',
        'fifty-move rule': 'Fifty moves passed by each side without a capture or a pawn move.',
      };
      text = why[st.reason] || 'The game is drawn.';
      Sound.draw();
    }
    await wait(2000);
    if (tok !== S.token) return;
    $('overCrest').textContent = crest;
    $('overTitle').textContent = title;
    $('overText').textContent = text;
    openModal('over');
  }

  function undo() {
    if (!S.started || S.busy || !game.played.length) return;
    S.token++;
    game.undo();
    if (S.mode === 'ai') { while (game.turn !== S.human && game.played.length) game.undo(); }
    S.over = false; S.result = null; S.thinking = false;
    deselect(); settling = [];
    rebuildPieces(); refreshStaticMarks(); updateUI();
    Sound.knock(0.35, 900, 0.06);
    setStatus('A move was taken back.');
    if (S.mode === 'pvp' && S.drone) flyToSide(game.turn, 1800);
    if (S.mode === 'ai' && game.turn !== S.human) vizierMove(S.token);
  }

  async function newGame(opts) {
    Object.assign(S, opts);
    S.token++; S.over = false; S.result = null; S.busy = false; S.thinking = false; S.started = true; S.topView = false;
    game.reset(); deselect(); settling = [];
    rebuildPieces(); refreshStaticMarks(); updateUI(); setStatus('');
    const tok = S.token;
    // the opening drone sweep over the court
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    camera.position.setFromSphericalCoords(Math.max(s.radius, 26), 0.75, sideTheta(viewSide()) + 2.4).add(target);
    camera.lookAt(target);
    await flyTo(sideTheta(viewSide()), VIEW_PHI, viewRadius(), 3400, false);
    if (tok !== S.token) return;
    if (S.mode === 'ai' && game.turn !== S.human) vizierMove(tok);
  }

  /* ------------------------------------------------------------------ */
  /*  Interface                                                          */
  /* ------------------------------------------------------------------ */
  function setStatus(t) { $('status').textContent = t; }
  let toastTimer = 0;
  function toast(t) {
    const el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 1500);
  }

  function updateUI() {
    const turn = game.turn;
    const st = S.over && S.result ? S.result : null;
    const banner = $('banner');
    banner.classList.toggle('black', turn === 'b' && !st);
    banner.classList.toggle('check', !st && game.inCheck());
    let text;
    if (st) text = st.reason === 'checkmate' ? `Checkmate — ${S.mode === 'ai' ? (st.winner === S.human ? 'you win' : 'the Vizier wins') : courtName(st.winner) + ' wins'}` : `Draw by ${st.reason}`;
    else if (S.thinking) text = 'The Vizier ponders…';
    else if (S.mode === 'ai') text = turn === S.human ? (game.inCheck() ? 'Check! Your move' : 'Your move') : "The Vizier's move";
    else text = `${courtName(turn)} to move${game.inCheck() ? ' — Check!' : ''}`;
    $('bannerText').textContent = text;

    for (const c of ['w', 'b']) {
      const up = c.toUpperCase();
      $('court' + up).classList.toggle('active', !st && turn === c);
      $('name' + up).firstChild.textContent = sideLabel(c);
      $('role' + up).textContent = `${courtName(c)} · ${c === 'w' ? 'ivory & gold' : 'ebony & gold'}`;
    }
    // captured pieces and material
    const taken = { w: [], b: [] };
    for (const m of game.played) if (m.captured) taken[m.color].push(m.captured.toLowerCase());
    const order = 'qrbnp';
    const score = { w: 0, b: 0 };
    for (const c of ['w', 'b']) {
      taken[c].sort((a, b) => order.indexOf(a) - order.indexOf(b));
      score[c] = taken[c].reduce((s, t) => s + VALUE[t], 0);
    }
    for (const c of ['w', 'b']) {
      const opp = c === 'w' ? 'b' : 'w', diff = score[c] - score[opp];
      $('taken' + c.toUpperCase()).innerHTML = taken[c].map((t) => glyph(opp, t)).join('') + (diff > 0 ? `<span class="adv">+${diff}</span>` : '');
    }
    renderMoves();
    syncButtons();
  }

  function renderMoves() {
    const list = game.played;
    const box = $('moves');
    if (!list.length) { box.innerHTML = '<div class="empty">The game awaits its first move.</div>'; return; }
    let html = '<table>';
    for (let i = 0; i < list.length; i += 2) {
      const lw = i === list.length - 1, lb = i + 1 === list.length - 1;
      html += `<tr><td class="n">${i / 2 + 1}.</td><td class="mv${lw ? ' last' : ''}">${pretty(list[i])}</td><td class="mv${lb ? ' last' : ''}">${list[i + 1] ? pretty(list[i + 1]) : ''}</td></tr>`;
    }
    box.innerHTML = html + '</table>';
    box.scrollTop = box.scrollHeight;
  }
  function pretty(m) {
    const t = m.piece.toLowerCase();
    const san = m.san.replace(/^[KQRBN]/, '').replace(/=([QRBN])/, (_, p) => '=' + glyph(m.color, p.toLowerCase()));
    if (m.flags === 'k' || m.flags === 'q') return m.san;
    return (t === 'p' ? '' : glyph(m.color, t)) + san;
  }

  function showCard(sq) {
    const p = game.get(sq);
    if (!p) return;
    const c = Chess.colorOf(p), t = p.toLowerCase();
    const n = game.turn === c ? game.moves(sq).length : null;
    $('cardBody').innerHTML =
      `<div class="glyph ${c}">${glyph(c, t)}</div><div class="name">${courtName(c)} ${NAME[t]}</div>` +
      `<div class="title">${LORE[t].title}</div><p>${LORE[t].rule}</p>` +
      `<div class="count">${n === null ? `Waits for the ${courtName(c)} turn` : n ? `Can move to ${n} square${n > 1 ? 's' : ''} now` : 'Cannot move right now'} · on ${Chess.sqName(sq)}</div>`;
  }

  function syncButtons() {
    $('btnUndo').disabled = !S.started || S.busy || !game.played.length;
    $('btnDrone').classList.toggle('on', S.drone);
    $('btnSound').classList.toggle('on', Sound.on);
    $('waves').style.display = Sound.on ? '' : 'none';
    $('btnTop').classList.toggle('on', S.topView);
    $('btnDrone').title = S.mode === 'ai' ? 'Drone camera (used in two-player games)' : 'Drone camera swings to whoever moves next (D)';
  }

  // modals
  const openModal = (id) => { $(id).classList.add('open'); const f = $(id).querySelector('.choice.sel, .big, .choice'); if (f) f.focus(); };
  const closeModal = (id) => $(id).classList.remove('open');
  const anyModal = () => document.querySelector('.modal.open');

  let promoResolve = null;
  function askPromotion(color) {
    const box = $('promoChoices');
    box.innerHTML = '';
    for (const t of ['q', 'r', 'b', 'n']) {
      const b = document.createElement('button');
      b.className = 'choice' + (t === 'q' ? ' sel' : '');
      b.innerHTML = `${glyph(color, t)}<small>${NAME[t]}</small>`;
      b.onclick = () => { closeModal('promo'); const r = promoResolve; promoResolve = null; r && r(t); };
      box.appendChild(b);
    }
    openModal('promo');
    return new Promise((res) => { promoResolve = res; });
  }

  // setup choices
  const setup = { mode: 'ai', side: 'w', level: '2' };
  document.querySelectorAll('#setup .choices').forEach((group) => {
    group.addEventListener('click', (e) => {
      const b = e.target.closest('.choice'); if (!b) return;
      group.querySelectorAll('.choice').forEach((x) => x.classList.toggle('sel', x === b));
      setup[group.dataset.group] = b.dataset.v;
      $('aiOpts').style.display = setup.mode === 'ai' ? '' : 'none';
    });
  });
  $('begin').onclick = () => {
    Sound.ensure();
    closeModal('setup');
    const human = setup.side === 'r' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.side;
    newGame({ mode: setup.mode, human, level: +setup.level });
  };
  $('overNew').onclick = () => { closeModal('over'); openModal('setup'); };
  $('overLook').onclick = () => closeModal('over');
  document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => closeModal(b.closest('.modal').id)));
  document.querySelectorAll('.modal').forEach((m) => m.addEventListener('click', (e) => {
    if (e.target !== m) return;
    if (m.id === 'setup' && !S.started) return;
    if (m.id === 'promo' && promoResolve) { const r = promoResolve; promoResolve = null; r(null); }
    closeModal(m.id);
  }));

  // toolbar
  $('btnNew').onclick = () => openModal('setup');
  $('btnUndo').onclick = undo;
  $('btnDrone').onclick = () => {
    S.drone = !S.drone; syncButtons();
    setStatus(S.drone ? 'Drone camera on: it flies to the side whose turn it is.' : 'Drone camera off: the view stays where you put it.');
    if (S.drone && S.mode === 'pvp' && S.started) flyToSide(game.turn, 1800);
  };
  $('btnTop').onclick = () => {
    S.topView = !S.topView; syncButtons();
    const s = new THREE.Spherical().setFromVector3(camera.position.clone().sub(target));
    if (S.topView) flyTo(sideTheta(viewSide()), 0.06, viewRadius() * 0.92, 1300, false);
    else flyTo(s.theta, VIEW_PHI, viewRadius(), 1300, false);
  };
  $('btnView').onclick = () => { S.topView = false; syncButtons(); flyToSide(viewSide(), 1500); };
  $('btnSound').onclick = () => { Sound.on = !Sound.on; Sound.ensure(); syncButtons(); };
  $('btnGuide').onclick = () => openModal('guide');
  $('btnLog').onclick = () => { $('right').classList.toggle('open'); $('btnLog').classList.toggle('on'); };

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); } return; }
    const open = anyModal();
    if (e.key === 'Escape') {
      if (open) {
        if (open.id === 'setup' && !S.started) return;
        if (open.id === 'promo' && promoResolve) { const r = promoResolve; promoResolve = null; r(null); }
        closeModal(open.id);
      } else deselect();
      return;
    }
    if (open) return;
    const k = e.key.toLowerCase();
    const map = { u: 'btnUndo', n: 'btnNew', d: 'btnDrone', t: 'btnTop', v: 'btnView', m: 'btnSound', h: 'btnGuide' };
    if (map[k]) { e.preventDefault(); $(map[k]).click(); }
  });

  /* ------------------------------------------------------------------ */
  /*  Pointer: tap/click to pick, hover to meet a courtier               */
  /* ------------------------------------------------------------------ */
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const boardPlane = new THREE.Plane(Y, 0);
  function pick(x, y) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    for (const h of raycaster.intersectObjects(pieceRoot.children, true)) {
      const g = h.object.userData.owner;
      if (g && g.userData.sq >= 0) return { sq: g.userData.sq, piece: g };
    }
    const p = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(boardPlane, p)) {
      const f = Math.floor(p.x + 4), rr = Math.floor(4 - p.z);
      if (f >= 0 && f < 8 && rr >= 0 && rr < 8) return { sq: rr * 8 + f, piece: null };
    }
    return null;
  }
  let down = null;
  canvas.addEventListener('pointerdown', (e) => { Sound.ensure(); down = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    down = null;
    if (moved < 8) onSquare(pick(e.clientX, e.clientY));
  });
  let hoverReq = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    hoverReq = { x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerleave', () => { hoverReq = null; $('tip').classList.remove('show'); setMarks('hover', []); canvas.style.cursor = ''; });
  let lastHoverSq = -2;
  function handleHover() {
    if (!hoverReq) return;
    const { x, y } = hoverReq; hoverReq = null;
    const tip = $('tip');
    if (anyModal() || down) { tip.classList.remove('show'); return; }
    const hit = pick(x, y);
    const sq = hit ? hit.sq : -1;
    const p = sq >= 0 ? game.get(sq) : null;
    const target = S.selMoves.some((m) => m.to === sq);
    const own = p && Chess.colorOf(p) === game.turn && isHumanTurn() && !S.over;
    canvas.style.cursor = own || target ? 'pointer' : '';
    if (sq !== lastHoverSq) {
      setMarks('hover', (own || target) && !S.busy ? [sq] : []);
      lastHoverSq = sq;
    }
    if (hit && hit.piece && p) {
      const c = Chess.colorOf(p), t = p.toLowerCase();
      const n = game.turn === c && !S.over ? game.moves(sq).length : null;
      tip.innerHTML = `<b>${glyph(c, t)} ${courtName(c)} ${NAME[t]}</b><br><i>${LORE[t].title}</i>` +
        (n === null ? '' : `<br>${n ? `${n} move${n > 1 ? 's' : ''} available — click to lift` : 'No legal move now'}`);
      const w = tip.offsetWidth || 220, h = tip.offsetHeight || 80;
      tip.style.left = Math.min(innerWidth - w - 12, x + 18) + 'px';
      tip.style.top = Math.min(innerHeight - h - 12, y + 18) + 'px';
      tip.classList.add('show');
      if (S.selected < 0 && sq !== showCard.last) { showCard(sq); showCard.last = sq; }
    } else {
      tip.classList.remove('show');
      showCard.last = -1;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Main loop                                                          */
  /* ------------------------------------------------------------------ */
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    controls.maxDistance = Math.max(26, viewRadius() + 8);
  });

  let lastT = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now;
    tickAnims(now);
    tickSparks(now, dt);
    handleHover();
    // the chosen courtier rises and waits, gently breathing
    const sel = S.selected >= 0 ? pieceAt[S.selected] : null;
    if (sel && !sel.userData.moving) {
      const goal = 0.17 + Math.sin(now / 380) * 0.025;
      sel.position.y += (goal - sel.position.y) * Math.min(1, dt * 10);
    }
    for (let i = settling.length - 1; i >= 0; i--) {
      const p = settling[i];
      if (p.userData.moving || p === sel) { settling.splice(i, 1); continue; }
      p.position.y += (0 - p.position.y) * Math.min(1, dt * 12);
      if (p.position.y < 0.001) { p.position.y = 0; settling.splice(i, 1); }
    }
    // the check glow pulses
    marks.check.mat.opacity = 0.65 + Math.sin(now / 180) * 0.35;
    marks.dot.mat.opacity = 0.85 + Math.sin(now / 260) * 0.15;
    if (!flight.active) controls.update();
    renderer.render(scene, camera);
  }

  rebuildPieces();
  refreshStaticMarks();
  updateUI();
  controls.autoRotate = true; controls.autoRotateSpeed = 0.5;
  requestAnimationFrame(loop);
  setTimeout(() => { $('loading').classList.add('hide'); openModal('setup'); }, 250);

  // a small hook for automated checks
  window.__royal = { game, S, newGame, commitMove, flyToSide, camera, rebuildPieces, refreshStaticMarks, updateUI, onSquare };
})();
