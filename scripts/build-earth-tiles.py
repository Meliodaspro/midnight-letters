"""Optional asset regeneration only; npm build uses the committed tiles.
Solar System Scope CC BY 4.0 maps, resized/re-encoded by Watched;
reprojected here to Web Mercator and composited with static clouds.
Requires Pillow and numpy. No remote map tiles are downloaded.
"""
from pathlib import Path
import numpy as np
from PIL import Image
root=Path(__file__).resolve().parents[1]
day=Image.open(root/'public/textures/earth-day-4k.webp').convert('RGB')
cloud=Image.open(root/'public/textures/earth-clouds-2k.webp').convert('L').resize(day.size,Image.Resampling.BILINEAR)
a=np.asarray(day,dtype=float);c=np.asarray(cloud,dtype=float)/255
c=np.clip((c-.16)/.62,0,1);c=c*c*(3-2*c);c=c[...,None]*.72
rgb=np.uint8(np.clip(a*(1-c)+np.array([233,235,233])*c,0,255));height,width=rgb.shape[:2]
for z in range(3):
 n=2**z
 for x in range(n):
  xs=np.clip(((x+(np.arange(256)+.5)/256)/n*width).astype(int),0,width-1)
  for y in range(n):
   merc=(y+(np.arange(256)+.5)/256)/n
   lat=np.arctan(np.sinh(np.pi*(1-2*merc)))
   ys=np.clip(((.5-lat/np.pi)*height).astype(int),0,height-1)
   path=root/f'public/earth-tiles/{z}/{x}/{y}.webp';path.parent.mkdir(parents=True,exist_ok=True)
   Image.fromarray(rgb[ys[:,None],xs[None,:]]).save(path,quality=87,method=6)
print('Built 21 local Earth tiles, zoom 0–2')
