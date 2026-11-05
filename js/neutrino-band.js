// The band of directions a neutrino telescope sees best, at one neutrino energy, for the sky figure on the Sky & network
// page (sky-explorer.js).
//   lower edge: how far below the horizon half of the neutrinos still get through the Earth. From the page's absorption
//     figures (straight up through the Earth, 2 Earth radii of rock, under 20% get across at 100 TeV and 5% at 1 PeV),
//     fitted as a power law in energy; a path δ below the horizon crosses 2 sin δ Earth radii of rock.
//   upper edge: how far above the horizon the telescope can still pick neutrinos out from the muons of the atmosphere.
//     A rough model, not data: at the horizon up to 100 TeV, then 20° higher for every factor of 10 in energy (10° at
//     1 PeV, the published band's edge).
// The energy slider's positions (0 to 300) map to 10 TeV × 10^(position / 100): 10 TeV to 10 PeV, 200 = 1 PeV.
(function () {
  const L100 = 2 / Math.log(5), L1000 = 2 / Math.log(20), SLOPE = Math.log10(L100 / L1000);
  const deg = (r) => (r * 180) / Math.PI;
  // the length (Earth radii) over which the Earth stops all but 1/e of the neutrinos at this energy
  const absorption = (tev) => L100 * Math.pow(tev / 100, -SLOPE);
  const lowerEdge = (tev) => -deg(Math.asin(Math.min(1, (absorption(tev) * Math.LN2) / 2)));
  const upperEdge = (tev) => Math.max(0, Math.min(45, 10 + 20 * Math.log10(tev / 1000)));
  window.NeutrinoBand = {
    absorption, lowerEdge, upperEdge,
    fromSlider: (v) => 10 * Math.pow(10, v / 100),
    toSlider: (tev) => 100 * Math.log10(tev / 10),
    format: (e) => (e >= 1000 ? `${+(e / 1000).toFixed(e >= 9950 ? 0 : 1)} PeV` : `${Math.round(e)} TeV`),
    // elevation edges [upper, lower], degrees above the horizon
    edges: (tev) => [upperEdge(tev), lowerEdge(tev)],
    announce: (tev, from) => document.dispatchEvent(new CustomEvent("neutrino-energy", { detail: { tev, from } })),
  };
})();
