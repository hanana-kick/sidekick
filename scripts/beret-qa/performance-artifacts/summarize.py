import json
from pathlib import Path
p=Path(__file__).resolve().parent
runs=[json.loads((p/f'abba-{i}-{v}.json').read_text()) for i,v in [(1,'baseline'),(2,'candidate'),(3,'candidate'),(4,'baseline')]]
def stat(a):
 a=sorted(a);return dict(n=len(a),median=a[len(a)//2],p95=a[int(len(a)*.95)],max=max(a))
summary=[]
for idx in range(3):
 row={'path':' → '.join(runs[0]['morph'][idx][k] for k in ['from','to','next'])}
 for v in ['baseline','candidate']:
  rs=[r['morph'][idx] for r in runs if r['variant']==v];fs=[f for r in rs for f in r['frames'] if f['active'] and f['frame']>0]
  row[v]={k:stat([f[k] for f in fs]) for k in ['advanceMs','bodyMs','beretMs','totalMs']}
  row[v]['runMedians']=[r['active']['totalMs']['median'] for r in rs]
 summary.append(row)
(p/'abba-summary.json').write_text(json.dumps(summary,indent=2))
print(json.dumps(summary,indent=2))
