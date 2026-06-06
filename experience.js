/* DPO Romandie — Le Labyrinthe de la Conformité (expérience 3D immersive first-person).
   Three.js auto-hébergé. ZQSD/WASD + souris (pointer lock). Le Sceau brille au cœur du dédale. */
import * as THREE from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const N = 11, C = 4.4, WALL_H = 3.6, T = 0.34, EYE = 1.6, RAD = 0.42;

// ---- génération du labyrinthe (recursive backtracker) ----
function buildMaze() {
  const cell = (i, j) => grid[i + j * N];
  const grid = Array.from({ length: N * N }, () => ({ n: true, e: true, s: true, w: true, v: false }));
  const stack = [], rng = mulberry(20260606);
  let cur = grid[0]; cur.v = true; cur.i = 0; cur.j = 0;
  grid.forEach((c, k) => { c.i = k % N; c.j = (k / N) | 0; });
  let count = 1;
  while (count < N * N) {
    const i = cur.i, j = cur.j, nb = [];
    if (j > 0 && !cell(i, j - 1).v) nb.push(["n", cell(i, j - 1)]);
    if (i < N - 1 && !cell(i + 1, j).v) nb.push(["e", cell(i + 1, j)]);
    if (j < N - 1 && !cell(i, j + 1).v) nb.push(["s", cell(i, j + 1)]);
    if (i > 0 && !cell(i - 1, j).v) nb.push(["w", cell(i - 1, j)]);
    if (nb.length) {
      const [dir, next] = nb[(rng() * nb.length) | 0];
      cur[dir] = false; next[{ n: "s", e: "w", s: "n", w: "e" }[dir]] = false;
      next.v = true; stack.push(cur); cur = next; count++;
    } else cur = stack.pop();
  }
  // ouvre une petite chambre 2x2 au centre
  const ci = (N / 2) | 0;
  for (const [a, b] of [[ci - 1, ci - 1], [ci, ci - 1], [ci - 1, ci], [ci, ci]]) {
    const c = cell(a, b); c.e = c.s = c.n = c.w = false;
  }
  return grid;
}
function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function initLabyrinth(canvas, ui) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04201f);
  scene.fog = new THREE.FogExp2(0x04201f, 0.058);

  const camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 200);
  camera.position.set(0, EYE, 0);

  const controls = new PointerLockControls(camera, document.body);
  const loader = new THREE.TextureLoader();
  const nor = loader.load("assets/metal_nor.jpg"); nor.wrapS = nor.wrapT = THREE.RepeatWrapping; nor.repeat.set(1, WALL_H / C);

  // ---- murs ----
  const grid = buildMaze();
  const cell = (i, j) => grid[i + j * N];
  const boxes = [], walls = [];
  const addWall = (cx, cz, sx, sz) => {
    const g = new THREE.BoxGeometry(sx, WALL_H, sz); g.translate(cx, WALL_H / 2, cz); boxes.push(g);
    walls.push({ minx: cx - sx / 2 - RAD, maxx: cx + sx / 2 + RAD, minz: cz - sz / 2 - RAD, maxz: cz + sz / 2 + RAD });
  };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const c = cell(i, j), x = i * C, z = j * C;
    if (c.e) addWall(x + C / 2, z, T, C + T);
    if (c.s) addWall(x, z + C / 2, C + T, T);
    if (j === 0 && c.n) addWall(x, z - C / 2, C + T, T);
    if (i === 0 && c.w) addWall(x - C / 2, z, T, C + T);
  }
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e4f52, metalness: 0.55, roughness: 0.5, normalMap: nor, normalScale: new THREE.Vector2(0.6, 0.6) });
  const wallMesh = new THREE.Mesh(mergeGeometries(boxes), wallMat); scene.add(wallMesh);

  // sol + plafond
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(N * C * 2, N * C * 2),
    new THREE.MeshStandardMaterial({ color: 0x06302f, metalness: 0.7, roughness: 0.35 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(N * C / 2, 0, N * C / 2); scene.add(floor);
  const ceil = floor.clone(); ceil.rotation.x = Math.PI / 2; ceil.position.y = WALL_H;
  ceil.material = new THREE.MeshStandardMaterial({ color: 0x031514, metalness: 0.4, roughness: 0.7 }); scene.add(ceil);

  // lumières : ambiance basse + torche du joueur
  scene.add(new THREE.HemisphereLight(0x16585a, 0x020a0a, 0.35));
  const torch = new THREE.PointLight(0xffe6b0, 2.4, 14, 1.8); camera.add(torch); scene.add(camera);

  // ---- le Sceau au cœur ----
  const ci = (N / 2) | 0, cx = (ci - 0.5) * C, cz = (ci - 0.5) * C;
  const sealTex = loader.load("seal-tex.jpg"); sealTex.colorSpace = THREE.SRGBColorSpace;
  const seal = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.28, 96),
    [new THREE.MeshStandardMaterial({ color: 0x0e4f52, metalness: 1, roughness: 0.25, emissive: 0x0a3a3c, emissiveIntensity: 0.3 }),
     new THREE.MeshStandardMaterial({ map: sealTex, metalness: 0.3, roughness: 0.5, emissive: 0x123f41, emissiveIntensity: 0.4 }),
     new THREE.MeshStandardMaterial({ color: 0x0c4648, metalness: 0.9, roughness: 0.4 })]);
  seal.rotation.x = Math.PI / 2; seal.position.set(cx, 1.7, cz); scene.add(seal);
  const sealGlow = new THREE.PointLight(0x39c0c4, 2.4, 11, 1.8); sealGlow.position.set(cx, 1.7, cz); scene.add(sealGlow);
  const redGlow = new THREE.PointLight(0xff3355, 1.4, 6, 2); redGlow.position.set(cx, 1.7, cz + 0.3); scene.add(redGlow);

  // ---- panneaux porteurs du message ----
  const PANELS = [
    { i: 1, j: 0, t: "LE RISQUE", x: "Vous traitez des données personnelles, parfois sensibles. La direction est personnellement exposée — jusqu'à 250'000 CHF, non assurable. Et des contrôles sont possibles." },
    { i: N - 1, j: 2, t: "POUR QUI", x: "Commerce, services, santé, fiduciaire, RH, immobilier, industrie : toutes les PME de Suisse romande." },
    { i: 0, j: N - 2, t: "LE DOSSIER", x: "Registre des traitements, politiques, procédures. Votre preuve de diligence — hébergée en Suisse." },
    { i: N - 2, j: N - 1, t: "L'HUMAIN", x: "Un conseiller à la protection des données nommé qui signe et vous représente lors d'un contrôle." },
    { i: 2, j: N - 1, t: "L'ABONNEMENT", x: "Audit, dossier, formation, veille, représentation. À coût prévisible. Offre pilote dès 990 CHF." },
  ];
  const panelMeshes = [];
  for (const p of PANELS) {
    const c = document.createElement("canvas"); c.width = 1024; c.height = 640;
    const g = c.getContext("2d");
    g.fillStyle = "#06302f"; g.fillRect(0, 0, 1024, 640);
    g.strokeStyle = "#39c0c4"; g.lineWidth = 8; g.strokeRect(20, 20, 984, 600);
    g.fillStyle = "#7fe3e0"; g.font = "bold 70px Georgia, serif"; g.fillText(p.t, 60, 130);
    g.fillStyle = "#e9f2f0"; g.font = "38px Helvetica, Arial, sans-serif";
    wrap(g, p.x, 60, 230, 900, 52);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2.0),
      new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.65, metalness: 0.2, roughness: 0.6, side: THREE.DoubleSide }));
    m.position.set(p.i * C, 1.9, p.j * C);
    m.userData = p; panelMeshes.push(m); scene.add(m);
  }
  function wrap(g, text, x, y, maxw, lh) {
    const words = text.split(" "); let line = "", yy = y;
    for (const w of words) { const test = line + w + " "; if (g.measureText(test).width > maxw && line) { g.fillText(line, x, yy); line = w + " "; yy += lh; } else line = test; }
    g.fillText(line, x, yy);
  }

  // ---- particules dorées ----
  const NP = 600, pp = new Float32Array(NP * 3);
  for (let k = 0; k < NP; k++) { pp[k * 3] = Math.random() * N * C; pp[k * 3 + 1] = Math.random() * WALL_H; pp[k * 3 + 2] = Math.random() * N * C; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute("position", new THREE.BufferAttribute(pp, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xc8a24a, size: 0.06, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(dust);

  // ---- post-processing (bloom) ----
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.6, 0.82));
  composer.addPass(new OutputPass());

  // ---- déplacement + collisions ----
  const keys = {};
  addEventListener("keydown", (e) => { keys[e.code] = true; });
  addEventListener("keyup", (e) => { keys[e.code] = false; });
  function collide(p) {
    for (const w of walls) {
      const clx = Math.max(w.minx, Math.min(p.x, w.maxx)), clz = Math.max(w.minz, Math.min(p.z, w.maxz));
      const dx = p.x - clx, dz = p.z - clz, d2 = dx * dx + dz * dz;
      if (d2 < 0.0004) { p.x += (Math.random() - 0.5) * 0.1; continue; }
      // intérieur : si le centre est dans l'AABB, pousser hors
      if (p.x > w.minx && p.x < w.maxx && p.z > w.minz && p.z < w.maxz) {
        const px = Math.min(p.x - w.minx, w.maxx - p.x), pz = Math.min(p.z - w.minz, w.maxz - p.z);
        if (px < pz) p.x += (p.x - (w.minx + w.maxx) / 2 > 0 ? px : -px);
        else p.z += (p.z - (w.minz + w.maxz) / 2 > 0 ? pz : -pz);
      }
    }
  }

  const dir = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  let last = performance.now(), atCenter = false;
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(), dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (controls.isLocked) {
      camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      right.crossVectors(dir, up).normalize();
      const sp = (keys.ShiftLeft ? 7 : 4) * dt;
      const f = (keys.KeyW || keys.KeyZ || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
      const r = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.KeyQ || keys.ArrowLeft ? 1 : 0);
      camera.position.x += (dir.x * f + right.x * r) * sp;
      camera.position.z += (dir.z * f + right.z * r) * sp;
      camera.position.y = EYE;
      collide(camera.position);
    }
    seal.rotation.z += dt * 0.5; dust.rotation.y += dt * 0.01;
    sealGlow.intensity = 2.0 + Math.sin(now / 600) * 0.5;
    // proximité panneaux
    let near = null, nd = 4.2;
    for (const m of panelMeshes) { const d = m.position.distanceTo(camera.position); if (d < nd) { nd = d; near = m; } }
    if (near) ui.readout(near.userData.t, near.userData.x); else ui.readout(null);
    const dc = Math.hypot(camera.position.x - cx, camera.position.z - cz);
    if (dc < 3 && !atCenter) { atCenter = true; ui.center(true); } else if (dc >= 3.4 && atCenter) { atCenter = false; ui.center(false); }
    composer.render();
  }
  frame();

  addEventListener("resize", () => {
    renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  });

  return { controls, camera, center: { x: cx, z: cz } };
}
