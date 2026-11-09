import {seeds} from './core/seed.js';
import {distanceMeters} from './core/location.js';
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_PITCH=38;
const CDN='https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/';
let sdk, instance, pending, resizeObserver, userMarker;
let markers=[];

export function hasMap(){return !!instance}

function loadSDK(){
 if(globalThis.maplibregl)return Promise.resolve(globalThis.maplibregl);
 if(!sdk)sdk=new Promise((resolve,reject)=>{
  if(!document.querySelector('#maplibre-css')){
   const link=document.createElement('link');
   Object.assign(link,{id:'maplibre-css',rel:'stylesheet',href:CDN+'maplibre-gl.css'});
   document.head.append(link);
  }
  const script=document.createElement('script');
  script.src=CDN+'maplibre-gl.js';
  const fail=()=>{clearTimeout(timer);script.remove();sdk=null;reject(Error('MapLibre unavailable'))};
  const timer=setTimeout(fail,15000);
  script.onload=()=>{clearTimeout(timer);resolve(globalThis.maplibregl)};
  script.onerror=fail;
  document.head.append(script);
 });
 return sdk;
}

function pastelStyle(style){
 style.light={anchor:'viewport',color:'#fff4db',intensity:0.4,position:[1.15,210,45]};
 const building=style.layers.find(layer=>layer.type==='fill'&&layer['source-layer']==='building');
 for(const layer of style.layers){
  const feature=layer['source-layer'];
  if(layer.type==='background')layer.paint={'background-color':['interpolate',['linear'],['zoom'],0,'#e0edcb',9,'#f4ecd8',14,'#f9efd9']};
  if(layer.id==='natural_earth')layer.paint={...layer.paint,'raster-opacity':0.5,'raster-saturation':0.25};
  if(layer.type==='fill'){
   const landcover=layer.id.includes('wood')?'#92cd9c':'#c4e5a6';
   const colors={water:'#83d4ee',landcover,landuse:'#f2e0cb',park:'#b0df9d',building:'#efd0bc',aeroway:'#dbdce4'};
   const fill=colors[feature]||'#f5e8ce';
   const outline=feature==='water'?'#69bfdc':feature==='building'?'#d8b4a1':fill;
   layer.paint={...layer.paint,'fill-color':fill,'fill-outline-color':outline};
  }
  if(layer.type==='line'){
   let color='#b19ec6';
   if(feature==='waterway')color='#72c8e6';
   if(feature==='transportation'){
    const main=/motorway|trunk_primary/.test(layer.id);
    color=layer.id.includes('casing')?(main?'#e3ad7e':'#d9c9b0'):(main?'#ffce98':'#fffdf5');
    if(layer.id.includes('rail'))color='#a7a6b7';
   }
   layer.paint={...layer.paint,'line-color':color};
  }
  if(layer.type==='symbol'&&layer.layout?.['text-field']){
   layer.paint={...layer.paint,'text-color':'#495467','text-halo-color':'#fff9e9','text-halo-width':1.2};
  }
 }
 if(building){
  const labelIndex=style.layers.findIndex(layer=>layer.type==='symbol');
  style.layers.splice(labelIndex<0?style.layers.length:labelIndex,0,{
   id:'midnight-buildings',type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:15,
   paint:{
    'fill-extrusion-color':['interpolate',['linear'],['to-number',['get','render_height'],['get','height'],0],0,'#f3c5b1',12,'#f1cf9c',24,'#d8bce9',45,'#add9e2'],
    'fill-extrusion-height':['max',0,['to-number',['get','render_height'],['get','height'],0]],
    'fill-extrusion-base':['max',0,['to-number',['get','render_min_height'],0]],
    'fill-extrusion-opacity':1
   }
  });
 }
 return style;
}

export async function connectMap(container,letters,onSelect){
 if(instance)return instance;
 if(!pending)pending=(async()=>{
  const [lib,response]=await Promise.all([loadSDK(),fetch(STYLE_URL,{signal:AbortSignal.timeout(15000)})]);
  if(!response.ok)throw Error('Map style unavailable');
  const style=pastelStyle(await response.json());
  const map=new lib.Map({container,style,center:[105.8525,21.0285],zoom:15.8,pitch:DEFAULT_PITCH,bearing:-18,maxPitch:65});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{map.off('load',loaded);reject(Error('Map timed out'))},20000);
    function loaded(){clearTimeout(timer);resolve()}
    map.once('load',loaded);
   });
   let overview=map.getZoom()<12;
   map.on('zoomend',()=>{
    const zoom=map.getZoom();
    if(!overview&&zoom<12){overview=true;map.easeTo({pitch:0,duration:300})}
    else if(overview&&zoom>=14){overview=false;map.easeTo({pitch:DEFAULT_PITCH,duration:300})}
   });
   map.addControl(new lib.NavigationControl({visualizePitch:true}),'bottom-right');
   let width=container.clientWidth,height=container.clientHeight;
   resizeObserver=new ResizeObserver(()=>{
    const nextWidth=container.clientWidth,nextHeight=container.clientHeight;
    if(!nextWidth||!nextHeight||nextWidth===width&&nextHeight===height)return;
    width=nextWidth;height=nextHeight;
    map.resize();
   });
   resizeObserver.observe(container);
   instance=map;
   refreshMarkers(letters,onSelect);
   addPets(map,letters.length?letters:seeds);
   return map;
  }catch(error){
   resizeObserver?.disconnect();
   instance=null;
   map.remove();
   throw error;
  }
 })().finally(()=>{pending=null});
 return pending;
}

export function groupLettersByPlace(letters){
 const groups=[];
 for(const letter of letters){
  const group=groups.find(group=>distanceMeters(group[0],letter)<=15);
  if(group)group.push(letter);
  else groups.push([letter]);
 }
 return groups;
}

