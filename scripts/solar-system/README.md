# Solar Atlas

Three.js solar-system explorer with a floating origin, actual kilometer geometry,
searchable camera checkpoints, local orbit guides and reversible time.

Live: https://felixchenyijun.github.io/explainers/solar-system/

## Build the exact published data snapshot

Use Node.js 20 or newer. From this directory:

```sh
npm ci
npm run restore-assets
npm test
npm run build
python3 -m http.server 8768 --directory dist --bind 127.0.0.1
```

Visit `http://127.0.0.1:8768/`. Runtime assets are entirely local. The published
data and textures live in `../../docs/solar-system/`; `restore-assets` copies
them into the ignored working directory, avoiding duplicate binary history.

## What is physically scaled

Body radii, ellipsoid axes, moon separations, heliocentric positions and ring
dimensions all use kilometers. Every frame subtracts a double-precision local
origin before converting to GPU floats. The render unit changes with camera
range, with the identical conversion applied to objects and distances. No planet
size multiplier or logarithmic distance compression is used. The depth buffer is
logarithmic; space itself is not.

Screen-sized navigation markers, distant planet lights, labels, orbit strokes,
motion tails and stars are overlays. Distant planets retain their geometric sky
direction and approximate colors without requiring name labels; their point
brightness is enhanced, not photometrically calibrated.
They can be disabled. Unmeasured moon sizes have markers only. Exaggerated fill
light and ring opacity are disclosed in the viewer.

## Scientific coverage and limits

- Sun, eight planets, Pluto and all 460 moons in the JPL satellite catalog fetched
  September 29, 2026: Jupiter 115, Saturn 291, Uranus 30, Neptune 16, Pluto 5, Mars 2,
  Earth 1. The dated catalog is not a claim of discovery completeness forever.
- JPL Horizons supplies 468 geometric trajectories: nine planet/dwarf bodies and
  459 moons. Daphnis is catalog-only because its source kernel ends in 2018.
- The simulation is bounded to January 1–December 31, 2026. Positions use cubic
  Hermite interpolation in TDB from J2000 ecliptic position/velocity vectors.
  Planets are sampled every three hours. Moon sampling is period/60, shortened
  for eccentricity, clamped between five minutes and six hours. Short-period
  moons at the five-minute floor can exceed period/60.
- 61 IAU body-orientation models from NAIF pck00011 include pole directions,
  prime-meridian rotation and periodic terms. Earth/Moon models are approximate
  IAU rotations, not high-precision Earth orientation or libration kernels.
- 39,032 displayed small bodies come from SBDB. Their osculating elements use
  two-body Kepler propagation, so they do not have Horizons-level accuracy.
  The raw source contains one extra Pluto row, deliberately deduplicated.
- Selected planet and moon orbit strokes remain highlighted at close range. A
  dense local section is centered on the actual current state, avoiding coarse
  whole-orbit chords and GPU precision loss. Orbit strokes are osculating ellipse guides. Actual planet/moon motion uses the
  integrated Horizons source and does not remain on one fixed ellipse.
- Fading motion tails use the same parent-relative trajectory as the body and
  reverse with time direction. History is bounded by the 2026 dataset. The small
  body catalog uses shorter two-segment Kepler tails; selected objects use denser
  curves. Tail length adapts to camera range without altering the orbit or size.
- Ring extents and major gaps use NASA/PDS dimensions. Annuli omit eccentricity,
  arcs, vertical structure, individual particles and transient waves.
- Solar prominence loops, corona, procedural surfaces and the Oort distribution
  are illustrations. They are not current or historical weather observations.
- Small-body satellites, spacecraft, every meteoroid and every dust grain are
  outside this dataset. Static cloud maps do not model atmospheric winds.

## Validation

`npm test` checks full date coverage and finite values for every trajectory,
independent SPICE orientation matrices, retrograde spin, Kepler propagation,
orbit scale and reversible evaluation without integration drift.

It also compares interpolation against 161 independently requested Horizons
midpoints across 23 bodies and seven times throughout 2026. The measured maximum
was 0.402941 km; tested planet/dwarf positions were within 0.01 km. These are
sampled checks, not global error guarantees. The maximum rotation-matrix element
discrepancy from SPICE was 4.21e-11.

Reference samples are committed under `data/`. `verify_ephemerides.py` regenerates
the independent position references; `prepare_orientation.py` regenerates the
orientation models and SPICE matrices. `tests/physics.test.mjs` consumes them.

## Refreshing upstream data

This is intentionally a separate, potentially long operation. Install Python
packages `requests beautifulsoup4 numpy spiceypy`, then save these sources into
the ignored `data/cache/` directory:

- `moon-elements.html`: https://ssd.jpl.nasa.gov/sats/elem/
- `moon-physical.html`: https://ssd.jpl.nasa.gov/sats/phys_par/
- `pck00011.tpc`: https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/pck00011.tpc

Run `python3 fetch_data.py`, `python3 prepare_orientation.py`, then
`python3 verify_ephemerides.py`. API calls are serialized in accordance with JPL's
fair-use guidance. Cached queries are reused. A new snapshot requires checking
the catalog census, timeline, captions, source date and validation tolerances;
these should never be silently adjusted to make tests pass.

## Assets and publication

`THIRD-PARTY-NOTICES.txt` accompanies the bundle. Three.js is MIT licensed. Solar
System Scope / INOVE maps are CC BY 4.0. Twenty additional maps come from NASA
3D Resources / JPL; their precise URLs are in `data/nasa-texture-sources.json`.
The app includes credits and explains enhanced colors and reconstructed map gaps.

Copy the reviewed `dist/` contents to `../../docs/solar-system/`, then follow
the repository's personal-account publishing instructions. Do not publish raw
API caches, local evidence directories or browser state.
