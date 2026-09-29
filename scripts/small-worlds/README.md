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

Character and sound layer: `feel.js` handles gentle synthesized effects and continuous SVG animation phases. Effects default to off, remember an explicit choice across games, and create an AudioContext only after a user gesture. There is no background music or external audio asset. Turning sound off stops scheduled notes; hiding the page pauses simulations and sound. The motion control and OS reduced-motion preference suppress decorative motion.

The café uses a continuous clock and stable customer identities, with per-barista four-minute progress, exact arrival ticks, ten-minute arrival totals, an event-accurate queue plot, and a shared playhead. Slow/fast playback, pause, event stepping, and a whole-day shortcut make the causal sequence inspectable. Its chart and picture use the same simulated customer schedule. The final view stays at closing time, rather than jumping back to the busiest minute.

`python3 scripts/small-worlds/feel-test.py` checks the new café controls, exact service/recovery gap, customer conservation, graph totals, actual Web Audio signal/muting, preference persistence, no autoplay, and motion accessibility through real browser controls. It launches its own muted-output headless browser so testing does not play sounds on the desktop.

Each interactive chapter has a **Restart chapter** action that stops playback and clears only that chapter’s decisions. It preserves the unlocked chapters, other answers, and sound/motion preferences. The sandbox action resets only its parameters. Whole-story restart remains a separately labeled, confirmed action.

The social-learning game includes an optional mathematical walkthrough after predictions: probability bars, an inspectable per-person evidence ledger, both possible private-clue decisions, and exact Bayesian likelihoods. It distinguishes each person's private posterior from an observer's public posterior. The same explanation follows sandbox changes and clue sharing. The full derivation states conditional independence, equal priors, signal quality, and the own-clue tie rule. Model validation independently conditions all 512 weighted jar/clue worlds at every decision, for both communication modes, and checks the story's 4/5 versus 1/17 posterior calculations.

`SW_BASE=http://127.0.0.1:8765 python3 scripts/small-worlds/rumor-math-test.py` plays the odds walkthrough, counterfactual branches, tie rule, clue sharing, exact likelihoods, reorderings, and sandbox changes on desktop and phone.
