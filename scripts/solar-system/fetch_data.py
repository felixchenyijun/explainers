"""Cache JPL data sequentially. No API calls are made by the published viewer."""
from pathlib import Path
import requests, json, gzip, time, math, re, struct
from collections import Counter
from bs4 import BeautifulSoup

ROOT=Path(__file__).resolve().parent
CACHE=ROOT/'data/cache'; OUT=ROOT/'public/data'
CACHE.mkdir(parents=True,exist_ok=True); OUT.mkdir(parents=True,exist_ok=True)
S=requests.Session()
def api(name,endpoint,params):
    path=CACHE/(name+'.json.gz')
    if path.exists(): return json.loads(gzip.decompress(path.read_bytes()))
    for attempt in range(4):
        try:
            base='https://ssd.jpl.nasa.gov/api/' if endpoint=='horizons.api' else 'https://ssd-api.jpl.nasa.gov/'
            r=S.get(base+endpoint,params=params,timeout=180)
            r.raise_for_status(); data=r.json()
            if 'error' in data: raise ValueError(data['error'])
            path.write_bytes(gzip.compress(json.dumps(data).encode()))
            time.sleep(.12)
            return data
        except Exception as e:
            if attempt==3: raise
            print('retry',name,str(e)[:100],flush=True); time.sleep(2+attempt*3)

def physical():
    # The source contains unclosed <td> tags, so read each cell's direct text.
    soup=BeautifulSoup((CACHE/'moon-physical.html').read_text(),'html.parser')
    result={}
    for tr in soup.select('#sat_phys_par tbody tr'):
        td=tr.select('td')
        if len(td)>=7:
            ident=td[2].get_text(strip=True)
            direct=''.join(td[6].find_all(string=True,recursive=False)).strip()
            try: result[ident]=float(direct)
            except ValueError: pass
    return result

def moons():
    sizes=physical(); rows=[]
    soup=BeautifulSoup((CACHE/'moon-elements.html').read_text(),'html.parser')
    for tr in soup.select('#sat_elem tbody tr'):
        r=[t.get_text(' ',strip=True) for t in tr.select('td')]
        if len(r)<14:continue
        rows.append(dict(id=r[3],name=r[2],parent=r[1],type='moon',radius=sizes.get(r[3]),
                         a=float(r[7]),e=float(r[8]),period=float(r[13]),source=r[4]))
    return rows

PLANETS=[('10','Sun',695700,0),('199','Mercury',2439.4,87.969),('299','Venus',6051.8,224.701),
 ('399','Earth',6371.0084,365.256),('499','Mars',3389.5,686.98),('599','Jupiter',69911,4332.59),
 ('699','Saturn',58232,10759.22),('799','Uranus',25362,30685.4),('899','Neptune',24622,60189),('999','Pluto',1188.3,90560)]
def trajectory(body):
    ident=body['id']; parent=body.get('parent','Sun')
    centers={p[1]:p[0] for p in PLANETS}
    # At most 1/60 of a period, with a five-minute floor. Eccentric objects
    # are sampled more closely; a six-hour cap resolves parent reflex motion.
    if body['type']=='moon':
        step=max(5,min(360,int(body['period']*1440/60*(1-body['e'])**1.5)))
    else: step=180
    params=dict(format='json',COMMAND="'"+ident+"'",OBJ_DATA="'NO'",MAKE_EPHEM="'YES'",EPHEM_TYPE="'VECTORS'",
                CENTER="'500@"+centers.get(parent,'10')+"'",START_TIME="'2025-12-31'",STOP_TIME="'2027-01-02'",
                STEP_SIZE="'"+str(step)+" m'",VEC_TABLE="'2'",OUT_UNITS="'KM-D'",REF_PLANE="'ECLIPTIC'",
                REF_SYSTEM="'ICRF'",VEC_CORR="'NONE'",CSV_FORMAT="'YES'",TIME_TYPE="'TDB'")
    data=api('vec-fine-'+ident,'horizons.api',params)
    result=data.get('result','')
    if '$$SOE' not in result: raise ValueError(result[-350:])
    raw=result.split('$$SOE')[1].split('$$EOE')[0]
    values=[]; dates=[]
    for line in raw.strip().splitlines():
        c=[s.strip() for s in line.split(',')]
        if len(c)>=8:
            dates.append(float(c[0])); values.extend(float(x) for x in c[2:8])
    # Horizons stops at the last whole step before STOP_TIME. Coarse outer-moon
    # steps may otherwise end before the viewer's final date; append one step.
    if dates[-1]<2461406.501:
        nextjd=dates[-1]+step/1440
        tailparams={k:v for k,v in params.items() if k not in ['START_TIME','STOP_TIME','STEP_SIZE']}
        tailparams['TLIST']="'"+str(nextjd)+"'"
        tail=api('tail-fine-'+ident,'horizons.api',tailparams)['result'].split('$$SOE')[1].split('$$EOE')[0]
        c=[s.strip() for s in tail.strip().split(',')]
        dates.append(float(c[0]));values.extend(float(x) for x in c[2:8])
    assert len(dates)>1
    packed=struct.pack('<'+'d'*len(values),*values)
    (OUT/(ident+'.bin.gz')).write_bytes(gzip.compress(packed,compresslevel=6))
    body['ephem']={'start':dates[0],'step':step/1440,'count':len(dates),'file':ident+'.bin.gz'}
    # Preserve one raw sample and metadata for validation.
    body['sample']=values[:6]
    return body

