# Explainers

Interactive educational explainers by Felix Chen.

**Site:** https://felixchenyijun.github.io/explainers/

The public collection includes Small Worlds—a series of six playable stories about incentives, networks, queues, voting, shared resources and social learning—as well as the jagged AI frontier, inference, GPUs and TPUs, physical AI, operating systems, Kubernetes, Lean and gene-centered evolution. Each page contains its assumptions, research dates and references.

## Publish

Only the personal account **felixchenyijun** may publish this repository. The GitHub Pages source is `main:/docs`.

1. Place a reviewed self-contained explainer at `docs/<slug>/index.html` and add its metadata to `catalog.json`.
2. Run `python3 scripts/build-index.py` and `python3 scripts/check-site.py`, then check the actual page in desktop and mobile browsers.
3. Stage the intended files, commit and run `python3 scripts/publish.py`. Verify the live Pages links before sharing.

`scripts/gh-personal` uses a separate GitHub CLI configuration at `~/.config/gh-felixchenyijun` and checks the authenticated account. To authenticate that configuration, use:

```sh
env -u GH_TOKEN -u GITHUB_TOKEN GH_CONFIG_DIR="$HOME/.config/gh-felixchenyijun" gh auth login --hostname github.com --git-protocol https --web
```

Configure this checkout to use the personal credential helper (without changing global Git settings):

```sh
python3 scripts/setup-checkout.py
```

The source originals from local experiments are outside the publication tree and intentionally ignored. The public inference video series has captions and no audio; narrated local originals are excluded. The inference interactive bundle includes Three.js and its full MIT notice.

No repository-wide reuse license has been selected. Preserve the included third-party notices.

## Integrating independently reviewed pages

For parallel authoring, keep each draft and its evidence in a separate ignored job directory. Use `scripts/publish-explainer.py` to serialize changes to the shared catalog and index:

```sh
python3 scripts/publish-explainer.py /path/to/job/ready.json --dry-run
python3 scripts/publish-explainer.py /path/to/job/ready.json
```

The manifest contains `slug`, `title`, `category`, `description`, `format`, an optional `note`, the absolute `source` path and its `source_sha256`. Its `review` object names absolute paths to inspected `desktop`, `mobile`, `recording` and `checks` files inside the same job directory. The checks JSON must identify the same `source_sha256` and record the actual validation and editorial review.

The helper verifies the personal account, reviewed source identity, clean checkout and unused route. It fast-forwards main, integrates only the page/catalog/index, validates them, commits and invokes the existing personal publisher. Identical retries are safe; different content at an existing route is refused by default. It does not establish editorial quality or that Pages is live. Verify the deployed bytes and actual desktop/mobile interactions, and capture evidence against the resulting commit before reporting completion.

For an independently reviewed correction, the coordinator can add `--replace-sha256 <current-published-page-sha256>` to both commands above. The helper checks that hash after fetching under the integration lock, preserves the route's catalog position, and refuses a stale or missing page. Fresh source review and final-commit evidence are still required; an identical retry after a committed update remains safe.

Publication integration tests run entirely against temporary local Git repositories:

```sh
python3 scripts/test_publish_explainer.py -v
```
