from pathlib import Path
import json
import spiceypy as spice
root=Path(__file__).resolve().parent
spice.furnsh(str(root/'data/cache/pck00011.tpc'))
cat=json.loads((root/'public/data/catalog.json').read_text())
models={}; refs={}
def get(key):
 try:return spice.gdpool(key,0,1000).tolist()
 except spice.utils.exceptions.NotFoundError:return None
for b in cat['bodies']:
 ident=b['id']; prefix='BODY'+ident+'_'; ra=get(prefix+'POLE_RA')
 if not ra:continue
 system=str(int(ident)//100) if int(ident)>99 else ident
 degree=get('BODY'+system+'_MAX_PHASE_DEGREE') or [1]
 models[ident]={'ra':ra,'dec':get(prefix+'POLE_DEC'),'pm':get(prefix+'PM'),
  'raTerms':get(prefix+'NUT_PREC_RA') or [],'decTerms':get(prefix+'NUT_PREC_DEC') or [],'pmTerms':get(prefix+'NUT_PREC_PM') or [],
  'angles':get('BODY'+system+'_NUT_PREC_ANGLES') or [],'angleSize':int(degree[0])+1,'radii':get(prefix+'RADII')}
 refs[ident]=[]
 for jd in [2461041.5,2461200.25,2461405.5]:
  mat=spice.tipbod('J2000',int(ident),(jd-2451545)*86400).T
  refs[ident].append({'jd':jd,'matrix':mat.tolist()})
(root/'public/data/orientation.json').write_text(json.dumps(models,separators=(',',':')))
(root/'data/orientation-reference.json').write_text(json.dumps(refs))
print('Exported',len(models),'IAU orientation models and independent SPICE reference matrices')
