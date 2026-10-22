/* Humanity’s Largest Group Project: the grain field.
   Thousands of pigment grains sit behind the page. At each step of the story they re-form into a new
   picture, scrubbed by scroll. Ultramarine is ground from lapis lazuli, a blue stone flecked with gold
   pyrite, so a few grains are gold: they mark people and places, and nothing else. */
(function () {
  'use strict';

  const D = window.HLGP || {};
  let canvas = document.getElementById('field');
  const labelLayer = document.getElementById('field-labels');
  if (!canvas || !window.requestAnimationFrame) return;

  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const fine = window.matchMedia('(pointer: fine)');
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = (t) => t * t * (3 - 2 * t);
  const frac = (v) => v - Math.floor(v);

  /* Seeded randomness, so every visit draws the same pictures. */
  let rs = 1;
  const srand = (n) => { rs = (n * 2654435761) >>> 0 || 1; };
  const rand = () => { rs ^= rs << 13; rs >>>= 0; rs ^= rs >>> 17; rs ^= rs << 5; rs >>>= 0; return rs / 4294967296; };
  const gauss = () => { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * rand()); };

  /* ---------- Grains ---------- */
  let W = 0, H = 0, DPR = 1, N = 0, small = false;
  let seed, seed2, base, dustX, dustY, perm, out;

  function makeGrains() {
    srand(7);
    seed = new Float32Array(N); seed2 = new Float32Array(N); base = new Float32Array(N);
    dustX = new Float32Array(N); dustY = new Float32Array(N); perm = new Int32Array(N);
    for (let i = 0; i < N; i++) {
      seed[i] = rand(); seed2[i] = rand();
      base[i] = (small ? 1.2 : 1.35) + Math.pow(rand(), 2.4) * (small ? 1.6 : 2.1);
      dustX[i] = rand(); dustY[i] = rand();
      perm[i] = i;
    }
    for (let i = N - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = perm[i]; perm[i] = perm[j]; perm[j] = t; }
    out = new Float32Array(N * 5);
  }

  /* A formation: where every grain wants to be, how bright, how big, and whether it's gold.
     Grains a picture doesn't need settle as faint dust. */
  function blank(alpha) {
    const f = { x: new Float32Array(N), y: new Float32Array(N), a: new Float32Array(N), s: new Float32Array(N), g: new Float32Array(N), labels: [], live: null };
    const al = alpha == null ? 0.07 : alpha;
    for (let i = 0; i < N; i++) { f.x[i] = dustX[i] * W; f.y[i] = dustY[i] * H; f.a[i] = al * (0.5 + seed2[i]); f.s[i] = base[i] * 0.8; }
    return f;
  }
  // The j-th point of a picture always goes to the same grain, so pictures morph calmly into one another.
  function put(f, j, x, y, a, s, g) {
    if (j >= N) return;
    const i = perm[j];
    f.x[i] = x; f.y[i] = y; f.a[i] = a; f.s[i] = base[i] * (s || 1); f.g[i] = g || 0;
  }
  function putAll(f, pts, j0, a, s) {
    pts.sort((p, q) => p[0] - q[0]);
    const n = Math.min(pts.length, N - j0);
    for (let k = 0; k < n; k++) put(f, j0 + k, pts[k][0], pts[k][1], a, s, 0);
    return j0 + n;
  }

  // Where pictures go: beside the text on wide screens, above it on phones.
  function stage(kind) {
    if (small) return { x: W * 0.06, y: H * 0.1, w: W * 0.88, h: H * 0.44 };
    if (kind === 'center') return { x: W * 0.1, y: H * 0.1, w: W * 0.8, h: H * 0.5 };
    return { x: W * 0.46, y: H * 0.13, w: W * 0.48, h: H * 0.74 };
  }

  // Labels sit beside their point, or under it when neither side has room (a narrow phone).
  const measureCtx = document.createElement('canvas').getContext('2d');
  function label(x, y, text, cls, key) {
    const px = cls === 'gold' ? (small ? 16 : 18) : (small ? 14 : 16);
    measureCtx.font = `italic ${px}px "LM Roman 10", Georgia, serif`;
    const w = measureCtx.measureText(text).width + 4;
    if (x + 16 + w < W - 12) return { key, text, cls, x: x + 16, y, align: 'left' };
    if (x - 16 - w > 12) return { key, text, cls, x: x - 16, y, align: 'right' };
    return { key, text, cls, x: clamp(x, w / 2 + 12, W - w / 2 - 12), y: y + px * 1.7, align: 'center' };
  }

  /* ---------- Pictures ---------- */

  // Hero and "Your turn": grains stream in along curved lanes from every side and are drawn into the question box.
  function stream(selector) {
    const f = blank(0.06);
    const K = Math.floor(N * 0.66), LANES = small ? 44 : 84;
    for (let j = 0; j < K; j++) { const i = perm[j]; f.s[i] = base[i]; }
    f.live = (time) => {
      const el = document.querySelector(selector);
      if (!el) return;
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2, rx = r.width / 2, ry = r.height / 2;
      const R0 = Math.hypot(W, H) * 0.62;
      for (let j = 0; j < K; j++) {
        const i = perm[j];
        const p = frac(seed[i] * 9.7 + time / (20 + 10 * seed2[i]));
        const lane = Math.floor(seed2[i] * LANES);
        const th = (lane / LANES) * TAU + (1 - p) * (1 - p) * 0.9 + (seed[i] - 0.5) * 0.03;
        const rr = R0 * Math.pow(1 - p, 1.35);
        f.x[i] = cx + Math.cos(th) * (rr + rx);
        f.y[i] = cy + Math.sin(th) * (rr * 0.82 + ry);
        f.a[i] = (0.22 + 0.62 * p) * Math.min(1, p / 0.08) * Math.min(1, (1 - p) / 0.06);
      }
    };
    f.live(0);
    return f;
  }

  // How it works: lanes of grains flowing from step 1 to step 3.
  function flow() {
    const f = blank(0.06);
    const K = Math.floor(N * 0.5), LANES = 9;
    for (let j = 0; j < K; j++) { const i = perm[j]; f.s[i] = base[i]; }
    f.live = (time) => {
      const el = document.querySelector('.how-steps');
      const r = el ? el.getBoundingClientRect() : { top: H * 0.4, height: H * 0.25 };
      const cy = r.top + r.height / 2, gap = Math.max(10, (r.height * 0.9) / LANES);
      for (let j = 0; j < K; j++) {
        const i = perm[j];
        const lane = Math.floor(seed2[i] * LANES);
        const p = frac(seed[i] + time / (24 + lane * 1.7));
        const x = -30 + p * (W + 60);
        f.x[i] = x;
        f.y[i] = cy + (lane - (LANES - 1) / 2) * gap + Math.sin(x * 0.008 + lane) * 9;
        f.a[i] = 0.6 * Math.sin(Math.PI * p);
      }
    };
    f.live(0);
    return f;
  }

  // Big labs, big countries, big institutions, big research departments… then everyone else.
  const BIG = ['Big labs', 'Big countries', 'Big institutions', 'Big research departments'];
  function clusters(crowd) {
    const f = blank(crowd ? 0.06 : 0.045);
    const st = stage('side');
    const per = Math.floor(N * 0.075), rad = Math.min(st.w, st.h) * 0.075;
    srand(21);
    let j = 0;
    for (let c = 0; c < 4; c++) {
      const cx = st.x + st.w * (c % 2 ? 0.74 : 0.26), cy = st.y + st.h * (c < 2 ? 0.26 : 0.68);
      for (let k = 0; k < per; k++) {
        const r = Math.abs(gauss()) * rad * 0.62, a = rand() * TAU;
        put(f, j++, cx + Math.cos(a) * r, cy + Math.sin(a) * r, 0.9, 1.1, 0);
      }
      f.labels.push({ key: 'big' + c, x: cx, y: cy + rad * 1.9, text: BIG[c], align: 'center' });
    }
    if (crowd) {
      srand(22);
      const n1 = Math.floor(N * 0.94);
      for (; j < n1; j++) put(f, j, rand() * W, rand() * H, 0.72, 1, rand() < 0.025 ? 1 : 0);
    }
    return f;
  }

  // An ivory tower, packed tight. Everything outside it goes dim.
  function tower() {
    const f = blank(0.04);
    const st = stage('side');
    const th = st.h * 0.94, tw = Math.min(st.w * 0.22, th * 0.21);
    const cx = st.x + st.w / 2, top = st.y + (st.h - th) / 2, bot = top + th, cw = tw * 1.3;
    const doorTop = bot - th * 0.11;
    const inside = (x, y) => {
      const dx = Math.abs(x - cx);
      if (y > top + th * 0.13) {
        if (dx > tw / 2) return false;
        if (dx < tw * 0.07 && y > top + th * 0.3 && y < top + th * 0.43) return false;             // window slit
        if (dx < tw * 0.2 && y > doorTop) return false;                                            // door
        if (y < doorTop && y > doorTop - tw * 0.2 && dx * dx + (y - doorTop) ** 2 < (tw * 0.2) ** 2) return false; // its arch
        return true;
      }
      if (y > top + th * 0.08) return dx <= cw / 2;                                                 // cornice
      return dx <= cw / 2 && Math.floor(((x - (cx - cw / 2)) / cw) * 5) % 2 === 0;                  // battlements
    };
    const K = Math.floor(N * 0.34);
    const g = Math.sqrt((tw * th * 0.92 + (cw - tw) * th * 0.1) / K);
    srand(31);
    const pts = [];
    for (let y = top; y <= bot; y += g) {
      for (let x = cx - cw / 2; x <= cx + cw / 2; x += g) {
        const jx = x + (rand() - 0.5) * g * 0.5, jy = y + (rand() - 0.5) * g * 0.5;
        if (inside(jx, jy)) pts.push([jx, jy]);
      }
    }
    putAll(f, pts, 0, 0.92, 1);
    return f;
  }

  // The tower opens into one wide ring: everyone, around the same table.
  function ring() {
    const f = blank(0.05);
    const st = stage('side');
    const cx = st.x + st.w / 2, cy = st.y + st.h / 2, R = Math.min(st.w, st.h) * 0.43;
    const K = Math.floor(N * 0.9);
    const ang = new Float32Array(K), rad = new Float32Array(K);
    srand(41);
    for (let j = 0; j < K; j++) {
      ang[j] = rand() * TAU; rad[j] = R * (1 + gauss() * 0.055);
      const i = perm[j]; f.a[i] = 0.75; f.s[i] = base[i]; f.g[i] = rand() < 0.03 ? 1 : 0;
    }
    f.live = (time) => {
      const rot = time * 0.035;
      for (let j = 0; j < K; j++) { const i = perm[j], a = ang[j] + rot; f.x[i] = cx + Math.cos(a) * rad[j]; f.y[i] = cy + Math.sin(a) * rad[j]; }
    };
    f.live(0);
    return f;
  }

  // The two words that hide everyone, set in the paper's own italic.
  function etal() {
    const f = blank(0.05);
    const st = stage('center');
    const fs = Math.min(st.w / 2.5, st.h * 0.92);
    const c = document.createElement('canvas'), x2 = c.getContext('2d');
    const font = `italic ${Math.round(fs)}px "LM Roman 12", "Latin Modern Roman", Georgia, serif`;
    x2.font = font;
    const tw = Math.ceil(x2.measureText('et al.').width) + 8, th = Math.ceil(fs * 1.15);
    c.width = tw; c.height = th;
    x2.font = font; x2.fillStyle = '#fff';
    x2.fillText('et al.', 4, Math.round(th * 0.78));
    const d = x2.getImageData(0, 0, tw, th).data;
    let filled = 0;
    for (let k = 3; k < d.length; k += 4) if (d[k] > 127) filled++;
    const g = Math.max(1.5, Math.sqrt(filled / (N * 0.8)));
    const ox = st.x + (st.w - tw) / 2, oy = st.y + (st.h - th) / 2;
    srand(51);
    const pts = [];
    for (let y = 0; y < th; y += g) {
      for (let x = 0; x < tw; x += g) {
        const sx = clamp(Math.round(x + (rand() - 0.5) * g * 0.7), 0, tw - 1);
        const sy = clamp(Math.round(y + (rand() - 0.5) * g * 0.7), 0, th - 1);
        if (d[(sy * tw + sx) * 4 + 3] > 127) pts.push([ox + sx, oy + sy]);
      }
    }
    putAll(f, pts, 0, 0.95, 1);
    return f;
  }

  /* ---------- The dot map ---------- */
  let LAND = null;
  function land() {
    if (LAND) return LAND;
    const w = D.world;
    if (!w) return (LAND = { cols: 0, rows: 0, lat0: 0, has: () => 0 });
    const bin = atob(w.bits), bytes = new Uint8Array(bin.length);
    for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
    LAND = { cols: w.cols, rows: w.rows, lat0: w.lat0, has: (r, c) => { const n = r * w.cols + c; return (bytes[n >> 3] >> (7 - (n & 7))) & 1; } };
    return LAND;
  }
  const fitK = () => Math.min((W * 0.94) / 360, (H * 0.72) / 136);
  const view = (lon, lat, px, py, k) => ({ lon, lat, px, py, k });
  const project = (v, lon, lat) => [v.px + (lon - v.lon) * v.k, v.py - (lat - v.lat) * v.k];

  // Reserved grains: 0–19 every place in the stories, 20–39 the pulse on the focus, 40–56 you. Land from 60.
  function mapF(v, focus, you) {
    const f = blank(0.035);
    const L = land();
    let j = 0;
    for (const a of D.authors || []) {
      if (a.lat == null || j >= 20) continue;
      const [x, y] = project(v, a.lon, a.lat);
      put(f, j++, x, y, a === focus ? 1 : 0.85, a === focus ? 3.6 : 2.3, 1);
    }
    const pick = (step) => {
      const pts = [], m = 30;
      for (let r = 0; r < L.rows; r += step) {
        const y = v.py - (L.lat0 - r - 0.5 - v.lat) * v.k;
        if (y < -m || y > H + m) continue;
        for (let c = 0; c < L.cols; c += step) {
          if (!L.has(r, c)) continue;
          const x = v.px + (-180 + c + 0.5 - v.lon) * v.k;
          if (x > -m && x < W + m) pts.push([x, y]);
        }
      }
      return pts;
    };
    let step = 1, pts = pick(1);
    while (pts.length > (N - 60) * 0.85 && step < 6) pts = pick(++step);
    putAll(f, pts, 60, 0.8, 1.2);

    const pulses = [];
    if (focus) {
      const [x, y] = project(v, focus.lon, focus.lat);
      pulses.push({ x, y, j0: 20, n: 20, gold: 1 });
      f.labels.push(label(x, y, focus.town || focus.place, 'gold', 'focus'));
    }
    if (you) {
      const [x, y] = project(v, you.lon, you.lat);
      put(f, 40, x, y, 1, 3.4, 0);
      pulses.push({ x, y, j0: 41, n: 16, gold: 0 });
      f.labels.push(label(x, y, you.text, '', 'you'));
    }
    f.live = (time) => {
      for (const p of pulses) {
        for (let k = 0; k < p.n; k++) {
          const ph = frac(time * 0.5 + (k % 2) * 0.5), a = (k / p.n) * TAU, r = 7 + 24 * ph;
          put(f, p.j0 + k, p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 0.85 * (1 - ph), 1.2, p.gold);
        }
      }
    };
    f.live(0.6);
    return f;
  }
  function placeView(a) {
    const st = stage('side');
    return view(a.lon, a.lat, st.x + st.w * 0.5, st.y + st.h * 0.5, fitK() * (small ? 3.4 : 2.0));
  }
  function youView(y) {
    if (small) { const st = stage('side'); return view(y.lon, clamp(y.lat, -30, 55), W / 2, st.y + st.h * 0.55, fitK() * 2.2); }
    return view(12, 14, W / 2, H * 0.42, fitK());
  }

  // Your grain sits on your time zone's city. It's never more precise than the time zone.
  const TZ = {
    'America/New_York': [40.7, -74], 'America/Detroit': [42.3, -83], 'America/Toronto': [43.7, -79.4], 'America/Chicago': [41.9, -87.6],
    'America/Denver': [39.7, -105], 'America/Phoenix': [33.4, -112.1], 'America/Los_Angeles': [34.1, -118.2], 'America/Vancouver': [49.3, -123.1],
    'America/Anchorage': [61.2, -149.9], 'Pacific/Honolulu': [21.3, -157.9], 'America/Mexico_City': [19.4, -99.1], 'America/Bogota': [4.7, -74.1],
    'America/Lima': [-12, -77], 'America/Santiago': [-33.4, -70.7], 'America/Sao_Paulo': [-23.5, -46.6], 'America/Argentina/Buenos_Aires': [-34.6, -58.4],
    'Europe/London': [51.5, -0.1], 'Europe/Dublin': [53.3, -6.3], 'Europe/Lisbon': [38.7, -9.1], 'Europe/Madrid': [40.4, -3.7], 'Europe/Paris': [48.9, 2.4],
    'Europe/Amsterdam': [52.4, 4.9], 'Europe/Brussels': [50.8, 4.4], 'Europe/Berlin': [52.5, 13.4], 'Europe/Zurich': [47.4, 8.5], 'Europe/Rome': [41.9, 12.5],
    'Europe/Stockholm': [59.3, 18.1], 'Europe/Oslo': [59.9, 10.8], 'Europe/Copenhagen': [55.7, 12.6], 'Europe/Warsaw': [52.2, 21], 'Europe/Prague': [50.1, 14.4],
    'Europe/Vienna': [48.2, 16.4], 'Europe/Athens': [38, 23.7], 'Europe/Istanbul': [41, 29], 'Europe/Kyiv': [50.5, 30.5], 'Europe/Kiev': [50.5, 30.5],
    'Europe/Moscow': [55.8, 37.6], 'Africa/Casablanca': [33.6, -7.6], 'Africa/Lagos': [6.5, 3.4], 'Africa/Accra': [5.6, -0.2], 'Africa/Cairo': [30, 31.2],
    'Africa/Nairobi': [-1.3, 36.8], 'Africa/Addis_Ababa': [9, 38.7], 'Africa/Johannesburg': [-26.2, 28], 'Asia/Dubai': [25.2, 55.3], 'Asia/Riyadh': [24.7, 46.7],
    'Asia/Tehran': [35.7, 51.4], 'Asia/Karachi': [24.9, 67], 'Asia/Kolkata': [22.6, 88.4], 'Asia/Calcutta': [22.6, 88.4], 'Asia/Dhaka': [23.8, 90.4],
    'Asia/Bangkok': [13.8, 100.5], 'Asia/Jakarta': [-6.2, 106.8], 'Asia/Singapore': [1.35, 103.8], 'Asia/Kuala_Lumpur': [3.1, 101.7], 'Asia/Manila': [14.6, 121],
    'Asia/Shanghai': [31.2, 121.5], 'Asia/Hong_Kong': [22.3, 114.2], 'Asia/Taipei': [25, 121.6], 'Asia/Seoul': [37.6, 127], 'Asia/Tokyo': [35.7, 139.7],
    'Australia/Perth': [-32, 115.9], 'Australia/Adelaide': [-34.9, 138.6], 'Australia/Brisbane': [-27.5, 153], 'Australia/Sydney': [-33.9, 151.2],
    'Australia/Melbourne': [-37.8, 145], 'Pacific/Auckland': [-36.8, 174.8],
  };
  function you() {
    const y = D.you || { short: 'wherever you are', tz: '' };
    let ll = TZ[y.tz];
    if (!ll) ll = [22, clamp(-new Date().getTimezoneOffset() / 4, -170, 170)];
    return { lat: ll[0], lon: ll[1], text: `You, ${y.short}` };
  }

  /* ---------- Google's work: one picture per project ---------- */
  const SHAPES = {
    // AlphaFold: a folded protein chain, coiled into helices, turning slowly.
    protein() {
      const f = blank(0.05);
      const st = stage('side');
      const K = Math.floor(N * 0.7);
      const px = new Float32Array(K), py = new Float32Array(K), pz = new Float32Array(K);
      const C = (t, o) => {
        o[0] = Math.sin(TAU * t * 1.15 + 0.4) * 0.78 + Math.sin(TAU * t * 3.2) * 0.17;
        o[1] = Math.cos(TAU * t * 0.85) * 0.74 + Math.sin(TAU * t * 2.1 + 1.3) * 0.2;
        o[2] = Math.sin(TAU * t * 1.6 + 2.0) * 0.6;
      };
      const a = [0, 0, 0], b = [0, 0, 0], c = [0, 0, 0];
      srand(61);
      for (let j = 0; j < K; j++) {
        const t = rand();
        C(t, a); C(Math.min(1, t + 0.002), b); C(Math.max(0, t - 0.002), c);
        let tx = b[0] - c[0], ty = b[1] - c[1], tz = b[2] - c[2];
        const tl = Math.hypot(tx, ty, tz) || 1; tx /= tl; ty /= tl; tz /= tl;
        let n1x = ty, n1y = -tx;
        const nl = Math.hypot(n1x, n1y) || 1; n1x /= nl; n1y /= nl;
        const n2x = -tz * n1y, n2y = tz * n1x, n2z = tx * n1y - ty * n1x;
        const w = smooth(clamp((Math.sin(TAU * t * 3.5 - 0.6) - 0.15) / 0.5, 0, 1));
        const ang = TAU * t * 58, rr = 0.075 * w + 0.012;
        px[j] = a[0] + (n1x * Math.cos(ang) + n2x * Math.sin(ang)) * rr + gauss() * 0.008;
        py[j] = a[1] + (n1y * Math.cos(ang) + n2y * Math.sin(ang)) * rr + gauss() * 0.008;
        pz[j] = a[2] + n2z * Math.sin(ang) * rr + gauss() * 0.008;
      }
      const S = Math.min(st.w, st.h) * 0.42, cx = st.x + st.w / 2, cy = st.y + st.h / 2;
      f.live = (time) => {
        const ry = time * 0.2, cr = Math.cos(ry), sr = Math.sin(ry), ct = Math.cos(0.35), stt = Math.sin(0.35);
        for (let j = 0; j < K; j++) {
          const x1 = px[j] * cr + pz[j] * sr, z1 = -px[j] * sr + pz[j] * cr;
          const y1 = py[j] * ct - z1 * stt, z2 = py[j] * stt + z1 * ct;
          const p = 2.8 / (2.8 + z2);
          put(f, j, cx + x1 * S * p, cy + y1 * S * p, 0.25 + 0.65 * clamp((1 - z2) / 2, 0, 1), 0.8 + 0.5 * p, 0);
        }
      };
      f.live(0);
      return f;
    },

    // Android Earthquake Alerts: ripples from an epicentre; each phone lights up as the wave reaches it.
    quake() {
      const f = blank(0.05);
      const st = stage('side');
      const ex = st.x + st.w * 0.42, ey = st.y + st.h * 0.52;
      const Rm = Math.hypot(st.w, st.h) * 0.55, gap = Rm / 4.2;
      const nP = Math.floor(N * 0.34), nR = Math.floor(N * 0.36);
      srand(71);
      const phX = new Float32Array(nP), phY = new Float32Array(nP), phD = new Float32Array(nP);
      const g = Math.sqrt((st.w * 1.1 * st.h * 1.1) / nP);
      let nPh = 0;
      for (let y = st.y - st.h * 0.05; y < st.y + st.h * 1.05 && nPh < nP; y += g) {
        for (let x = st.x - st.w * 0.05; x < st.x + st.w * 1.05 && nPh < nP; x += g) {
          phX[nPh] = x + (rand() - 0.5) * g * 0.7; phY[nPh] = y + (rand() - 0.5) * g * 0.7;
          phD[nPh] = Math.hypot(phX[nPh] - ex, phY[nPh] - ey); nPh++;
        }
      }
      const ang = new Float32Array(nR);
      for (let q = 0; q < nR; q++) ang[q] = rand() * TAU;
      put(f, 0, ex, ey, 1, 3.2, 0);
      f.live = (time) => {
        const r0 = (time * 60) % gap;
        for (let q = 0; q < nR; q++) {
          const r = r0 + (q % 5) * gap + Math.sin(q * 12.9898) * 1.5, fade = clamp(1 - r / Rm, 0, 1);
          put(f, 1 + q, ex + Math.cos(ang[q]) * r, ey + Math.sin(ang[q]) * r, 0.8 * fade * fade, 0.9, 0);
        }
        for (let q = 0; q < nPh; q++) {
          let m = (phD[q] - r0) % gap; if (m < 0) m += gap; m = Math.min(m, gap - m);
          const lit = Math.exp(-(m * m) / 140) * clamp(1 - phD[q] / Rm, 0, 1);
          put(f, 1 + nR + q, phX[q], phY[q], 0.3 + 0.7 * lit, 1 + 0.9 * lit, 0);
        }
      };
      f.live(0);
      return f;
    },

    // Flood Hub: seven water lines, one for each day of the forecast.
    flood() {
      const f = blank(0.05);
      const st = stage('side');
      const lines = 7, K = Math.floor(N * 0.66), per = Math.floor(K / lines);
      srand(81);
      const u = new Float32Array(K);
      for (let q = 0; q < K; q++) u[q] = rand();
      f.live = (time) => {
        const rise = Math.sin(time * 0.35) * st.h * 0.02;
        for (let l = 0; l < lines; l++) {
          const y0 = st.y + st.h * (0.3 + l * 0.095) - rise * (1 - l / lines);
          const amp = 5 + l * 1.8, al = 0.32 + l * 0.085;
          for (let k = 0; k < per; k++) {
            const q = l * per + k, x = st.x + u[q] * st.w;
            const y = y0 + Math.sin(x * 0.014 + time * 0.8 - l * 0.7) * amp + Math.sin(x * 0.037 - time * 1.3 + l) * amp * 0.35;
            put(f, q, x, y, al * Math.min(1, u[q] / 0.08, (1 - u[q]) / 0.08), 1, 0);
          }
        }
      };
      f.live(0);
      return f;
    },

    // Calling in Our Corals: a recording from a reef, with the fish sounds standing out.
    sound() {
      const f = blank(0.05);
      const st = stage('side');
      const K = Math.floor(N * 0.7);
      srand(91);
      const u = new Float32Array(K), v = new Float32Array(K);
      for (let q = 0; q < K; q++) { u[q] = rand(); v[q] = (rand() * 2 - 1) * (q % 9 === 0 ? 0.05 : 1); }
      f.live = (time) => {
        const cy = st.y + st.h * 0.5, A = st.h * 0.34;
        for (let q = 0; q < K; q++) {
          const ph = u[q] * 10 + time * 0.7;
          const burst = Math.pow(Math.max(0, Math.sin(ph * 1.9) * Math.sin(ph * 0.61 + 1.2)), 3);
          const click = Math.pow(Math.max(0, Math.sin(ph * 5.3 + 2.1)), 24);
          const env = (0.06 + 0.8 * burst + 0.5 * click) * Math.min(1, u[q] / 0.06, (1 - u[q]) / 0.06);
          put(f, q, st.x + u[q] * st.w, cy + v[q] * A * env, 0.78, 1, 0);
        }
      };
      f.live(0);
      return f;
    },

    // Cyclone forecasting: spiral bands around a tight eye.
    cyclone() {
      const f = blank(0.05);
      const st = stage('side');
      const K = Math.floor(N * 0.74);
      const cx = st.x + st.w / 2, cy = st.y + st.h / 2, R = Math.min(st.w, st.h) * 0.47, eye = R * 0.07;
      srand(101);
      const u = new Float32Array(K), jit = new Float32Array(K);
      for (let q = 0; q < K; q++) { u[q] = Math.pow(rand(), 0.9); jit[q] = gauss(); }
      f.live = (time) => {
        const rot = -time * 0.1;
        for (let q = 0; q < K; q++) {
          let x, y, al;
          if (q % 11 === 0) {
            const a = u[q] * TAU * 3 + rot * 2.5, r = eye * (1.5 + jit[q] * 0.12);
            x = cx + Math.cos(a) * r; y = cy + Math.sin(a) * r; al = 0.9;
          } else {
            const r = eye * 1.6 + (R - eye * 1.6) * u[q];
            const th = (q % 3) * (TAU / 3) + Math.log(1 + u[q] * 8) * 1.9 + rot + jit[q] * (0.08 + 0.3 * u[q]);
            x = cx + Math.cos(th) * r; y = cy + Math.sin(th) * r * 0.94; al = 0.85 * (1 - 0.65 * u[q]);
          }
          put(f, q, x, y, al, 1, 0);
        }
      };
      f.live(0);
      return f;
    },

    // GNoME: a crystal lattice, turning.
    crystal() {
      const f = blank(0.05);
      const st = stage('side');
      const n = 5, nodes = n * n * n, edges = 3 * n * n * (n - 1);
      const m = Math.max(2, Math.floor((N * 0.7 - nodes) / edges));
      const P = [], c = (v) => (v / (n - 1)) * 2 - 1;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let d = 0; d < n; d++) {
        P.push([c(a), c(b), c(d), 1]);
        for (let s = 1; s <= m; s++) {
          const t = s / (m + 1);
          if (a < n - 1) P.push([c(a + t), c(b), c(d), 0]);
          if (b < n - 1) P.push([c(a), c(b + t), c(d), 0]);
          if (d < n - 1) P.push([c(a), c(b), c(d + t), 0]);
        }
      }
      const S = Math.min(st.w, st.h) * 0.26, cx = st.x + st.w / 2, cy = st.y + st.h / 2;
      f.live = (time) => {
        const ay = time * 0.16 + 0.6, cy1 = Math.cos(ay), sy1 = Math.sin(ay), cx1 = Math.cos(0.55), sx1 = Math.sin(0.55);
        for (let q = 0; q < P.length && q < N; q++) {
          const [x, y, z, node] = P[q];
          const x1 = x * cy1 + z * sy1, z1 = -x * sy1 + z * cy1;
          const y1 = y * cx1 - z1 * sx1, z2 = y * sx1 + z1 * cx1;
          const p = 3.2 / (3.2 + z2);
          put(f, q, cx + x1 * S * p, cy + y1 * S * p, (node ? 0.95 : 0.45) * (0.45 + 0.55 * clamp((1.6 - z2) / 3.2, 0, 1)), node ? 2.3 : 0.85, 0);
        }
      };
      f.live(0);
      return f;
    },
  };

  let YOU = null;
  function build(key) {
    if (key === 'hero') return stream('#entry-form .slip');
    if (key === 'gather') return stream('#entry-form-2 .slip');
    if (key === 'flow') return flow();
    if (key === 'clusters') return clusters(false);
    if (key === 'fraction') return clusters(true);
    if (key === 'tower') return tower();
    if (key === 'ring') return ring();
    if (key === 'etal') return etal();
    if (key === 'you') return mapF(youView(YOU), null, YOU);
    if (key.startsWith('place-')) { const a = (D.authors || [])[+key.slice(6)]; return a && a.lat != null ? mapF(placeView(a), a, null) : blank(0.085); }
    if (key.startsWith('shape-') && SHAPES[key.slice(6)]) return SHAPES[key.slice(6)]();
    return blank(0.085);
  }

  /* ---------- Scroll: each [data-scene] holds its picture; pictures morph at the seams ---------- */
  let scenes = [], bounds = [], reads = [], F = {};
  function measure() {
    const sy = window.scrollY;
    const rects = scenes.map((s) => { const r = s.el.getBoundingClientRect(); return { top: r.top + sy, bottom: r.bottom + sy }; });
    bounds = [];
    for (let k = 0; k < scenes.length - 1; k++) {
      const end = rects[k].bottom - H / 2, start = rects[k + 1].top - H / 2;
      const room = Math.min(rects[k].bottom - rects[k].top, rects[k + 1].bottom - rects[k + 1].top) / 2;
      bounds.push({ b: (end + start) / 2, z: Math.max(40, Math.min(H * 0.32, room * 0.8) + Math.max(0, start - end) / 2) });
    }
  }
  function scenePos() {
    const s = window.scrollY;
    for (let k = 0; k < bounds.length; k++) {
      const { b, z } = bounds[k];
      if (s < b - z) return k;
      if (s <= b + z) return k + (s - (b - z)) / (2 * z);
    }
    return bounds.length;
  }

  /* ---------- Drawing ---------- */
  let gl = null, c2d = null, uRes = null, uDpr = null;
  const VS = 'attribute vec2 p;attribute float s;attribute float a;attribute float k;uniform vec2 r;uniform float d;varying float va;varying float vk;' +
    'void main(){vec2 c=p/r*2.0-1.0;gl_Position=vec4(c.x,-c.y,0.0,1.0);gl_PointSize=max(1.0,s*d*1.5);va=a;vk=k;}';
  const FS = 'precision mediump float;varying float va;varying float vk;' +
    'void main(){float m=smoothstep(0.5,0.12,length(gl_PointCoord-0.5));vec3 c=mix(vec3(1.0),vec3(0.95,0.78,0.36),vk);float al=m*va;gl_FragColor=vec4(c*al,al);}';
  function initGL() {
    try {
      gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' });
      if (!gl) return false;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS));
      gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error('link failed');
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      [['p', 2, 0], ['s', 1, 8], ['a', 1, 12], ['k', 1, 16]].forEach(([name, size, off]) => {
        const l = gl.getAttribLocation(prog, name);
        gl.enableVertexAttribArray(l);
        gl.vertexAttribPointer(l, size, gl.FLOAT, false, 20, off);
      });
      uRes = gl.getUniformLocation(prog, 'r'); uDpr = gl.getUniformLocation(prog, 'd');
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
      return true;
    } catch (e) {
      gl = null;
      return false;
    }
  }
  function draw() {
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform2f(uRes, W, H); gl.uniform1f(uDpr, DPR);
      gl.bufferData(gl.ARRAY_BUFFER, out, gl.DYNAMIC_DRAW);
      gl.drawArrays(gl.POINTS, 0, N);
      return;
    }
    if (!c2d) return;
    c2d.setTransform(DPR, 0, 0, DPR, 0, 0);
    c2d.clearRect(0, 0, W, H);
    for (let pass = 0; pass < 2; pass++) {
      c2d.fillStyle = pass ? '#f2c75c' : '#ffffff';
      for (let i = 0, o = 0; i < N; i++, o += 5) {
        const a = out[o + 3];
        if (a < 0.02 || (out[o + 4] > 0.5) !== (pass === 1)) continue;
        const s = out[o + 2];
        c2d.globalAlpha = a;
        c2d.fillRect(out[o] - s / 2, out[o + 1] - s / 2, s, s);
      }
    }
    c2d.globalAlpha = 1;
  }

  /* Labels for pictures that need words (the four "big" clusters, a story's place, you). */
  const pool = [];
  function drawLabels(A, B, t) {
    const items = [];
    const shared = (l) => B !== A && B.labels.find((m) => m.key === l.key);
    for (const l of A.labels) {
      const m = shared(l);
      if (m) items.push({ text: t < 0.5 ? l.text : m.text, cls: m.cls, align: m.align, x: l.x + (m.x - l.x) * t, y: l.y + (m.y - l.y) * t, w: 1 });
      else items.push({ ...l, w: B === A ? 1 : 1 - smooth(clamp(t / 0.45, 0, 1)) });
    }
    if (B !== A) for (const l of B.labels) if (!A.labels.some((m) => m.key === l.key)) items.push({ ...l, w: smooth(clamp((t - 0.55) / 0.45, 0, 1)) });
    let n = 0;
    for (const it of items) {
      if (it.w < 0.01) continue;
      let el = pool[n];
      if (!el) { el = document.createElement('span'); labelLayer.appendChild(el); pool.push(el); }
      if (el._t !== it.text) { el.textContent = it.text; el._t = it.text; }
      const cls = 'field-label' + (it.cls ? ' is-' + it.cls : '') + (it.align === 'right' ? ' is-right' : it.align === 'center' ? ' is-center' : '');
      if (el.className !== cls) el.className = cls;
      el.style.transform = `translate(${it.x.toFixed(1)}px, ${it.y.toFixed(1)}px)`;
      el.style.opacity = it.w.toFixed(3);
      el.hidden = false;
      n++;
    }
    for (let q = n; q < pool.length; q++) if (!pool[q].hidden) pool[q].hidden = true;
  }

  /* ---------- The loop ---------- */
  let Pd = 0, time = 0, last = 0, raf = 0;
  const pointer = { x: -1e4, y: -1e4 };
  const bursts = [];
  function frame(now) {
    raf = requestAnimationFrame(frame);
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now;
    const still = reduce.matches;
    if (!still) time += dt;
    const P = scenePos();
    Pd = still ? Math.round(P) : Pd + (P - Pd) * (1 - Math.exp(-dt * 6));
    if (Math.abs(P - Pd) < 1e-3) Pd = P;
    const k = clamp(Math.floor(Pd), 0, scenes.length - 1);
    const t = k >= scenes.length - 1 ? 0 : Pd - k;
    const A = F[scenes[k].key], B = t > 0 ? F[scenes[k + 1].key] : A;
    if (A.live) A.live(time);
    if (B !== A && B.live) B.live(time);

    const rects = [];
    for (const el of reads) {
      const r = el.getBoundingClientRect();
      if (r.width && r.bottom > -40 && r.top < H + 40) rects.push(r);
    }
    const px = pointer.x, py = pointer.y, stir = fine.matches && !still;
    const nowS = now / 1000;
    for (let b = bursts.length - 1; b >= 0; b--) if (nowS - bursts[b].t0 > 1.6) bursts.splice(b, 1);

    for (let i = 0, o = 0; i < N; i++, o += 5) {
      let e = 0;
      if (B !== A) e = still ? (t < 0.5 ? 0 : 1) : smooth(clamp((t - seed[i] * 0.35) / 0.65, 0, 1));
      const ax = A.x[i], ay = A.y[i], dx0 = B.x[i] - ax, dy0 = B.y[i] - ay;
      let x = ax + dx0 * e, y = ay + dy0 * e;
      if (e > 0 && e < 1) { const w = Math.sin(Math.PI * e) * (seed2[i] - 0.5) * 0.5; x -= dy0 * w; y += dx0 * w; }
      if (!still) { x += Math.sin(time * 0.6 + seed[i] * 40) * 1.4; y += Math.cos(time * 0.5 + seed2[i] * 40) * 1.4; }
      if (stir) {
        const dx = x - px, dy = y - py, d2 = dx * dx + dy * dy;
        if (d2 < 12100) { const d = Math.sqrt(d2) || 1, push = 1 - d / 110; x += (dx / d) * push * push * 28; y += (dy / d) * push * push * 28; }
      }
      let a = A.a[i] + (B.a[i] - A.a[i]) * e;
      for (const bu of bursts) {
        const age = nowS - bu.t0, dx = x - bu.x, dy = y - bu.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const wave = Math.exp(-Math.pow((d - age * 520) / 70, 2)) * (1 - age / 1.6);
        x += (dx / d) * wave * 22; y += (dy / d) * wave * 22; a += wave * 0.5;
      }
      // Grains step back from text, so every line stays easy to read.
      for (const r of rects) {
        const dd = Math.max(r.left - 24 - x, x - r.right - 24, r.top - 18 - y, y - r.bottom - 18, 0);
        if (dd < 36) a *= 0.14 + 0.86 * (dd / 36);
      }
      out[o] = x; out[o + 1] = y;
      out[o + 2] = A.s[i] + (B.s[i] - A.s[i]) * e;
      out[o + 3] = a > 1 ? 1 : a;
      out[o + 4] = A.g[i] + (B.g[i] - A.g[i]) * e;
    }
    draw();
    drawLabels(A, B, B === A ? 0 : t);
  }
  const start = () => { if (!raf) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  /* ---------- Setup ---------- */
  let lastW = 0, lastH = 0;
  function setup(force) {
    const w = window.innerWidth, h = window.innerHeight;
    const rebuild = force || w !== lastW || Math.abs(h - lastH) > 140;
    W = w; H = h; DPR = Math.min(2, window.devicePixelRatio || 1); small = W < 721;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (rebuild) {
      const n = clamp(Math.round((W * H) / 150), 2400, 9000);
      if (n !== N || !seed) { N = n; makeGrains(); }
      YOU = you();
      F = {};
      for (const sc of scenes) if (!F[sc.key]) F[sc.key] = build(sc.key);
      lastW = w; lastH = h;
    }
    measure();
  }
  const debounce = (fn, ms) => { let id = 0; return () => { clearTimeout(id); id = setTimeout(fn, ms); }; };

  async function init() {
    scenes = [...document.querySelectorAll('[data-scene]')].map((el) => ({ el, key: el.dataset.scene }));
    reads = [...document.querySelectorAll('.reads')];
    if (!scenes.length) return;
    if (!initGL()) {
      const c = canvas.cloneNode(false);
      canvas.replaceWith(c);
      canvas = c;
      c2d = canvas.getContext('2d');
      if (!c2d) return;
    }
    try {
      await Promise.race([document.fonts.load('italic 100px "LM Roman 12"'), new Promise((r) => setTimeout(r, 2500))]);
    } catch (e) { /* draw with the fallback face */ }
    setup(true);
    Pd = scenePos();
    document.documentElement.classList.add('has-field');
    start();
    window.addEventListener('resize', debounce(() => setup(false), 120), { passive: true });
    if (window.ResizeObserver) new ResizeObserver(debounce(measure, 100)).observe(document.body);
    window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; }, { passive: true });
    document.addEventListener('pointerleave', () => { pointer.x = pointer.y = -1e4; });
    document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  }

  D.field = {
    // A ripple through the grains, from wherever something was just added.
    burst(x, y) { if (!reduce.matches) bursts.push({ x, y, t0: performance.now() / 1000 }); },
    refresh() { reads = [...document.querySelectorAll('.reads')]; measure(); },
  };
  init();
})();
