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
    // las posturas usan las medidas reales del muñeco
    Object.assign(FIG.L, { th: dist('RightUpLeg', 'RightLeg'), sh: dist('RightLeg', 'RightFoot'), ua: dist('RightArm', 'RightForeArm'), fa: dist('RightForeArm', 'RightHand') + 5,
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
  const FIST = { HandIndex1: 80, HandIndex2: 85, HandIndex3: 55, HandThumb1: 10, HandThumb2: 35, HandThumb3: 25 };
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
  function fists() { for (const [b, [ax, ang]] of CURL) b.quaternion.multiply(_f.setFromAxisAngle(ax, ang)); }
  function placeBody(P) {
    for (const [b, q] of REST) b.quaternion.copy(q);
    fists();
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
      }
      aim(B.RightUpLeg, B.RightLeg, dir2(J.hip, J.kne, FIG.L.th, .15)); aim(B.RightLeg, B.RightFoot, dir2(J.kne, J.ank, FIG.L.sh, 0)); aim(B.RightFoot, B.RightToeBase, dir2(J.ank, J.toe, 1e3, 0));
      aim(B.LeftUpLeg, B.LeftLeg, dir2(J.hip, J.kne2, FIG.L.th, -.15)); aim(B.LeftLeg, B.LeftFoot, dir2(J.kne2, J.ank2, FIG.L.sh, 0)); aim(B.LeftFoot, B.LeftToeBase, dir2(J.ank2, J.toe2, 1e3, 0));
      return;
    }
    // de frente: el muñeco mira a +x; la derecha de la imagen es su lado izquierdo (-z)
    const seated = J.hipY > 160;
    fig.position.y += (FIG.FLOOR - J.hipY + 6) - B.Hips.getWorldPosition(V3()).y; fig.updateMatrixWorld(true);
    const fd = (a, b) => { const v = WF(b).sub(WF(a)); return v.lengthSq() ? v : V3(0, -1, 0); };
    for (const [s, side] of [['R', 'Left'], ['L', 'Right']]) {
      const j = J[s];
      aim(B[side + 'Arm'], B[side + 'ForeArm'], fd(j.S, j.E).add(V3(4, 0, 0))); aim(B[side + 'ForeArm'], B[side + 'Hand'], fd(j.E, j.H).add(V3(6, 0, 0)));
      if (seated) {
        const kd = fd(j.Hp, j.K); aim(B[side + 'UpLeg'], B[side + 'Leg'], V3(1, -.05, kd.z / 40));
        aim(B[side + 'Leg'], B[side + 'Foot'], V3(.05, -1, kd.z / 120)); aim(B[side + 'Foot'], B[side + 'ToeBase'], V3(1, -.25, 0));
      } else { aim(B[side + 'UpLeg'], B[side + 'Leg'], fd(j.Hp, j.K)); aim(B[side + 'Leg'], B[side + 'Foot'], fd(j.K, j.A)); aim(B[side + 'Foot'], B[side + 'ToeBase'], V3(1, -.25, 0)); }
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
  function mesh(geo, mat, pos, scale, quat) { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); m.scale.copy(scale); if (quat) m.quaternion.copy(quat); m.castShadow = true; m.receiveShadow = true; eqGroup.add(m); return m; }
  function rod(a, b, r, mat) { const d = b.clone().sub(a), len = d.length(); if (len < .1) return; const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), d.normalize()); mesh(G.cyl, mat, a.clone().add(b).multiplyScalar(.5), V3(r, len, r), q); }
  const ZQ = new THREE.Quaternion().setFromAxisAngle(X, Math.PI / 2);
  function disc(c, r, w) { mesh(G.cyl, mats.plate, c, V3(r, w, r), ZQ); mesh(G.cyl, mats.acc, c, V3(r * 1.02, w * .4, r * 1.02), ZQ); }
  function placeEquip(P) {
    while (eqGroup.children.length) eqGroup.remove(eqGroup.children[0]);
    const F = P.front, w = F ? WF : W;
    const hand = near => { const s = near ? 'Right' : 'Left', h = bonePos(s + 'Hand'), f = h.clone().sub(bonePos(s + 'ForeArm')).normalize(); return h.addScaledVector(f, 6); };
    const faDir = near => { const s = near ? 'Right' : 'Left'; return bonePos(s + 'Hand').sub(bonePos(s + 'ForeArm')).normalize(); };
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
        if (o.z === 'sides') for (const z of [-28, 28]) rod(at2(o.a, z), at2(o.b, z), r, mat);
        else if (o.z === 'across') { const c = w([(o.a[0] + o.b[0]) / 2, o.a[1]]); rod(V3(c.x, c.y, -64), V3(c.x, c.y, 64), r, mat); for (const z of [-64, 64]) rod(V3(c.x, c.y, z), V3(c.x, 0, z), 3.5, mats.frame); }
        else if (F) rod(w(o.a), w(o.b), r, mat);
        else if (Math.abs(o.a[0] - o.b[0]) < 1 && o.b[1] >= FIG.FLOOR - 1) { if (o.b[1] - o.a[1] > 120) for (const z of [-15, 15]) rod(at2(o.a, z), at2(o.b, z), r, mat); } // patas cortas: se ponen solas bajo cada pieza
        else rod(at2(o.a, 0), at2(o.b, 0), r, mat);
      }
      else if (o.k === 'barbell') { // barra cruzada (con las dos manos) y un disco a cada lado
        let c = w(o.p); if (sameHands) { const h = hand(true); c = V3(h.x, h.y, 0); }
        rod(V3(c.x, c.y, -64), V3(c.x, c.y, 64), 1.6, mats.metal); for (const z of [-46, 46]) disc(V3(c.x, c.y, z), o.r, 5); }
      else if (o.k === 'db' || o.k === 'dbAxis') {
        for (const [i, h] of hands().entries()) { const near = F ? false : i === 0;
          const ax = o.k === 'dbAxis' ? faDir(near).cross(Z).normalize() : Z.clone();
          rod(h.clone().addScaledVector(ax, -11), h.clone().addScaledVector(ax, 11), 1.6, mats.metal);
          for (const s of [-1, 1]) { const c = h.clone().addScaledVector(ax, 9 * s), q = new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), ax);
            mesh(G.cyl, mats.plate, c, V3(6.5, 5, 6.5), q); mesh(G.cyl, mats.acc, c, V3(6.7, 1.6, 6.7), q); } }
      }
      else if (o.k === 'handle') for (const h of hands()) rod(h.clone().add(V3(0, 0, -6)), h.clone().add(V3(0, 0, 6)), 2.6, mats.metal);
      else if (o.k === 'cable') {
        const q0 = w(o.q), h0 = w(o.h), hs = F ? [hand(true), hand(false)] : hands();
        const h = hs.reduce((a, b) => a.distanceTo(h0) < b.distanceTo(h0) ? a : b), q = F ? q0 : V3(q0.x, q0.y, h.z);
        rod(h, q, .9, mats.cable); mesh(G.sphere, mats.acc, q, V3(4.5, 4.5, 4.5));
      }
      else if (o.k === 'roller') { const c = w(o.p); solids.push({ pos: c, size: V3(16, 16, 48), q: new THREE.Quaternion(), roller: 1 }); }
      else if (o.k === 'wheel') { const c = w(o.p); disc(c, 10, 6); rod(V3(c.x, c.y, -14), V3(c.x, c.y, 14), 1.6, mats.metal); }
      else if (o.k === 'kpad') for (const [s_, z] of [['Right', 1], ['Left', -1]]) { // almohadillas de la máquina de abductores/aductores
        const kn = bonePos(s_ + 'Leg'), c = kn.clone().add(V3(-2, 0, z * (o.side === 'out' ? 10 : -10)));
        solids.push({ pos: c, size: V3(16, 22, 5), q: new THREE.Quaternion(), legs: 1, thin: 2, dir: z * (o.side === 'out' ? 1 : -1) }); }
      else if (o.k === 'armpad') { // atril del curl predicador: justo debajo de los brazos
        const A = bonePos('RightArm'), E = bonePos('RightForeArm'), d = E.clone().sub(A); d.z = 0; const len = d.length(); d.normalize();
        const n = V3(d.y, -d.x, 0); if (n.y > 0) n.negate();
        const ch = bonePos('Spine2').x + 18, c = E.clone().addScaledVector(n, 11).addScaledVector(d, -6); c.z = 0; c.x = Math.max(c.x, ch + len * .4); const q = new THREE.Quaternion().setFromUnitVectors(V3(1, 0, 0), d);
        mesh(G.box, mats.pad, c, V3(len * .8, 10, 48), q);
        const foot = c.clone().addScaledVector(d, len * .35).addScaledVector(n, 5); rod(foot, V3(foot.x, 0, 0), 3, mats.frame); }
      else if (o.k === 'back') { const h = bonePos('Hips'), s2 = bonePos('Spine2'); solids.push({ pos: h.clone().lerp(s2, .55).add(V3(-14, 0, 0)), size: V3(6, 60, 44), q: new THREE.Quaternion(), legs: 1 }); }
      else if (o.k === 'sled') { const c = w(o.p), q = new THREE.Quaternion().setFromAxisAngle(Z, 38 * Math.PI / 180); solids.push({ pos: c, size: V3(12, 56, 54), q }); }
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
      mesh(G.box, mats.pad, sd.pos, sd.size, sd.q);
      const hs = sd.size.clone().multiplyScalar(.5), low = sd.pos.y - Math.abs(hs.clone().applyQuaternion(sd.q).y) * 0 - hs.y;
      if (!sd.legs || low < 6) continue;
      if (sd.legs === 4 && sd.q.equals(new THREE.Quaternion())) for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const c = V3(sd.pos.x + sx * Math.max(0, hs.x - 7), sd.pos.y - hs.y, sd.pos.z + sz * Math.max(0, hs.z - 6)); rod(c, V3(c.x, 0, c.z), 2.6, mats.frame); }
      else { const c = sd.pos.clone().add(V3(sd.legAt === 'b' ? hs.x - 4 : 0, -hs.y, 0).applyQuaternion(sd.q)); rod(c, V3(c.x, 0, c.z), 3, mats.frame); }
    }
  }

  // --- encuadre y render ---
  const fits = new Map();
  function fit(f, aspect) {
    const key = f.id + f.eq + aspect.toFixed(2); if (fits.has(key)) return fits.get(key);
    const box = new THREE.Box3();
    for (const k of aspect === 1 ? [.55] : [0, .5, 1]) { pose(f, k, null); fig.updateMatrixWorld(true);
      for (const b of Object.values(B)) box.expandByPoint(b.getWorldPosition(V3())); }
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
  return api;
})();
