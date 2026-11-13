import {atlasStyle,atlasFlight,atlasView,DEFAULT_PLACE} from './core/atlas.js';
import {fitGlobeCamera,hybridOpacity} from './core/hybrid-camera.js';
import {distanceMeters} from './core/location.js';
const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
const DEFAULT_PITCH=38;
const CDN='/vendor/maplibre/';
let sdk, instance, pending, resizeObserver, userMarker;
let markers=[],mapCallbacks={},worldHandlers=false,mapContainer,lastCamera=null,lastCameraKey='',navigation=0;
export function supportsAtlas(){try{const canvas=document.createElement('canvas');const gl=canvas.getContext('webgl2');if(!gl)return false;gl.getExtension('WEBGL_lose_context')?.loseContext();return true}catch{return false}}
const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
export function flyOverview(){if(!instance)return;const token=++navigation;const fly=()=>{if(instance&&token===navigation)instance.flyTo(atlasFlight({lat:instance.getCenter().lat,lng:instance.getCenter().lng},true,reduced()))};if(instance.getPitch()>.1){instance.once('moveend',fly);instance.easeTo({pitch:0,bearing:0,duration:reduced()?0:350})}else fly()}
export function flyGround(place){if(!instance)return;const center=instance.getCenter(),flight=atlasFlight(place||{lat:center.lat,lng:center.lng},false,reduced()),token=++navigation;
 instance.once('moveend',()=>{if(!instance||token!==navigation||instance.getZoom()<14)return;const c=instance.getCenter();if(Math.abs(c.lat-flight.center[1])>.02||Math.abs(((c.lng-flight.center[0]+540)%360)-180)>.02)return;instance.easeTo({pitch:48,duration:reduced()?0:650})});
 instance.flyTo({...flight,pitch:0,bearing:0});}
export function zoomBy(delta){navigation++;instance?.zoomTo(Math.max(0,Math.min(19,instance.getZoom()+delta)),{duration:reduced()?0:450})}
export function getCamera(){if(!instance||!mapContainer)return null;
 const center=instance.getCenter(),zoom=instance.getZoom(),pitch=instance.getPitch(),bearing=instance.getBearing?.()||0,width=mapContainer.clientWidth,height=mapContainer.clientHeight;
 const key=[center.lat,center.lng,zoom,pitch,bearing,width,height].join('/');if(lastCamera&&key===lastCameraKey)return lastCamera;
 const camera=hybridOpacity(zoom,pitch)>0?fitGlobeCamera(p=>instance.project([p.lng,p.lat]),center,bearing,width,height):null;
 lastCamera={zoom,pitch,center:{lat:center.lat,lng:center.lng},camera,opacity:camera?hybridOpacity(zoom,pitch):0};lastCameraKey=key;return lastCamera;
}
export function isOverview(){return !instance||atlasView(instance.getZoom())==='globe'}

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

export async function connectMap(container,letters,onSelect,callbacks={}){
 mapCallbacks=callbacks;mapContainer=container;
 if(!supportsAtlas())throw Error('webgl_unavailable');
 if(instance)return instance;
 if(!pending)pending=(async()=>{
  const [lib,response]=await Promise.all([loadSDK(),fetch(STYLE_URL,{signal:AbortSignal.timeout(15000)})]);
  if(!response.ok)throw Error('Map style unavailable');
  const style=atlasStyle(pastelStyle(await response.json()),location.origin);
  const map=new lib.Map({container,style,center:[105.8525,21.0285],zoom:1.2,pitch:0,bearing:0,maxPitch:65,maxZoom:19,renderWorldCopies:false,canvasContextAttributes:{antialias:true,powerPreference:'low-power'}});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{map.off('load',loaded);reject(Error('Map timed out'))},20000);
    function loaded(){clearTimeout(timer);resolve()}
    map.once('load',loaded);
   });
   const syncView=()=>{const overview=atlasView(map.getZoom())==='globe';markers.forEach(marker=>{marker.getElement().hidden=overview});mapCallbacks.onView?.(overview?'globe':'street')};
   map.on('zoom',syncView);
   let sentCamera;map.on('render',()=>{const snapshot=getCamera();if(snapshot&&snapshot!==sentCamera){sentCamera=snapshot;mapCallbacks.onCamera?.(snapshot)}});
   map.on('zoomend',()=>{if(map.getZoom()<6&&map.getPitch()>0)map.easeTo({pitch:0,duration:reduced()?0:300})});
   map.on('webglcontextlost',()=>{resizeObserver?.disconnect();instance=null;worldHandlers=false;lastCamera=null;lastCameraKey='';map.remove();mapCallbacks.onError?.('webgl_unavailable')});
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
   addPets(map,letters);
   syncView();
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

