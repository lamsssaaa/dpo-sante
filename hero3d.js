/* DPO Romandie — scène 3D cinématographique « Le Sceau de Diligence » (édition spectaculaire).
   HDR env (IBL), métal PBR + tranche ciselée réelle, relief, profondeur de champ (DoF),
   bloom, SMAA, particules ambiantes + de surface, anneaux orbitaux, drag à inertie. Auto-hébergé. */
import * as THREE from "three";
import { RGBELoader } from "three/addons/loaders/RGBELoader.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { BokehPass } from "three/addons/postprocessing/BokehPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { MeshSurfaceSampler } from "three/addons/math/MeshSurfaceSampler.js";

const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeOutBack = (t) => { const c = 1.70158; return 1 + 2.7 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

function dotTexture() {
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.35, "rgba(255,255,255,.55)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
function bgTexture() {
  const s = 512, c = document.createElement("canvas"); c.width = c.height = s;
  const x = c.getContext("2d");
  const g = x.createRadialGradient(s / 2, s * 0.46, 0, s / 2, s / 2, s * 0.66);
  g.addColorStop(0, "#0c4143"); g.addColorStop(0.42, "#082c2e"); g.addColorStop(1, "#f6f2ea");
  x.fillStyle = g; x.fillRect(0, 0, s, s);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function swissBadge() {
  const g = new THREE.Group();
  const sq = new THREE.Shape();
  const a = 0.46, rr = 0.12;
  sq.moveTo(-a + rr, -a); sq.lineTo(a - rr, -a); sq.quadraticCurveTo(a, -a, a, -a + rr);
  sq.lineTo(a, a - rr); sq.quadraticCurveTo(a, a, a - rr, a); sq.lineTo(-a + rr, a);
  sq.quadraticCurveTo(-a, a, -a, a - rr); sq.lineTo(-a, -a + rr); sq.quadraticCurveTo(-a, -a, -a + rr, -a);
  const sqGeo = new THREE.ExtrudeGeometry(sq, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 4 }); sqGeo.center();
  g.add(new THREE.Mesh(sqGeo, new THREE.MeshStandardMaterial({ color: 0xc6102e, metalness: 0.3, roughness: 0.33, emissive: 0x7a0a1c, emissiveIntensity: 0.7 })));
  const cr = new THREE.Shape();
  const arm = 0.30, t = 0.095;
  cr.moveTo(-t, -arm); cr.lineTo(t, -arm); cr.lineTo(t, -t); cr.lineTo(arm, -t); cr.lineTo(arm, t);
  cr.lineTo(t, t); cr.lineTo(t, arm); cr.lineTo(-t, arm); cr.lineTo(-t, t); cr.lineTo(-arm, t); cr.lineTo(-arm, -t); cr.lineTo(-t, -t); cr.closePath();
  const crGeo = new THREE.ExtrudeGeometry(cr, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 }); crGeo.center();
  const cross = new THREE.Mesh(crGeo, new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.1, roughness: 0.3 }));
  cross.position.z = 0.12; g.add(cross);
  return g;
}
function reedEdge(geo, R, flutes, amp) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z);
    if (r > R * 0.985) { const s = 1 + amp * Math.sin(flutes * Math.atan2(z, x)); p.setX(i, x * s); p.setZ(i, z * s); }
  }
  p.needsUpdate = true; geo.computeVertexNormals();
}

