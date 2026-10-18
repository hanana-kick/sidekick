from pathlib import Path
import json,sys,math
import numpy as np
from PIL import Image
root=Path(sys.argv[1]);shape=sys.argv[2];view=sys.argv[3] if len(sys.argv)>3 else 'quarter';g=json.loads((root/f'{shape}-{view}-geometry.json').read_text());im=Image.open(root/f'{shape}-{view}.png').convert('RGB');size=im.width;pixels=np.array(im);active=set(map(tuple,np.argwhere(np.all(pixels==[255,204,55],axis=2))));groups=[]
while active:
 q=[active.pop()];points=[]
 while q:
  y,x=q.pop();points.append((x,y))
  for dy,dx in [(-1,-1),(-1,0),(-1,1),(0,-1),(0,1),(1,-1),(1,0),(1,1)]:
   p=(y+dy,x+dx)
   if p in active:active.remove(p);q.append(p)
 if len(points)>=1:groups.append(points)
groups.sort(key=len,reverse=True);draws=[]
for di,d in enumerate(g['draws']):
 vertices=np.array(d['vertices']).reshape(-1,6);model=np.array(d['uniforms']['model']['values']).reshape(4,4,order='F');projection=np.array(d['uniforms']['projection']['values']).reshape(4,4,order='F');world=np.concatenate([vertices[:,:3],np.ones((len(vertices),1))],axis=1)@model.T;clip=world@projection.T;ndc=clip[:,:3]/clip[:,3,None];screen=np.stack([(ndc[:,0]+1)*size/2,(1-ndc[:,1])*size/2,(ndc[:,2]+1)/2],axis=1);draws.append((np.array(d['indices']).reshape(-1,3),screen,world[:,:3]))
def hits(pixel):
 px,py=pixel[0]+.5,pixel[1]+.5;result=[]
 for di,(ix,screen,world)in enumerate(draws):
  tri=screen[ix];ax,ay=tri[:,0,0],tri[:,0,1];bx,by=tri[:,1,0],tri[:,1,1];cx,cy=tri[:,2,0],tri[:,2,1]
  den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);safe=np.where(np.abs(den)>1e-12,den,1)
  u=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/safe;v=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/safe;w=1-u-v
  for ti in np.flatnonzero((np.abs(den)>1e-12)&(np.minimum(np.minimum(u,v),w)>=-1e-8)):
   ids=ix[ti];weights=np.array([u[ti],v[ti],w[ti]]);depth=float(weights@tri[ti,:,2]);point=(weights@world[ids]).tolist()
   globalTriangle=int(ti)+(len(draws[1][0])if di==2 else 0)
   section='body' if di==0 else ['bottom wall','outer band','outer upper wall','point top rim','inner upper wall','inner lower wall'][globalTriangle//160]
   result.append({'draw':di,'triangle':globalTriangle if di else int(ti),'vertexIds':ids.tolist(),'section':section,'frontFacing':bool(den[ti]<0),'depth':depth,'depth16':round(depth*65535),'pointInRecordedModelSpace':point})
 return sorted(result,key=lambda r:r['depth'])

raw={k:(root/'depth'/f"{shape}-{g['camera']['yaw']}-{g['camera']['pitch']}-{k}.rgba").read_bytes()for k in ['culled','unculled','crown-only']}
report=[]
for points in groups[1:]:
 cx=sum(p[0]for p in points)/len(points);cy=sum(p[1]for p in points)/len(points);p=min(points,key=lambda p:(p[0]-cx)**2+(p[1]-cy)**2);offset=(p[1]*size+p[0])*4
 native={k:{'id':v[offset]if v[offset+3]else 0,'depth16':v[offset+1]*256+v[offset+2]}for k,v in raw.items()}
 report.append({'componentPixels':len(points),'pixel':p,'bbox':[min(x for x,y in points),min(y for x,y in points),max(x for x,y in points),max(y for x,y in points)],'native':native,'allRayTriangleHitsNearToFar':hits(p)})
from collections import Counter
for entry,points in zip(report,groups[1:]):
 counts=Counter();closestGaps=[];unexpected=[]
 for p in points:
  ray=hits(p);frontBody=[h for h in ray if h['draw']==0 and h['frontFacing']];crown=[h for h in ray if h['draw']>0];frontCrown=[h for h in crown if h['frontFacing']]
  if not frontBody:unexpected.append({'pixel':p,'reason':'no front-facing body ray hit'});continue
  if crown and crown[0]['depth']<frontBody[0]['depth']:unexpected.append({'pixel':p,'reason':'metal in front of body'});
  if frontCrown:counts[frontCrown[0]['section']]+=1;closestGaps.append(frontCrown[0]['depth']-frontBody[0]['depth'])
  else:counts['no front-facing metal on ray']+=1
 entry['allComponentPixelRays']={'testedPixels':len(points),'nearestFrontFacingCrownSectionCounts':dict(counts),'minDepthGapCrownMinusBody':min(closestGaps)if closestGaps else None,'unexpected':unexpected}
probes=[]
for p in (json.loads(sys.argv[4]) if len(sys.argv)>4 else ([(365,192)] if shape=='fan' else [])):
 offset=(p[1]*size+p[0])*4
 probes.append({'pixel':p,'productionRGB':pixels[p[1],p[0]].tolist(),'native':{k:{'id':v[offset]if v[offset+3]else 0,'depth16':v[offset+1]*256+v[offset+2]}for k,v in raw.items()},'allRayTriangleHitsNearToFar':hits(p)})
out={'shape':shape,'camera':g['camera'],'method':'Ray-triangle attribution at pixel centers using actual recorded production vertex buffers, exact model/projection matrices, screen winding, and native ID/depth buffers. Crown sections mapped from immutable six-ring topology (160 triangles per adjacent-ring section). Every disconnected exact-yellow body-patch pixel is checked, plus explicit background-hole probes.','bodyPatchComponents':report,'explicitProbes':probes}
(root/f'{shape}-{view}-ray-attribution.json').write_text(json.dumps(out,indent=2,default=lambda x:x.item())+'\n');print(json.dumps(out,indent=2,default=lambda x:x.item()))
