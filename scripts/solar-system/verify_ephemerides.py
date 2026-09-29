"""Fetch independent midpoint samples to measure interpolation error, serially."""
from pathlib import Path
import json,gzip,struct,math
from fetch_data import api
root=Path(__file__).resolve().parent
catalog=json.loads((root/'public/data/catalog.json').read_text())
centers={b['name']:b['id'] for b in catalog['bodies'] if b['type']!='moon'}
results=[]
for ident in ['199','299','399','499','599','699','799','899','999','301','401','501','502','503','504','516','506','508','602','606','607','801','901']:
 b=next(x for x in catalog['bodies'] if x['id']==ident);m=b['ephem']
 # Middle of an interpolation interval, spread across the whole year.
 indices=[int((m['count']-2)*f) for f in [.013,.127,.297,.511,.689,.853,.983]]
 dates=[m['start']+(k+.5)*m['step'] for k in indices]
 params={'format':'json','COMMAND':"'"+ident+"'",'OBJ_DATA':"'NO'",'EPHEM_TYPE':"'VECTORS'",'CENTER':"'500@"+centers[b['parent']]+"'",'TLIST':"'"+' '.join(str(x) for x in dates)+"'",'VEC_TABLE':"'2'",'OUT_UNITS':"'KM-D'",'REF_PLANE':"'ECLIPTIC'",'REF_SYSTEM':"'ICRF'",'VEC_CORR':"'NONE'",'CSV_FORMAT':"'YES'",'TIME_TYPE':"'TDB'"}
 data=api('verify-fine-midpoint-'+ident,'horizons.api',params)
 rows=[]
 for line in data['result'].split('$$SOE')[1].split('$$EOE')[0].strip().splitlines():
  c=[x.strip() for x in line.split(',')];rows.append({'jd':float(c[0]),'state':[float(x) for x in c[2:8]]})
 results.append({'id':ident,'name':b['name'],'rows':rows})
 print('reference',b['name'],len(rows),flush=True)
(root/'data/ephemeris-reference.json').write_text(json.dumps(results))
