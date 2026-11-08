// Native Google 3D map. Building detail depends on Google's regional coverage.
let instance,markers=[],userMarker,loading,library;
export function hasMap(){return !!instance}
async function loadGoogle(key){
 if(globalThis.google?.maps)return;
 if(!loading)loading=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const fail=message=>{clearTimeout(timer);loading=null;script.remove();reject(Error(message))};
  const timer=setTimeout(()=>fail('Google Maps timeout'),20000);
  globalThis.midnightMapReady=()=>{clearTimeout(timer);resolve()};
  globalThis.gm_authFailure=()=>{fail('Google Maps authorization failed');window.dispatchEvent(new Event('maps-auth-error'))};
  script.async=true;
  script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&callback=midnightMapReady&v=beta';
  script.onerror=()=>fail('Google Maps unavailable');
  document.head.append(script);
 });
 await loading;
}


export async function connectMap(key,container,letters,onSelect){
 if(instance)return instance;
 await loadGoogle(key);
 library=await google.maps.importLibrary('maps3d');
 const {Map3DElement,Marker3DInteractiveElement}=library;
 if(!Map3DElement||!Marker3DInteractiveElement)throw Error('Google Maps 3D is unavailable');
 const map=new Map3DElement({
  center:{lat:21.0285,lng:105.8525,altitude:0},
  range:1100,tilt:60,heading:15,mode:'HYBRID',
  gestureHandling:'GREEDY'
 });
 map.style.cssText='display:block;width:100%;height:100%';
 map.addEventListener('gmp-error',()=>window.dispatchEvent(new Event('maps-auth-error')));
 container.replaceChildren(map);
 instance=map;
 refreshMarkers(letters,onSelect);
 return instance;
}
export function refreshMarkers(letters,onSelect){
 if(!instance)return;
 markers.forEach(marker=>marker.remove());
 markers=letters.map(letter=>{
  const marker=new library.Marker3DInteractiveElement({
   position:{lat:letter.lat,lng:letter.lng,altitude:8},
   altitudeMode:'RELATIVE_TO_GROUND',extruded:true,
   label:'✉ '+letter.title,drawsWhenOccluded:true
  });
  marker.addEventListener('gmp-click',()=>onSelect(letter.id));
  instance.append(marker);
  return marker;
 });
}
export function panTo(position){
 if(!instance)return;
 instance.center={lat:position.lat,lng:position.lng,altitude:0};
}
export function showPosition(position){
 if(!instance)return;
 const point={lat:position.lat,lng:position.lng,altitude:2};
 if(!userMarker){
  userMarker=new library.Marker3DElement({
   position:point,altitudeMode:'RELATIVE_TO_GROUND',
   label:'GPS ±'+Math.round(position.accuracy)+' m',drawsWhenOccluded:true
  });
  instance.append(userMarker);
 }else{
  userMarker.position=point;
  userMarker.label='GPS ±'+Math.round(position.accuracy)+' m';
 }
}
export function clearPosition(){userMarker?.remove();userMarker=null}
export function invalidate(){
 markers.forEach(marker=>marker.remove());markers=[];
 clearPosition();instance?.remove();instance=null;loading=null;library=null;
}
