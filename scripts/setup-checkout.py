#!/usr/bin/env python3
"""Configure this checkout only, after verifying the personal account."""
import json
import subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
def run(*args):
    return subprocess.check_output(args,cwd=ROOT,text=True).strip()
if run('git','remote','get-url','origin') != 'https://github.com/felixchenyijun/explainers.git':
    raise SystemExit('Unexpected origin; only felixchenyijun/explainers is allowed.')
user=json.loads(run(str(ROOT/'scripts/gh-personal'),'api','user'))
run('git','config','user.name','Felix Chen')
run('git','config','user.email',f'{user["id"]}+felixchenyijun@users.noreply.github.com')
run('git','config','--replace-all','credential.https://github.com.helper','')
run('git','config','--add','credential.https://github.com.helper','!'+str(ROOT/'scripts/git-credential-personal'))
run('git','config','core.hooksPath','scripts/hooks')
print('Configured personal author, credential helper and pre-push account check for this checkout.')
