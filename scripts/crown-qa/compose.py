"""Assemble original-resolution production renders with labels, without retouching."""
from pathlib import Path
import argparse, hashlib, json, math
from PIL import Image, ImageDraw, ImageFont

p=argparse.ArgumentParser()
p.add_argument('directory',type=Path)
p.add_argument('--label',default='Crown fit')
p.add_argument('--baseline',type=Path)
p.add_argument('--baseline-label',default='frozen v0.3.1 baseline')
a=p.parse_args()
r=a.directory.resolve(); meta=json.loads((r/'provenance.json').read_text())
size=meta['size']; shapes=meta['shapes']; views=[v[0] for v in meta['views']]
out=r/'montages';out.mkdir(exist_ok=True)
font=lambda n:ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',n)
files=[]
for view in views:
    cols=min(7,len(shapes)); rows=math.ceil(len(shapes)/cols)
    im=Image.new('RGB',(cols*size,76+rows*(size+38)),'white'); d=ImageDraw.Draw(im)
    d.text((18,10),f'{a.label} | {view} | {len(shapes)} production crown shapes',font=font(27),fill=(25,25,25))
    d.text((18,45),'Original production colors and shaders | native EGL/GLES3 | no mesh or image alterations',font=font(17),fill=(65,65,65))
    for i,shape in enumerate(shapes):
        x=(i%cols)*size; y=76+(i//cols)*(size+38)
        d.text((x+14,y+7),f'{i+1}. {shape}',font=font(22),fill=(25,25,25))
        panel=Image.open(r/f'{shape}-{view}.png').convert('RGB')
        assert panel.size==(size,size)
        im.paste(panel,(x,y+38))
    dest=out/f'all35-{view}.png'; im.save(dest);files.append(dest)
if a.baseline:
    before=a.baseline.resolve(); bm=json.loads((before/'provenance.json').read_text())
    assert bm['size']==size and bm['shapes']==shapes and bm['views']==meta['views'] and bm['zoom']==meta['zoom'],'Mismatched baseline rendering configuration'
    for view in views:
        for page in range(math.ceil(len(shapes)/7)):
            group=shapes[page*7:(page+1)*7]
            im=Image.new('RGB',(len(group)*size,118+2*(size+38)),'white');d=ImageDraw.Draw(im)
            d.text((18,10),f'Crown before / after | {view} | page {page+1} | {a.label}',font=font(27),fill=(25,25,25))
            d.text((18,49),f'Top: {a.baseline_label}     Bottom: current production render',font=font(21),fill=(45,45,45))
            for j,shape in enumerate(group):
                x=j*size; d.text((x+14,88),f'{page*7+j+1}. {shape}',font=font(22),fill=(25,25,25))
                im.paste(Image.open(before/f'{shape}-{view}.png').convert('RGB'),(x,118))
                d.text((x+14,118+size+7),'AFTER',font=font(20),fill=(25,25,25))
                im.paste(Image.open(r/f'{shape}-{view}.png').convert('RGB'),(x,118+size+38))
            dest=out/f'before-after-{view}-{page+1}.png';im.save(dest);files.append(dest)
manifest={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
(out/'provenance.json').write_text(json.dumps({'sourceManifest':str(r/'provenance.json'),'baselineManifest':str(a.baseline/'provenance.json') if a.baseline else None,'baselineLabel':a.baseline_label if a.baseline else None,'method':'Pixel-exact native PNG panels pasted at original resolution; added plain-text headings only.','files':manifest},indent=2)+'\n')
print(f'Created {len(files)} montage PNGs in {out}')
