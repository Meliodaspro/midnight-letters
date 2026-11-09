const STYLE_URL='https://tiles.openfreemap.org/styles/liberty';
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
  const map=new lib.Map({container,style,center:[105.8525,21.0285],zoom:16.3,pitch:52,bearing:-18,maxPitch:65});
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
    else if(overview&&zoom>=14){overview=false;map.easeTo({pitch:52,duration:300})}
   });
   map.addControl(new lib.NavigationControl({visualizePitch:true}),'bottom-right');
   resizeObserver=new ResizeObserver(()=>{if(container.clientWidth&&container.clientHeight)map.resize()});
   resizeObserver.observe(container);
   instance=map;
   refreshMarkers(letters,onSelect);
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

export function refreshMarkers(letters,onSelect){
 if(!instance)return;
 markers.forEach(marker=>marker.remove());
 markers=letters.map(letter=>{
  const button=document.createElement('button');
  button.type='button';
  button.className='storybook-pin';
  button.setAttribute('aria-label',letter.place||letter.title);
  button.innerHTML='<svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true"><rect x="2" y="3" width="26" height="18" rx="4" fill="#fff7df" stroke="#8b7051" stroke-width="2"/><path d="m3 5 12 9L27 5" fill="none" stroke="#8b7051" stroke-width="1.6"/><circle cx="15" cy="14" r="3" fill="#d98874"/></svg>';
  button.addEventListener('click',()=>onSelect(letter.id));
  return new globalThis.maplibregl.Marker({element:button}).setLngLat([letter.lng,letter.lat]).addTo(instance);
 });
}
export function panTo(position){instance?.easeTo({center:[position.lng,position.lat],duration:500})}
export function showPosition(position){
 if(!instance)return;
 if(!userMarker){
  const element=document.createElement('div');
  element.className='storybook-user';
  element.setAttribute('role','img');
  element.setAttribute('aria-label','GPS');
  userMarker=new globalThis.maplibregl.Marker({element});
  userMarker.setLngLat([position.lng,position.lat]).addTo(instance);
 }
 userMarker.setLngLat([position.lng,position.lat]);
}
export function clearPosition(){userMarker?.remove();userMarker=null}
