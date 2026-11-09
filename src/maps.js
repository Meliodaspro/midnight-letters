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

function nightStyle(style){
 const building=style.layers.find(layer=>layer.type==='fill'&&layer['source-layer']==='building');
 for(const layer of style.layers){
  const feature=layer['source-layer'];
  if(layer.type==='background')layer.paint={'background-color':'#18272e'};
  if(layer.type==='fill'){
   const color={water:'#235663',landcover:'#29453c',landuse:'#293c38',park:'#2b493d',building:'#405455'}[feature];
   layer.paint={...layer.paint,'fill-color':color||'#23343a','fill-outline-color':color||'#23343a'};
  }
  if(layer.type==='line'){
   const color=feature==='transportation'?(layer.id.includes('casing')?'#29383c':'#76847e'):feature==='waterway'?'#326572':'#536763';
   layer.paint={...layer.paint,'line-color':color};
  }
  if(layer.type==='symbol'&&layer.layout?.['text-field']){
   layer.paint={...layer.paint,'text-color':'#dfddc8','text-halo-color':'#17272d','text-halo-width':1.2};
  }
 }
 if(building){
  const labelIndex=style.layers.findIndex(layer=>layer.type==='symbol');
  style.layers.splice(labelIndex<0?style.layers.length:labelIndex,0,{
   id:'midnight-buildings',type:'fill-extrusion',source:building.source,'source-layer':'building',minzoom:15,
   paint:{
    'fill-extrusion-color':'#536d69',
    'fill-extrusion-height':['max',0,['to-number',['get','render_height'],['get','height'],0]],
    'fill-extrusion-base':['max',0,['to-number',['get','render_min_height'],0]],
    'fill-extrusion-opacity':0.85
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
  const style=nightStyle(await response.json());
  const map=new lib.Map({container,style,center:[105.8525,21.0285],zoom:16.3,pitch:52,bearing:-18,maxPitch:65});
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{map.off('load',loaded);reject(Error('Map timed out'))},20000);
    function loaded(){clearTimeout(timer);resolve()}
    map.once('load',loaded);
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
