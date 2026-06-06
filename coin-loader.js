/* Charge la scène 3D « Sceau de Diligence » sur desktop capable.
   Spectacle prioritaire : chargée dès le load (ou plus tôt à l'interaction).
   Fallback = sceau SVG (mobile, reduced-motion/data, pas de WebGL, file://). */
const c = document.getElementById("coin");
const okMotion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
const okData = !matchMedia("(prefers-reduced-data: reduce)").matches;
function webgl() {
  try {
    const e = document.createElement("canvas");
    return !!(window.WebGLRenderingContext && (e.getContext("webgl2") || e.getContext("webgl")));
  } catch (_) { return false; }
}
if (c && okMotion && okData && innerWidth > 860 && webgl()) {
  let started = false;
  const evs = ["pointermove", "pointerdown", "scroll", "touchstart", "keydown"];
  const go = () => {
    if (started) return;
    started = true;
    evs.forEach((e) => removeEventListener(e, go));
    import("./hero3d.js").then((m) => m.initHeroCoin(c)).catch((e) => console.error("3D:", e));
  };
  evs.forEach((e) => addEventListener(e, go, { passive: true }));
  if (document.readyState === "complete") setTimeout(go, 250);
  else addEventListener("load", () => setTimeout(go, 250));
}