function refreshWorldLetters(letters,onSelect){
 const features=letters.map(letter=>({type:'Feature',properties:{id:letter.id},geometry:{type:'Point',coordinates:[letter.lng,letter.lat]}}));
 const source=instance.getSource('midnight-letter-world');
 if(source){source.setData({type:'FeatureCollection',features});return}
 if(!features.length)return;
 instance.addSource('midnight-letter-world',{type:'geojson',data:{type:'FeatureCollection',features},cluster:true,clusterRadius:60,clusterMaxZoom:6});
 instance.addLayer({id:'midnight-letter-world-dot',type:'circle',source:'midnight-letter-world',maxzoom:6,paint:{'circle-radius':['case',['has','point_count'],15,8],'circle-color':'#e2c18b','circle-stroke-color':'#18252d','circle-stroke-width':2}});
 instance.addLayer({id:'midnight-letter-world-count',type:'symbol',source:'midnight-letter-world',maxzoom:6,filter:['has','point_count'],layout:{'text-field':['to-string',['get','point_count_abbreviated']],'text-font':['Noto Sans Regular'],'text-size':11},paint:{'text-color':'#18252d'}});
 if(!worldHandlers){worldHandlers=true;instance.on('click','midnight-letter-world-dot',async event=>{const feature=event.features?.[0];if(!feature)return;if(feature.properties.cluster){try{const zoom=await instance.getSource('midnight-letter-world').getClusterExpansionZoom(feature.properties.cluster_id);instance.flyTo({center:feature.geometry.coordinates,zoom:Math.max(6.2,zoom),pitch:0,duration:reduced()?0:2500})}catch{}}else onSelect([feature.properties.id])});}
}
export function refreshMarkers(letters,onSelect){
 if(!instance)return;
 refreshWorldLetters(letters,onSelect);
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
  button.hidden=isOverview();button.addEventListener('click',()=>onSelect(group.map(item=>item.id)));
  return new globalThis.maplibregl.Marker({element:button}).setLngLat([letter.lng,letter.lat]).addTo(instance);
 });
}
export function panTo(position){flyGround(position)}
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
  flyGround(position);
 }
 userMarker.setLngLat([position.lng,position.lat]);
}
export function clearPosition(){userMarker?.remove();userMarker=null}

const ELEVATION_TILES='https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
let contourDEM,terrainPending;
const terrainColors=new Map();

export function terrainEnabled(){return !!instance?.getTerrain()}

async function loadContours(){
 if(contourDEM)return contourDEM;
 if(!globalThis.mlcontour)await new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src='https://cdn.jsdelivr.net/npm/maplibre-contour@0.1.0/dist/index.min.js';
  const fail=()=>{clearTimeout(timer);script.remove();reject(Error('Contour plugin unavailable'))};
  const timer=setTimeout(fail,8000);
  script.onload=()=>{clearTimeout(timer);resolve()};
  script.onerror=fail;
  document.head.append(script);
 });
 contourDEM=new globalThis.mlcontour.DemSource({url:ELEVATION_TILES,encoding:'terrarium',maxzoom:13,worker:true,cacheSize:100,timeoutMs:10000});
 contourDEM.setupMaplibre(globalThis.maplibregl);
 return contourDEM;
}

