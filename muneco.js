// Muñeco de FORJA: figura blanca y musculosa dibujada por código (SVG), sin fotos.
// Cada ejercicio usa una plantilla de movimiento con dos posturas (A = inicio, B = final) que se interpolan.
// Ángulos absolutos en grados, medidos desde "abajo" y positivos hacia delante (la figura mira a la derecha):
// 0 = abajo, 90 = delante, 180 = arriba, -90 = atrás. t = cadera→hombro, ua/fa = brazo/antebrazo, th/sh = muslo/espinilla, ft = pie.
// Las claves con 2 (ua2, th2…) son el brazo y la pierna del fondo; si faltan, copian a las de delante.
const FIG = (() => {
  const D = Math.PI / 180, FLOOR = 262;
  const L = { t: 64, ua: 40, fa: 37, th: 62, sh: 58, ft: 24 };
  const dir = a => [Math.sin(a * D), Math.cos(a * D)];
  const add = (p, a, len) => { const d = dir(a); return [p[0] + d[0] * len, p[1] + d[1] * len]; };
  const r1 = n => Math.round(n * 10) / 10;
  const P = p => `${r1(p[0])} ${r1(p[1])}`;

  // Cápsula con barriga muscular: de a (radio ra) a b (radio rb), ensanchada `bulge` en la posición `at` (0–1).
  function limb(a, b, ra, rb, bulge = 0, at = .45) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || .01, nx = -dy / len, ny = dx / len;
    const m = [a[0] + dx * at, a[1] + dy * at], rm = Math.max(ra, rb) * (1 - Math.abs(at - .5)) + Math.min(ra, rb) * Math.abs(at - .5) + bulge;
    const off = (p, r, s) => [p[0] + nx * r * s, p[1] + ny * r * s];
    const a1 = off(a, ra, 1), a2 = off(a, ra, -1), b1 = off(b, rb, 1), b2 = off(b, rb, -1), m1 = off(m, rm, 1), m2 = off(m, rm, -1);
    const c1 = [2 * m1[0] - (a1[0] + b1[0]) / 2, 2 * m1[1] - (a1[1] + b1[1]) / 2], c2 = [2 * m2[0] - (a2[0] + b2[0]) / 2, 2 * m2[1] - (a2[1] + b2[1]) / 2];
    return `M${P(a1)}Q${P(c1)} ${P(b1)}A${r1(rb)} ${r1(rb)} 0 0 0 ${P(b2)}Q${P(c2)} ${P(a2)}A${r1(ra)} ${r1(ra)} 0 0 0 ${P(a1)}Z`;
  }
  // --- anatomía: cada segmento tiene un perfil [t, delante, detrás] (anchos a lo largo del hueso, 0 = origen, 1 = final) ---
  // "Delante" es el lado del bíceps/cuádriceps/espinilla; "detrás" el del tríceps/isquio/gemelo.
  const PROF = {
    ua: [[0, 16.2, 16.9], [0.16, 17.6, 18.9], [0.36, 12.3, 15.0], [0.6, 15.6, 15.0], [0.86, 9.8, 10.4], [1, 8.8, 8.8]],          // deltoides, bíceps, tríceps
    fa: [[0, 9.1, 9.1], [0.2, 12.7, 10.7], [0.5, 9.4, 8.3], [0.86, 6.2, 5.9], [1, 5.7, 5.5]],                                 // antebrazo cónico
    th: [[0, 15, 16], [0.26, 22, 19.5], [0.55, 19.2, 17.3], [0.84, 13.4, 12.8], [1, 11.5, 11.5]],                              // cuádriceps e isquios
    sh: [[0, 10.8, 10.8], [0.2, 10.0, 15.6], [0.42, 9.0, 12.8], [0.74, 6.5, 7.0], [1, 5.5, 5.8]],                           // gemelo alto, tobillo fino
    ft: [[0, 6.3, 6.3], [0.5, 5.8, 4.8], [1, 4.4, 3.7]],
  };
  const LINES = { // líneas de separación muscular: [t0, o0, t1, o1] (o > 0 hacia delante)
    ua: [[.12, -3, .42, 1], [.44, 1.5, .8, .5]], fa: [[.1, 2, .55, -1]], th: [[.12, 6, .78, 2], [.3, -4, .7, -6]], sh: [[.1, -2, .55, 2]],
  };
  function crSpline(pts) { // Catmull-Rom → curvas Bézier
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += `C${P([p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6])} ${P([p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6])} ${P(p2)}`;
    }
    return d;
  }
  function seg(a, b, key, far, mirror = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || .01, ux = dx / len, uy = dy / len, fx = uy * mirror, fy = -ux * mirror;
    const at = (t, o) => [a[0] + dx * t + fx * o, a[1] + dy * t + fy * o];
    const pr = PROF[key], F = pr.map(([t, f]) => at(t, f)), B = pr.map(([t, , k]) => at(t, -k)).reverse();
    const re = (pr.at(-1)[1] + pr.at(-1)[2]) / 2, rs = (pr[0][1] + pr[0][2]) / 2, sw = mirror > 0 ? 1 : 0;
    let s = `<path d="M${P(F[0])}${crSpline(F)}A${r1(re)} ${r1(re)} 0 0 ${sw} ${P(B[0])}${crSpline(B)}A${r1(rs)} ${r1(rs)} 0 0 ${sw} ${P(F[0])}Z" fill="url(#${far ? 'fSk2' : 'fSk'})" stroke="${far ? '#6a7290' : '#8f97b5'}" stroke-width="1.15" stroke-linejoin="round"/>`;
    for (const [t0, o0, t1, o1] of LINES[key] || []) {
      const p0 = at(t0, o0), p1 = at(t1, o1), c = at((t0 + t1) / 2, (o0 + o1) / 2 + 1.5);
      s += `<path d="M${P(p0)}Q${P(c)} ${P(p1)}" fill="none" stroke="${far ? '#7c849f' : '#b2b8cf'}" stroke-width="1.2" stroke-linecap="round"/>`;
    }
    return s;
  }
  // Torso de perfil en su propio sistema (cadera en 0,0; hombro en 0,-64; delante = x positiva): pecho, dorsales, trapecio, cintura y glúteo.
  const TORSO = 'M6 -75C12 -72 18 -68 21 -63C29 -58 30 -45 24 -38C20 -35 16 -34 14 -32C15 -24 14 -14 13 -6C13 2 12 8 8 13C2 17 -8 17 -13 14C-19 10 -20 1 -17 -7C-14 -14 -11 -20 -11 -27C-13 -37 -21 -46 -22 -56C-23 -65 -17 -71 -8 -77C-4 -80 3 -79 6 -75Z';
  const TORSO_L = 'M14 -33C7 -36 4 -45 8 -58M13 -23C10 -22 8 -22 6 -23M13 -13C10 -12 8 -12 6 -13M-12 -28C-9 -36 -11 -46 -16 -54M-21 -7C-16 -6 -12 -9 -10 -14';
  const torsoSide = (hip, t, far) => `<g transform="translate(${P(hip)}) rotate(${r1(180 - t)}) scale(1.24 1.04)"><path d="${TORSO}" fill="url(#${far ? 'fSk2' : 'fSkT'})" stroke="#8f97b5" stroke-width="1.15"/><path d="${TORSO_L}" fill="none" stroke="#b2b8cf" stroke-width="1" stroke-linecap="round"/></g>`;
  // Cabeza pequeña con mentón y cuello ancho (mira hacia delante del torso).
  const HEAD = 'M-11 -3C-12 -14 -3 -18 4 -16C11 -14 13 -7 12.5 -1C12.5 2 14 4 13.5 6C12.5 10 9 12.5 4 13C-3 14 -9 11 -11 4Z';
  const headSide = (c, a) => `<g transform="translate(${P(c)}) rotate(${r1(180 - a)}) scale(1.08)"><path d="M-8 4C-10 12 -12 18 -13 24H12C11 18 9 12 7 6Z" fill="url(#fSk)" stroke="#8f97b5" stroke-width="1.1"/><path d="${HEAD}" fill="url(#fSk)" stroke="#8f97b5" stroke-width="1.15"/></g>`;
  const part = (d, far) => `<path d="${d}" fill="url(#${far ? 'fSk2' : 'fSk'})" stroke="${far ? '#6f7795' : '#9aa1bd'}" stroke-width="1.1" stroke-linejoin="round"/>`;
  const ball = (p, r, far) => `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}" fill="url(#${far ? 'fSk2' : 'fSk'})" stroke="${far ? '#6f7795' : '#9aa1bd'}" stroke-width="1.1"/>`;

  // Dos huesos (brazo o pierna) que llegan a un punto: devuelve el codo/rodilla y el extremo.
  function ik(S, T, l1, l2, bend) {
    let dx = T[0] - S[0], dy = T[1] - S[1], d = Math.hypot(dx, dy) || .01;
    const dd = Math.min(Math.max(d, Math.abs(l1 - l2) + .5), l1 + l2 - .5), ux = dx / d, uy = dy / d;
    const a = Math.acos((l1 * l1 + dd * dd - l2 * l2) / (2 * l1 * dd)) * bend, c = Math.cos(a), s = Math.sin(a);
    const E = [S[0] + (ux * c - uy * s) * l1, S[1] + (ux * s + uy * c) * l1];
    return [E, [S[0] + ux * dd, S[1] + uy * dd]];
  }
  const lerp = (A, B, k) => { const o = {}; for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[key] ?? B[key], b = B[key] ?? A[key];
    o[key] = Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * k) : typeof a === 'number' ? a + (b - a) * k : a;
  } return o; };

  // --- figura de perfil ---
  function side(p, anchor) {
    const hip = [0, 0], sho = add(hip, p.t, L.t);
    const arm = (ua, fa, s1 = 1, s2 = 1) => { const e = add(sho, ua, L.ua * s1); return [e, add(e, fa, L.fa * s2)]; };
    const leg = (th, sh, ft) => { const k = add(hip, th, L.th), a = add(k, sh, L.sh); return [k, a, add(a, ft, L.ft)]; };
    const [elb, han] = arm(p.ua, p.fa, p.uas, p.fas), [elb2, han2] = arm(p.ua2 ?? p.ua, p.fa2 ?? p.fa, p.uas2 ?? p.uas, p.fas2 ?? p.fas);
    const [kne, ank, toe] = leg(p.th, p.sh, p.ft ?? 90), [kne2, ank2, toe2] = leg(p.th2 ?? p.th, p.sh2 ?? p.sh, p.ft2 ?? p.ft ?? 90);
    const J = { hip, sho, elb, han, kne, ank, toe, elb2, han2, kne2, ank2, toe2, head: add(sho, p.t + (p.h || 0), 25) };
    const [k, x, y] = anchor, dx = x - J[k][0], dy = y - J[k][1];
    for (const n in J) J[n] = [J[n][0] + dx, J[n][1] + dy];
    // objetivos fijos (manos en el suelo, pie en el banco…) con dos huesos
    if (p.hT) [J.elb, J.han] = ik(J.sho, p.hT, L.ua, L.fa, p.hb ?? 1);
    if (p.hT2 || p.hT) [J.elb2, J.han2] = ik(J.sho, p.hT2 || p.hT, L.ua, L.fa, p.hb ?? 1);
    if (p.fT) { [J.kne, J.ank] = ik(J.hip, p.fT, L.th, L.sh, p.fb ?? -1); J.toe = add(J.ank, p.ft ?? 90, L.ft); }
    if (p.fT2) { [J.kne2, J.ank2] = ik(J.hip, p.fT2, L.th, L.sh, p.fb2 ?? -1); J.toe2 = add(J.ank2, p.ft2 ?? 90, L.ft); }
    return J;
  }
  function drawSide(J, p) {
    const legS = (h, k, a, t, far) => seg(h, k, 'th', far) + seg(k, a, 'sh', far) + seg(a, t, 'ft', far);
    const armS = (s, e, h, far) => seg(s, e, 'ua', far) + seg(e, h, 'fa', far) + ball(h, 5.8, far);
    const t = angOf(J.hip, J.sho), ha = angOf(J.sho, J.head);
    return legS(J.hip, J.kne2, J.ank2, J.toe2, 1) + (p.farArmFront ? '' : armS(J.sho, J.elb2, J.han2, 1))
      + legS(J.hip, J.kne, J.ank, J.toe) + headSide(J.head, ha) + torsoSide(J.hip, t) + (p.farArmFront ? armS(J.sho, J.elb2, J.han2, 1) : '') + armS(J.sho, J.elb, J.han);
  }
  const angOf = (a, b) => Math.atan2(b[0] - a[0], b[1] - a[1]) / D;

  // --- figura de frente (elevaciones laterales, encogimientos, aductores…) ---
  // ua/fa positivos = hacia fuera; th/sh igual para las piernas; lift = subir hombros; seat = sentado (rodillas hacia ti).
  function front(p) {
    const cx = 200, lift = p.lift || 0, sy = 76 - lift;
    const J = { L: {}, R: {} }, hipY = p.seat ? 178 : 140;
    const yOff = p.seat ? 42 : 0;
    for (const [s, m] of [['R', 1], ['L', -1]]) {
      const S = [cx + 40 * m, sy + 4 + yOff], f = a => [Math.sin(a * D) * m, Math.cos(a * D)];
      const E = [S[0] + f(p.ua)[0] * L.ua, S[1] + f(p.ua)[1] * L.ua], H = [E[0] + f(p.fa)[0] * L.fa, E[1] + f(p.fa)[1] * L.fa];
      const Hp = [cx + 15 * m, hipY + 2];
      let K, A;
      if (p.seat) { K = [cx + (p.kx || 20) * m, hipY + 16]; A = [K[0] + 3 * m, 254]; }
      else { K = [Hp[0] + f(p.th || 0)[0] * L.th, Hp[1] + f(p.th || 0)[1] * L.th]; A = [K[0] + f(p.sh || 0)[0] * L.sh, K[1] + f(p.sh || 0)[1] * L.sh]; }
      Object.assign(J[s], { S, E, H, Hp, K, A });
    }
    J.head = [cx, 52 - lift * .4 + yOff]; J.cx = cx; J.sy = sy + yOff; J.hipY = hipY;
    return J;
  }
  function drawFront(J, p) {
    const { cx, sy, hipY } = J, X = (dx, y) => `${r1(cx + dx)} ${r1(y)}`;
    const legs = ['L', 'R'].map(s => { const j = J[s], m = s === 'R' ? 1 : -1;
      const foot = seg(j.A, [j.A[0] + 4 * m, j.A[1] + 8], 'ft', 0, m);
      return p.seat ? seg(j.Hp, j.K, 'th', 0, m) + ball(j.K, 13) + seg(j.K, j.A, 'sh', 0, m) + foot
        : seg(j.Hp, j.K, 'th', 0, m) + seg(j.K, j.A, 'sh', 0, m) + foot; }).join('');
    // torso en V: trapecios, dorsales anchos, cintura estrecha
    const half = m => [[12, sy - 15], [30, sy - 7], [40, sy + 8], [42, sy + 26], [33, sy + 46], [23, hipY - 14], [25, hipY + 2], [12, hipY + 14], [0, hipY + 17]].map(([x, y]) => [cx + x * m, y]);
    const R = half(1), Lh = half(-1).reverse();
    const torso = `<path d="M${P(Lh.at(-1))}${crSpline([Lh.at(-1), ...R.slice(1)])}${crSpline([R.at(-1), ...Lh.slice(1)])}Z" fill="url(#fSkT2)" stroke="#8f97b5" stroke-width="1.15"/>`;
    const lines = `<path d="M${X(-34, sy + 20)}Q${X(-18, sy + 36)} ${X(0, sy + 27)}Q${X(18, sy + 36)} ${X(34, sy + 20)}M${X(0, sy + 2)}V${r1(hipY - 4)}M${X(-11, sy + 42)}Q${X(-5, sy + 45)} ${X(-1, sy + 42)}M${X(11, sy + 42)}Q${X(5, sy + 45)} ${X(1, sy + 42)}M${X(-11, sy + 54)}Q${X(-5, sy + 57)} ${X(-1, sy + 54)}M${X(11, sy + 54)}Q${X(5, sy + 57)} ${X(1, sy + 54)}M${X(-10, sy + 66)}Q${X(-5, sy + 68)} ${X(-1, sy + 66)}M${X(10, sy + 66)}Q${X(5, sy + 68)} ${X(1, sy + 66)}M${X(-24, sy + 36)}Q${X(-20, sy + 58)} ${X(-16, hipY - 4)}M${X(24, sy + 36)}Q${X(20, sy + 58)} ${X(16, hipY - 4)}M${X(-13, sy - 14)}Q${X(-22, sy - 6)} ${X(-30, sy - 6)}M${X(13, sy - 14)}Q${X(22, sy - 6)} ${X(30, sy - 6)}" fill="none" stroke="#b2b8cf" stroke-width="1.15" stroke-linecap="round"/>`;
    const arms = ['L', 'R'].map(s => { const j = J[s], m = s === 'R' ? 1 : -1; return seg(j.S, j.E, 'ua', 0, m) + seg(j.E, j.H, 'fa', 0, m) + ball(j.H, 6); }).join('');
    const hy = J.head[1], neck = `<path d="M${X(-11, hy + 6)}C${X(-12, hy + 14)} ${X(-14, sy - 12)} ${X(-16, sy - 10)}H${r1(cx + 16)}C${X(14, sy - 12)} ${X(12, hy + 14)} ${X(11, hy + 6)}Z" fill="url(#fSk)" stroke="#8f97b5" stroke-width="1.1"/>`;
    const head = `<path d="M${X(0, hy - 16)}C${X(9, hy - 16)} ${X(12.5, hy - 9)} ${X(12.5, hy - 1)}C${X(12.5, hy + 8)} ${X(7, hy + 15)} ${X(0, hy + 15)}C${X(-7, hy + 15)} ${X(-12.5, hy + 8)} ${X(-12.5, hy - 1)}C${X(-12.5, hy - 9)} ${X(-9, hy - 16)} ${X(0, hy - 16)}Z" fill="url(#fSk)" stroke="#8f97b5" stroke-width="1.15"/>`;
    return legs + torso + lines + neck + head + arms;
  }

  // --- material del gimnasio ---
  const M = { pad: '#363556', padHi: '#4d4c78', metal: '#5d5c86', plate: '#232238', acc: '#B79AFF', cable: '#8b89b8' };
  let sink = null; // lista de objetos cuando se construye la escena 3D
  const put = o => { sink.push(o); return ''; };
  const roller = p => sink ? put({ k: 'roller', p }) : `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="9" fill="${M.pad}" stroke="${M.padHi}" stroke-width="1.2"/>`;
  const wheel = p => sink ? put({ k: 'wheel', p }) : `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="11" fill="${M.plate}" stroke="${M.acc}" stroke-width="2.4"/>`;
  const sled = p => sink ? put({ k: 'sled', p }) : `<rect x="-6" y="-26" width="14" height="56" rx="4" fill="${M.pad}" stroke="${M.padHi}" stroke-width="1.2" transform="translate(${P(p)}) rotate(-38)"/>`;
  const kpad = side => sink ? put({ k: 'kpad', side }) : '';
  const back = () => sink ? put({ k: 'back' }) : '';
  const armpad = () => sink ? put({ k: 'armpad' }) : '';
  const rect = (x, y, w, h, r = 5, f = M.pad, opt = {}) => sink ? put({ k: 'box', x, y, w, h, ...opt }) : `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r}" fill="${f}" stroke="${M.padHi}" stroke-width="1.2"/>`;
  const bar = (a, b, w = 4, c = M.metal, z) => sink ? put({ k: 'bar', a, b, w, metal: c === M.metal || c === M.cable, z }) : `<path d="M${P(a)}L${P(b)}" stroke="${c}" stroke-width="${w}" stroke-linecap="round"/>`;
  const plate = (p, r = 15) => sink ? put({ k: 'barbell', p, r }) : `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r}" fill="${M.plate}" stroke="${M.acc}" stroke-width="2"/><circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="${r * .32}" fill="${M.metal}"/>`;
  const db = p => sink ? put({ k: 'db', p }) : plate(p, 8.5);
  const dbAxis = (e, h) => { if (sink) return put({ k: 'dbAxis', e, h }); const dx = h[0] - e[0], dy = h[1] - e[1], l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, a = [h[0] - uy * 13, h[1] + ux * 13], b = [h[0] + uy * 13, h[1] - ux * 13];
    return bar(a, b, 4, M.metal) + [a, b].map(q => `<rect x="${r1(q[0] - 7)}" y="${r1(q[1] - 4.5)}" width="14" height="9" rx="3" fill="${M.plate}" stroke="${M.acc}" stroke-width="1.6" transform="rotate(${r1(Math.atan2(uy, ux) / D)} ${P(q)})"/>`).join(''); };
  const handle = p => sink ? put({ k: 'handle', p }) : `<circle cx="${r1(p[0])}" cy="${r1(p[1])}" r="5.5" fill="${M.metal}" stroke="${M.acc}" stroke-width="1.6"/>`;
  const cable = (h, q) => sink ? put({ k: 'cable', h, q }) : `<path d="M${P(h)}L${P(q)}" stroke="${M.cable}" stroke-width="1.6"/><circle cx="${r1(q[0])}" cy="${r1(q[1])}" r="6" fill="${M.plate}" stroke="${M.cable}" stroke-width="2"/>`;
  const tower = x => bar([x, 18], [x, FLOOR], 7, '#2c2b45');
  const legs4 = (x1, x2, y) => bar([x1 + 8, y], [x1 + 8, FLOOR], 5, '#2c2b45') + bar([x2 - 8, y], [x2 - 8, FLOOR], 5, '#2c2b45');
  const flatBench = (x1, x2, y = 204) => legs4(x1, x2, y + 10) + rect(x1, y, x2 - x1, 12);
  const pad2 = (a, b, w = 12, opt = {}) => sink ? put({ k: 'pad', a, b, w, ...opt }) : `<path d="M${P(a)}L${P(b)}" stroke="${M.padHi}" stroke-width="${w + 2.4}" stroke-linecap="round"/><path d="M${P(a)}L${P(b)}" stroke="${M.pad}" stroke-width="${w}" stroke-linecap="round"/>`;
  const seat = (x, y, w = 60) => bar([x + w / 2, y + 8], [x + w / 2, FLOOR], 6, '#2c2b45') + rect(x, y, w, 12);
  const off = (p, dx, dy) => [p[0] + dx, p[1] + dy];

  // --- plantillas de movimiento ---
  // v: 'side' | 'front'; an: ancla [punto, x, y]; A/B: posturas; bg/fg: material detrás/delante; eq: 'bar' | 'db' | 'cable'…
  const std = { t: 180, ua: 0, fa: 0, th: 0, sh: 0, ft: 90 };
  const stand = ['ank', 205, 252];
  const T = {
    bench: { an: ['hip', 252, 187], A: { t: -90, ua: 180, fa: 180, th: 78, sh: 12, ft: 90 }, B: { t: -90, ua: 108, uas: .5, fa: 178, fas: .92, th: 78, sh: 12, ft: 90 },
      bg: () => flatBench(140, 300), fg: (J, eq) => eq === 'db' ? db(J.han) : plate(J.han) },
    benchClose: { an: ['hip', 252, 187], A: { t: -90, ua: 180, fa: 180, th: 78, sh: 12, ft: 90 }, B: { t: -90, ua: 64, uas: .85, fa: 176, fas: .95, th: 78, sh: 12, ft: 90 },
      bg: () => flatBench(140, 300), fg: J => plate(J.han) },
    incline: { an: ['hip', 246, 198], A: { t: -138, ua: 172, fa: 174, th: 72, sh: 14, ft: 90 }, B: { t: -138, ua: 118, uas: .62, fa: 172, fas: .95, th: 72, sh: 14, ft: 90 },
      bg: J => legs4(196, 280, 220) + pad2(off(J.hip, -6, 18), off(J.sho, -12, 14), 13) + rect(214, 212, 70, 12), fg: (J, eq) => eq === 'db' ? db(J.han) : plate(J.han) },
    flyDb: { an: ['hip', 252, 187], A: { t: -90, ua: 180, fa: 178, th: 78, sh: 12 }, B: { t: -90, ua: 128, uas: .42, fa: 112, fas: .45, th: 78, sh: 12 },
      bg: () => flatBench(140, 300), fg: J => db(J.han) },
    chestMachine: { an: ['hip', 200, 194], A: { t: 186, ua: -78, fa: 86, th: 86, sh: -3 }, B: { t: 186, ua: 90, fa: 90, th: 86, sh: -3 },
      bg: J => seat(170, 205, 52) + pad2(off(J.hip, -18, 6), off(J.sho, -18, -6), 13) + bar([300, 60], [300, FLOOR], 7, '#2c2b45'), fg: J => handle(J.han) + bar(J.han, [300, J.han[1]], 3, M.cable) },
    dips: { an: ['han', 215, 150], A: { t: 166, ua: 2, fa: 0, th: 18, sh: -62, ft: 40 }, B: { t: 158, ua: -62, fa: 76, th: 22, sh: -60, ft: 40 },
      bg: () => bar([150, 158], [262, 158], 7, M.metal, 'sides') + bar([175, 158], [175, FLOOR], 6, '#2c2b45') + bar([245, 158], [245, FLOOR], 6, '#2c2b45') },
    pushup: { an: ['toe', 92, 259], A: { t: 108, th: -72, sh: -72, ft: -8, hT: [262, 252], hb: 1 }, B: { t: 94, th: -86, sh: -86, ft: -8, hT: [262, 252], hb: 1 } },
    pullup: { an: ['han', 214, 0], A: { t: 180, ua: 180, fa: 180, th: 8, sh: -28, ft: 60 }, B: { t: 172, ua: 26, fa: 172, th: 10, sh: -32, ft: 60, h: -12 },
      bg: () => bar([120, -4], [300, -4], 6, M.metal, 'across') + bar([128, -4], [128, FLOOR], 7, '#2c2b45') + bar([292, -4], [292, FLOOR], 7, '#2c2b45') },
    pulldown: { an: ['hip', 196, 196], A: { t: 184, ua: 166, fa: 168, th: 88, sh: -4 }, B: { t: 194, ua: -8, fa: 158, th: 88, sh: -4 },
      bg: J => seat(162, 206, 56) + rect(J.kne[0] - 14, J.kne[1] - 30, 22, 14, 7) + tower(150) + bar([150, 26], [214, 26], 5, '#2c2b45'),
      fg: J => cable(J.han, [214, 30]) + bar(off(J.han, -18, 0), off(J.han, 18, 0), 4, M.metal) },
    seatedRow: { an: ['hip', 150, 214], A: { t: 158, ua: 86, fa: 88, th: 96, sh: 66, ft: 160 }, B: { t: 186, ua: -62, fa: 72, th: 96, sh: 66, ft: 160 },
      bg: J => rect(110, 224, 110, 12) + legs4(110, 220, 234) + bar([J.ank[0] + 22, 196], [J.ank[0] + 22, 250], 8, '#2c2b45'),
      fg: J => cable(J.han, [352, J.han[1] + 10]) + handle(J.han) },
    machineRow: { an: ['hip', 186, 196], A: { t: 176, ua: 88, fa: 88, th: 88, sh: -3 }, B: { t: 180, ua: -64, fa: 74, th: 88, sh: -3 },
      bg: J => seat(156, 207, 52) + pad2(off(J.sho, 34, 4), off(J.hip, 34, -26), 13) + bar([300, 40], [300, FLOOR], 7, '#2c2b45'),
      fg: J => handle(J.han) + bar(J.han, [300, J.han[1]], 3, M.cable) },
    barRow: { an: stand, A: { t: 116, ua: 0, fa: 0, th: 26, sh: -8 }, B: { t: 118, ua: -112, fa: 6, th: 26, sh: -8 }, fg: J => plate(J.han) },
    dbRow: { an: stand, A: { t: 102, ua: 0, fa: 0, ua2: 22, fa2: 2, th: 18, sh: -6, th2: -14, sh2: -14, hT2: [262, 178] }, B: { t: 102, ua: -118, fa: 4, th: 18, sh: -6, th2: -14, sh2: -14, hT2: [262, 178] },
      bg: () => flatBench(240, 330, 178), fg: (J, eq) => eq === 'cable' ? cable(J.han, [J.han[0] + 80, 250]) + handle(J.han) : db(J.han), farArmFront: false },
    pullover: { an: stand, A: { t: 162, ua: 150, fa: 152, th: 6, sh: -4 }, B: { t: 162, ua: 14, fa: 14, th: 6, sh: -4 },
      bg: () => tower(330), fg: J => cable(J.han, [330, 34]) + handle(J.han) },
    deadlift: { an: stand, A: { t: 128, ua: 4, fa: 4, th: 62, sh: -26 }, B: { t: 180, ua: 0, fa: 0, th: 2, sh: 0 }, fg: J => plate(J.han, 17) },
    rdl: { an: stand, A: { t: 180, ua: 0, fa: 0, th: 2, sh: 0 }, B: { t: 108, ua: 2, fa: 2, th: 12, sh: -10 }, fg: (J, eq) => eq === 'db' ? db(J.han) : plate(J.han, 17) },
    slDL: { an: stand, A: { t: 180, ua: 0, fa: 0, th: 2, sh: 0, th2: 6, sh2: -20 }, B: { t: 104, ua: 2, fa: 2, th: 12, sh: -10, th2: -98, sh2: -98, ft2: 0 }, fg: J => db(J.han) },
    hyper: { an: ['hip', 205, 158], A: { t: 66, ua: 30, fa: 150, th: -44, sh: -44, ft: 40 }, B: { t: 136, ua: 100, fa: -60, th: -44, sh: -44, ft: 40 },
      bg: J => pad2(off(J.hip, 10, 12), off(J.hip, -50, 60), 14) + bar(off(J.ank, 4, 10), off(J.ank, 4, 60), 6, '#2c2b45') + rect(J.ank[0] - 10, J.ank[1] + 6, 26, 9, 4) + bar([195, 180], [195, FLOOR], 7, '#2c2b45') },
    ohpBar: { an: stand, A: { t: 182, ua: 16, fa: 170 }, B: { t: 184, ua: 176, fa: 180 }, fg: J => plate(J.han) },
    ohpSeated: { an: ['hip', 205, 196], A: { t: 186, ua: 30, uas: .55, fa: 176, th: 86, sh: -3 }, B: { t: 186, ua: 176, fa: 180, th: 86, sh: -3 },
      bg: J => seat(172, 207, 54) + pad2(off(J.hip, -18, 4), off(J.sho, -18, -14), 13), fg: (J, eq) => eq === 'mach' ? handle(J.han) : db(J.han) },
    frontRaise: { an: stand, A: { t: 180, ua: 4, fa: 6 }, B: { t: 182, ua: 92, fa: 96 }, fg: J => db(J.han) },
    rearFlyDb: { an: stand, A: { t: 112, ua: 0, fa: 4, th: 22, sh: -8 }, B: { t: 112, ua: 172, uas: .32, fa: 176, fas: .28, th: 22, sh: -8 }, fg: J => db(J.han) },
    rearDeltMachine: { an: ['hip', 200, 194], A: { t: 176, ua: 90, fa: 90, th: 86, sh: -3 }, B: { t: 176, ua: 60, uas: .35, fa: 80, fas: .5, th: 86, sh: -3 },
      bg: J => seat(170, 205, 52) + pad2(off(J.sho, 18, 6), off(J.hip, 20, -8), 13), fg: J => handle(J.han) },
    facePull: { an: stand, A: { t: 178, ua: 86, fa: 88 }, B: { t: 182, ua: -98, fa: 96 },
      bg: () => tower(345), fg: J => cable(J.han, [345, 96]) + handle(J.han) },
    curl: { an: stand, A: { t: 180, ua: 2, fa: 2 }, B: { t: 182, ua: 8, fa: 146 },
      fg: (J, eq) => eq === 'hammer' ? dbAxis(J.elb, J.han) : eq === 'bar' ? plate(J.han, 13) : eq === 'cable' ? cable(J.han, [258, 250]) + handle(J.han) : db(J.han), bg: (J, eq) => eq === 'cable' ? tower(258) : '' },
    preacher: { an: ['hip', 192, 196], A: { t: 176, ua: 64, fa: 70, th: 88, sh: -3 }, B: { t: 176, ua: 64, fa: 165, th: 88, sh: -3 },
      bg: J => seat(160, 207, 56) + armpad() + bar(off(J.elb, 4, 18), [J.elb[0] + 4, FLOOR], 6, '#2c2b45'), fg: J => plate(J.han, 13) },
    inclineCurl: { an: ['hip', 230, 198], A: { t: -152, ua: -2, fa: -2, th: 76, sh: 12 }, B: { t: -152, ua: -2, fa: 128, th: 76, sh: 12 },
      bg: J => legs4(186, 270, 220) + pad2(off(J.hip, -6, 18), off(J.sho, -12, 12), 13) + rect(208, 212, 66, 12), fg: J => db(J.han) },
    bayesian: { an: stand, A: { t: 172, ua: -36, fa: -38, ua2: 2, fa2: 0 }, B: { t: 172, ua: -26, fa: 112, ua2: 2, fa2: 0 },
      bg: () => tower(80), fg: J => cable(J.han, [80, 246]) + handle(J.han) },
    pushdown: { an: stand, A: { t: 172, ua: 6, fa: 118 }, B: { t: 172, ua: 6, fa: 6 },
      bg: J => tower(J.sho[0] + 44), fg: J => cable(J.han, [J.sho[0] + 44, 30]) + handle(J.han) },
    pushdown1: { an: stand, A: { t: 172, ua: 6, fa: 118, ua2: 0, fa2: 0 }, B: { t: 172, ua: 6, fa: 6, ua2: 0, fa2: 0 },
      bg: J => tower(J.sho[0] + 44), fg: J => cable(J.han, [J.sho[0] + 44, 30]) + handle(J.han) },
    katana: { an: stand, A: { t: 176, ua: 150, fa: -50, ua2: 0, fa2: 0 }, B: { t: 176, ua: 140, fa: 148, ua2: 0, fa2: 0 },
      bg: () => tower(70), fg: J => cable(J.han, [70, 150]) + handle(J.han) },
    ohTriceps: { an: stand, A: { t: 166, ua: 158, fa: -6 }, B: { t: 166, ua: 158, fa: 166 },
      bg: () => tower(70), fg: J => cable(J.han, [70, 236]) + handle(J.han) },
    skull: { an: ['hip', 252, 187], A: { t: -90, ua: -172, fa: -174, th: 78, sh: 12 }, B: { t: -90, ua: -168, fa: -96, th: 78, sh: 12 },
      bg: () => flatBench(140, 300), fg: (J, eq) => eq === 'db' ? db(J.han) : plate(J.han, 13) },
    squat: { an: stand, A: { ...std, ua: -34, fa: 154 }, B: { t: 140, ua: -10, fa: 168, th: 84, sh: -22 }, fg: J => plate(off(J.sho, -6, -6), 17) },
    frontSquat: { an: stand, A: { ...std, ua: 108, fa: -72 }, B: { t: 158, ua: 112, fa: -70, th: 86, sh: -24 }, fg: J => plate(off(J.han, 2, -4), 17) },
    hack: { an: ['ank', 230, 236], A: { t: -170, ua: 4, fa: 30, th: -8, sh: -8, ft: 80 }, B: { t: -150, ua: 6, fa: 40, th: 74, sh: -40, ft: 80 },
      bg: J => pad2(off(J.hip, -16, 10), off(J.sho, -16, -4), 13) + bar(off(J.hip, -34, 80), off(J.sho, -38, -50), 6, '#2c2b45') + rect(J.ank[0] - 14, J.ank[1] + 6, 60, 10, 4) },
    legPress: { an: ['hip', 138, 206], A: { t: -122, ua: 30, fa: 40, th: 152, sh: 84, ft: 168 }, B: { t: -122, ua: 30, fa: 40, th: 112, sh: 110, ft: 196 },
      bg: J => pad2([120, 226], [70, 150], 15) + rect(100, 218, 70, 12) + bar([140, 230], [140, FLOOR], 7, '#2c2b45') + bar([230, 230], [350, 120], 6, '#2c2b45')
        + sled(off(J.ank, 10, -4)) },
    legPress1: { an: ['hip', 138, 206], A: { t: -122, ua: 30, fa: 40, th: 152, sh: 84, ft: 168, th2: 96, sh2: 4, ft2: 90 }, B: { t: -122, ua: 30, fa: 40, th: 112, sh: 110, ft: 196, th2: 96, sh2: 4, ft2: 90 },
      bg: J => pad2([120, 226], [70, 150], 15) + rect(100, 218, 70, 12) + bar([140, 230], [140, FLOOR], 7, '#2c2b45') + bar([230, 230], [350, 120], 6, '#2c2b45')
        + sled(off(J.ank, 10, -4)) },
    calfPress: { an: ['hip', 138, 206], A: { t: -122, ua: 30, fa: 40, th: 112, sh: 112, ft: 210 }, B: { t: -122, ua: 30, fa: 40, th: 110, sh: 110, ft: 166 },
      bg: J => pad2([120, 226], [70, 150], 15) + rect(100, 218, 70, 12) + bar([140, 230], [140, FLOOR], 7, '#2c2b45')
        + sled(off(J.toe, 8, 0)) },
    lunge: { an: ['ank', 236, 252], A: { t: 180, ua: 0, fa: 0, th: 8, sh: -6, fT2: [140, 246], ft2: 70 }, B: { t: 178, ua: 2, fa: 2, th: 78, sh: -6, fT2: [150, 248], ft2: 60 }, fg: J => db(J.han) },
    bulgarian: { an: ['ank', 236, 252], A: { t: 176, th: 10, sh: -6, fT2: [118, 196], ft2: 110 }, B: { t: 170, ua: 4, fa: 4, th: 80, sh: -10, fT2: [118, 196], ft2: 110 },
      bg: () => flatBench(70, 140, 202), fg: (J, eq) => eq === 'bar' ? plate(off(J.sho, -6, -6), 15) : db(J.han) },
    stepUp: { an: ['ank', 236, 192], A: { t: 176, th: 72, sh: -10, fT2: [176, 252], ft2: 90, fb2: -1 }, B: { t: 180, th: 2, sh: 0, fT2: [222, 216], ft2: 40, fb2: -1 },
      bg: () => rect(206, 200, 96, 62, 6), fg: J => db(J.han) },
    legExt: { an: ['hip', 175, 196], A: { t: 186, ua: 16, fa: 60, th: 90, sh: 2, ft: 100 }, B: { t: 186, ua: 16, fa: 60, th: 90, sh: 82, ft: 150 },
      bg: J => seat(140, 207, 92) + pad2(off(J.hip, -16, 4), off(J.sho, -18, -6), 13), fg: J => roller(off(J.ank, 3, -1)) },
    legExt1: { an: ['hip', 175, 196], A: { t: 186, ua: 16, fa: 60, th: 90, sh: 2, ft: 100, sh2: 2, ft2: 100 }, B: { t: 186, ua: 16, fa: 60, th: 90, sh: 82, ft: 150, sh2: 2, ft2: 100 },
      bg: J => seat(140, 207, 92) + pad2(off(J.hip, -16, 4), off(J.sho, -18, -6), 13), fg: J => roller(off(J.ank, 3, -1)) },
    legCurlSeated: { an: ['hip', 175, 196], A: { t: 186, ua: 16, fa: 60, th: 90, sh: 80, ft: 150 }, B: { t: 186, ua: 16, fa: 60, th: 90, sh: -18, ft: 80 },
      bg: J => seat(140, 207, 92) + pad2(off(J.hip, -16, 4), off(J.sho, -18, -6), 13) + rect(J.kne[0] - 24, J.kne[1] - 30, 40, 13, 6),
      fg: J => roller(off(J.ank, 0, 9)) },
    legCurlLying: { an: ['hip', 202, 200], A: { t: 90, ua: 62, fa: 128, th: -90, sh: -90, ft: -180 }, B: { t: 90, ua: 62, fa: 128, th: -92, sh: -168, ft: -110 },
      bg: () => legs4(110, 300, 228) + rect(110, 216, 190, 13), fg: J => roller(off(J.ank, 2, -9)) },
    hipThrust: { an: ['sho', 158, 186], A: { t: -128, ua: 100, fa: 40, th: 150, sh: 14, h: -20, fT: [282, 252], fT2: [282, 252], fb: -1, fb2: -1 }, B: { t: -86, ua: 104, fa: 50, th: 96, sh: 6, h: -40, fT: [282, 252], fT2: [282, 252], fb: -1, fb2: -1 },
      bg: () => legs4(96, 160, 206) + rect(96, 196, 64, 14), fg: (J, eq) => eq === 'single' ? '' : plate(off(J.hip, 2, -18), 15) },
    hipThrust1: { an: ['sho', 158, 186], A: { t: -128, ua: 100, fa: 40, th: 150, sh: 14, th2: 150, sh2: 95, h: -20, fT: [282, 252], fb: -1 }, B: { t: -86, ua: 104, fa: 50, th: 96, sh: 6, th2: 118, sh2: 100, h: -40, fT: [282, 252], fb: -1 },
      bg: () => legs4(96, 160, 206) + rect(96, 196, 64, 14) },
    calfStanding: { an: ['toe', 232, 246], A: { ...std, ua: -30, fa: 160, ft: 84 }, B: { t: 180, ua: -30, fa: 160, th: 0, sh: 0, ft: 42 },
      bg: () => rect(200, 248, 60, 12, 3) + bar([150, 40], [150, FLOOR], 7, '#2c2b45'), fg: J => rect(J.sho[0] - 26, J.sho[1] - 14, 34, 12, 6) },
    calfSeated: { an: ['toe', 268, 246], A: { t: 184, ua: 40, fa: 90, th: 88, sh: 0, ft: 80 }, B: { t: 184, ua: 40, fa: 90, th: 88, sh: 0, ft: 40 },
      bg: J => seat(J.hip[0] - 30, J.hip[1] + 11, 52) + rect(232, 248, 60, 12, 3), fg: J => rect(J.kne[0] - 20, J.kne[1] - 24, 34, 12, 6, M.pad, { push: [0, -1], legs: 0 }) },
    plank: { an: ['toe', 92, 259], A: { t: 100, th: -80, sh: -80, ft: -6, hT: [262, 255], hb: -1 }, B: { t: 101.5, th: -78.5, sh: -78.5, ft: -6, hT: [262, 255], hb: -1 } },
    crunch: { an: ['hip', 236, 240], A: { t: -92, ua: 96, fa: 98, th: 134, sh: 18, h: -4, fT: [298, 250], fT2: [298, 250], fb: -1, fb2: -1 }, B: { t: -116, ua: 122, fa: 120, th: 134, sh: 18, h: -18, fT: [298, 250], fT2: [298, 250], fb: -1, fb2: -1 } },
    cableCrunch: { an: ['kne', 196, 250], A: { t: 176, ua: 160, fa: 20, th: 0, sh: -90, ft: -10 }, B: { t: 92, ua: 100, fa: -30, th: 0, sh: -90, ft: -10 },
      bg: () => tower(232), fg: J => cable(J.han, [232, 26]) },
    legRaise: { an: ['han', 214, 0], A: { t: 180, ua: 180, fa: 180, th: 2, sh: 0, ft: 70 }, B: { t: 184, ua: 180, fa: 180, th: 88, sh: 84, ft: 150 },
      bg: () => bar([120, -4], [300, -4], 6, M.metal, 'across') + bar([128, -4], [128, FLOOR], 7, '#2c2b45') + bar([292, -4], [292, FLOOR], 7, '#2c2b45') },
    abWheel: { an: ['kne', 150, 250], A: { t: 168, th: 0, sh: -90, ft: -10, hT: [196, 246], hb: 1 }, B: { t: 100, th: 52, sh: -90, ft: -10, hT: [304, 246], hb: 1 },
      fg: J => wheel(off(J.han, 0, 4)) },
    russian: { an: ['hip', 200, 236], A: { t: -142, th: 124, sh: 66, ft: 115, tw: -42 }, B: { t: -142, th: 124, sh: 66, ft: 115, tw: 42 },
      fg: J => db(J.han) },
    // de frente
    lateral: { v: 'front', A: { ua: 6, fa: 8 }, B: { ua: 86, fa: 92 }, fg: (J, eq) => eq === 'cable' ? cable(J.R.H, [J.cx - 70, 252]) + cable(J.L.H, [J.cx + 70, 252]) : db(J.R.H) + db(J.L.H) },
    lateral1: { v: 'front', A: { ua: 6, fa: 8 }, B: { ua: 86, fa: 92 }, one: 1, fg: (J, eq) => eq === 'cable' ? cable(J.R.H, [J.cx - 60, 252]) + handle(J.R.H) : db(J.R.H) },
    shrug: { v: 'front', A: { ua: 8, fa: 6, lift: 0 }, B: { ua: 8, fa: 6, lift: 16 }, fg: J => db(J.R.H) + db(J.L.H) },
    crossover: { v: 'front', A: { ua: 78, fa: 84 }, B: { ua: 16, fa: -66 }, fg: J => cable(J.R.H, [J.cx + 150, 34]) + cable(J.L.H, [J.cx - 150, 34]), bg: J => tower(J.cx + 150) + tower(J.cx - 150) },
    pecDeck: { v: 'front', A: { ua: 86, fa: 150, seat: 1, kx: 22 }, B: { ua: 50, fa: 178, seat: 1, kx: 22 }, bg: J => rect(J.cx - 40, J.hipY + 6, 80, 12) },
    abductor: { v: 'front', A: { ua: 12, fa: 20, seat: 1, kx: 18 }, B: { ua: 12, fa: 20, seat: 1, kx: 46 }, bg: J => rect(J.cx - 46, J.hipY + 6, 92, 12) + back() + kpad('out') },
    adductor: { v: 'front', A: { ua: 12, fa: 20, seat: 1, kx: 46 }, B: { ua: 12, fa: 20, seat: 1, kx: 18 }, bg: J => rect(J.cx - 46, J.hipY + 6, 92, 12) + back() + kpad('in') },
  };

  // --- qué plantilla usa cada ejercicio (por su nombre) ---
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const RULES = [
    [/press frances/, 'skull'], [/press cerrado/, 'benchClose'], [/press de banca/, 'bench'], [/press inclinado/, 'incline'], [/press de pecho/, 'chestMachine'],
    [/aperturas en maquina|contractora|pec deck/, 'pecDeck'], [/aperturas/, 'flyDb'], [/cruce de poleas/, 'crossover'],
    [/fondos/, 'dips'], [/flexiones/, 'pushup'], [/dominada/, 'pullup'], [/jalon/, 'pulldown'],
    [/remo con barra/, 'barRow'], [/remo unilateral/, 'dbRow'], [/remo en maquina/, 'machineRow'], [/remo/, 'seatedRow'],
    [/peso muerto unilateral/, 'slDL'], [/peso muerto rumano/, 'rdl'], [/peso muerto/, 'deadlift'], [/pullover/, 'pullover'], [/hiperextens/, 'hyper'],
    [/press militar/, 'ohpBar'], [/press de hombros/, 'ohpSeated'],
    [/elevacion(es)? lateral(es)? a un brazo|lateral a un brazo/, 'lateral1'], [/elevacion(es)? lateral/, 'lateral'], [/elevaciones frontales|elevacion frontal/, 'frontRaise'],
    [/pajaros/, 'rearFlyDb'], [/deltoides posterior/, 'rearDeltMachine'], [/face pull/, 'facePull'], [/encogimiento/, 'shrug'],
    [/curl femoral tumbado/, 'legCurlLying'], [/curl femoral/, 'legCurlSeated'], [/bayesian/, 'bayesian'], [/curl predicador/, 'preacher'],
    [/curl en banco inclinado/, 'inclineCurl'], [/curl/, 'curl'],
    [/katana/, 'katana'], [/sobre la cabeza/, 'ohTriceps'], [/triceps a un brazo/, 'pushdown1'], [/triceps/, 'pushdown'],
    [/sentadilla bulgara/, 'bulgarian'], [/sentadilla frontal/, 'frontSquat'], [/hack/, 'hack'], [/sentadilla/, 'squat'],
    [/gemelos en prensa/, 'calfPress'], [/prensa a una pierna/, 'legPress1'], [/prensa/, 'legPress'], [/zancada/, 'lunge'], [/step up/, 'stepUp'],
    [/extension de cuadriceps a una pierna/, 'legExt1'], [/extension de cuadriceps/, 'legExt'], [/hip thrust unilateral/, 'hipThrust1'], [/hip thrust/, 'hipThrust'],
    [/gemelos de pie/, 'calfStanding'], [/gemelos/, 'calfSeated'], [/abductor/, 'abductor'], [/aductor/, 'adductor'],
    [/plancha/, 'plank'], [/crunch en polea/, 'cableCrunch'], [/crunch/, 'crunch'], [/elevacion de piernas/, 'legRaise'], [/rueda abdominal/, 'abWheel'], [/russian/, 'russian'],
  ];
  function pick(name) {
    const n = nrm(name), r = RULES.find(([re]) => re.test(n));
    if (!r) return null;
    const eq = /polea|cable/.test(n) ? 'cable' : /mancuerna/.test(n) ? 'db' : /maquina/.test(n) ? 'mach' : /barra|multipower/.test(n) ? 'bar' : '';
    return { id: r[1], eq: /martillo/.test(n) ? 'hammer' : r[1] === 'curl' && !eq ? 'db' : eq };
  }

  // --- escena completa ---
  const DEFS = `<defs><linearGradient id="fBg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#25233d"/><stop offset="1" stop-color="#141422"/></linearGradient>
    <radialGradient id="fGl" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#B79AFF" stop-opacity=".2"/><stop offset="1" stop-color="#B79AFF" stop-opacity="0"/></radialGradient>
    <linearGradient id="fSk" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#eceef6"/><stop offset="1" stop-color="#b9bfd7"/></linearGradient>
    <linearGradient id="fSkT" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c3c9de"/><stop offset=".45" stop-color="#f4f5fa"/><stop offset=".8" stop-color="#ffffff"/><stop offset="1" stop-color="#dfe3ef"/></linearGradient>
    <linearGradient id="fSkT2" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#c3c9de"/><stop offset=".35" stop-color="#ffffff"/><stop offset=".7" stop-color="#eef0f7"/><stop offset="1" stop-color="#bfc5da"/></linearGradient>
    <linearGradient id="fSk2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9cde0"/><stop offset="1" stop-color="#868ea9"/></linearGradient></defs>`;
  const ease = x => x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  function body(id, eq, k) {
    const tp = T[id], base = tp.v === 'front' ? {} : { t: 180, ua: 0, fa: 0, th: 0, sh: 0, ft: 90, uas: 1, fas: 1 }, p = lerp({ ...base, ...tp.A }, { ...base, ...tp.B }, ease(k));
    if (tp.v === 'front') {
      const J = front(p);
      if (tp.one) { const b = front(tp.A); J.L = b.L; }
      return { J, svg: (tp.bg ? tp.bg(J, eq) : '') + `<ellipse cx="${J.cx}" cy="${FLOOR}" rx="72" ry="7" fill="#000" opacity=".35"/>` + drawFront(J, p) + (tp.fg ? tp.fg(J, eq) : '') };
    }
    const J = side(p, tp.an), sx = (Math.min(J.toe[0], J.toe2[0], J.hip[0]) + Math.max(J.toe[0], J.toe2[0], J.hip[0], J.han[0])) / 2;
    return { J, svg: (tp.bg ? tp.bg(J, eq) : '') + `<ellipse cx="${r1(sx)}" cy="${FLOOR}" rx="78" ry="7" fill="#000" opacity=".35"/>` + drawSide(J, p) + (tp.fg ? tp.fg(J, eq) : '') };
  }
  const ground = `<rect x="-200" y="-200" width="800" height="700" fill="url(#fBg)"/><ellipse cx="200" cy="140" rx="210" ry="150" fill="url(#fGl)"/><rect x="-200" y="${FLOOR}" width="800" height="200" fill="#121220"/><path d="M-200 ${FLOOR}H600" stroke="#2f2d4d" stroke-width="1.5"/>`;
  // Escena 400×300 en el instante k (0 = inicio, 1 = final).
  function scene(id, eq, k) { return DEFS + ground + body(id, eq, k).svg; }

  // Miniatura cuadrada (imagen en caché por plantilla): postura intermedia, encuadrada en el muñeco.
  const thumbs = new Map();
  function thumbUrl(name) {
    const f = pick(name); if (!f) return null;
    const key = f.id + '/' + f.eq;
    if (!thumbs.has(key)) {
      const { J } = body(f.id, f.eq, .55), pts = T[f.id].v === 'front' ? [[150, 30], [250, 262]] : Object.values(J).filter(Array.isArray);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, s = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 46;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r1(cx - s / 2)} ${r1(cy - s / 2)} ${r1(s)} ${r1(s)}">${DEFS}<rect x="-200" y="-200" width="800" height="700" fill="#2a2843"/>${body(f.id, f.eq, .55).svg}</svg>`;
      thumbs.set(key, URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })));
    }
    return thumbs.get(key);
  }

  // Demostración animada: un bucle para todas las <svg data-fig> que haya en pantalla.
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const CYCLE = 2600; // ms: sube, pausa, baja, pausa
  const phase = t => { const x = (t % CYCLE) / CYCLE; return x < .1 ? 0 : x < .45 ? (x - .1) / .35 : x < .55 ? 1 : x < .9 ? 1 - (x - .55) / .35 : 0; };
  function loop(t) {
    for (const el of document.querySelectorAll('svg[data-fig]')) {
      const k = calm.matches ? 1 : phase(t);
      if (calm.matches && el.dataset.drawn) continue;
      el.innerHTML = scene(el.dataset.fig, el.dataset.eq, k); el.dataset.drawn = 1;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  // Encuadre 4:3 que abarca el muñeco en todo el recorrido (así llena la imagen).
  const frames = new Map();
  function frame(id, eq) {
    const key = id + eq; if (frames.has(key)) return frames.get(key);
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const k of [0, .5, 1]) { const { J } = body(id, eq, k);
      const pts = T[id].v === 'front' ? [[130, 26], [270, 262]] : Object.values(J).filter(Array.isArray);
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } }
    y1 = Math.max(y1, FLOOR - 4);
    let w = x1 - x0 + 70, h = y1 - y0 + 56; if (w / h < 4 / 3) w = h * 4 / 3; else h = w * 3 / 4;
    w = Math.max(w, 220); h = w * 3 / 4;
    const cx = (x0 + x1) / 2, vb = [cx - w / 2, Math.min(y1 + 22, 300) - h, w, h].map(r1).join(' ');
    frames.set(key, vb); return vb;
  }
  function demo(name) {
    const f = pick(name); if (!f) return '';
    return `<svg class="figdemo" data-fig="${f.id}" data-eq="${f.eq}" viewBox="${frame(f.id, f.eq)}" role="img" aria-label="Animación del ejercicio">${scene(f.id, f.eq, 0)}</svg>`;
  }
  // Para el 3D: postura (puntos 2D) y lista de material en el instante k.
  function pose(id, eq, k) {
    const tp = T[id], base = tp.v === 'front' ? {} : { t: 180, ua: 0, fa: 0, th: 0, sh: 0, ft: 90, uas: 1, fas: 1 }, p = lerp({ ...base, ...tp.A }, { ...base, ...tp.B }, ease(k));
    let J;
    if (tp.v === 'front') { J = front(p); if (tp.one) J.L = front(tp.A).L; } else J = side(p, tp.an);
    sink = []; try { tp.bg && tp.bg(J, eq); tp.fg && tp.fg(J, eq); } finally { var eqp = sink; sink = null; }
    return { J, p, front: tp.v === 'front', one: !!tp.one, eq: eqp };
  }
  return { pick, scene, thumbUrl, demo, frame, pose, T, L, FLOOR, phase: t => phase(t) };
})();
