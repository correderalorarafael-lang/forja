// Muñeco 3D de FORJA: hombre musculado con proporciones reales (generado con MakeHuman/MPFB, licencia CC0, archivo muneco.glb),
// blanco, con pantalón corto negro, movido con las posturas de muneco.js. Los músculos principales del ejercicio se pintan en rojo.
// Si no hay WebGL o el modelo no carga, la app sigue con el muñeco dibujado de muneco.js.
const FIG3D = (() => {
  const api = { ok: false };
  let R, RT, scene, cam, fig, body, eqGroup, mats, G, B = {}, REST = new Map(), REGION = null, colors = null, hlKey = null;
  const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
  const W = (p, z = 0) => V3(p[0] - 200, FIG.FLOOR - p[1], z);   // punto 2D (perfil) → mundo
  const WF = (p, x = 0) => V3(x, FIG.FLOOR - p[1], -(p[0] - 200)); // punto 2D (frente) → mundo
  const X = V3(1, 0, 0), Z = V3(0, 0, 1);
  const nrm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

  // músculo del ejercicio → zonas del cuerpo que se pintan
  const HL = [[/pecho/, ['pecho']], [/dorsal/, ['dorsales']], [/espalda \(parte alta\)|trapecio/, ['trapecio', 'espaldaAlta']], [/espalda \(parte media\)/, ['espaldaAlta', 'dorsales']],
    [/^espalda$/, ['dorsales', 'espaldaAlta']], [/hombro/, ['hombros']], [/biceps/, ['biceps']], [/triceps/, ['triceps']], [/antebrazo/, ['antebrazo']],
    [/cuadriceps|flexores de la cadera/, ['cuadriceps']], [/isquio/, ['isquios']], [/gluteo/, ['gluteos']], [/aductor/, ['aductores']], [/gemelo/, ['gemelos']],
    [/oblicuo/, ['oblicuos']], [/abdomen/, ['abs']], [/lumbar/, ['lumbar']]];
  const tagsFor = main => { const t = new Set(); for (const m of main || []) for (const [re, tags] of HL) if (re.test(nrm(m))) tags.forEach(x => t.add(x)); return t; };

  // --- zonas musculares de cada vértice (en la postura de reposo, mirando a +z) ---
  const TAGS = ['', 'pecho', 'abs', 'oblicuos', 'dorsales', 'trapecio', 'espaldaAlta', 'lumbar', 'gluteos', 'hombros', 'biceps', 'triceps', 'antebrazo', 'cuadriceps', 'isquios', 'aductores', 'gemelos', 'short'];
  function regions(mesh) {
    const g = mesh.geometry, pos = g.attributes.position, si = g.attributes.skinIndex, sw = g.attributes.skinWeight, bones = mesh.skeleton.bones, n = pos.count;
    const bp = {}; mesh.skeleton.bones.forEach((b, i) => { bp[b.name.replace('mixamorig', '')] = i; });
    const inv = mesh.skeleton.boneInverses, bpos = bones.map((b, i) => V3(0, 0, 0).applyMatrix4(new THREE.Matrix4().copy(inv[i]).invert()));
    const P = name => bpos[bp[name]];
    const hipY = P('Hips').y, kneeY = (P('RightLeg').y + P('LeftLeg').y) / 2, upLegY = P('RightUpLeg').y, chestY = P('Spine2').y, spine1Y = P('Spine1').y, neckY = P('Neck').y;
    const midZ = P('Spine1').z, shoX = Math.abs(P('RightArm').x);
    const out = new Uint8Array(n), v = V3(0, 0, 0);
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(pos, i);
      let best = -1, bw = 0;
      const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
      for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = is[k]; }
      const name = (bones[best]?.name || '').replace('mixamorig', '').replace(/^(Left|Right)/, '');
      const ax = Math.abs(v.x), front = v.z > midZ, side = n => TAGS.indexOf(n);
      let t = 0;
      // pantalón corto: de la cintura a medio muslo
      if (/^(Arm)$/.test(name)) { const s = name === 'Arm' ? (v.y > P('RightArm').y - (shoX * .25) && ax < shoX * 1.35 ? 'hombros' : v.z > (best >= 0 ? bpos[best].z : 0) ? 'biceps' : 'triceps') : ''; t = side(s); }
      else if (name === 'Shoulder') t = side(v.y > neckY - (neckY - chestY) * .2 || !front ? 'trapecio' : 'hombros');
      else if (name === 'ForeArm') t = side('antebrazo');
      else if (name === 'Neck') t = side(!front ? 'trapecio' : '');
      else if (name === 'Spine2') t = side(front ? (ax < shoX * .9 && v.y < neckY - (neckY - chestY) * .15 ? 'pecho' : '') : ax > shoX * .45 ? 'dorsales' : 'espaldaAlta');
      else if (name === 'Spine1') t = side(front ? (ax < shoX * .3 ? 'abs' : ax < shoX * .85 && v.y > chestY - (chestY - spine1Y) * .1 ? 'pecho' : 'oblicuos') : ax > shoX * .4 ? 'dorsales' : 'lumbar');
      else if (name === 'Spine') t = side(front ? (ax < shoX * .3 ? 'abs' : 'oblicuos') : 'lumbar');
      else if (name === 'Hips') t = side(front ? 'abs' : 'gluteos');
      else if (name === 'UpLeg') { const mx = Math.abs(bpos[best].x); t = side(front ? (ax < mx - .25 * shoX * .4 ? 'aductores' : 'cuadriceps') : (v.y > upLegY - (upLegY - kneeY) * .25 ? 'gluteos' : 'isquios')); }
      else if (name === 'Leg') t = side(!front && v.y > kneeY - (kneeY - P('RightFoot').y) * .6 ? 'gemelos' : '');
      out[i] = Math.max(0, t);
    }
    return out;
  }
  const WHITE = [.95, .955, .975], RED = [1, .27, .15], BLACK = [.07, .07, .09];
  function paint(tags) {
    const key = tags ? [...tags].sort().join() : ''; if (key === hlKey) return; hlKey = key;
    const c = colors.array;
    for (let i = 0; i < REGION.length; i++) {
      const t = TAGS[REGION[i]], col = t === 'short' ? BLACK : tags && tags.has(t) ? RED : WHITE;
      c[i * 3] = col[0]; c[i * 3 + 1] = col[1]; c[i * 3 + 2] = col[2];
    }
    colors.needsUpdate = true;
  }

  // Superficie continua de sección variable. Filas (de arriba abajo): [y, centro x, delante, detrás, fuera, dentro].
  function tube(rows, segU = 40, segV = 36) {
    const n = rows.length, pos = [], idx = [];
    const cr = (i, c, t) => { const p0 = rows[Math.max(i - 1, 0)][c], p1 = rows[i][c], p2 = rows[Math.min(i + 1, n - 1)][c], p3 = rows[Math.min(i + 2, n - 1)][c];
      return .5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t); };
    for (let a = 0; a <= segU; a++) {
      const u = a / segU * (n - 1), i = Math.min(Math.floor(u), n - 2), t = u - i, v = c => cr(i, c, t);
      const y = v(0), cx = v(1), fr = v(2), bk = v(3), la = v(4), me = v(5);
      for (let b = 0; b < segV; b++) { const ph = b / segV * Math.PI * 2, c = Math.cos(ph), s = Math.sin(ph); pos.push(cx + c * (c >= 0 ? fr : bk), y, s * (s >= 0 ? la : me)); }
    }
    const top = pos.length / 3; pos.push(rows[0][1], rows[0][0] + (rows[0][0] - rows[1][0]) * .08, 0);
    for (let a = 0; a < segU; a++) for (let b = 0; b < segV; b++) { const v00 = a * segV + b, v01 = a * segV + (b + 1) % segV; idx.push(v00, v01, v00 + segV, v01, v01 + segV, v00 + segV); }
    for (let b = 0; b < segV; b++) idx.push(top, (b + 1) % segV, b);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
  }
  // Cabeza de maniquí lisa (cm, sobre el hueso de la cabeza): cráneo, pómulos, mandíbula, barbilla y cuello. Sin ojos, boca ni orejas.
  const HEAD = [[18.6, -1, .4, .4, .4, .4], [17.2, -1, 4.6, 4.8, 4.4, 4.4], [14, -.6, 7.8, 8.6, 7.4, 7.4], [9.5, -.2, 8.8, 9.3, 7.7, 7.7], [5, .8, 9.1, 8.8, 7.5, 7.5],
    [1, 1.6, 8.6, 7.8, 7, 7], [-2.8, 2.3, 7.6, 6.3, 6, 6], [-5.3, 2.8, 5.3, 4.6, 4.9, 4.9], [-6.8, 1.2, 5.7, 5.7, 5.9, 5.9], [-13, 0, 6.3, 6.6, 6.8, 6.8]];

  // --- escena ---
  function build(gltf) {
    R = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    RT = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    for (const r of [R, RT]) { r.outputEncoding = THREE.sRGBEncoding; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.0; r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap; }
    RT.setSize(176, 176, false); RT.setPixelRatio(1);
    R.domElement.style.cssText = 'width:100%;height:100%;display:block;border-radius:inherit';
    scene = new THREE.Scene();
    cam = new THREE.PerspectiveCamera(26, 4 / 3, 10, 4000);
    G = { sphere: new THREE.SphereGeometry(1, 24, 16), box: new THREE.BoxGeometry(1, 1, 1), cyl: new THREE.CylinderGeometry(1, 1, 1, 28) };
    mats = {
      skin: new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .5, metalness: 0, skinning: true, vertexColors: true }),
      pad: new THREE.MeshStandardMaterial({ color: 0x34334f, roughness: .7 }),
      frame: new THREE.MeshStandardMaterial({ color: 0x24233a, roughness: .55, metalness: .3 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x9a99be, roughness: .3, metalness: .75 }),
      plate: new THREE.MeshStandardMaterial({ color: 0x1b1a2b, roughness: .5, metalness: .2 }),
      acc: new THREE.MeshStandardMaterial({ color: 0xb79aff, roughness: .35, emissive: 0x3d2a7a, emissiveIntensity: .6 }),
      cable: new THREE.MeshStandardMaterial({ color: 0xc8c6e6, roughness: .4 }),
      rubber: new THREE.MeshStandardMaterial({ color: 0x111116, roughness: .9 }),
      steel: new THREE.MeshStandardMaterial({ color: 0x3a3954, roughness: .45, metalness: .55 }),
      stack: new THREE.MeshStandardMaterial({ color: 0x23222f, roughness: .55, metalness: .35 }),
      eyes: new THREE.MeshStandardMaterial({ color: 0xf2f3f8, roughness: .5, skinning: true }),
      shorts: new THREE.MeshStandardMaterial({ color: 0x141419, roughness: .78, skinning: true }),
      head: new THREE.MeshStandardMaterial({ color: 0xf2f3f8, roughness: .5 }),
      floor: new THREE.ShadowMaterial({ opacity: .38 }),
    };
    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2640, .55));
    const key = new THREE.DirectionalLight(0xffffff, 1.45); key.position.set(180, 460, 280); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -320, right: 320, top: 320, bottom: -320, near: 10, far: 1500 }); key.shadow.bias = -.0006;
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xc9b6ff, 1.0); rim.position.set(-320, 240, -280); scene.add(rim);
    const fill = new THREE.DirectionalLight(0xffffff, .3); fill.position.set(320, 60, -100); scene.add(fill);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), mats.floor); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    eqGroup = new THREE.Group(); scene.add(eqGroup);
    fig = gltf.scene;
    fig.updateMatrixWorld(true);
    fig.rotation.y = Math.PI / 2; // mira a +x
    fig.traverse(o => {
      if (o.isSkinnedMesh || o.isMesh) {
        o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
        if (!body || o.geometry.attributes.position.count > body.geometry.attributes.position.count) body = o;
      }
      if (o.isBone) { B[o.name.replace('mixamorig', '')] = o; REST.set(o, o.quaternion.clone()); }
    });
    fig.traverse(o => { if (o.isMesh) o.material = o === body ? mats.skin : /short/i.test(o.name) ? mats.shorts : mats.eyes; });
    fistAxes();
    REGION = regions(body);
    colors = new THREE.Float32BufferAttribute(new Float32Array(REGION.length * 3), 3); body.geometry.setAttribute('color', colors); paint(new Set());
    scene.add(fig);
    fig.updateMatrixWorld(true);
    const wp = b => b.getWorldPosition(V3()), dist = (a, b) => wp(B[a]).distanceTo(wp(B[b]));
    const leg = dist('RightUpLeg', 'RightLeg') + dist('RightLeg', 'RightFoot');
    fig.scale.setScalar((FIG.L.th + FIG.L.sh) / leg); fig.updateMatrixWorld(true);
    gripSetup();
    const gOff = grip('Right').sub(wp(B.RightHand)).dot(wp(B.RightHand).sub(wp(B.RightForeArm)).normalize());
    // las posturas usan las medidas reales del muñeco
    Object.assign(FIG.L, { th: dist('RightUpLeg', 'RightLeg'), sh: dist('RightLeg', 'RightFoot'), ua: dist('RightArm', 'RightForeArm'), fa: dist('RightForeArm', 'RightHand') + gOff,
      t: wp(B.Hips).distanceTo(wp(B.RightArm).add(wp(B.LeftArm)).multiplyScalar(.5)) });
  }

  // Girar un hueso (desde el reposo) para que el tramo hasta su hijo apunte hacia d.
  const _q = new THREE.Quaternion(), _p = new THREE.Quaternion(), _w = new THREE.Quaternion();
  function aim(bone, child, d) {
    if (!bone || !child) return;
    bone.updateMatrixWorld(true);
    const a = bone.getWorldPosition(V3()), cur = child.getWorldPosition(V3()).sub(a).normalize();
    _q.setFromUnitVectors(cur, d.clone().normalize());
    bone.getWorldQuaternion(_w); const nq = _q.clone().multiply(_w);
    bone.parent.getWorldQuaternion(_p); bone.quaternion.copy(_p.invert().multiply(nq)); bone.updateMatrixWorld(true);
  }
  function turnWorld(bone, q) { bone.getWorldQuaternion(_w); const nq = q.clone().multiply(_w); bone.parent.getWorldQuaternion(_p); bone.quaternion.copy(_p.invert().multiply(nq)); bone.updateMatrixWorld(true); }
  // Dirección 3D de un tramo a partir de los puntos 2D (si se ve más corto que su longitud, sale hacia fuera del cuerpo).
  function dir2(a, b, len, side) {
    const v = W(b).sub(W(a)), s = Math.min(1, v.length() / len), d = V3(v.x, v.y, 0);
    if (d.lengthSq() < 1e-6) d.set(0, -1, 0); d.normalize().multiplyScalar(s); d.z = side * Math.sqrt(Math.max(0, 1 - s * s)) + side * .12; return d;
  }
  // Puños cerrados: tres falanges para los cuatro dedos y tres para el pulgar; giran hacia la palma (en reposo mira hacia abajo).
  const CURL = new Map(), _f = new THREE.Quaternion();
  const FIST = { HandIndex1: 95, HandIndex2: 100, HandIndex3: 70, HandThumb1: 35, HandThumb2: 45, HandThumb3: 40 };
  function fistAxes() {
    fig.updateMatrixWorld(true);
    const palm = V3(0, -1, 0);
    for (const s of ['Left', 'Right']) for (const [n, deg] of Object.entries(FIST)) {
      const b = B[s + n]; if (!b) continue;
      const next = B[s + n.replace(/\d$/, d => +d + 1)], prev = B[s + n.replace(/\d$/, d => +d - 1)] || B[s + 'Hand'];
      const p0 = b.getWorldPosition(V3()), dir = next ? next.getWorldPosition(V3()).sub(p0) : p0.clone().sub(prev.getWorldPosition(V3()));
      const ax = new THREE.Vector3().crossVectors(dir.normalize(), palm).normalize();
      CURL.set(b, [ax.applyQuaternion(b.getWorldQuaternion(new THREE.Quaternion()).invert()), deg * Math.PI / 180]);
    }
  }
  function fists(openR, openL = openR) { for (const [b, [ax, ang]] of CURL) { const open = /Right/.test(b.name) ? openR : openL;
    b.quaternion.multiply(_f.setFromAxisAngle(ax, open ? ang * (/Thumb/.test(b.name) ? .3 : .18) : ang)); } }
  // Centro del puño (por donde pasa el mango) y dirección de la palma, guardados en el sistema de la mano.
  const GRIP = {};
  function gripSetup() {
    fists(); fig.updateMatrixWorld(true);
    for (const s of ['Left', 'Right']) {
      const H = B[s + 'Hand'], p = n => B[s + n].getWorldPosition(V3());
      const i1 = p('HandIndex1'), i2 = p('HandIndex2'), i3 = p('HandIndex3'), tip = i3.clone().add(i3.clone().sub(i2).multiplyScalar(.8));
      const c = i1.clone().add(i2).add(i3).add(tip).multiplyScalar(.25);
      GRIP[s] = { c: c.applyMatrix4(new THREE.Matrix4().copy(H.matrixWorld).invert()), palm: V3(0, -1, 0).applyQuaternion(H.getWorldQuaternion(new THREE.Quaternion()).invert()) };
    }
    for (const [b, q] of REST) b.quaternion.copy(q); fig.updateMatrixWorld(true);
  }
  const grip = s => { const H = B[s + 'Hand']; H.updateMatrixWorld(true); return GRIP[s].c.clone().applyMatrix4(H.matrixWorld); };
  const palmN = s => GRIP[s].palm.clone().applyQuaternion(B[s + 'Hand'].getWorldQuaternion(new THREE.Quaternion())).normalize();
  // Eje del mango dentro del puño (de lado a lado de los nudillos).
  const gripAxis = s => palmN(s).cross(B[s + 'Hand'].getWorldPosition(V3()).sub(B[s + 'ForeArm'].getWorldPosition(V3()))).normalize();
  // Brazo de dos huesos hasta que el puño (o la muñeca, si la mano va plana) llegue a T, con el codo hacia "pole".
  function armIK(s, T, pole, flat, lock = 0) {
    const A = B[s + 'Arm'], F = B[s + 'ForeArm'], H = B[s + 'Hand'];
    const S = A.getWorldPosition(V3()), Ep = F.getWorldPosition(V3()), Hp = H.getWorldPosition(V3());
    const l1 = S.distanceTo(Ep), l2 = Ep.distanceTo(Hp) + (flat ? 0 : grip(s).sub(Hp).dot(Hp.clone().sub(Ep).normalize()));
    if (lock > 0) { const n0 = T.clone().sub(S).normalize(); T = T.clone().lerp(S.clone().addScaledVector(n0, (l1 + l2) * 1.06), Math.min(1, lock)); } // brazo bloqueado: objetivo fuera de alcance → codo estirado
    const d = T.clone().sub(S), dist = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 1), l1 + l2 - .3), n = d.normalize();
    const A_ = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
    let sd = pole.clone().sub(S); sd.addScaledVector(n, -sd.dot(n)); if (sd.lengthSq() < 1e-6) sd = V3(0, -1, 0).addScaledVector(n, n.y); sd.normalize();
    const E = S.clone().addScaledVector(n, Math.cos(A_) * l1).addScaledVector(sd, Math.sin(A_) * l1);
    aim(A, F, E.clone().sub(S)); aim(F, H, S.clone().addScaledVector(n, dist).sub(E));
  }
  // Pierna de dos huesos hasta que el tobillo llegue a T, con la rodilla hacia "pole".
  function legIK(s, T, pole) {
    const A = B[s + 'UpLeg'], K = B[s + 'Leg'], F = B[s + 'Foot'];
    const S = A.getWorldPosition(V3()), Kp = K.getWorldPosition(V3()), l1 = S.distanceTo(Kp), l2 = Kp.distanceTo(F.getWorldPosition(V3()));
    const d = T.clone().sub(S), dist = Math.min(Math.max(d.length(), Math.abs(l1 - l2) + 1), l1 + l2 - .3), n = d.normalize();
    const a = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist))));
    let sd = pole.clone().sub(S); sd.addScaledVector(n, -sd.dot(n)); if (sd.lengthSq() < 1e-6) sd = V3(1, 0, 0); sd.normalize();
    const E = S.clone().addScaledVector(n, Math.cos(a) * l1).addScaledVector(sd, Math.sin(a) * l1);
    aim(A, K, E.clone().sub(S)); aim(K, F, S.clone().addScaledVector(n, dist).sub(E));
  }
  // Gira antebrazo (70 %) y muñeca (30 %) sobre su eje hasta que la palma mire hacia "want".
  function palmTo(s, want) {
    const F = B[s + 'ForeArm'], H = B[s + 'Hand'];
    const ax = H.getWorldPosition(V3()).sub(F.getWorldPosition(V3())).normalize();
    const flat = v => v.clone().addScaledVector(ax, -v.dot(ax));
    const p1 = flat(palmN(s)), p2 = flat(want); if (p1.lengthSq() < 1e-6 || p2.lengthSq() < 1e-6) return;
    const ang = Math.atan2(ax.dot(p1.clone().cross(p2)), p1.dot(p2));
    turnWorld(F, new THREE.Quaternion().setFromAxisAngle(ax, ang * .7)); fig.updateMatrixWorld(true);
    turnWorld(H, new THREE.Quaternion().setFromAxisAngle(ax, ang * .3)); fig.updateMatrixWorld(true);
  }
  function placeBody(P) {
    for (const [b, q] of REST) b.quaternion.copy(q);
    const op = h => h === 'open' || h === 'flat'; fists(op(P.p.hand), op(P.p.hand2 ?? P.p.hand));
    fig.position.set(0, 0, 0); fig.updateMatrixWorld(true);
    const J = P.J;
    if (!P.front) {
      // tronco: inclinación del perfil repartida en la cadera
      const tilt = Math.atan2(J.sho[0] - J.hip[0], -(J.sho[1] - J.hip[1]));
      const spineNow = B.Spine2.getWorldPosition(V3()).sub(B.Hips.getWorldPosition(V3())).normalize();
      turnWorld(B.Hips, new THREE.Quaternion().setFromUnitVectors(spineNow, V3(Math.sin(tilt), Math.cos(tilt), 0)));
      fig.updateMatrixWorld(true);
      fig.position.add(W(J.hip).sub(B.Hips.getWorldPosition(V3()))); fig.updateMatrixWorld(true);
      aim(B.Neck, B.Head, W(J.head).sub(W(J.sho)));
      if (P.p.tw != null) {
        // giro del tronco sobre su eje (russian twist): la mitad en cada vértebra y las manos juntas delante del pecho
        const axis = W(J.sho).sub(W(J.hip)).normalize(), half = new THREE.Quaternion().setFromAxisAngle(axis, P.p.tw * Math.PI / 360);
        turnWorld(B.Spine1, half); fig.updateMatrixWorld(true); turnWorld(B.Spine2, half); fig.updateMatrixWorld(true);
        const chest = B.Spine2.getWorldPosition(V3()), fwd = V3(1, 0, 0).sub(axis.clone().multiplyScalar(axis.x)).normalize().applyAxisAngle(axis, P.p.tw * Math.PI / 180);
        const tgt = chest.clone().addScaledVector(fwd, 36).addScaledVector(axis, -24);
        for (const s of ['Right', 'Left']) {
          const sp = B[s + 'Arm'].getWorldPosition(V3()), mid = sp.clone().lerp(tgt, .5).addScaledVector(axis, -10);
          aim(B[s + 'Arm'], B[s + 'ForeArm'], mid.sub(sp)); aim(B[s + 'ForeArm'], B[s + 'Hand'], tgt.clone().sub(B[s + 'ForeArm'].getWorldPosition(V3())));
        }
      } else {
      // cerca de la cámara (+z) = lado derecho del muñeco
      aim(B.RightArm, B.RightForeArm, dir2(J.sho, J.elb, FIG.L.ua, 1)); aim(B.RightForeArm, B.RightHand, dir2(J.elb, J.han, FIG.L.fa, .4));
      aim(B.LeftArm, B.LeftForeArm, dir2(J.sho, J.elb2, FIG.L.ua, -1)); aim(B.LeftForeArm, B.LeftHand, dir2(J.elb2, J.han2, FIG.L.fa, -.4));
      // ajuste fino en 3D: el puño llega al punto exacto (hz = media anchura de agarre, ez = codos) y la palma se orienta
      const p = P.p;
      for (const [s, sg, e, h] of [['Right', 1, J.elb, J.han], ['Left', -1, J.elb2, J.han2]]) {
        fig.updateMatrixWorld(true); const flat = (s === 'Left' ? p.hand2 ?? p.hand : p.hand) === 'flat';
        const g0 = flat ? bonePos(s + 'Hand') : grip(s), e0 = bonePos(s + 'ForeArm');
        armIK(s, W(h, p.hz != null ? p.hz * sg : g0.z), W(e, p.ez != null ? p.ez * sg : e0.z), flat, s === 'Left' && p.lock2 != null ? p.lock2 : p.lock);
        fig.updateMatrixWorld(true);
        const fd = (flat ? bonePos(s + 'Hand') : grip(s)).sub(bonePos(s + 'ForeArm')).normalize();
        if (flat) { palmTo(s, V3(0, -1, 0)); aim(B[s + 'Hand'], B[s + 'HandIndex1'], V3(1, -.04, -sg * .12)); continue; }
        let want;
        if (p.pv) want = V3(p.pv[0], p.pv[1], -sg * p.pv[2]);
        else { const r = (p.pr ?? 90) * Math.PI / 180, v0 = V3(-fd.y, fd.x, 0); if (v0.lengthSq() < .05) v0.set(0, 1, 0); want = v0.normalize().multiplyScalar(Math.cos(r)).add(V3(0, 0, -sg * Math.sin(r))); }
        palmTo(s, want);
      }
      }
      aim(B.RightUpLeg, B.RightLeg, dir2(J.hip, J.kne, FIG.L.th, .15)); aim(B.RightLeg, B.RightFoot, dir2(J.kne, J.ank, FIG.L.sh, 0)); aim(B.RightFoot, B.RightToeBase, dir2(J.ank, J.toe, 1e3, 0));
      aim(B.LeftUpLeg, B.LeftLeg, dir2(J.hip, J.kne2, FIG.L.th, -.15)); aim(B.LeftLeg, B.LeftFoot, dir2(J.kne2, J.ank2, FIG.L.sh, 0)); aim(B.LeftFoot, B.LeftToeBase, dir2(J.ank2, J.toe2, 1e3, 0));
      // pies apoyados: el tobillo se queda a su altura sobre el suelo y la planta plana (o de puntillas si la plantilla lo pide)
      for (const [s, k, a, t] of [['Right', J.kne, J.ank, J.toe], ['Left', J.kne2, J.ank2, J.toe2]]) {
        fig.updateMatrixWorld(true); const az = bonePos(s + 'Foot').z, wa = W(a, az);
        if (wa.y < 16) { legIK(s, V3(wa.x, 9.5, az), W(k, bonePos(s + 'Leg').z)); fig.updateMatrixWorld(true);
          const td = W(t).sub(W(a)); aim(B[s + 'Foot'], B[s + 'ToeBase'], td.y > 4 ? td : V3(td.x || 1, -.28 * Math.abs(td.x || 1), 0)); }
        else { fig.updateMatrixWorld(true); const toe = bonePos(s + 'ToeBase'); if (toe.y < 2) { const f = bonePos(s + 'Foot'), d = toe.sub(f); d.y = Math.max(d.y, 2 - f.y); aim(B[s + 'Foot'], B[s + 'ToeBase'], d); } }
      }
      return;
    }
    // de frente: el muñeco mira a +x; la derecha de la imagen es su lado izquierdo (-z)
    const seated = J.hipY > 160;
    fig.position.y += (FIG.FLOOR - J.hipY + 6) - B.Hips.getWorldPosition(V3()).y; fig.updateMatrixWorld(true);
    const fd = (a, b) => { const v = WF(b).sub(WF(a)); return v.lengthSq() ? v : V3(0, -1, 0); };
    if (P.p.lift) for (const [sd, sg] of [['Right', 1], ['Left', -1]]) { turnWorld(B[sd + 'Shoulder'], new THREE.Quaternion().setFromAxisAngle(X, -sg * P.p.lift * 1.1 * Math.PI / 180)); fig.updateMatrixWorld(true); } // encogimiento: suben las clavículas
    for (const [s, side] of [['R', 'Left'], ['L', 'Right']]) {
      const j = J[s];
      aim(B[side + 'Arm'], B[side + 'ForeArm'], fd(j.S, j.E).add(V3(4, 0, 0))); aim(B[side + 'ForeArm'], B[side + 'Hand'], fd(j.E, j.H).add(V3(6, 0, 0)));
      fig.updateMatrixWorld(true); // mismo alcance 3D que de perfil: el puño llega al punto de la plantilla, codo un poco hacia atrás
      armIK(side, WF(j.H).add(V3(P.p.hx ?? 6, 0, 0)), WF(j.E).add(V3(-6, 0, 0)), false, P.p.lock);
      if (seated) {
        const kd = fd(j.Hp, j.K); aim(B[side + 'UpLeg'], B[side + 'Leg'], V3(1, -.05, kd.z / 40));
        aim(B[side + 'Leg'], B[side + 'Foot'], V3(.05, -1, kd.z / 120)); aim(B[side + 'Foot'], B[side + 'ToeBase'], V3(1, -.25, 0));
      } else { aim(B[side + 'UpLeg'], B[side + 'Leg'], fd(j.Hp, j.K)); aim(B[side + 'Leg'], B[side + 'Foot'], fd(j.K, j.A)); aim(B[side + 'Foot'], B[side + 'ToeBase'], V3(1, -.25, 0)); }
      // palma: 0 = hacia el cuerpo con el brazo caído (hacia abajo con el brazo en cruz), 90 = hacia delante
      fig.updateMatrixWorld(true);
      const sg = side === 'Right' ? 1 : -1, f = grip(side).sub(bonePos(side + 'ForeArm')).normalize(), r = (P.p.pr ?? 0) * Math.PI / 180;
      const v0 = V3(0, -f.z * sg, f.y * sg); if (v0.lengthSq() < .05) v0.set(0, -1, 0);
      palmTo(side, v0.normalize().multiplyScalar(Math.cos(r)).add(V3(Math.sin(r), 0, 0)));
    }
    if (!seated) { // pies al suelo
      fig.updateMatrixWorld(true); const fy = Math.min(B.LeftFoot.getWorldPosition(V3()).y, B.RightFoot.getWorldPosition(V3()).y);
      fig.position.y += 9 - fy; fig.updateMatrixWorld(true);
    }
  }
  const bonePos = n => B[n].getWorldPosition(V3());
  // Volumen aproximado del cuerpo (esferas a lo largo de los huesos) para que las máquinas no lo atraviesen.
  function bodySpheres() {
    const S = [], seg = (a, b, r, n) => { const A = bonePos(a), Bb = bonePos(b); for (let i = 0; i <= n; i++) S.push([A.clone().lerp(Bb, i / n), r]); };
    seg('Hips', 'Spine2', 17, 5); seg('Spine2', 'Neck', 17, 3); S.push([bonePos('Hips'), 18]);
    const hd = bonePos('Head'), up = hd.clone().sub(bonePos('Neck')).normalize(); S.push([hd.clone().addScaledVector(up, 12), 14]);
    for (const s of ['Left', 'Right']) {
      seg(s + 'Arm', s + 'ForeArm', 7.5, 4); // antebrazos y manos no cuentan: suelen apoyarse o agarrar
      seg(s + 'UpLeg', s + 'Leg', 11, 5); seg(s + 'Leg', s + 'Foot', 8, 5); seg(s + 'Foot', s + 'ToeBase', 5.5, 2);
    }
    return S;
  }

  // --- material del gimnasio (a partir de la lista de muneco.js) ---
  // --- kit de máquina: tapizados redondeados, tubo cuadrado, bases, torre de discos y poleas ---
  const RB = new Map();
  function roundGeo(w, h, d) { // caja tapizada de w × h × d con cantos redondeados (geometría guardada por tamaño)
    const key = [w, h, d].map(v => Math.round(v * 2) / 2).join(); if (RB.has(key)) return RB.get(key);
    const r = Math.min(3.2, w * .3, h * .3, d * .3), sh = new THREE.Shape(), x = w / 2 - r, y = d / 2 - r;
    sh.moveTo(-x, -d / 2); sh.lineTo(x, -d / 2); sh.quadraticCurveTo(w / 2, -d / 2, w / 2, -y); sh.lineTo(w / 2, y); sh.quadraticCurveTo(w / 2, d / 2, x, d / 2);
    sh.lineTo(-x, d / 2); sh.quadraticCurveTo(-w / 2, d / 2, -w / 2, y); sh.lineTo(-w / 2, -y); sh.quadraticCurveTo(-w / 2, -d / 2, -x, -d / 2);
    const bv = Math.min(2.2, h * .3), g = new THREE.ExtrudeGeometry(sh, { depth: Math.max(.1, h - bv * 2), bevelEnabled: true, bevelThickness: bv, bevelSize: bv * .8, bevelSegments: 3, curveSegments: 5 });
    g.translate(0, 0, -(h - bv * 2) / 2); g.rotateX(-Math.PI / 2); g.computeVertexNormals(); RB.set(key, g); return g;
  }
  // tapizado (x = largo, y = grosor, z = ancho) con su tablero de madera negra debajo
  function cushion(pos, size, q) { const m = new THREE.Mesh(roundGeo(size.x, size.y, size.z), mats.pad); m.position.copy(pos); if (q) m.quaternion.copy(q); m.castShadow = m.receiveShadow = true; eqGroup.add(m);
    const b = V3(0, -size.y / 2 - .6, 0); if (q) b.applyQuaternion(q); mesh(G.box, mats.rubber, pos.clone().add(b), V3(size.x - 2, 1.4, size.z - 2), q); return m; }
  // tubo cuadrado de acero de a a b
  function tube(a, b, s = 5, mat = mats.steel) { const d = b.clone().sub(a), len = d.length(); if (len < .1) return; const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()); mesh(G.box, mat, a.clone().add(b).multiplyScalar(.5), V3(s, len + s * .4, s), q); }
  // pie de suelo: tubo a lo largo de z con tacos de goma
  function foot(x, z0, z1, s = 5) { tube(V3(x, s / 2 + 1, z0), V3(x, s / 2 + 1, z1), s); for (const z of [z0, z1]) mesh(G.box, mats.rubber, V3(x, .8, z), V3(s + 2, 1.6, 4)); }
  function hub(p, ax = Z, r = 4.5, l = 9) { mesh(G.cyl, mats.metal, p, V3(r, l, r), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), ax.clone().normalize())); }
  // asa con funda de goma a lo largo de ax
  function gripBar(c, ax, half = 8) { rod(c.clone().addScaledVector(ax, -half - 2), c.clone().addScaledVector(ax, half + 2), 1.5, mats.metal); rod(c.clone().addScaledVector(ax, -half), c.clone().addScaledVector(ax, half), 2.3, mats.rubber); }
  // polea con su carcasa (ax = eje de giro)
  function pulley(p, ax = Z) { const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), ax.clone().normalize()); mesh(G.cyl, mats.stack, p, V3(5, 3, 5), q); mesh(G.cyl, mats.metal, p, V3(1.4, 4.4, 1.4), q);
    for (const s of [-1, 1]) mesh(G.box, mats.steel, p.clone().addScaledVector(ax.clone().normalize(), s * 2.4), V3(11, 11, .9), q); }
  // torre de discos: base, dos guías, pila de placas con su pasador, placa superior y travesaño con polea; devuelve el punto de la polea alta
  function stack(x, z, top = 250, w = 30) {
    foot(x - 14, z - w / 2 - 8, z + w / 2 + 8, 6); foot(x + 14, z - w / 2 - 8, z + w / 2 + 8, 6);
    for (const s of [-1, 1]) tube(V3(x, 0, z + s * (w / 2 + 4)), V3(x, top, z + s * (w / 2 + 4)), 6);
    tube(V3(x, top + 3, z - w / 2 - 7), V3(x, top + 3, z + w / 2 + 7), 7);
    for (const s of [-1, 1]) rod(V3(x, 6, z + s * 8), V3(x, top - 6, z + s * 8), .9, mats.metal);
    for (let i = 0; i < 14; i++) mesh(G.box, mats.stack, V3(x, 9 + i * 4.3, z), V3(16, 3.8, w - 4));
    mesh(G.box, mats.metal, V3(x, 9 + 14 * 4.3 + 1, z), V3(17, 2.4, w - 3)); rod(V3(x + 7, 30, z), V3(x + 13, 30, z), .8, mats.acc);
    rod(V3(x, 9 + 14 * 4.3 + 2, z), V3(x, top - 8, z), .7, mats.cable);
    return V3(x, top - 6, z);
  }
  const cushionM = (pos, size, q) => cushion(pos, size, q);
  function mesh(geo, mat, pos, scale, quat) { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.scale.copy(scale); if (quat) m.quaternion.copy(quat); m.castShadow = true; m.receiveShadow = true; eqGroup.add(m); return m; }
  function rod(a, b, r, mat) { if (mat === mats.frame) return tube(a, b, Math.max(4, r * 1.7)); const d = b.clone().sub(a), len = d.length(); if (len < .1) return; const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()); mesh(G.cyl, mat, a.clone().add(b).multiplyScalar(.5), V3(r, len, r), q); }
  const ZQ = new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2);
  function disc(c, r, w) { mesh(G.cyl, mats.plate, c, V3(r, w, r), ZQ); mesh(G.cyl, mats.acc, c, V3(r * 1.02, w * .4, r * 1.02), ZQ); }
  // Barra olímpica a escala (2,2 m, discos de 45 cm) y mancuerna (mango de 13 cm).
  function barbell(c, r) {
    rod(V3(c.x, c.y, -150), V3(c.x, c.y, 150), 1.9, mats.metal);
    for (const s of [-1, 1]) { rod(V3(c.x, c.y, s * 88), V3(c.x, c.y, s * 92), 3.6, mats.metal); rod(V3(c.x, c.y, s * 92), V3(c.x, c.y, s * 140), 2.6, mats.metal);
      disc(V3(c.x, c.y, s * 97), r, 7); if (r > 25) disc(V3(c.x, c.y, s * 105), r * .82, 6); }
  }
  function dumbbell(h, ax) {
    rod(h.clone().addScaledVector(ax, -20), h.clone().addScaledVector(ax, 20), 1.9, mats.metal);
    for (const s of [-1, 1]) for (const [o, r] of [[12.5, 12], [17.5, 10.5]]) { const c = h.clone().addScaledVector(ax, o * s), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), ax);
      mesh(G.cyl, mats.plate, c, V3(r, 5, r), q); mesh(G.cyl, mats.acc, c, V3(r * 1.02, 1.4, r * 1.02), q); }
  }
  function placeEquip(P) {
    while (eqGroup.children.length) eqGroup.remove(eqGroup.children[0]);
    const F = P.front, w = F ? WF : W;
    const hand = near => grip(near ? 'Right' : 'Left');
    const gAx = near => gripAxis(near ? 'Right' : 'Left');
    const sameHands = !F && Math.hypot(P.J.han[0] - P.J.han2[0], P.J.han[1] - P.J.han2[1]) < 6;
    const at2 = (p, z) => { const v = w(p); if (!F) v.z = z; return v; };
    const hands = () => F ? (P.one ? [hand(false)] : [hand(true), hand(false)]) : sameHands ? [hand(true), hand(false)] : [hand(true)];
    const solids = [];
    for (const o of P.eq) {
      if (o.k === 'box') { const c = w([o.x + o.w / 2, o.y + o.h / 2]); solids.push({ pos: c, size: F ? V3(44, o.h, o.w) : V3(o.w, o.h, 38), q: new THREE.Quaternion(), legs: o.legs ?? 4, push: o.push }); }
      else if (o.k === 'pad') { const a = w(o.a), b = w(o.b), d = b.clone().sub(a), q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), d.clone().normalize());
        solids.push({ pos: a.clone().add(b).multiplyScalar(.5), size: V3(d.length() + o.w, o.w, 36), q, legs: o.legs ?? 1, push: o.push, legAt: o.legAt }); }
      else if (o.k === 'bar') {
        const mat = o.metal ? mats.metal : mats.frame, r = o.w / 2;
        if (o.z === 'sides') { const gz = Math.abs(hand(true).z) + 1; for (const z of [-gz, gz]) rod(at2(o.a, z), at2(o.b, z), Math.min(r, 3), mat); }
        else if (o.z === 'across') { const g = hand(true).lerp(hand(false), .5), c = V3(g.x, g.y, 0); rod(V3(c.x, c.y, -90), V3(c.x, c.y, 90), 1.9, mats.metal); for (const z of [-90, 90]) rod(V3(c.x, c.y, z), V3(c.x, 0, z), 3.5, mats.frame); }
        else if (F && !(Math.abs(o.a[0] - o.b[0]) < 1 && o.b[1] >= FIG.FLOOR - 1 && o.b[1] - o.a[1] > 120)) rod(w(o.a), w(o.b), r, mat);
        else if (Math.abs(o.a[0] - o.b[0]) < 1 && o.b[1] >= FIG.FLOOR - 1) { if (o.b[1] - o.a[1] > 120) { const t = at2(o.a, 0); if (F) stack(t.x - 10, t.z, Math.max(t.y, 210), 26); else stack(t.x, 0, Math.max(t.y, 210)); } } // las patas cortas se ponen solas bajo cada pieza; los postes altos son torres de discos
        else rod(at2(o.a, 0), at2(o.b, 0), r, mat);
      }
      else if (o.k === 'barbell') { // barra cruzada (con las dos manos) y un disco a cada lado
        let c = w(o.p); if (sameHands) { const h = hand(true).lerp(hand(false), .5); c = V3(h.x, h.y, 0); }
        barbell(c, o.r >= 15 ? 31 : 21); }
      else if (o.k === 'db' || o.k === 'dbAxis') {
        for (const h of hands()) { const near = h.z > 0;
          dumbbell(h, gAx(near)); }
      }
      else if (o.k === 'handle') for (const h of hands()) { const ax = gAx(h.z > 0); rod(h.clone().addScaledVector(ax, -7), h.clone().addScaledVector(ax, 7), 2.2, mats.metal); }
      else if (o.k === 'cable') {
        const q0 = w(o.q), h0 = w(o.h), hs = F ? [hand(true), hand(false)] : hands();
        const h = hs.reduce((a, b) => a.distanceTo(h0) < b.distanceTo(h0) ? a : b), q = F ? q0 : V3(q0.x, q0.y, h.z);
        rod(h, q, .7, mats.cable); pulley(q, F ? X : Z);
      }
      else if (o.k === 'roller' && o.side) { // rodillo de la máquina apoyado en el tobillo (delante o detrás) y su palanca hasta la rodilla
        const k = bonePos('RightLeg'), a = bonePos('RightFoot'), d = a.clone().sub(k).normalize(), t = bonePos('RightToeBase').sub(a);
        const n = t.addScaledVector(d, -t.dot(d)).normalize().multiplyScalar(o.side), c = a.clone().addScaledVector(d, -7).addScaledVector(n, 14); c.z = 0;
        const kz = V3(k.x, k.y, 0); rod(c.clone().add(V3(0, 0, -26)), c.clone().add(V3(0, 0, 26)), 8, mats.pad);
        for (const z of [-30, 30]) { rod(V3(c.x, c.y, z), V3(kz.x, kz.y, z), 2.6, mats.frame); } mesh(G.cyl, mats.frame, V3(kz.x, kz.y, 30), V3(4, 6, 4), ZQ); }
      else if (o.k === 'roller') { const c = w(o.p); solids.push({ pos: c, size: V3(16, 16, 48), q: new THREE.Quaternion(), roller: 1 }); }
      else if (o.k === 'wheel') { const c = w(o.p); disc(c, 10, 6); rod(V3(c.x, c.y, -14), V3(c.x, c.y, 14), 1.6, mats.metal); }
      else if (o.k === 'kpad') for (let [s_, z] of [['Right', 1], ['Left', -1]]) { // almohadillas de abductores (fuera) o aductores (dentro) y su brazo hasta el eje bajo el asiento
        const kn = bonePos(s_ + 'Leg'), hip = bonePos(s_ + 'UpLeg'), out = o.side === 'out' ? 1 : -1, d = kn.clone().sub(hip).normalize(); z = Math.sign(kn.z) || z;
        const c = kn.clone().addScaledVector(d, -9); c.z += z * out * 16; const q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), V3(d.x, d.y, 0).normalize());
        cushion(c, V3(30, 7, 26), q.clone().multiply(new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2)));
        const piv = V3(hip.x + 6, hip.y - 26, z * 6), arm = c.clone().add(V3(0, -13, z * out * 4)); tube(arm, V3(arm.x, piv.y, arm.z), 4); tube(V3(arm.x, piv.y, arm.z), piv, 4); hub(piv, V3(0, 1, 0), 4, 6); }
      else if (o.k === 'kneepad') { // gemelo sentado: almohadilla sobre los muslos junto a las rodillas, con su brazo, el eje y los discos
        const kr = bonePos('RightLeg'), kl = bonePos('LeftLeg'), hip = bonePos('Hips'), d = kr.clone().sub(bonePos('RightUpLeg')).normalize();
        const c = kr.clone().lerp(kl, .5).addScaledVector(d, -8); c.y += 12; c.z = 0;
        cushion(c, V3(14, 8, 56)); const pv = V3(c.x + 4, c.y + 2, 0);
        for (const sg of [-1, 1]) { tube(V3(c.x, c.y, sg * 30), V3(c.x - 50, c.y - 8, sg * 30), 4.5); }
        tube(V3(c.x - 50, c.y - 8, -30), V3(c.x - 50, c.y - 8, 30), 5); hub(V3(c.x - 50, c.y - 8, 0), Z, 4.5, 64);
        tube(V3(c.x - 50, c.y - 8, 0), V3(c.x - 50, 4, 0), 7); foot(c.x - 50, -32, 32, 7);
        for (const sg of [-1, 1]) { rod(V3(c.x + 2, c.y - 4, sg * 30), V3(c.x + 2, c.y - 4, sg * 44), 2, mats.metal); disc(V3(c.x + 2, c.y - 4, sg * 38), 18, 4); } }
      else if (o.k === 'shpads') { // almohadillas sobre los hombros con su asa delante
        const up = bonePos('Neck').sub(bonePos('Spine2')).normalize();
        for (const s of ['Right', 'Left']) { const c = bonePos(s + 'Arm').lerp(bonePos('Neck'), .45).addScaledVector(up, 13); c.z *= 1.05;
          cushionM(c, V3(22, 9, 16), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), up));
          const g = grip(s), ax = gripAxis(s); rod(g.clone().addScaledVector(ax, -9), g.clone().addScaledVector(ax, 9), 2.3, mats.metal); rod(g.clone().addScaledVector(ax, 9 * Math.sign(ax.y || 1)), c, 2.3, mats.frame); } }
      else if (o.k === 'sbar') { const a = hand(true), b = hand(false), d = b.clone().sub(a).normalize(); rod(a.clone().addScaledVector(d, -12), b.clone().addScaledVector(d, 12), 1.9, mats.metal); }
      else if (o.k === 'latbar') { // barra de jalón: recta en el centro y caída en las puntas
        const g = hand(true).lerp(hand(false), .5), c = V3(g.x, g.y, 0);
        rod(V3(c.x, c.y, -58), V3(c.x, c.y, 58), 1.9, mats.metal); for (const s of [-1, 1]) rod(V3(c.x, c.y, s * 58), V3(c.x, c.y - 8, s * 82), 1.9, mats.metal);
        for (const s of [-1, 1]) mesh(G.cyl, mats.plate, V3(c.x, c.y - 6, s * 74), V3(2.6, 14, 2.6), new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), V3(0, -8, s * 24).normalize())); }
      else if (o.k === 'pecdeck') { // contractora: torre alta detrás del respaldo, ejes muy por encima de la cabeza y asas verticales que bajan hasta las manos
        const sh = bonePos('RightArm').lerp(bonePos('LeftArm'), .5), rv = o.rev ? -1 : 1, px = o.rev ? sh.x + 26 : sh.x - 10, bx = o.rev ? sh.x + 48 : sh.x - 30, top = bonePos('Head').y + 60;
        for (const s of ['Right', 'Left']) { const g = grip(s), sg = g.z > 0 ? 1 : -1, piv = V3(px, top, sg * 30), up = V3(g.x, top - 6, g.z);
          rod(g.clone().add(V3(0, -13, 0)), up, 2.4, mats.metal); rod(up, piv, 3.2, mats.frame); mesh(G.cyl, mats.frame, piv, V3(5, 10, 5)); }
        rod(V3(px, top + 5, -34), V3(px, top + 5, 34), 4.5, mats.frame); rod(V3(px, top + 5, 0), V3(bx, top + 5, 0), 4.5, mats.frame);
        for (const z of [-22, 22]) rod(V3(bx, top + 5, z), V3(bx, 0, z), 5, mats.frame);
        if (!o.rev) cushionM(V3(bx + 10, bonePos('Head').y - 2, 0), V3(8, 30, 30));
        stack(bx + (o.rev ? 24 : -24), 0, top + 4); }
      else if (o.k === 'mach' && (o.kind === 'press' || o.kind === 'shoulder')) { // press de pecho: asas horizontales en brazos de palanca que bajan desde un eje alto detrás del respaldo; torre de discos detrás
        const sh = bonePos('RightArm').lerp(bonePos('LeftArm'), .5), bx = sh.x - 34, top = o.kind === 'shoulder' ? sh.y - 6 : bonePos('Head').y + 40;
        for (const s of ['Right', 'Left']) { const g = grip(s), sg = g.z > 0 ? 1 : -1, ax = gripAxis(s), o1 = g.clone().addScaledVector(ax, ax.z * sg > 0 ? 9 : -9);
          rod(g.clone().addScaledVector(ax, -9), g.clone().addScaledVector(ax, 9), 2.3, mats.metal);
          const out = V3(o1.x, o1.y, sg * (Math.abs(o1.z) + 6)), piv = V3(bx + 8, top, sg * (Math.abs(g.z) + 14));
          rod(o1, out, 2.6, mats.frame); rod(out, piv, 3.4, mats.frame); mesh(G.cyl, mats.frame, piv, V3(5, 9, 5)); }
        const ft = Math.max(top, bonePos('Head').y + 30); rod(V3(bx + 8, ft, -50), V3(bx + 8, ft, 50), 4.5, mats.frame);
        for (const z of [-50, 50]) rod(V3(bx + 8, ft, z), V3(bx + 8, 0, z), 4.5, mats.frame);
        stack(bx - 26, 0, ft + 4); }
      else if (o.k === 'mach' && o.kind === 'row') { // remo en máquina: asas verticales en palancas que cuelgan de un eje alto delante del pecho
        const sh = bonePos('RightArm').lerp(bonePos('LeftArm'), .5), fx = sh.x + 118, top = bonePos('Head').y + 30;
        for (const s of ['Right', 'Left']) { const g = grip(s), sg = g.z > 0 ? 1 : -1, z = sg * (Math.abs(g.z) + 10);
          rod(g.clone().add(V3(0, -9, 0)), g.clone().add(V3(0, 9, 0)), 2.3, mats.metal); rod(g.clone().add(V3(0, 9, 0)), V3(g.x, g.y + 9, z), 2.4, mats.frame);
          rod(V3(g.x, g.y + 9, z), V3(fx - 12, top, z), 3.2, mats.frame); }
        rod(V3(fx - 12, top, -46), V3(fx - 12, top, 46), 4.5, mats.frame); for (const z of [-46, 46]) { rod(V3(fx - 12, top, z), V3(fx, 0, z), 4.5, mats.frame); foot(fx, z - 14, z + 14, 6); }
        stack(fx + 30, 0, top + 6); tube(V3(sh.x - 40, 7, 0), V3(fx + 30, 7, 0), 7); }
      else if (o.k === 'armpad') { // atril del curl predicador: justo debajo de los brazos
        const A = bonePos('RightArm'), E = bonePos('RightForeArm'), d = E.clone().sub(A); d.z = 0; const len = d.length(); d.normalize();
        const n = V3(d.y, -d.x, 0); if (n.y > 0) n.negate();
        const ch = bonePos('Spine2').x + 18, c = E.clone().addScaledVector(n, 11).addScaledVector(d, -6); c.z = 0; c.x = Math.max(c.x, ch + len * .4); const q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), d);
        cushionM(c, V3(len * 1.05, 9, 54), q); mesh(G.box, mats.steel, c.clone().addScaledVector(n, 6.5), V3(len * .9, 3, 40), q);
        const ft = c.clone().addScaledVector(d, len * .3).addScaledVector(n, 7); tube(ft, V3(ft.x, 4, 0), 6); foot(ft.x, -26, 26, 6);
        for (const sg of [-1, 1]) { const hk = c.clone().addScaledVector(d, -len * .45).addScaledVector(n, -6); hk.z = sg * 58; rod(hk, hk.clone().add(V3(-6, 2, 0)), 2, mats.metal); } }
      else if (o.k === 'back') { const h = bonePos('Hips'), s2 = bonePos('Spine2'); solids.push({ pos: h.clone().lerp(s2, .55).add(V3(-14, 0, 0)), size: V3(6, 60, 44), q: new THREE.Quaternion(), legs: 1 }); }
      else if (o.k === 'sled') { // prensa: plataforma inclinada 38° apoyada en la planta (o en la punta del pie para gemelos), carro con discos y raíles hasta el suelo
        const A = 38 * Math.PI / 180, q = new THREE.Quaternion().setFromAxisAngle(Z, A), n = V3(Math.cos(A), Math.sin(A), 0), up = V3(-Math.sin(A), Math.cos(A), 0);
        const pt = n2 => bonePos('Right' + n2).lerp(bonePos('Left' + n2), .5), toe = pt('ToeBase'), ank = pt('Foot');
        const sole = o.calf ? toe : ank.clone().lerp(toe, .5), c = sole.clone().addScaledVector(n, 7 - sole.clone().sub(sole).dot(n)).addScaledVector(up, o.calf ? 16 : 0); c.z = 0;
        const base = (dn, wd) => c.clone().addScaledVector(n, dn).addScaledVector(up, wd);
        mesh(G.box, mats.steel, c, V3(4, 60, 62), q); mesh(G.box, mats.rubber, c.clone().addScaledVector(n, -2.4), V3(1, 58, 60), q);
        for (const z of [-26, 26]) { const a = base(14, -24), b = base(14, 26); a.z = b.z = z; tube(a, b, 5); }
        for (const z of [-40, 40]) { const h = base(16, 18); h.z = z; const h2 = h.clone(); h2.z = z * 1.35; rod(h, h2, 2.4, mats.metal); disc(V3(h.x, h.y, z * 1.12), 22, 4); }
        for (const z of [-30, 30]) { const r0 = base(22, -150), r1 = base(22, 70); r0.z = r1.z = z; if (r0.y < 2) r0.addScaledVector(up, (2 - r0.y) / up.y); tube(r0, r1, 5); tube(r0, V3(r0.x, 2, z), 5); }
      }
      else if (o.k === 'smith') { // multipower: dos guías verticales a los lados con la barra enganchada en sus carros
        const g = hand(true).lerp(hand(false), .5), x = g.x - 2;
        for (const z of [-74, 74]) { tube(V3(x, 0, z), V3(x, 300, z), 6); rod(V3(x, 300, z), V3(x, 300, z), 1, mats.metal); mesh(G.box, mats.steel, V3(x, g.y, z), V3(9, 16, 9)); foot(x, z - 18, z + 18, 6); }
        tube(V3(x, 302, -80), V3(x, 302, 80), 7); for (const z of [-80, 80]) { tube(V3(x - 44, 302, z), V3(x + 44, 302, z), 6); for (const dx of [-44, 44]) tube(V3(x + dx, 0, z), V3(x + dx, 302, z), 6); } }
      else if (o.k === 'mach' && o.kind === 'side') { // torre de discos al lado de la máquina (lado lejano) unida al bastidor del asiento
        const h = bonePos('Hips'), sx = h.x - 6, t = stack(sx, -66, 190, 26);
        tube(V3(sx, 8, -50), V3(sx, 8, -4), 6); tube(V3(sx - 40, 8, -4), V3(sx + 60, 8, -4), 6); foot(sx + 60, -26, 26, 6); foot(sx - 40, -26, 26, 6);
        const k = bonePos('RightLeg'); tube(V3(k.x, k.y, -32), V3(sx, 140, -52), 4); pulley(V3(sx, 140, -52), X); }
      else if (o.k === 'mach' && o.kind === 'hack') { // guías de la sentadilla hack paralelas al respaldo, del suelo a por encima de los hombros
        const hp = bonePos('Hips'), nk = bonePos('Neck'), d = nk.clone().sub(hp); d.z = 0; d.normalize(); const nb = V3(-d.y, d.x, 0); if (nb.x > 0) nb.negate();
        const p0 = hp.clone().addScaledVector(nb, 26); p0.z = 0;
        for (const z of [-36, 36]) { let a = p0.clone().addScaledVector(d, -160), b = p0.clone().addScaledVector(d, 120); if (a.y < 3) a = p0.clone().addScaledVector(d, -(p0.y - 3) / d.y); a.z = b.z = z; tube(a, b, 6); tube(V3(a.x, 3, z), a, 6); mesh(G.box, mats.steel, p0.clone().setZ(z).addScaledVector(d, 30), V3(10, 20, 10)); }
        tube(V3(p0.x, 3, -40), V3(p0.x + 130, 3, -40), 6); tube(V3(p0.x, 3, 40), V3(p0.x + 130, 3, 40), 6); }
      else if (o.k === 'mach' && o.kind === 'lat') { // jalón: bastidor del asiento unido a la torre y soporte de la almohadilla de rodillas
        const h = bonePos('Hips'), k = bonePos('RightLeg'); tube(V3(-50, 6, 0), V3(h.x + 10, 6, 0), 7); tube(V3(k.x + 4, k.y + 18, 0), V3(k.x + 4, 6, 0), 6); foot(k.x + 4, -26, 26, 6); }
      else if (o.k === 'db1') { const a = hand(true), b = hand(false), c = a.clone().lerp(b, .5); dumbbell(c, b.clone().sub(a).normalize().lengthSq() > .1 ? b.clone().sub(a).normalize() : gAx(true)); }
    }
    // Cada pieza se aparta del cuerpo (por su lado más fino) hasta no atravesarlo; luego se le ponen patas hasta el suelo.
    const SPH = bodySpheres();
    for (const sd of solids) {
      const inv = sd.q.clone().invert(), hs = sd.size.clone().multiplyScalar(.5);
      const pen = () => { let wd = 0, wl = null;
        for (const [p, r] of SPH) {
          const l = p.clone().sub(sd.pos).applyQuaternion(inv);
          const cl = V3(Math.max(-hs.x, Math.min(hs.x, l.x)), Math.max(-hs.y, Math.min(hs.y, l.y)), Math.max(-hs.z, Math.min(hs.z, l.z)));
          const d = l.distanceTo(cl), depth = d > 0 ? r - d : r + Math.min(hs.x - Math.abs(l.x), hs.y - Math.abs(l.y), hs.z - Math.abs(l.z));
          if (depth > wd) { wd = depth; wl = l; } }
        return [wd, wl]; };
      let [d, wl] = pen(); if (d <= 0) continue;
      let dir;
      if (sd.push) dir = V3(sd.push[0], -sd.push[1], 0).normalize();
      else if (sd.roller) { dir = V3(-wl.x, -wl.y, 0); if (dir.lengthSq() < 1e-6) dir.set(0, -1, 0); dir.normalize(); }
      else {
        const ax = sd.thin ?? (hs.x <= hs.y && hs.x <= hs.z ? 0 : hs.y <= hs.z ? 1 : 2), e = [V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1)][ax];
        const sign = sd.dir ?? -Math.sign([wl.x, wl.y, wl.z][ax] || 1); dir = e.multiplyScalar(sign).applyQuaternion(sd.q);
      }
      for (let k = 0; k < 80 && d > 0; k++) { sd.pos.addScaledVector(dir, 1); [d] = pen(); }
    }
    for (const sd of solids) {
      if (sd.roller) { rod(sd.pos.clone().add(V3(0, 0, -24)), sd.pos.clone().add(V3(0, 0, 24)), 8, mats.pad); continue; }
      cushionM(sd.pos, sd.size, sd.q);
      const hs = sd.size.clone().multiplyScalar(.5), low = sd.pos.y - Math.abs(hs.clone().applyQuaternion(sd.q).y) * 0 - hs.y;
      if (!sd.legs || low < 6) continue;
      if (sd.legs === 4 && sd.q.equals(new THREE.Quaternion())) { // banco: larguero bajo el tapizado, dos patas en T con pie al suelo
        const y = sd.pos.y - hs.y - 1.5, x0 = sd.pos.x - hs.x + 9, x1 = sd.pos.x + hs.x - 9;
        tube(V3(x0, y - 2, sd.pos.z), V3(x1, y - 2, sd.pos.z), 6);
        for (const x of [x0, x1]) { tube(V3(x, y - 2, sd.pos.z), V3(x, 4, sd.pos.z), 6); foot(x, sd.pos.z - hs.z * .9, sd.pos.z + hs.z * .9, 5); } }
      else { const c = sd.pos.clone().add(V3(sd.legAt === 'b' ? hs.x - 6 : 0, -hs.y - 1.5, 0).applyQuaternion(sd.q)); tube(c, V3(c.x, 4, c.z), 6); foot(c.x, c.z - 22, c.z + 22, 5); foot(c.x - 16, c.z - 4, c.z + 4, 5); }
    }
  }

  // --- encuadre y render ---
  const fits = new Map();
  function fit(f, aspect) {
    const key = f.id + f.eq + aspect.toFixed(2); if (fits.has(key)) return fits.get(key);
    const box = new THREE.Box3();
    for (const k of aspect === 1 ? [.55] : [0, .5, 1]) { pose(f, k, null); fig.updateMatrixWorld(true);
      const bb = new THREE.Box3(); for (const b of Object.values(B)) bb.expandByPoint(b.getWorldPosition(V3()));
      eqGroup.updateMatrixWorld(true); const eb = new THREE.Box3().setFromObject(eqGroup); box.union(bb);
      if (!eb.isEmpty()) box.union(eb.intersect(bb.clone().expandByScalar(aspect === 1 ? 45 : 80))); } // la máquina entra en el encuadre, pero sin encoger al muñeco
    box.expandByScalar(16); box.max.y += 10;
    const c = box.getCenter(V3()), s = box.getSize(V3()), front = FIG.T[f.id].v === 'front', D = Math.PI / 180;
    const dirC = front ? V3(Math.cos(28 * D), Math.sin(7 * D), Math.sin(28 * D)) : V3(Math.sin(32 * D), Math.sin(7 * D), Math.cos(32 * D));
    const horiz = front ? s.z * .88 + s.x * .47 : s.x * .85 + s.z * .53, ext = Math.max(s.y, horiz / aspect);
    const R0 = ext / 2 / Math.tan(13 * D) * (aspect === 1 ? 1.02 : 1.1) + Math.max(s.x, s.z) * .25;
    const r = { c, pos: c.clone().addScaledVector(dirC.normalize(), R0) };
    fits.set(key, r); return r;
  }
  function pose(f, k, tags) { const P = FIG.pose(f.id, f.eq, k); placeBody(P); placeEquip(P); if (tags) paint(tags); return P; }
  function shoot(renderer, f, aspect) { const r = fit(f, aspect); cam.aspect = aspect; cam.updateProjectionMatrix(); cam.position.copy(r.pos); cam.lookAt(r.c); renderer.render(scene, cam); }

  // Miniaturas: se dibujan poco a poco (una por fotograma) y se cambian en pantalla al estar listas.
  const thumbs = new Map(), queue = [];
  api.thumb = e => {
    if (!api.ok) return null;
    if (thumbs.has(e.name)) return thumbs.get(e.name);
    if (FIG.pick(e.name) && !queue.some(x => x.name === e.name)) queue.push(e);
    return null;
  };
  function thumbStep() {
    const e = queue.shift(); if (!e) return;
    const f = FIG.pick(e.name); pose(f, .55, tagsFor(e.main)); shoot(RT, f, 1);
    const url = RT.domElement.toDataURL('image/png'); thumbs.set(e.name, url);
    document.querySelectorAll('img[data-t3]').forEach(img => { if (img.dataset.t3 === e.name) { img.src = url; img.classList.add('t3'); } });
    if (cur) hlKey = null; // la demo vuelve a pintar sus músculos
  }
  // Demostración animada: el lienzo se coloca en el primer [data-fig3d] que haya en pantalla.
  let cur = null;
  api.demo = e => FIG.pick(e.name) ? `<div class="fig3d" data-fig3d="${String(e.id).replace(/"/g, '')}"></div>` : '';
  function loop(t) {
    const host = document.querySelector('[data-fig3d]');
    if (host) {
      if (R.domElement.parentNode !== host) { host.appendChild(R.domElement); cur = null; }
      const w = host.clientWidth, h = host.clientHeight, pr = Math.min(2, devicePixelRatio || 1);
      if (w && (R.domElement.width !== Math.round(w * pr) || R.domElement.height !== Math.round(h * pr))) { R.setPixelRatio(pr); R.setSize(w, h, false); }
      const id = host.dataset.fig3d;
      if (!cur || cur.id !== id) { const e = (typeof allEx === 'function' ? allEx() : LIB).find(x => x.id === id); cur = e && { id, e, f: FIG.pick(e.name), tags: tagsFor(e.main) }; hlKey = null; }
      if (cur?.f) { const k = window.FIG_K ?? (matchMedia('(prefers-reduced-motion: reduce)').matches ? .55 : FIG.phase(t)); pose(cur.f, k, cur.tags); shoot(R, cur.f, w / h || 4 / 3); }
    } else cur = null;
    thumbStep();
    requestAnimationFrame(loop);
  }
  api.start = (url = 'muneco.glb') => {
    if (api.ok || api.loading || !window.THREE || !THREE.GLTFLoader) return;
    api.loading = true;
    new THREE.GLTFLoader().load(url, gltf => {
      try { build(gltf); api.ok = true; requestAnimationFrame(loop); window.onFig3d?.(); } catch (err) { console.warn('3D no disponible', err); }
    }, undefined, err => console.warn('No se pudo cargar el muñeco 3D', err));
  };
  api.tagsFor = tagsFor;
  api.setFist = o => { Object.assign(FIST, o); for (const [b, v] of CURL) { const n = b.name.replace(/^mixamorig:?(Left|Right)/, ''); if (FIST[n] != null) v[1] = FIST[n] * Math.PI / 180; } gripSetup(); };
  // Revisión numérica: codos, puños y pies de cada ejercicio en el inicio, la mitad y el final.
  api.audit = () => {
    const ang = s => { const a = bonePos(s + 'Arm'), e = bonePos(s + 'ForeArm'), g = grip(s); return Math.round(a.sub(e).angleTo(g.sub(e)) * 180 / Math.PI); };
    const out = [];
    for (const e of LIB) { const f = FIG.pick(e.name); if (!f) continue;
      for (const k of [0, .5, 1]) { const P = pose(f, k, null); fig.updateMatrixWorld(true);
        const feet = Math.min(bonePos('RightFoot').y, bonePos('LeftFoot').y, bonePos('RightToeBase').y, bonePos('LeftToeBase').y);
        const hands = Math.min(grip('Right').y, grip('Left').y);
        out.push({ n: e.name, id: f.id, k, codoD: ang('Right'), codoI: ang('Left'), pies: Math.round(feet), manos: Math.round(hands), lock: P.p.lock ?? 0 }); } }
    return out;
  };
  // Para revisar: imagen de un ejercicio en el instante k (az = giro extra de cámara en grados).
  api.shot = (name, k = .55, size = 360, az = 0, focus) => {
    const f = FIG.pick(name); if (!f) return null; const e = LIB.find(x => x.name === name);
    const r = fit(f, 1), save = r.pos.clone(); pose(f, k, tagsFor(e?.main)); RT.setSize(size, size, false);
    if (az) r.pos.sub(r.c).applyAxisAngle(V3(0, 1, 0), az * Math.PI / 180).add(r.c);
    const sc = r.c.clone(); if (focus) { const g = focus === 'grip' ? grip('Right') : bonePos(focus); r.pos.sub(r.c).multiplyScalar(window.ZM || .3).add(g); r.c.copy(g); }
    shoot(RT, f, 1); r.pos.copy(save); r.c.copy(sc); const u = RT.domElement.toDataURL('image/png'); RT.setSize(176, 176, false); return u;
  };
  return api;
})();
