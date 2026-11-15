# Draws the hand-made sprites over their tiles, enlarged, to look at: python art/preview.py <out.png>
import json, sys, os
from PIL import Image
A=os.path.join(os.path.dirname(__file__),'..','assets')
atlas=json.load(open(os.path.join(A,'atlas.json')))
imgs={}
def fr(sheet,name):
    s=atlas[sheet]
    if sheet not in imgs: imgs[sheet]=Image.open(os.path.join(A,s['image'])).convert('RGBA')
    x,y,w,h,_=s['frames'][name]
    return imgs[sheet].crop((x,y,x+w,y+h))
out=Image.new('RGBA',(16*9,16*9),(20,16,24,255))
row=0
for b in ['frost','ember','mire','lode']:
    items=[k for k in atlas[b+'-items']['frames']]
    for i,name in enumerate(['dense','oreA','oreB','hazard','relic']):
        if name not in items: continue
        out.alpha_composite(fr(b,b+'-255-a'),(i*16,row*16))
        out.alpha_composite(fr(b+'-items',name),(i*16,row*16))
    out.alpha_composite(fr(b+'-floor',b+'-floor-255-a'),(5*16,row*16))
    out.alpha_composite(fr(b,b+'-0-a'),(5*16,row*16))
    out.alpha_composite(fr(b,b+'-0-a'),(6*16,row*16))
    out.alpha_composite(fr(b+'-items','oreA'),(6*16,row*16))
    row+=1
for i,d in enumerate(['right-a-0','right-a-1','right-a-2','right-a-3','right-a-4']):
    out.alpha_composite(fr('crust-floor','crust-floor-255-a'),(i*16,row*16))
    out.alpha_composite(fr('drill',d),(i*16,row*16))
for i,n in enumerate(['slate','vault','bedrock','crust']):
    out.alpha_composite(fr(n,n+'-255-a'),((5+i)*16,row*16))
row+=1
for i,n in enumerate(atlas['upgrades']['frames']): out.alpha_composite(fr('upgrades',n),(i*14+1,row*16+2))
row+=1
for i,n in enumerate(atlas['icons']['frames']): out.alpha_composite(fr('icons',n),(i*12+1,row*16+2))
for i,n in enumerate(['hand','recall','sound','mute']): out.alpha_composite(fr('ui',n),(i*16+1, (row+1)*16))
out.alpha_composite(fr('core','core-a-0'),(96,(row)*16))
out=out.resize((out.width*6,out.height*6),Image.NEAREST)
out.save(sys.argv[1])