def small_bodies():
    fields='spkid,full_name,name,pdes,kind,class,epoch,a,e,i,om,w,ma,n,diameter,H,q,tp'
    collected={}; queries=[('large',{'sort':'-diameter','limit':'20000','sb-kind':'a'}),
                          ('trojans',{'sb-class':'TJN','limit':'12000'}),
                          ('outer',{'sb-class':'TNO','limit':'15000'}),
                          ('centaurs',{'sb-class':'CEN','limit':'5000'}),
                          ('comets',{'sb-kind':'c','limit':'2000','sb-ns':'n'})]
    for name,params in queries:
        data=api('sb-'+name,'sbdb_query.api',{'fields':fields,'full-prec':'true',**params})
        for row in data.get('data',[]):
            x=dict(zip(data['fields'],row))
            if any(x.get(k) is None for k in ['a','e','i','om','w','ma','n','epoch']):continue
            ident=x['spkid']
            label=x['name'] or x['full_name'].strip()
            if x['kind'].startswith('c'):label=x['full_name'].strip()
            # Schema: id, label, designation, class, epoch, a(AU), e,i,node,w,M,n(deg/day),radius(km),H,q,tp.
            vals=[ident,label,x['pdes'],x['class']]+[float(x[k]) if x.get(k) is not None else None for k in ['epoch','a','e','i','om','w','ma','n','diameter','H','q','tp']]
            if vals[12] is not None: vals[12]/=2
            collected[ident]=vals
        print('small bodies',name,len(collected),flush=True)
    data=list(collected.values())
    (OUT/'small-bodies.json').write_text(json.dumps(data,separators=(',',':')))
    return len(data)

def main():
    bodies=[dict(id=i,name=n,radius=r,period=p,parent='Sun',type='star' if i=='10' else 'dwarf' if i=='999' else 'planet') for i,n,r,p in PLANETS]
    bodies+=moons()
    print('Moon census',dict(Counter(x['parent'] for x in bodies if x['type']=='moon')),flush=True)
    n=small_bodies()
    failures=[]
    for index,b in enumerate(bodies):
        if b['id']=='10':continue
        try:
            trajectory(b)
            print(index,b['name'],b['ephem']['count'],flush=True)
        except Exception as e:
            failures.append({'id':b['id'],'name':b['name'],'error':str(e)[:300]})
            b['unavailable']=True
            print('UNAVAILABLE',b['id'],b['name'],str(e)[:90],flush=True)
        metadata={'fetched':'2026-09-29','startUTC':'2026-01-01T00:00:00Z','endUTC':'2026-12-31T23:59:59Z',
                  'frame':'J2000 ecliptic, geometric, TDB','bodies':bodies,'smallBodyCount':n,'failures':failures}
        (OUT/'catalog.json').write_text(json.dumps(metadata,separators=(',',':')))
    print('DONE',len(bodies),'bodies;',len(failures),'unavailable;',n,'small bodies',flush=True)

if __name__=='__main__':main()
