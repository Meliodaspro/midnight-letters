import {globePoint} from './globe-math.js';
const radians=Math.PI/180;
export function hybridOpacity(zoom,pitch=0){const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};return (1-smooth(1.8,2.8,zoom))*(1-smooth(.1,1,Math.abs(pitch)))}
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const along=(front,tangent,angle)=>front.map((v,i)=>v*Math.cos(angle)+tangent[i]*Math.sin(angle));
const latLng=v=>({lat:Math.asin(Math.max(-1,Math.min(1,v[1])))/radians,lng:Math.atan2(-v[2],v[0])/radians});
// Fit the second renderer to the actual public map.project() result, rather than
// guessing MapLibre's camera distance/FOV from zoom. A north sample checks that
// the projection is still spherical before the photographic layer is shown.
export function fitGlobeCamera(project,center,bearing,width,height){
 if(!width||!height)return null;
 const front=globePoint(center.lat,center.lng),lon=center.lng*radians,lat=center.lat*radians,b=bearing*radians;
 const east=[-Math.sin(lon),0,-Math.cos(lon)],north=[-Math.sin(lat)*Math.cos(lon),Math.cos(lat),Math.sin(lat)*Math.sin(lon)];
 const right=east.map((v,i)=>v*Math.cos(b)-north[i]*Math.sin(b));
 const up=north.map((v,i)=>v*Math.cos(b)+east[i]*Math.sin(b));
 try{
  const origin=project(center),a=10*radians,c=45*radians;
  const p=project(latLng(along(front,right,a))),q=project(latLng(along(front,right,c)));
  const qa=(p.x-origin.x)/Math.sin(a),qc=(q.x-origin.x)/Math.sin(c),den=qa-qc;
  if(Math.abs(den)<1e-7)return null;
  const distance=(qa*Math.cos(a)-qc*Math.cos(c))/den,focal=qa*(distance-Math.cos(a));
  if(!Number.isFinite(distance)||distance<=1.01||focal<=0)return null;
  const n=25*radians,check=project(latLng(along(front,up,n))),expectedY=origin.y-focal*Math.sin(n)/(distance-Math.cos(n));
  const error=Math.hypot(check.x-origin.x,check.y-expectedY);
  if(!Number.isFinite(error)||error>Math.max(2,Math.min(width,height)*.0075))return null;
  return {position:front.map(v=>v*distance),up,distance,fov:2*Math.atan(height/(2*focal))/radians,offsetX:width/2-origin.x,offsetY:height/2-origin.y,width,height};
 }catch{return null}
}
