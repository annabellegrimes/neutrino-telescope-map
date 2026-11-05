# Neutrino telescopes of the world

Two interactive figures about where the world's neutrino telescopes are, and which part of the sky each one sees best.

**Live:** [annabelle-grimes.com/telescopes](https://annabelle-grimes.com/telescopes/)

## What's here

- **Telescope globe** ([js/scopes-globe.js](js/scopes-globe.js)): a turnable globe beside cards for P-ONE, IceCube, KM3NeT, Baikal-GVD, ANTARES, TRIDENT and HUNT/NEON. Hovering a card flies the globe to that telescope.
- **Sky explorer** ([js/sky-explorer.js](js/sky-explorer.js)): one 3D scene in three views (Earth; Earth and sky; sky from inside), showing each telescope's band of best directions at a chosen neutrino energy, the real stars, the Milky Way, constellations, and IceCube's public alert neutrinos.
- **The band model** ([js/neutrino-band.js](js/neutrino-band.js)): a simple illustration of the band's two edges versus energy (Earth absorption below the horizon, atmospheric muons above it). It isn't a simulation, and it isn't P-ONE's measured sensitivity. The equations and assumptions are explained on the page.

It's plain HTML, CSS and JavaScript, with [D3](https://d3js.org/) and [topojson-client](https://github.com/topojson/topojson-client) loaded from a CDN. There's no build step.

## Running it locally

The sky data is loaded with `fetch()`, so serve the folder rather than opening the file directly:

```
python -m http.server 8000
```

Then open <http://localhost:8000/>.

## Data and credits

- **Published sky bands:** L. Schumacher et al., "PLEνM: A global and distributed monitoring system of high-energy astrophysical neutrinos", PoS(ICRC2021)1185, [arXiv:2107.13534](https://arxiv.org/abs/2107.13534)
- **IceCube alert neutrinos:** [IceCat-1](https://doi.org/10.7910/DVN/SCRUCD), IceCube Collaboration, ApJS 269, 25
- **Stars:** [XHIP](https://cdsarc.cds.unistra.fr/viz-bin/cat/V/137D), Anderson & Francis 2012
- **Milky Way outline:** [Milky Way Outline Catalog](http://www.skymap.com/milkyway_cat.htm), J. R. Vieira
- **Constellations:** [IAU](https://www.iau.org/public/themes/constellations/)
- The stars, Milky Way and constellations are packaged by [d3-celestial](https://github.com/ofrohn/d3-celestial) © Olaf Frohn (BSD licence, see [assets/data/LICENSE-d3-celestial.txt](assets/data/LICENSE-d3-celestial.txt))
- **Coastlines:** [Natural Earth](https://www.naturalearthdata.com/) via [world-atlas](https://github.com/topojson/world-atlas)

Further physics references (neutrino cross-sections, Earth absorption, Earth density, muon range) are listed on the page.

## Author

[Annabelle Grimes](https://annabelle-grimes.com), PhD candidate, Simon Fraser University
