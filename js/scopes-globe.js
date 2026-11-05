// Sky page: a globe of the neutrino telescopes beside their cards. Hovering or focusing a card flies the globe to that
// telescope; clicking a marker picks its card. Colours match the sky figure further down (planned ones dashed).
(function () {
  const root = document.querySelector(".scopes-map");
  if (!root || !window.d3) return;

  const canvas = root.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const cards = [...root.querySelectorAll(".scope[data-scope]")];
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // one or more sites per card; HUNT and NEON share a card, KM3NeT has two detectors (sites of planned ones approximate)
  const SITES = [
    { card: "pone", name: "P-ONE", lat: 47.77, lon: -127.76, color: "#ff5f6d" },
    { card: "icecube", name: "IceCube", lat: -90, lon: 0, color: "#e8f1f8" },
    { card: "km3net", name: "KM3NeT ARCA", lat: 36.27, lon: 16.1, color: "#7ee8e0" },
    { card: "km3net", name: "KM3NeT ORCA", lat: 42.8, lon: 6.03, color: "#7ee8e0", dx: -1 },
    { card: "baikal", name: "Baikal-GVD", lat: 51.77, lon: 104.4, color: "#2bb39f" },
    { card: "antares", name: "ANTARES", lat: 42.8, lon: 6.17, color: "#9aa9b7", ended: true, dy: 16 },
    { card: "trident", name: "TRIDENT", lat: 17.4, lon: 114.0, color: "#ffc371", planned: true },
    { card: "hunt-neon", name: "HUNT", lat: 18.5, lon: 115.5, color: "#a77bff", planned: true, dy: -14 },
    { card: "hunt-neon", name: "NEON", lat: 16.0, lon: 112.5, color: "#ff9fd8", planned: true, dx: -1, dy: 14 },
  ];
  const TILT = -22; // the resting view looks a little from the north, where most of the telescopes are

  let size = 0, land = null, targets = [], active = null, flight = null, drag = null, spinning = !reduceMotion, pulse = 0;
  const projection = d3.geoOrthographic().clipAngle(90).rotate([128, TILT]);
  const path = d3.geoPath(projection, ctx);
  const graticule = d3.geoGraticule10();

  function isFront(s) {
    const r = projection.rotate();
    return d3.geoDistance([s.lon, s.lat], [-r[0], -r[1]]) < Math.PI / 2 - 0.02;
  }

  function render() {
    ctx.clearRect(0, 0, size, size);
    targets = [];
    const [cx, cy] = projection.translate();
    const r = projection.scale();

    const air = ctx.createRadialGradient(cx, cy, r * 0.96, cx, cy, r * 1.08);
    air.addColorStop(0, "rgba(76, 201, 255, .28)");
    air.addColorStop(1, "rgba(76, 201, 255, 0)");
    ctx.fillStyle = air;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
    ctx.fill();

    const ocean = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.05, cx, cy, r);
    ocean.addColorStop(0, "#1a5684");
    ocean.addColorStop(0.55, "#0d2f4d");
    ocean.addColorStop(1, "#04111f");
    ctx.fillStyle = ocean;
    ctx.beginPath();
    path({ type: "Sphere" });
    ctx.fill();

    ctx.strokeStyle = "rgba(157, 179, 198, .08)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    path(graticule);
    ctx.stroke();

    if (land) {
      ctx.fillStyle = "rgba(175, 196, 214, .24)";
      ctx.strokeStyle = "rgba(190, 210, 228, .5)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      path(land);
      ctx.fill();
      ctx.stroke();
    }

    // the picked telescope's markers last, so they sit on top
    const order = SITES.filter(isFront).sort((a, b) => (a.card === active) - (b.card === active));
    for (const s of order) {
      const [x, y] = projection([s.lon, s.lat]);
      const on = s.card === active;
      const dim = active && !on;
      ctx.globalAlpha = dim ? 0.45 : 1;
      if (on && !reduceMotion) {
        const p = (pulse / 50) % 1;
        ctx.strokeStyle = s.color;
        ctx.globalAlpha = 1 - p;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 8 + p * 16, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const rad = on ? 7 : 5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      if (s.planned) {
        // planned or proposed: a dashed ring, as in the sky figure
        ctx.setLineDash([3, 2.5]);
        ctx.strokeStyle = s.color;
        ctx.fillStyle = "rgba(3, 11, 23, .7)";
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = s.ended ? "rgba(3, 11, 23, .8)" : s.color;
        ctx.strokeStyle = s.ended ? s.color : "rgba(3, 11, 23, .9)";
        ctx.fill();
        ctx.stroke();
      }
      if (!dim || on) label(s.name, x, y, s.color, (s.dx || 1) * (rad + 6), s.dy || 0, on);
      ctx.globalAlpha = 1;
      targets.push({ x, y, r: 12, site: s });
    }

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(157, 179, 198, .35)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function label(text, x, y, color, dx, dy, strong) {
    ctx.font = `${strong ? 700 : 600} ${strong ? 13 : 11.5}px Inter, system-ui, sans-serif`;
    ctx.textAlign = dx < 0 ? "right" : "left";
    ctx.lineWidth = 3.5;
    ctx.strokeStyle = "rgba(3, 11, 23, .9)";
    ctx.strokeText(text, x + dx, y + dy + 4);
    ctx.fillStyle = color;
    ctx.fillText(text, x + dx, y + dy + 4);
    ctx.textAlign = "left";
  }

  // ---------- picking a telescope: from its card, or its marker ----------
  function flyTo(site) {
    const from = projection.rotate();
    const to = [-site.lon, -Math.max(-62, Math.min(62, site.lat))];
    // turn the short way round
    while (to[0] - from[0] > 180) to[0] -= 360;
    while (to[0] - from[0] < -180) to[0] += 360;
    flight = { from, to, t0: performance.now(), ms: reduceMotion ? 1 : 900 };
  }

  function pick(id, fly = true) {
    if (id === active && !fly) return;
    active = id;
    cards.forEach((c) => c.classList.toggle("on", c.dataset.scope === id));
    if (id && fly) {
      const sites = SITES.filter((s) => s.card === id);
      // a card with several sites (KM3NeT, HUNT and NEON) flies to the middle of them
      flyTo({ lon: d3.mean(sites, (s) => s.lon), lat: d3.mean(sites, (s) => s.lat) });
    }
    spinning = !id && !reduceMotion;
    render();
  }

  cards.forEach((c) => {
    c.addEventListener("mouseenter", () => pick(c.dataset.scope));
    c.addEventListener("focusin", () => pick(c.dataset.scope));
  });
  root.querySelector(".scopes").addEventListener("mouseleave", () => pick(null, false));
  root.addEventListener("focusout", (e) => {
    if (!root.contains(e.relatedTarget)) pick(null, false);
  });

  function hitAt(e) {
    const box = canvas.getBoundingClientRect();
    const x = e.clientX - box.left, y = e.clientY - box.top;
    return targets.reduce((best, t) => {
      const d = Math.hypot(t.x - x, t.y - y);
      return d < t.r && (!best || d < best.d) ? { d, site: t.site } : best;
    }, null);
  }

  canvas.addEventListener("pointerdown", (e) => {
    flight = null;
    spinning = false;
    drag = { x: e.clientX, y: e.clientY, rotate: projection.rotate() };
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add("dragging");
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) {
      canvas.classList.toggle("over-marker", Boolean(hitAt(e)));
      return;
    }
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) return; // still a click, not a drag
    const k = 180 / size;
    const [l, p] = drag.rotate;
    projection.rotate([l + (e.clientX - drag.x) * k, Math.max(-90, Math.min(90, p - (e.clientY - drag.y) * k))]);
    render();
  });
  const endDrag = (e) => {
    if (drag && e.type === "pointerup" && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) {
      const hit = hitAt(e);
      pick(hit ? hit.site.card : null, Boolean(hit));
      if (hit) {
        const card = cards.find((c) => c.dataset.scope === hit.site.card);
        // on a phone the cards sit below the globe: bring the picked one into view
        if (card.getBoundingClientRect().top > innerHeight) card.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      }
    }
    drag = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  // ---------- size, data, animation ----------
  function resize() {
    const w = canvas.clientWidth;
    if (!w) return;
    const dpr = window.devicePixelRatio || 1;
    size = w;
    canvas.width = w * dpr;
    canvas.height = w * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    projection.translate([w / 2, w / 2]).scale(w / 2 - 14);
    render();
  }
  new ResizeObserver(resize).observe(canvas);

  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json")
    .then((r) => r.json())
    .then((topo) => { land = topojson.feature(topo, topo.objects.land); render(); })
    .catch(() => {}); // without the coastlines the ocean and the markers still show

  let visible = false;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  let last = performance.now();
  (function frame(now) {
    const dt = Math.min(now - last, 100);
    last = now;
    if (visible) {
      if (flight) {
        const t = Math.min((now - flight.t0) / flight.ms, 1);
        const k = d3.easeCubicInOut(t);
        projection.rotate([flight.from[0] + (flight.to[0] - flight.from[0]) * k, flight.from[1] + (flight.to[1] - flight.from[1]) * k]);
        if (t === 1) flight = null;
        render();
      } else if (spinning && !drag) {
        const [l, p] = projection.rotate();
        // spin west to east, easing the tilt back to the resting view
        projection.rotate([l + dt * 0.008, p + (TILT - p) * 0.02]);
        render();
      } else if (active && !reduceMotion) {
        render();
      }
      pulse += dt / 16;
    }
    requestAnimationFrame(frame);
  })(last);
})();
