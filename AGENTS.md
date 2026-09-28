# Publishing this collection

Felix explicitly selected his personal GitHub account for this project.

- The only repository is `felixchenyijun/explainers`.
- The only public site is `https://felixchenyijun.github.io/explainers/`.
- Never create, upload or push these explainers using `felix-chen-zip` or any company account. A personal commit email alone is not authentication.
- Use `scripts/gh-personal` for GitHub CLI operations. It isolates authentication in `~/.config/gh-felixchenyijun`, ignores ambient token variables and verifies `/user` is exactly `felixchenyijun`.
- Put reviewed public files in `docs/<slug>/index.html`. Keep each existing route stable. Source originals outside `docs` are ignored intentionally and can include unpublished versions.
- Add the entry to `catalog.json`, then run `python3 scripts/build-index.py` and `python3 scripts/check-site.py`.
- Run a desktop/mobile browser check, including important controls and any media, before publishing. Never substitute a prose report for observed behavior.
- Stage only the files you changed. After validation, commit promptly and run `python3 scripts/publish.py`; it serializes publication and checks the account, origin and tracked paths before pushing. If main moved, integrate the other task's changes without overwriting them; do not force-push.
- GitHub Pages serves `main:/docs`. Verify the live URLs after deployment before reporting or pinging success.
- Review new public content for credentials, company/customer data, internal links and third-party asset redistribution restrictions. Do not include internal artifact directories, private evidence, transcripts, credentials or browser profiles.
- Preserve the user's active app, window, keyboard focus and macOS Space. Use background/headless tools.
- Do not alter the user's global GitHub login or global Git configuration.

Public inference videos are silent/captioned copies. The local narrated originals use macOS System Voices and are deliberately excluded from public distribution. Keep the Three.js MIT notice with the interactive inference bundle.
