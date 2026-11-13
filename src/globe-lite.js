import {sunDirection} from './core/sun.js';
import {globePoint,clusterLetters} from './core/globe-math.js';
// Canvas fallback for devices without WebGL. Texture projection renders only on interaction.
export async function createLiteGlobe(host,{letters,onCluster,labels}){
 const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<701,mapWidth=mobile?1024:2048,mapHeight=mapWidth/2;
 const images=await Promise.all(['day-2k','night-2k','clouds-2k','data-1k'].map(async name=>{const img=new Image();img.src=`/textures/earth-${name}.webp`;await img.decode();return img}));
 const source=document.createElement('canvas');source.width=mapWidth;source.height=mapHeight;const ctx=source.getContext('2d',{willReadFrequently:true});
 const maps=images.map(image=>{ctx.clearRect(0,0,mapWidth,mapHeight);ctx.drawImage(image,0,0,mapWidth,mapHeight);return ctx.getImageData(0,0,mapWidth,mapHeight).data});
 const linear=Array.from({length:256},(_,i)=>{const s=i/255;return s<=.04045?s/12.92:Math.pow((s+.055)/1.055,2.4)});
 const encode=v=>{v=Math.max(0,v);return Math.min(255,255*(v<=.0031308?v*12.92:1.055*Math.pow(v,1/2.4)-.055))};
 const smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t)};
 const canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');host.append(canvas);const output=canvas.getContext('2d');const surface=document.createElement('canvas'),sctx=surface.getContext('2d');
 let yaw=105.85,pitch=21.03,scale=1,active=true,frame=0,pins=[],groups=[],position=null;
 const user=document.createElement('span');user.className='globe-user';user.hidden=true;host.append(user);
 function setLabels(value){labels=value;pins.forEach((p,i)=>{p.textContent='✉ '+groups[i].letters.length+' '+labels.letters;p.setAttribute('aria-label',labels.cluster+' · '+groups[i].letters.length+' '+labels.letters)})}
 function updateLetters(data){pins.forEach(p=>p.remove());groups=clusterLetters(data);pins=groups.map(g=>{const p=document.createElement('button');p.className='globe-pin';p.onclick=()=>onCluster(g.letters[0].id);host.append(p);return p});setLabels(labels);request()}
 function request(){if(!frame&&active&&!document.hidden)frame=requestAnimationFrame(draw)}
 function draw(){frame=0;if(!active||!host.clientWidth||!host.clientHeight)return;const w=host.clientWidth,h=host.clientHeight;canvas.width=w;canvas.height=h;const r=Math.min(w,h)*.43*scale,cx=w/2,cy=h/2;output.clearRect(0,0,w,h);
 let seed=42;for(let i=0;i<180;i++){seed=(seed*1664525+1013904223)>>>0;const x=seed/4294967296*w;seed=(seed*1664525+1013904223)>>>0;const y=seed/4294967296*h;output.fillStyle=i%3?'#9aacb51c':'#e1d4b54d';output.fillRect(x,y,1,1)}
 const glow=output.createRadialGradient(cx,cy,r*.995,cx,cy,r*1.025);glow.addColorStop(0,'#afcde22b');glow.addColorStop(.22,'#84b2d633');glow.addColorStop(1,'#50799100');output.fillStyle=glow;output.beginPath();output.arc(cx,cy,r*1.025,0,Math.PI*2);output.fill();
 const n=Math.max(32,Math.min(innerWidth<701?440:760,Math.round(r*2*(devicePixelRatio||1)))),a=yaw*Math.PI/180,b=pitch*Math.PI/180;surface.width=n;surface.height=n;const data=sctx.createImageData(n,n),dst=data.data;const front=globePoint(pitch,yaw),right=[-Math.sin(a),0,-Math.cos(a)],up=[-Math.sin(b)*Math.cos(a),Math.cos(b),Math.sin(b)*Math.sin(a)];
 const sun=sunDirection(Date.now()),[dayMap,nightMap,cloudMap,dataMap]=maps;
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){
  const sx=(x+.5)/n*2-1,sy=1-(y+.5)/n*2,z2=1-sx*sx-sy*sy;if(z2<0)continue;
  const z=Math.sqrt(z2),vx=right[0]*sx+up[0]*sy+front[0]*z,vy=up[1]*sy+front[1]*z,vz=right[2]*sx+up[2]*sy+front[2]*z;
  const lon=Math.atan2(-vz,vx),lat=Math.asin(Math.max(-1,Math.min(1,vy))),tx=Math.min(mapWidth-1,Math.max(0,Math.floor((lon/Math.PI/2+.5)*mapWidth))),ty=Math.min(mapHeight-1,Math.max(0,Math.floor((.5-lat/Math.PI)*mapHeight)));
  const k=(ty*mapWidth+tx)*4,j=(y*n+x)*4,ndl=vx*sun[0]+vy*sun[1]+vz*sun[2],day=smooth(-.05,.09,ndl),cover=smooth(.16,.78,cloudMap[k]/255),ocean=smooth(.35,.65,dataMap[k+1]/255);
  const lambert=Math.max(0,(ndl+.04)/1.04),shadow=1-.38*cover*smooth(0,.2,ndl),haze=Math.pow(1-z,3.2)*.7*smooth(-.02,.2,ndl),cloudDay=smooth(-.05,.12,ndl),alpha=cover*(.16+.78*cloudDay)*(1-.55*Math.pow(1-z,4));
  const nightLuma=.2126*linear[nightMap[k]]+.7152*linear[nightMap[k+1]]+.0722*linear[nightMap[k+2]],lights=Math.pow(smooth(.014,.55,nightLuma),1.45)*(1-smooth(-.14,.03,ndl))*(1-.45*cover)*1.7;
  const luma=.2126*linear[dayMap[k]]+.7152*linear[dayMap[k+1]]+.0722*linear[dayMap[k+2]];
  const sunView=sun[0]*front[0]+sun[1]*front[1]+sun[2]*front[2],hlen=Math.sqrt(2+2*sunView),ndh=hlen>1e-5?(ndl+z)/hlen:0,spec=(Math.pow(Math.max(0,ndh),220)*.55+Math.pow(Math.max(0,ndh),28)*.045)*.37*ocean*(1-.9*cover)*smooth(0,.25,ndl);
  for(let c=0;c<3;c++){
   const base=linear[dayMap[k+c]],grade=(luma*.12+base*.88)*[.96,.99,1.03][c],sea=(luma*.45+grade*.55)*[.46,.56,.7][c];
   const albedo=Math.pow(grade*(1-ocean)+sea*ocean,1.12)*1.06;
   let lit=albedo*1.08*lambert*shadow+spec;
   lit=lit*(1-haze)+[.45,.59,.76][c]*.4*smooth(.02,.45,ndl)*haze;
   const night=[.0046,.0057,.007][c]*(1.3-.3*ocean)+luma*.012+nightLuma*.25+lights*[1,.53,.22][c];
   let color=night*(1-day)+lit*day;
   const cloudShade=(.32+.68*Math.max(0,(ndl+.08)/1.08))*(.78+.28*Math.max(0,Math.min(1,ndl*.5+.5)));
   const cloudColor=[.006,.008,.011][c]*(1-cloudDay)+[.78,.77,.73][c]*1.08*cloudShade*cloudDay;
   color=color*(1-alpha)+cloudColor*alpha;
   dst[j+c]=encode(color);
  }
  dst[j+3]=255;
 }
 sctx.putImageData(data,0,0);output.drawImage(surface,cx-r,cy-r,r*2,r*2);
 function project(el,p){const v=globePoint(p.lat,p.lng);el.hidden=v.reduce((sum,v,i)=>sum+v*front[i],0)<=0;if(!el.hidden){el.style.left=cx+r*v.reduce((sum,v,i)=>sum+v*right[i],0)+'px';el.style.top=cy-r*v.reduce((sum,v,i)=>sum+v*up[i],0)+'px'}}pins.forEach((p,i)=>project(p,groups[i]));if(position)project(user,position);else user.hidden=true;
 }
 let drag;canvas.addEventListener('pointerdown',e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)});canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw-=(e.clientX-drag[0])*.35;pitch=Math.max(-80,Math.min(80,pitch+(e.clientY-drag[1])*.35));drag=[e.clientX,e.clientY];request()});canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('wheel',e=>{e.preventDefault();scale=Math.max(.7,Math.min(1.5,scale-e.deltaY*.001));request()},{passive:false});const observer=new ResizeObserver(request);observer.observe(host);const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else request()};document.addEventListener('visibilitychange',visibility);const sunlightTimer=setInterval(request,60000);updateLetters(letters);
 return {lite:true,setLabels,updateLetters,setPosition(p){position=p;request()},flyTo(p){yaw=p.lng;pitch=p.lat;request()},zoom(delta){scale=Math.max(.7,Math.min(1.5,scale-delta*.4));request()},setActive(value){active=value;if(!active){cancelAnimationFrame(frame);frame=0}else request()},dispose(){active=false;clearInterval(sunlightTimer);cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);host.replaceChildren()}};
}
