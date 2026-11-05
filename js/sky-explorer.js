// Sky & network page: one figure for where neutrino telescopes look, in three views of one 3D scene.
//   Earth: the turnable Earth. At each telescope picked, the band of directions it sees best, as two cones from it: the
//     upper edge out into the sky, the lower edge down through the Earth to where its neutrinos go in. The telescope in
//     focus (the last one picked) also shows its horizon as a flat disk.
//   Earth and sky: the Earth shrinks inside the sky, drawn as a see-through sphere with the real stars, the Milky Way,
//     the neutrino sources and IceCube's alert neutrinos. Each band lands on it as a ring. The sky is so far away that
//     the Earth is a point beside it, so the bands' directions are carried out from the Earth's centre (dashed rays).
//   Sky from inside: the far half of that same sphere, seen from the Earth's centre.
// The sky is fixed; the Earth turns inside it with the sidereal time, so the rings sweep across the stars. The band at
// one energy comes from js/neutrino-band.js; the published band (after L. Schumacher et al.) is for the E^-2 mix.
// Coordinates: x toward right ascension 0, z toward the north celestial pole; a place on Earth at longitude L is at
// right ascension L + 15° × the sidereal time (in hours).
(function () {
  const fig = document.querySelector(".sky-explorer");
  if (!fig || !window.d3 || !window.NeutrinoBand) return;
  const NB = window.NeutrinoBand;
  const canvas = fig.querySelector("canvas"), ctx = canvas.getContext("2d");
  const tip = fig.querySelector(".globe-tip"), hint = fig.querySelector(".sx-hint");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const RAD = Math.PI / 180, deg = (r) => r / RAD;
  const wrap = (lon) => ((lon + 540) % 360) - 180;
  const rgba = (hex, a) => `rgba(${[1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ")}, ${a})`;

  const TELESCOPES = {
    pone: { name: "P-ONE", lat: 47.77, lon: -127.76, color: "#ff5f6d" },
    icecube: { name: "IceCube", lat: -90, lon: 0, color: "#e8f1f8", fill: 0.08 },
    km3net: { name: "KM3NeT", lat: 36.27, lon: 16.1, color: "#7ee8e0" },
    baikal: { name: "Baikal-GVD", lat: 51.77, lon: 104.4, color: "#2bb39f" },
    // planned or proposed; sites are approximate (these sit close together, so each has its own label offset)
    trident: { name: "TRIDENT", lat: 17.4, lon: 114.0, color: "#ffc371", planned: true, labelAt: [12, 8] },
    hunt: { name: "HUNT", lat: 18.5, lon: 115.5, color: "#a77bff", planned: true, labelAt: [12, -10] },
    neon: { name: "NEON", lat: 16.0, lon: 112.5, color: "#ff9fd8", planned: true, labelAt: [-12, 14] },
  };
  Object.entries(TELESCOPES).forEach(([id, t]) => (t.id = id));
  const SITE_TIPS = {
    pone: "In Cascadia Basin, 2,600 m down off Vancouver Island, in the northeast Pacific.",
    icecube: "A cubic kilometre of ice at the South Pole, Antarctica.",
    km3net: "Its ARCA detector, 3,500 m down in the Mediterranean off Sicily.",
    baikal: "In Lake Baikal, Siberia, up to about 1,300 m down.",
    trident: "Planned for the South China Sea; site approximate.",
    hunt: "Proposed; site approximate.",
    neon: "Proposed for the South China Sea; site approximate.",
  };

  // ---------- the band: the elevations of its upper and lower edges, in degrees above the horizon ----------
  // The published band, read off the original figure (approximate), is for sources with an E^-2 spectrum, a mix of
  // energies; at 1 PeV the single-energy band from js/neutrino-band.js comes closest to it (10° above to 13° below).
  const PUBLISHED = [10, -15], PUBLISHED_TEV = 1000;
  let band = PUBLISHED.slice(), published = true, tev = PUBLISHED_TEV;

  const SOURCES = [
    { name: "TXS 0506+056", ra: 77.36, dec: 5.69, mark: "plus", tip: "tip-txs" },
    { name: "NGC 1068", ra: 40.67, dec: -0.01, mark: "cross", tip: "tip-ngc" },
  ];
  const GALACTIC_CENTER = { ra: 266.4, dec: -28.94, tip: "tip-galaxy" };
  // the galactic plane (b = 0) in equatorial coordinates, J2000
  const POLE_RA = 192.85948 * RAD, POLE_DEC = 27.12825 * RAD, L_NCP = 122.93192 * RAD;
  const galacticPlane = {
    type: "LineString",
    coordinates: d3.range(0, 361, 2).map((l) => {
      const d = L_NCP - l * RAD;
      const dec = Math.asin(Math.cos(POLE_DEC) * Math.cos(d));
      const ra = POLE_RA + Math.atan2(Math.sin(d), -Math.sin(POLE_DEC) * Math.cos(d));
      return [wrap(deg(ra)), deg(dec)];
    }),
  };

  // Real sky data (assets/data/sky-catalogs.json, its "sources" say where each part comes from): the stars to magnitude
  // 6 (XHIP), the Milky Way's outline in five brightness steps (Vieira), the constellations, and IceCube's alert
  // neutrinos (IceCat-1). Until it loads, the sky has only its grid, the bands and the sources.
  let stars = [], milkyWay = [], figures = null, constellationNames = [], brightStars = [], neutrinos = [];
  const STAR_LIMIT = 5;   // magnitude: the faintest stars drawn, so the bands stay readable (the data goes to 6)
  // a star's colour from its B-V colour index: hot blue-white to cool orange
  const BV = [[-0.3, [155, 178, 255]], [0, [202, 216, 255]], [0.3, [248, 247, 255]], [0.6, [255, 244, 232]], [0.9, [255, 228, 196]], [1.2, [255, 210, 161]], [1.6, [255, 189, 111]]];
  function bvColor(bv) {
    const i = Math.max(0, Math.min(BV.length - 2, BV.findIndex(([b]) => b > bv) - 1));
    const [b0, c0] = BV[i], [b1, c1] = BV[i + 1], t = Math.max(0, Math.min(1, (bv - b0) / (b1 - b0)));
    return c0.map((c, k) => Math.round(c + (c1[k] - c) * t));
  }
  // the Milky Way's polygons, turned round where their winding would make them enclose the rest of the sphere
  const placeMilkyWay = (levels) => levels.map((polys) => ({
    type: "MultiPolygon",
    coordinates: polys.map((rings) => {
      let poly = rings.map((ring) => ring.map(([ra, dec]) => [wrap(ra), dec]));
      if (d3.geoArea({ type: "Polygon", coordinates: poly }) > 2 * Math.PI) poly = poly.map((ring) => ring.slice().reverse());
      return poly;
    }),
  }));
  // a neutrino's ring: bigger for more energy (54 TeV to 7 PeV), warmer and brighter the likelier it comes from space
  const nuRadius = (e) => 1.8 + 1.4 * Math.log10(e / 50);
  const nuColor = (s) => `rgba(${Math.round(120 + 135 * s)}, ${Math.round(160 + 49 * s)}, ${Math.round(200 - 98 * s)}, ${(0.45 + 0.5 * s).toFixed(2)})`;

  // ---------- state ----------
  // the telescopes picked; the last one picked is in focus: the view turns to it and it gets the horizon disk
  let picked = ["pone"], focus = TELESCOPES.pone;
  let hours = 7.5;   // sidereal time; TXS 0506+056 starts inside P-ONE's band
  let playing = false, visible = false, last = 0;
  let showNeutrinos = false, showConstellations = true, nuWindow = null;
  // Each view as a mix of a few numbers (sizes as fractions of the half-width), so switching can glide between them:
  // the Earth's and the sky's radius, how much of the sky shows, its near half, the Earth, and the sky's own glow
  const VIEWS = {
    earth: { earth: 0.633, sky: 0.98, aSky: 0, aFront: 0, aEarth: 1, glass: 0.45 },
    sky: { earth: 0.15, sky: 0.944, aSky: 1, aFront: 1, aEarth: 1, glass: 0.45 },
    inside: { earth: 0, sky: 0.985, aSky: 1, aFront: 0, aEarth: 0, glass: 1 },
  };
  let view = "earth", look = { ...VIEWS.earth };
  let rot = [0, 0];   // the view's rotation of the sky: [λ, φ] as d3 takes them
  let size = 0, H = 0, C = [0, 0], land = null, hoverTargets = [];

  // ---------- projections ----------
  // The near half of the sky through the front projection; the far half through the back one, mirrored, so that a
  // point keeps the same place on screen whether it is seen through the glass from outside or from the Earth's centre.
  const front = d3.geoOrthographic().clipAngle(90), back = d3.geoOrthographic().clipAngle(90).reflectX(true);
  const earthProjection = d3.geoOrthographic().clipAngle(90);   // the Earth's surface, turned by the sidereal time
  const frontPath = d3.geoPath(front, ctx), backPath = d3.geoPath(back, ctx), earthPath = d3.geoPath(earthProjection, ctx);
  const graticule = d3.geoGraticule10();
  let turn = d3.geoRotation([0, 0, 0]);
  const theta = () => hours * 15;

  // a direction on the sky, or a point in Earth radii, as screen-aligned X (right), Y (up), Z (toward the viewer)
  function at(lon, lat) {
    const [l, f] = turn([lon, lat]).map((d) => d * RAD);
    return { X: Math.cos(f) * Math.sin(l), Y: Math.sin(f), Z: Math.cos(f) * Math.cos(l) };
  }
  function atVec(v) {
    const r = Math.hypot(...v);
    if (r < 1e-9) return { X: 0, Y: 0, Z: 0 };   // the Earth's centre has no direction of its own
    const q = at(deg(Math.atan2(v[1], v[0])), deg(Math.asin(v[2] / r)));
    return { X: q.X * r, Y: q.Y * r, Z: q.Z * r };
  }
  const screen = (q, px) => [C[0] + px * q.X, C[1] - px * q.Y];
  // hidden by the Earth's near side: it projects onto the disc and lies behind the surface there
  const behind = (q) => { const s = q.X * q.X + q.Y * q.Y; return s < 1 && q.Z < Math.sqrt(1 - s); };
  const add = (a, b, k = 1) => a.map((v, i) => v + b[i] * k);
  const fromLonLat = (lon, lat) => [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD)];

  // a telescope's own directions where it is right now: up, north and east (at the poles, along the 0° meridian)
  function frame(t) {
    const lon = t.lon + theta(), up = fromLonLat(lon, t.lat), lo = lon * RAD, la = t.lat * RAD;
    const east = [-Math.sin(lo), Math.cos(lo), 0], north = [-Math.sin(la) * Math.cos(lo), -Math.sin(la) * Math.sin(lo), Math.cos(la)];
    return { up, east, north };
  }
  const dirAt = (f, az, el) => add(add(f.north.map((v) => v * Math.cos(el * RAD) * Math.cos(az)), f.east, Math.cos(el * RAD) * Math.sin(az)), f.up, Math.sin(el * RAD));
  // the ring of sky a telescope sees best: between its band's edges, as zenith angles round the point overhead
  function bandRing(t) {
    const circle = (r) => d3.geoCircle().center([wrap(t.lon + theta()), t.lat]).radius(r)().coordinates[0];
    return { type: "Polygon", coordinates: [circle(90 - band[1]), circle(90 - band[0]).reverse()] };
  }

  // ---------- the cones at each telescope, in 3D pieces sorted by depth ----------
  const DISK = 0.6, REACH = 0.8;   // the disk's and the upper cone's size, in Earth radii (drawn large, not to scale)
  const N = 64, PIECE = 8;          // segments round the circle, drawn in pieces of 8: few seams, but fine enough to sort
  // the lower cone runs back through the Earth along a chord of 2 sin δ Earth radii, to where its neutrinos go in
  const lowerReach = () => (band[1] < 0 ? 2 * Math.sin(-band[1] * RAD) : REACH);
  function cones(t, main) {
    const f = frame(t), o = f.up, out = [], c = t.color, alpha = main ? 1 : 0.6;
    const rim = (len, el, i0) => Array.from({ length: PIECE + 1 }, (_, k) => add(o, dirAt(f, (2 * Math.PI * (i0 + k)) / N, el), len));
    for (let i = 0; i < N; i += PIECE) {
      const top = rim(REACH, band[0], i), bottom = rim(lowerReach(), band[1], i);
      if (main) {
        const disk = rim(DISK, 0, i);
        out.push({ kind: "disk", pts: [o, ...disk], alpha }, { kind: "disk edge", pts: disk, line: true, alpha });
      }
      out.push({ kind: "band", pts: [o, ...top], c, alpha }, { kind: "band edge", pts: top, line: true, c, alpha });
      out.push({ kind: "band", pts: [o, ...bottom], c, alpha }, { kind: "band edge", pts: bottom, line: true, c, alpha });
      // a spoke from the telescope to each rim, so the band reads as a wedge from it at any angle
      out.push({ kind: "band edge spoke", pts: [o, top[0]], line: true, c, alpha }, { kind: "band edge spoke", pts: [o, bottom[0]], line: true, c, alpha });
    }
    return out;
  }
  // the band's directions carried out to the sky from the Earth's centre, and the Earth's axis out to the sky's poles
  function skyLines(t, skyR, alpha) {
    const f = frame(t), out = [], steps = (a, b) => Array.from({ length: 4 }, (_, k) => [a + ((b - a) * k) / 4, a + ((b - a) * (k + 1)) / 4]);
    for (let i = 0; i < N; i += PIECE)
      for (const el of band) {
        const d = dirAt(f, (2 * Math.PI * i) / N, el);
        for (const [r0, r1] of steps(1, skyR)) out.push({ kind: "ray", pts: [d.map((v) => v * r0), d.map((v) => v * r1)], line: true, c: t.color, alpha });
      }
    for (const [r0, r1] of steps(-skyR, skyR)) out.push({ kind: "axis", pts: [[0, 0, r0], [0, 0, r1]], line: true, alpha });
    return out;
  }
  function drawPieces(list, px, alpha) {
    for (const p of list) {
      const pts = p.q.map((q) => screen(q, px));
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.globalAlpha = alpha * p.alpha;
      if (!p.line) {
        ctx.closePath();
        ctx.fillStyle = p.kind === "disk" ? "rgba(232, 241, 248, .2)" : rgba(p.c, 0.24);
        ctx.fill();
        continue;
      }
      ctx.setLineDash(p.kind === "ray" ? [3, 4] : p.kind === "axis" ? [6, 5] : []);
      ctx.strokeStyle = p.kind === "disk edge" ? "rgba(232, 241, 248, .7)" : p.kind === "axis" ? "rgba(232, 241, 248, .55)" : p.c;
      ctx.lineWidth = p.kind === "ray" || p.kind.endsWith("spoke") ? 1 : 1.8;
      if (p.kind === "ray") ctx.globalAlpha *= 0.55;
      else if (p.kind.endsWith("spoke")) ctx.globalAlpha *= 0.6;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // ---------- labels and glyphs ----------
  function label(text, [x, y], color, dx = 10, dy = 4, font = "600 12px Inter, system-ui, sans-serif") {
    ctx.font = font;
    // a negative dx places the label left of the marker; also flip near the right edge so it is not cut off
    const flip = dx < 0 || x + dx + ctx.measureText(text).width > size - 4;
    dx = Math.abs(dx);
    ctx.textAlign = flip ? "right" : "left";
    const tx = flip ? x - dx : x + dx;
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(3, 11, 23, .85)";
    ctx.strokeText(text, tx, y + dy);
    ctx.fillStyle = color;
    ctx.fillText(text, tx, y + dy);
    ctx.textAlign = "left";
  }
  function glyph(kind, [x, y]) {
    const r = 7;
    ctx.fillStyle = "#e8f1f8";
    ctx.strokeStyle = "#030b17";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    const a = kind === "plus" ? 0 : Math.PI / 4;
    for (const t of [a, a + Math.PI / 2]) {
      ctx.moveTo(x - Math.cos(t) * r, y - Math.sin(t) * r);
      ctx.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r);
    }
    ctx.stroke();
  }

  // ---------- the drawing ----------
  // One half of the sky sphere. The far half (seen from inside, or through the glass) carries everything; the near
  // half only its grid, the rings, the galactic plane and the stars, faintly, so it does not hide the Earth.
  function drawSky(far, px, alpha) {
    const path = far ? backPath : frontPath, tels = picked.map((id) => TELESCOPES[id]);
    const onSide = (q) => (far ? q.Z < -0.02 : q.Z > 0.02), interactive = far && alpha > 0.5;
    ctx.save();
    ctx.globalAlpha = alpha;
    if (far) {
      const bg = ctx.createRadialGradient(C[0] - px * 0.3, C[1] - px * 0.3, px * 0.1, C[0], C[1], px);
      bg.addColorStop(0, "#1a2f5e");
      bg.addColorStop(1, "#040b1d");
      ctx.globalAlpha = alpha * look.glass;
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(C[0], C[1], px, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      // the Milky Way's real outline: each brighter step over the fainter ones, so the core glows most
      ctx.fillStyle = "rgba(185, 200, 255, .075)";
      for (const level of milkyWay) {
        ctx.beginPath();
        path(level);
        ctx.fill();
      }
    }
    ctx.strokeStyle = "rgba(157, 179, 198, .1)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    path(graticule);
    ctx.stroke();
    // the constellations' stick figures: the sky's coastlines, to find your way
    if (far && figures && showConstellations) {
      ctx.strokeStyle = "rgba(157, 179, 198, .38)";
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      path(figures);
      ctx.stroke();
    }
    // the real stars, sized by brightness and coloured by their colour index
    for (const s of stars) {
      const q = at(s.ra, s.dec);
      if (!onSide(q)) continue;
      const [x, y] = screen(q, px);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    // each telescope's band, as a ring round the point overhead (dashed for planned ones)
    for (const t of tels) {
      ctx.beginPath();
      path(bandRing(t));
      ctx.fillStyle = rgba(t.color, t.fill ?? (t.planned ? 0.08 : 0.16));
      ctx.fill();
      ctx.strokeStyle = rgba(t.color, 0.9);
      ctx.lineWidth = 1.4;
      if (t.planned) ctx.setLineDash([6, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // the galactic plane, dotted
    ctx.setLineDash([2, 5]);
    ctx.lineCap = "round";
    ctx.strokeStyle = "rgba(232, 241, 248, .85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    path(galacticPlane);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineCap = "butt";

    if (far) {
      if (showConstellations) {
        ctx.font = "500 10px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillStyle = "rgba(190, 205, 225, .6)";
        for (const c of constellationNames) {
          const q = at(c.ra, c.dec);
          if (!onSide(q)) continue;
          const [x, y] = screen(q, px);
          ctx.fillText(c.n.toUpperCase(), x, y);
        }
        ctx.textAlign = "left";
      }
      if (interactive)
        for (const b of brightStars) {
          const q = at(b.ra, b.dec);
          if (onSide(q)) { const [x, y] = screen(q, px); hoverTargets.push({ x, y, star: b }); }
        }
      const gc = at(GALACTIC_CENTER.ra, GALACTIC_CENTER.dec);
      if (onSide(gc)) {
        const p = screen(gc, px);
        ctx.fillStyle = "#e8f1f8";
        ctx.beginPath();
        ctx.arc(p[0], p[1], 6, 0, Math.PI * 2);
        ctx.fill();
        label("Galactic center", p, "rgba(232, 241, 248, .9)");
        if (interactive) hoverTargets.push({ x: p[0], y: p[1], tip: GALACTIC_CENTER.tip });
      }
      // IceCube's alert neutrinos, each at its best-fit direction: a ring, so it never reads as a star
      if (showNeutrinos)
        for (const n of neutrinos) {
          if (nuWindow && (n.e < nuWindow[0] || n.e > nuWindow[1])) continue;   // outside the chosen energy
          const q = at(n.ra, n.dec);
          if (!onSide(q)) continue;
          const [x, y] = screen(q, px);
          ctx.beginPath();
          ctx.arc(x, y, nuRadius(n.e), 0, Math.PI * 2);
          ctx.strokeStyle = "rgba(3, 11, 23, .75)";
          ctx.lineWidth = 3.2;
          ctx.stroke();
          ctx.strokeStyle = nuColor(n.s);
          ctx.lineWidth = 1.6;
          ctx.stroke();
          if (interactive) hoverTargets.push({ x, y, nu: n });
        }
      for (const s of SOURCES) {
        const q = at(s.ra, s.dec);
        if (!onSide(q)) continue;
        const p = screen(q, px);
        glyph(s.mark, p);
        label(s.name, p, "#e8f1f8", 11, -8);
        if (interactive) hoverTargets.push({ x: p[0], y: p[1], tip: s.tip });
      }
      // from inside: the point straight above each telescope, which the Earth's turning carries round the sky
      if (look.aEarth < 0.5)
        for (const t of tels) {
          const q = at(wrap(t.lon + theta()), t.lat);
          if (!onSide(q)) continue;
          const p = screen(q, px), [dx, dy] = t.labelAt ?? [10, 4];
          ctx.beginPath();
          ctx.arc(p[0], p[1], 5, 0, Math.PI * 2);
          ctx.lineWidth = 2;
          ctx.strokeStyle = t.planned ? t.color : "#030b17";
          ctx.fillStyle = t.color;
          if (!t.planned) ctx.fill();
          ctx.stroke();
          label(`Above ${t.name}`, p, t.color, dx, dy);
          if (interactive) hoverTargets.push({ x: p[0], y: p[1], site: t });
        }
    }
    ctx.restore();
  }

  function drawEarth(px, skyR) {
    const a = look.aEarth, tels = picked.map((id) => TELESCOPES[id]);
    // painter's order: far pieces first; those the Earth's near side hides go under it (and show faintly through it)
    const pieces = [...tels.flatMap((t) => cones(t, t === focus)), ...(focus && look.aSky > 0.01 ? skyLines(focus, skyR, look.aSky) : [])].map((s) => {
      const q = s.pts.map(atVec), mid = atVec(s.pts.reduce((m, p) => add(m, p, 1 / s.pts.length), [0, 0, 0]));
      // the band's rims always show, as if the Earth were glass, so the lower edge reads even deep inside the Earth
      return { ...s, q, z: mid.Z, hidden: behind(mid) && !(s.line && s.kind.startsWith("band edge")) };
    }).sort((p, q) => p.z - q.z);
    drawPieces(pieces.filter((p) => p.hidden), px, a * 0.55);

    ctx.save();
    ctx.globalAlpha = a * 0.84;   // a little see-through, so the band inside the Earth shows
    const ocean = ctx.createRadialGradient(C[0] - px * 0.3, C[1] - px * 0.4, px * 0.05, C[0], C[1], px * 1.05);
    ocean.addColorStop(0, "#1b5684");
    ocean.addColorStop(0.6, "#0d2f4d");
    ocean.addColorStop(1, "#04111f");
    ctx.fillStyle = ocean;
    ctx.beginPath();
    earthPath({ type: "Sphere" });
    ctx.fill();
    ctx.globalAlpha = a;
    ctx.strokeStyle = "rgba(157, 179, 198, .14)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    earthPath(graticule);
    ctx.stroke();
    if (land) {
      ctx.fillStyle = "rgba(157, 179, 198, .22)";
      ctx.strokeStyle = "rgba(157, 179, 198, .5)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      earthPath(land);
      ctx.fill();
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(157, 179, 198, .4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    earthPath({ type: "Sphere" });
    ctx.stroke();
    ctx.restore();

    drawPieces(pieces.filter((p) => !p.hidden), px, a);

    // the telescopes: the one in focus large, the others small; outlined if planned; faint when the Earth hides them
    ctx.save();
    for (const t of tels) {
      const q = atVec(frame(t).up), p = screen(q, px), main = t === focus, h = main ? 6 : 4;
      ctx.globalAlpha = a * (q.Z < 0 ? 0.35 : 1);
      ctx.lineWidth = main ? 2 : 1.5;
      if (t.planned) {
        ctx.strokeStyle = t.color;
        ctx.strokeRect(p[0] - h, p[1] - h, 2 * h, 2 * h);
      } else {
        ctx.fillStyle = t.color;
        ctx.strokeStyle = "#030b17";
        ctx.fillRect(p[0] - h, p[1] - h, 2 * h, 2 * h);
        ctx.strokeRect(p[0] - h, p[1] - h, 2 * h, 2 * h);
      }
      const [dx, dy] = main ? [14, -6] : t.labelAt ?? [10, 4];
      label(t.name, p, main ? "#e8f1f8" : "rgba(190, 205, 225, .85)", dx, dy, main ? "600 14px Inter, system-ui, sans-serif" : "600 11px Inter, system-ui, sans-serif");
      if (a > 0.5 && q.Z >= 0) hoverTargets.push({ x: p[0], y: p[1], site: t });
    }
    ctx.restore();
  }

  function render() {
    if (!size) return;
    ctx.clearRect(0, 0, size, size);
    hoverTargets = [];
    const earthPx = look.earth * H, skyPx = look.sky * H, skyR = skyPx / Math.max(earthPx, 0.5);   // inside, the Earth shrinks to nothing
    turn = d3.geoRotation([rot[0], rot[1], 0]);
    front.rotate([rot[0], rot[1], 0]).translate(C).scale(skyPx);
    back.rotate([rot[0] - 180, -rot[1], 0]).translate(C).scale(skyPx);
    earthProjection.rotate([rot[0] + theta(), rot[1], 0]).translate(C).scale(earthPx);

    if (look.aSky > 0.01) drawSky(true, skyPx, look.aSky);
    if (look.aEarth > 0.01 && earthPx > 0.5) drawEarth(earthPx, skyR);
    if (look.aSky * look.aFront > 0.01) drawSky(false, skyPx, look.aSky * look.aFront * 0.35);
    if (look.aSky > 0.01) {
      ctx.globalAlpha = look.aSky;
      ctx.strokeStyle = "rgba(157, 179, 198, .45)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(C[0], C[1], skyPx, 0, Math.PI * 2);
      ctx.stroke();
      if (look.aEarth > 0.01) {
        ctx.globalAlpha = look.aSky * look.aEarth;
        ctx.font = "600 11px Inter, system-ui, sans-serif";
        ctx.fillStyle = "rgba(157, 179, 198, .9)";
        ctx.textAlign = "right";
        ctx.fillText("THE SKY", C[0] - 0.74 * skyPx, C[1] - 0.74 * skyPx);
        ctx.textAlign = "left";
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---------- views ----------
  const viewButtons = [...fig.querySelectorAll("[data-sx-view]")];
  const HINTS = {
    earth: "Drag to turn the globe.",
    sky: "Drag to turn. The sky is fixed; the Earth turns inside it.",
    inside: "Drag to look around: the real stars and Milky Way. The rings sweep across the sky as the Earth turns.",
  };
  function setView(v) {
    view = v;
    fig.dataset.view = v;
    viewButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sxView === v)));
    fig.querySelectorAll("[data-for-view]").forEach((el) => (el.hidden = !el.dataset.forView.split(" ").includes(v)));
    hint.textContent = HINTS[v];
    tip.hidden = true;
    const from = { ...look }, to = VIEWS[v];
    if (reduceMotion) { look = { ...to }; render(); return; }
    const start = performance.now();
    (function glide(now) {
      const t = Math.min(1, (now - start) / 700), k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      for (const key in to) look[key] = from[key] + (to[key] - from[key]) * k;
      render();
      if (t < 1 && view === v) requestAnimationFrame(glide);
    })(start);
  }
  viewButtons.forEach((b) => b.addEventListener("click", () => b.dataset.sxView !== view && setView(b.dataset.sxView)));

  // the view of a telescope edge on, with it on the globe's rim (at the top, or for the far south at the bottom)
  const viewFor = (t) => [-(t.lon + theta()), t.lat >= 0 ? 90 - t.lat : -(t.lat + 90)];
  function goTo(t) {
    const to = viewFor(t), from = rot.slice();
    to[0] = from[0] + ((((to[0] - from[0]) % 360) + 540) % 360) - 180;   // the short way round
    if (reduceMotion) { rot = to; render(); return; }
    const glide = d3.interpolate(from, to), start = performance.now();
    (function step(now) {
      const t = Math.min(1, (now - start) / 800), k = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      rot = glide(k);
      render();
      if (t < 1) requestAnimationFrame(step);
    })(start);
  }
  fig.querySelector(".sx-reset").addEventListener("click", () => goTo(focus || TELESCOPES.pone));

  // ---------- telescopes: a button adds one (and turns the view to it) or takes it away; all can be taken away ----------
  const siteButtons = [...fig.querySelectorAll("[data-site]")];
  siteButtons.forEach((b) => b.addEventListener("click", () => {
    const id = b.dataset.site;
    if (!picked.includes(id)) picked.push(id);
    else picked = picked.filter((p) => p !== id);
    siteButtons.forEach((o) => o.setAttribute("aria-pressed", String(picked.includes(o.dataset.site))));
    const was = focus;
    focus = picked.length ? TELESCOPES[picked[picked.length - 1]] : null;   // none picked: the bare Earth and sky
    if (focus) fig.style.setProperty("--c", focus.color);   // the band's swatch in the key
    if (focus && focus.id === id && focus !== was && view !== "inside") goTo(focus);
    else render();
  }));

  // ---------- sidereal time: the Earth turning inside the fixed sky, one sidereal day in 20 s ----------
  const timeIn = fig.querySelector("#sx-time"), timeOut = fig.querySelector(".sx-time output"), playBtn = fig.querySelector(".sx-play");
  function setHours(h) {
    hours = (h + 24) % 24;
    timeIn.value = hours.toFixed(2);
    const hh = Math.floor(hours), mm = Math.floor((hours - hh) * 60);
    timeOut.textContent = `${String(hh).padStart(2, "0")}h ${String(mm).padStart(2, "0")}m`;
  }
  function setPlaying(p) {
    playing = p;
    playBtn.textContent = p ? "Pause" : "Play a day";
    playBtn.setAttribute("aria-pressed", String(p));
    if (p) loop();
  }
  timeIn.addEventListener("input", () => { setHours(Number(timeIn.value)); setPlaying(false); render(); });
  playBtn.addEventListener("click", () => setPlaying(!playing));
  let frameQueued = false;
  function loop() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame((now) => {
      frameQueued = false;
      const dt = last ? Math.min(now - last, 100) : 0;
      last = now;
      if (playing && visible) {
        setHours(hours + (dt / 1000) * 1.2);
        render();
        loop();
      } else last = 0;
    });
  }

  // ---------- energy: the band at one energy, or the published band for the E^-2 mix ----------
  const energyIn = fig.querySelector("#sx-energy"), energyOut = fig.querySelector(".sx-energy output");
  const figureBtn = fig.querySelector(".sx-published"), edgesOut = fig.querySelector(".ef-edges");
  const nuCount = fig.querySelector(".nu-count");
  function countNeutrinos() {
    if (!nuCount || !neutrinos.length) return;
    const n = nuWindow ? neutrinos.filter((x) => x.e >= nuWindow[0] && x.e <= nuWindow[1]).length : neutrinos.length;
    nuCount.textContent = nuWindow
      ? `${n} of ${neutrinos.length} at ${NB.format(nuWindow[0])} to ${NB.format(nuWindow[1])}${n ? "" : " (IceCube’s alerts start at 54 TeV)"}`
      : `all ${neutrinos.length}, 54 TeV to 7 PeV`;
  }
  // the live numbers in the equations under "Why the band sits near the horizon" (at the slider's energy)
  const mathOut = (key, text) => document.querySelectorAll(`[data-math="${key}"]`).forEach((el) => (el.textContent = text));
  function showMath() {
    mathOut("E", NB.format(tev));
    mathOut("up", `${Math.round(NB.upperEdge(tev))}°`);
    mathOut("L", NB.absorption(tev).toFixed(2));
    mathOut("low", `${Math.round(-NB.lowerEdge(tev))}°`);
    // the diagram in the same drawer: the band's two edges, as rays out from the telescope on both sides
    const diagram = document.querySelector(".fd-diagram");
    if (diagram) {
      const T = [300, 185], r = 230, ray = (deg, side) => [T[0] + side * r * Math.cos(deg * RAD), T[1] - r * Math.sin(deg * RAD)];
      const up = NB.upperEdge(tev), low = NB.lowerEdge(tev), pt = (q) => q.map((v) => v.toFixed(1)).join(" ");
      const [uL, uR, lL, lR] = [ray(up, -1), ray(up, 1), ray(low, -1), ray(low, 1)];
      diagram.querySelector(".fd-band").setAttribute("d", `M${pt(T)} L${pt(uL)} L${pt(lL)} Z M${pt(T)} L${pt(uR)} L${pt(lR)} Z`);
      diagram.querySelector(".fd-edge.up").setAttribute("d", `M${pt(uL)} L${pt(T)} L${pt(uR)}`);
      diagram.querySelector(".fd-edge.low").setAttribute("d", `M${pt(lL)} L${pt(T)} L${pt(lR)}`);
      const place = (el, q, dy) => { el.setAttribute("x", (q[0] + 8).toFixed(1)); el.setAttribute("y", Math.min(Math.max(q[1] + dy, 14), 352).toFixed(1)); };
      place(diagram.querySelector(".fd-label.up"), uR, -4);
      place(diagram.querySelector(".fd-label.low"), lR, 14);
    }
  }
  function describeBand() {
    showMath();
    const up = Math.round(band[0]), down = Math.round(-band[1]);
    edgesOut.querySelector(".ef-span").innerHTML = `The band runs from <b>${up ? `${up}° above` : "the horizon"}</b> to
      <b>${down}° below</b> the horizon. Its neutrinos enter the Earth within <b>${(Math.round((2 * down * 111.2) / 100) * 100).toLocaleString("en-US")} km</b>
      (${Math.round(2 * down)}° of arc) of the telescope.`;
    // why the band sits where it does at this energy: which filter matters most
    edgesOut.querySelector(".ef-why").textContent = published
      ? "This is the published band: not for one energy, but for a typical cosmic source’s neutrinos, which span many energies, with ever fewer at higher ones (a spectrum falling as E⁻²). Move the slider to see the band at a single energy."
      : tev < 100
        ? "Why here: at low energies the Earth is nearly transparent, so neutrinos get through even on long paths deep below the horizon. Above the horizon, they are drowned out by muons, which are at their most numerous at these energies."
        : tev < 3000
          ? "Why here: long paths through the Earth now stop many neutrinos, so the band narrows toward the horizon. Just above it, neutrinos this energetic are starting to stand out from the muons."
          : "Why here: the Earth stops most neutrinos except on short paths just below the horizon. But muons this energetic are rare, so the telescope can look well above the horizon, and the band tilts upward.";
  }
  function useEnergy(e) {
    tev = e;
    band = NB.edges(e);
    published = false;
    nuWindow = [e / 2, e * 2];
    energyOut.textContent = NB.format(e);
    figureBtn.setAttribute("aria-pressed", "false");
    countNeutrinos();
    describeBand();
    render();
  }
  function usePublished() {
    tev = PUBLISHED_TEV;
    energyIn.value = NB.toSlider(PUBLISHED_TEV);   // the slider at 1 PeV, the single energy whose band comes closest
    band = PUBLISHED.slice();
    published = true;
    nuWindow = null;
    energyOut.textContent = "all energies";
    figureBtn.setAttribute("aria-pressed", "true");
    countNeutrinos();
    describeBand();
    render();
  }
  energyIn.addEventListener("input", () => useEnergy(NB.fromSlider(energyIn.value)));
  figureBtn.addEventListener("click", usePublished);

  // ---------- layers ----------
  const nuBox = fig.querySelector('[data-layer="neutrinos"]'), conBox = fig.querySelector('[data-layer="constellations"]');
  showNeutrinos = nuBox.checked;
  showConstellations = conBox.checked;
  nuBox.addEventListener("change", () => { showNeutrinos = nuBox.checked; render(); });
  conBox.addEventListener("change", () => { showConstellations = conBox.checked; render(); });

  // ---------- dragging, and the explanation for whatever is under the pointer ----------
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, rot: rot.slice() };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* a pointer that cannot be captured still drags */ }
    canvas.classList.add("dragging");
  });
  function showTipAt(e) {
    const box = canvas.getBoundingClientRect(), x = e.clientX - box.left, y = e.clientY - box.top;
    // the nearest marker within reach (neutrinos lie thick in places); named markers win a near tie
    let hit = null, best = 14;
    for (const t of hoverTargets) {
      const d = Math.hypot(t.x - x, t.y - y) - (t.tip || t.site ? 4 : 0);
      if (d < best) { best = d; hit = t; }
    }
    canvas.classList.toggle("over-marker", Boolean(hit));
    if (!hit) { tip.hidden = true; return; }
    tip.innerHTML = hit.nu ? neutrinoTip(hit.nu) : hit.star ? starTip(hit.star) : hit.site ? siteTip(hit.site)
      : document.getElementById(hit.tip).innerHTML;
    tip.hidden = false;
    // keep the tip inside the stage: open toward the side with more room
    tip.style.left = `${hit.x < size / 2 ? hit.x + 18 : hit.x - 18 - tip.offsetWidth}px`;
    tip.style.top = `${Math.min(Math.max(hit.y - 20, 0), size - tip.offsetHeight)}px`;
  }
  const neutrinoTip = (n) => `<strong>${n.n}: an IceCube alert neutrino</strong>
    Seen ${new Date(n.d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}.
    Most probable energy ${NB.format(n.e)}; a ${Math.round(n.s * 100)}% chance it came from space rather than from cosmic rays
    hitting the atmosphere. Its direction is known to within about ${Math.max(...n.err).toFixed(1)}° (90% confidence).`;
  const starTip = (b) => `<strong>${b.n}</strong>
    A star in ${b.c}, at magnitude ${b.m.toFixed(1)}${b.m < 0 ? ", one of the very brightest in the night sky" : ""}.`;
  const siteTip = (t) => `<strong>${t.name}${t.planned ? " (planned)" : ""}</strong>
    ${SITE_TIPS[t.id] || ""} ${view === "inside"
      ? "The dot marks the point of the sky straight above it right now. It sees best in the ring of sky about 90° from here, near its horizon, which sweeps round as the Earth turns."
      : "It sees best in a band of directions near its horizon: the cones drawn from it."}`;
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) { showTipAt(e); return; }
    tip.hidden = true;
    const k = 180 / size;
    rot = [drag.rot[0] + (e.clientX - drag.x) * k, Math.max(-90, Math.min(90, drag.rot[1] - (e.clientY - drag.y) * k))];
    render();
  });
  const endDrag = (e) => {
    // a tap without movement (e.g. on a touch screen) opens the explanation for the marker under it
    if (drag && e.type === "pointerup" && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 5) showTipAt(e);
    drag = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => (tip.hidden = true));

  // ---------- size, start, data ----------
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    size = canvas.offsetWidth;
    H = size / 2;
    C = [H, H];
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    render();
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && playing) loop();
  }).observe(canvas);
  window.addEventListener("resize", resize);

  setHours(hours);
  rot = viewFor(focus);
  fig.style.setProperty("--c", focus.color);
  setView("earth");
  usePublished();
  resize();

  fetch("https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json")
    .then((r) => r.json())
    .then((topo) => { land = topojson.feature(topo, topo.objects.land); render(); })
    .catch(() => {});   // an ocean without coastlines, if they cannot load

  // assets/data/sky-catalogs.js carries the same data for pages opened from disk, where fetch() is blocked
  (window.SKY_CATALOGS ? Promise.resolve(window.SKY_CATALOGS) : fetch("assets/data/sky-catalogs.json").then((r) => r.json()))
    .then((data) => {
      stars = data.stars.filter((s) => s[2] <= STAR_LIMIT).map(([ra, dec, mag, bv]) => {
        const [cr, cg, cb] = bvColor(bv);
        return { ra: wrap(ra), dec, r: Math.max(0.4, 2.4 - 0.38 * mag), color: `rgba(${cr}, ${cg}, ${cb}, ${Math.max(0.3, Math.min(1, 1.05 - mag / 6.5)).toFixed(2)})` };
      });
      milkyWay = placeMilkyWay(data.milkyway);
      figures = { type: "MultiLineString", coordinates: data.constellations.flatMap((c) => c.lines.map((line) => line.map(([ra, dec]) => [wrap(ra), dec]))) };
      constellationNames = data.constellations.filter((c) => c.r === 1).map((c) => ({ n: c.n, ra: wrap(c.at[0]), dec: c.at[1] }));
      brightStars = data.brightstars.map(([n, c, ra, dec, m]) => ({ n, c, m, ra: wrap(ra), dec }));
      neutrinos = data.neutrinos;
      countNeutrinos();
      render();
    })
    .catch(() => {});   // a sky with only its grid, the bands and the sources, if the data cannot load
})();
