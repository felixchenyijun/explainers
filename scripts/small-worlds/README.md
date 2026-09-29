# Small Worlds

Six original playable explanations, inspired by the predict/play/revise structure of Nicky Case's *The Evolution of Trust*. All art is original inline SVG. Each generated page is standalone and makes no runtime network requests.

Build: `python3 scripts/small-worlds/build.py`

Validate mathematical behavior: `node scripts/small-worlds/models.test.js`

Publication validation: `python3 scripts/check-site.py`

The models are educational idealizations. Model assumptions and primary sources are included in each game. Player progress stays in the browser; no telemetry is collected. Completion is not a claim of measured learning efficacy.

Browser validation (start `python3 -m http.server 8765 --bind 127.0.0.1 --directory docs` first):

- `python3 scripts/small-worlds/playtest.py`: all 42 story scenes, completion, saved progress, sandbox entry/return, unique DOM IDs, and overflow.
- `SW_WIDTH=390 SW_SESSION=small-worlds-mobile python3 scripts/small-worlds/playtest.py`: the same full flows on a narrow viewport.
- `SW_ALTERNATE=1 SW_SESSION=small-worlds-alternate python3 scripts/small-worlds/playtest.py`: alternate predictions and incorrect transfer answers.
- `SW_SESSION=small-worlds-sandbox python3 scripts/small-worlds/sandbox-test.py`: controls, edge cases, counterexamples, WCAG A/AA automated checks, and external runtime request checks.

For recordings, use the real story controls with motion enabled. Tests use the visible motion switch for fast deterministic traversal; that does not replace normal-animation testing or visual inspection. Model tests cover conservation, equilibrium, exact queue schedules, ballot transfers and ties, ecological limits, and Bayesian evidence accounting.