export function refreshMarkers(letters,onSelect){
 if(!instance)return;
 markers.forEach(marker=>marker.remove());
 markers=groupLettersByPlace(letters).map(group=>{
  const [letter]=group;
  const button=document.createElement('button');
  button.type='button';
  button.className='storybook-pin';
  button.setAttribute('aria-label',letter.place||letter.title);
  button.innerHTML='<svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true"><rect x="2" y="3" width="26" height="18" rx="4" fill="#fff7df" stroke="#8b7051" stroke-width="2"/><path d="m3 5 12 9L27 5" fill="none" stroke="#8b7051" stroke-width="1.6"/><circle cx="15" cy="14" r="3" fill="#d98874"/></svg>';
  if(group.length>1){
   const count=document.createElement('span');
   count.textContent=String(group.length);
   count.style.cssText='position:absolute;top:-8px;right:-8px;min-width:24px;padding:3px 5px;border:2px solid #fff;border-radius:20px;background:#243958;color:#fff;font:700 12px/1 system-ui;text-align:center';
   button.append(count);
   const vi=document.documentElement.lang==='vi';
   button.setAttribute('aria-label',vi?group.length+' lá thư · '+letter.place:group.length+' letters · '+letter.place);
  }
  button.addEventListener('click',()=>onSelect(group.map(item=>item.id)));
  return new globalThis.maplibregl.Marker({element:button}).setLngLat([letter.lng,letter.lat]).addTo(instance);
 });
}
export function panTo(position){instance?.easeTo({center:[position.lng,position.lat],duration:500})}
export function showPosition(position){
 if(!instance)return;
 if(!userMarker){
  const element=document.createElement('div');
  element.className='storybook-user';
  const label=document.createElement('span');
  label.className='storybook-user-label';
  label.textContent=document.documentElement.lang==='vi'?'Bạn đang ở đây':'You are here';
  element.append(label);
  userMarker=new globalThis.maplibregl.Marker({element});
  userMarker.setLngLat([position.lng,position.lat]).addTo(instance);
  instance.easeTo({center:[position.lng,position.lat],zoom:Math.max(instance.getZoom(),15),duration:650});
 }
 userMarker.setLngLat([position.lng,position.lat]);
}
export function clearPosition(){userMarker?.remove();userMarker=null}

export function terrainEnabled(){return !!instance?.getTerrain()}
export function toggleTerrain(){
 if(!instance)return;
 if(terrainEnabled()){
  instance.setTerrain(null);
  if(instance.getLayer('midnight-hillshade'))instance.removeLayer('midnight-hillshade');
  if(instance.getSource('midnight-terrain'))instance.removeSource('midnight-terrain');
  return;
 }
 if(!instance.getSource('midnight-terrain')){
  instance.addSource('midnight-terrain',{
   type:'raster-dem',encoding:'terrarium',tileSize:256,maxzoom:15,
   tiles:['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
   attribution:'Elevation tiles by Mapzen'
  });
 }
 const before=instance.getStyle().layers.find(layer=>layer.type==='symbol'||layer['source-layer']==='transportation')?.id;
 instance.addLayer({
  id:'midnight-hillshade',type:'hillshade',source:'midnight-terrain',minzoom:3,
  paint:{
   'hillshade-exaggeration':0.55,
   'hillshade-shadow-color':'#4d5c43',
   'hillshade-highlight-color':'#fff6d4',
   'hillshade-accent-color':'#7e8c67'
  }
 },before);
 instance.setTerrain({source:'midnight-terrain',exaggeration:1.3});
}

const pets=[
 {name:'cat',color:'#f3a975',ears:2.1,tail:1.5},
 {name:'dog',color:'#ba8763',ears:1.1,tail:1.25},
 {name:'rabbit',color:'#e7bbe3',ears:3.2,tail:0.9}
];

function addPets(map,letters){
 const features=[];
 for(const letter of letters.slice(0,3)){
  const pet=pets[Math.floor(Math.random()*pets.length)];
  const lng=letter.lng+(Math.random()-.5)*.0005;
  const lat=letter.lat+(Math.random()-.5)*.0005;
  const dx=1/(111320*Math.cos(lat*Math.PI/180));
  const dy=1/111320;
  // Small block models anchored to real locations, drawn in the existing map renderer.
  function block(x,y,w,h,base,top,color=pet.color){
   const point=(east,north)=>[lng+east*dx,lat+north*dy];
   features.push({type:'Feature',properties:{base,top,color},geometry:{type:'Polygon',coordinates:[[
    point(x,y),point(x+w,y),point(x+w,y+h),point(x,y+h),point(x,y)
   ]]}});
  }
  block(-2,-3,4,5,1,3);
  block(-1.6,1.1,3.2,2.6,2.1,4.4);
  for(const x of [-1.75,0.75]){
   block(x,-2.6,1,1,0,1.7);
   block(x,.6,1,1,0,1.7);
   block(x,2.15,.9,1,4.1,4.1+pet.ears);
   block(x+.28,3.65,.45,.2,3.4,3.8,'#3d3340');
  }
  block(-.6,-4.4,1.2,1.8,2.1,2.1+pet.tail);
 }
 if(!features.length)return;
 map.addSource('midnight-pets',{type:'geojson',data:{type:'FeatureCollection',features}});
 map.addLayer({id:'midnight-pets',type:'fill-extrusion',source:'midnight-pets',minzoom:16,paint:{
  'fill-extrusion-color':['get','color'],
  'fill-extrusion-base':['get','base'],
  'fill-extrusion-height':['get','top']
 }});
}