export function toggleTerrain(){
 if(!instance)return Promise.resolve(false);
 if(terrainPending)return terrainPending;
 terrainPending=switchTerrain().catch(error=>{clearTerrain(instance);throw error}).finally(()=>{terrainPending=null});
 return terrainPending;
}
function clearTerrain(map){
 map.setTerrain(null);
 for(const id of ['midnight-contour-labels','midnight-contour-lines','midnight-hillshade']){
  if(map.getLayer(id))map.removeLayer(id);
 }
 for(const id of ['midnight-contours','midnight-terrain']){
  if(map.getSource(id))map.removeSource(id);
 }
 for(const [id,property,value] of terrainColors.values())map.setPaintProperty(id,property,value);
 terrainColors.clear();
 return true;
}
async function switchTerrain(){
 const map=instance;
 if(terrainEnabled()){clearTerrain(map);return true}

 const dem=await loadContours().catch(()=>null);
 const layers=map.getStyle().layers;
 const before=layers.find(layer=>layer.type==='symbol'||layer['source-layer']==='transportation')?.id;
 for(const layer of layers){
  const feature=layer['source-layer'];
  const color=layer.type==='background'?'#f3f1e1':layer.type==='fill'?{park:'#c8dfad',landcover:'#d9e7c0',landuse:'#ebe9d4',water:'#9dcbe5',building:'#dfdbcf'}[feature]:null;
  if(!color)continue;
  const property=layer.type==='background'?'background-color':'fill-color';
  terrainColors.set(layer.id,[layer.id,property,map.getPaintProperty(layer.id,property)]);
  map.setPaintProperty(layer.id,property,color);
 }
 map.addSource('midnight-terrain',{
  type:'raster-dem',encoding:'terrarium',tileSize:256,maxzoom:13,
  tiles:[dem?.sharedDemProtocolUrl||ELEVATION_TILES],attribution:'Elevation tiles by Mapzen'
 });
 map.addLayer({
  id:'midnight-hillshade',type:'hillshade',source:'midnight-terrain',minzoom:3,
  paint:{'hillshade-exaggeration':0.55,'hillshade-shadow-color':'#535c46','hillshade-highlight-color':'#fff9e6','hillshade-accent-color':'#829171'}
 },before);
 if(dem){
  map.addSource('midnight-contours',{type:'vector',minzoom:11,maxzoom:15,
   tiles:[dem.contourProtocolUrl({thresholds:{11:[100,500],13:[40,200],15:[20,100]}})]
  });
  map.addLayer({
   id:'midnight-contour-lines',type:'line',source:'midnight-contours','source-layer':'contours',
   filter:['>', ['get','ele'],0],
   paint:{'line-color':'#8a805c','line-opacity':0.62,'line-width':['match',['get','level'],1,1.2,0.55]}
  },before);
  map.addLayer({
   id:'midnight-contour-labels',type:'symbol',source:'midnight-contours','source-layer':'contours',minzoom:12,
   filter:['all',['>', ['get','level'],0],['>', ['get','ele'],0]],
   layout:{'symbol-placement':'line','symbol-spacing':280,'text-font':['Noto Sans Regular'],'text-size':10,'text-field':['concat',['to-string',['get','ele']],' m']},
   paint:{'text-color':'#6f6247','text-halo-color':'#f7f5e4','text-halo-width':1}
  });
 }
 map.setTerrain({source:'midnight-terrain',exaggeration:1.12});
 return !!dem;
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


export function decodeWalkingShape(shape){
 const points=[];
 let index=0,lat=0,lng=0;
 function delta(){
  let value=0,shift=0,chunk;
  do{
   if(index>=shape.length||shift>30)throw Error('Invalid route shape');
   chunk=shape.charCodeAt(index++)-63;
   if(chunk<0||chunk>63)throw Error('Invalid route shape');
   value|=(chunk&31)<<shift;
   shift+=5;
  }while(chunk>=32);
  return value&1?~(value>>1):value>>1;
 }
 while(index<shape.length){lat+=delta();lng+=delta();points.push([lng/1e6,lat/1e6])}
 return points;
}

export async function fetchWalkingRoute(origin,destination,signal){
 const locations=[origin,destination].map(({lat,lng})=>({lat,lon:lng}));
 const url=new URL('https://valhalla1.openstreetmap.de/route');
 url.searchParams.set('json',JSON.stringify({locations,costing:'pedestrian',units:'kilometers'}));
 const response=await fetch(url,{signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});
 if(!response.ok)throw Error('No walking route');
 const {trip}=await response.json();
 const coordinates=trip.legs.flatMap(leg=>decodeWalkingShape(leg.shape));
 if(coordinates.length<2||!Number.isFinite(trip.summary?.length)||!Number.isFinite(trip.summary?.time))throw Error('Invalid walking route');
 return {coordinates,km:trip.summary.length,minutes:Math.max(1,Math.round(trip.summary.time/60))};
}

export function showWalkingRoute(route){
 if(!instance)return;
 const data={type:'Feature',properties:{},geometry:{type:'LineString',coordinates:route.coordinates}};
 const source=instance.getSource('walking-route');
 if(source)source.setData(data);
 else{
  instance.addSource('walking-route',{type:'geojson',data});
  for(const [id,color,width] of [['walking-route-outline','#fffaf0',9],['walking-route-line','#0962da',5]]){
   instance.addLayer({id,type:'line',source:'walking-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':color,'line-width':width}});
  }
 }
 const bounds=new globalThis.maplibregl.LngLatBounds();
 for(const coordinate of route.coordinates)bounds.extend(coordinate);
 instance.fitBounds(bounds,{padding:72,maxZoom:16,duration:650});
}
export function clearWalkingRoute(){
 if(!instance)return;
 for(const id of ['walking-route-line','walking-route-outline'])if(instance.getLayer(id))instance.removeLayer(id);
 if(instance.getSource('walking-route'))instance.removeSource('walking-route');
}