export function initHeroCoin(container) {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const PR = Math.min(devicePixelRatio || 1, matchMedia("(max-width:820px)").matches ? 1.5 : 2);
  let w = container.clientWidth, h = container.clientHeight || w;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(PR); renderer.setSize(w, h);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.06;
  renderer.domElement.setAttribute("aria-hidden", "true");
  container.appendChild(renderer.domElement); container.style.touchAction = "none";

  const scene = new THREE.Scene();
  scene.background = bgTexture();
  const camera = new THREE.PerspectiveCamera(34, w / h, 0.1, 100);
  camera.position.set(0, 0, 7.4);

  // Environnement : RoomEnvironment d'abord (anti-FOUC), puis HDR studio premium
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  new RGBELoader().setPath("assets/").load("studio.hdr", (hdr) => {
    hdr.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = pmrem.fromEquirectangular(hdr).texture; hdr.dispose();
  });

  const loader = new THREE.TextureLoader();
  const aniso = renderer.capabilities.getMaxAnisotropy();
  const map = loader.load("seal-tex.jpg"); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = aniso;
  const bump = loader.load("seal-bump.jpg"); bump.anisotropy = aniso;
  const nor = loader.load("assets/metal_nor.jpg"); nor.wrapS = nor.wrapT = THREE.RepeatWrapping; nor.repeat.set(7, 2);
  const armT = loader.load("assets/metal_arm.jpg"); armT.wrapS = armT.wrapT = THREE.RepeatWrapping; armT.repeat.set(7, 2);

  const group = new THREE.Group(); scene.add(group);

  const R = 2.05, TH = 0.36;
  const body = new THREE.CylinderGeometry(R, R, TH, 256, 1, false);
  reedEdge(body, R, 120, 0.012);
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x115c5f, metalness: 1.0, roughness: 0.3, normalMap: nor, normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: armT, metalnessMap: armT, envMapIntensity: 1.6, clearcoat: 0.55, clearcoatRoughness: 0.22, iridescence: 0.22, iridescenceIOR: 1.3 });
  const faceMat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.06, metalness: 0.24, roughness: 0.52, clearcoat: 0.38, clearcoatRoughness: 0.4, envMapIntensity: 1.0 });
  const backMat = new THREE.MeshPhysicalMaterial({ color: 0x115c5f, metalness: 1.0, roughness: 0.34, normalMap: nor, roughnessMap: armT, metalnessMap: armT, envMapIntensity: 1.4, clearcoat: 0.4 });
  const coin = new THREE.Mesh(body, [rimMat, faceMat, backMat]);
  coin.rotation.x = Math.PI / 2; group.add(coin);

  const badge = swissBadge(); badge.position.z = TH / 2 + 0.02; badge.scale.setScalar(1.18); group.add(badge);

  // particules de surface (poussière dorée sur le sceau)
  try {
    const sampler = new MeshSurfaceSampler(coin).build();
    const M = 850, sp = new Float32Array(M * 3), _v = new THREE.Vector3();
    for (let i = 0; i < M; i++) { sampler.sample(_v); sp[i * 3] = _v.x; sp[i * 3 + 1] = _v.y; sp[i * 3 + 2] = _v.z; }
    const sg = new THREE.BufferGeometry(); sg.setAttribute("position", new THREE.BufferAttribute(sp, 3));
    const surf = new THREE.Points(sg, new THREE.PointsMaterial({ size: 0.022, color: 0xe6c884, map: dotTexture(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    coin.add(surf);
  } catch (_) {}

  // anneaux orbitaux
  const rings = new THREE.Group();
  for (let i = 0; i < 2; i++) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(3.0 + i * 0.5, 0.016, 16, 200),
      new THREE.MeshPhysicalMaterial({ color: 0x12595c, metalness: 1, roughness: 0.24, envMapIntensity: 1.5 }));
    t.rotation.x = Math.PI / 2 + (i ? 0.55 : -0.42); t.rotation.y = i ? 0.35 : -0.22;
    rings.add(t);
  }
  scene.add(rings);

  // particules ambiantes
  const N = 700, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), spd = new Float32Array(N);
  const c1 = new THREE.Color(0x2a8d90), c2 = new THREE.Color(0xc8a24a);
  for (let i = 0; i < N; i++) {
    const rad = 2.8 + Math.random() * 4.4, th = Math.random() * Math.PI * 2;
    pos[i * 3] = Math.cos(th) * rad; pos[i * 3 + 1] = (Math.random() - 0.5) * 7.2; pos[i * 3 + 2] = Math.sin(th) * rad * 0.5 - 1.3;
    const c = Math.random() < 0.72 ? c1 : c2; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; spd[i] = 0.1 + Math.random() * 0.4;
  }
  const pg = new THREE.BufferGeometry();
  pg.setAttribute("position", new THREE.BufferAttribute(pos, 3)); pg.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ size: 0.05, map: dotTexture(), vertexColors: true, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(dust);

  // lumières d'appoint (l'HDR fait l'essentiel)
  scene.add(new THREE.HemisphereLight(0xf6f2ea, 0x0a3a3c, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.3); key.position.set(-4, 5, 6); scene.add(key);
  const rimL = new THREE.DirectionalLight(0xcfeeec, 0.8); rimL.position.set(5, -3, -4); scene.add(rimL);
  const fill = new THREE.DirectionalLight(0xffffff, 1.7); fill.position.set(0, 0.6, 8); scene.add(fill);
  const accent = new THREE.PointLight(0xffe6b0, 10, 22, 2); accent.position.set(2.5, 2, 3.5); scene.add(accent);

  // post-processing : Render → DoF → Bloom → SMAA → Output
  const composer = new EffectComposer(renderer);
  composer.setPixelRatio(PR); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  let bokeh = null;
  if (!reduce) { bokeh = new BokehPass(scene, camera, { focus: 7.4, aperture: 0.00019, maxblur: 0.009 }); composer.addPass(bokeh); }
  const bloom = new UnrealBloomPass(new THREE.Vector2(w, h), 0.42, 0.45, 0.88);
  composer.addPass(bloom);
  composer.addPass(new SMAAPass(w * PR, h * PR));
  composer.addPass(new OutputPass());

  // interaction
  let dragging = false, lpx = 0, lpy = 0, vY = 0, vX = 0, rotY = 0, rotX = 0, mxN = 0, myN = 0;
  container.addEventListener("pointerdown", (e) => { dragging = true; lpx = e.clientX; lpy = e.clientY; try { container.setPointerCapture(e.pointerId); } catch (_) {} });
  container.addEventListener("pointermove", (e) => {
    const r = container.getBoundingClientRect(); mxN = (e.clientX - r.left) / r.width - 0.5; myN = (e.clientY - r.top) / r.height - 0.5;
    if (dragging) { vY = (e.clientX - lpx) * 0.006; vX = (e.clientY - lpy) * 0.006; rotY += vY; rotX += vX; lpx = e.clientX; lpy = e.clientY; }
  });
  addEventListener("pointerup", () => { dragging = false; });
  container.addEventListener("pointerleave", () => { mxN = 0; myN = 0; });

  function resize() {
    w = container.clientWidth; h = container.clientHeight || w;
    renderer.setSize(w, h); composer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (bokeh) bokeh.uniforms["aspect"].value = camera.aspect;
  }
  addEventListener("resize", resize, { passive: true });

  let running = true; const t0 = performance.now();
  function frame() {
    if (!running) return;
    requestAnimationFrame(frame);
    const t = (performance.now() - t0) / 1000;
    const intro = Math.min(t / 1.1, 1);
    group.scale.setScalar(reduce ? 1 : easeOutBack(Math.min(intro, 1)));
    bloom.strength = 0.42 + (1 - easeOutCubic(intro)) * 1.7;
    if (reduce) {
      group.rotation.set(0.13, -0.42, 0);
    } else {
      if (!dragging) { rotY += 0.0042 + vY; vY *= 0.94; vX *= 0.94; rotX += vX; rotX *= 0.96; }
      group.rotation.y = rotY + mxN * 0.5 + Math.sin(t * 0.5) * 0.04;
      group.rotation.x = THREE.MathUtils.clamp(rotX, -0.9, 0.9) - myN * 0.4 + Math.sin(t * 0.7) * 0.03;
      rings.rotation.y = t * 0.08; rings.rotation.z = Math.sin(t * 0.2) * 0.1;
      accent.position.x = Math.cos(t * 0.6) * 3; accent.position.y = Math.sin(t * 0.5) * 2.5;
      const p = dust.geometry.attributes.position;
      for (let i = 0; i < N; i++) { let y = p.array[i * 3 + 1] + spd[i] * 0.004; if (y > 3.7) y = -3.7; p.array[i * 3 + 1] = y; }
      p.needsUpdate = true; dust.rotation.y = t * 0.03;
      if (bokeh) bokeh.uniforms["focus"].value = camera.position.distanceTo(group.position);
    }
    composer.render();
  }
  frame();

  new IntersectionObserver((es) => { running = es[0].isIntersecting && !document.hidden; if (running) frame(); }, { threshold: 0 }).observe(container);
  document.addEventListener("visibilitychange", () => { running = !document.hidden; if (running) frame(); });
  requestAnimationFrame(() => container.classList.add("coin-ready"));
}
