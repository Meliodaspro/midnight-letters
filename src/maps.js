let instance,markers=[],userMarker,circle,loading;
export function hasMap(){return !!instance}
export async function connectMap(key,container,letters,onSelect){
 if(instance)return instance;
 if(!globalThis.google?.maps){
  if(!loading)loading=new Promise((resolve,reject)=>{globalThis.midnightMapReady=resolve;globalThis.gm_authFailure=()=>{loading=null;reject(Error('Google Maps authorization failed'));window.dispatchEvent(new Event('maps-auth-error'))};const script=document.createElement('script');script.async=true;script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&callback=midnightMapReady&v=weekly';script.onerror=()=>{loading=null;reject(Error('Google Maps unavailable'))};document.head.append(script);setTimeout(()=>reject(Error('Google Maps timeout')),20000)});
  await loading;
 }
 const {Map}=await google.maps.importLibrary('maps');const {AdvancedMarkerElement}=await google.maps.importLibrary('marker');
 instance=new Map(container,{center:{lat:21.0285,lng:105.8525},zoom:16,mapId:'DEMO_MAP_ID',colorScheme:google.maps.ColorScheme.DARK,disableDefaultUI:true,zoomControl:true,gestureHandling:'greedy',clickableIcons:false});
 refreshMarkers(letters,onSelect,AdvancedMarkerElement);return instance;
}
export async function refreshMarkers(letters,onSelect,Marker){if(!instance)return;Marker??=(await google.maps.importLibrary('marker')).AdvancedMarkerElement;markers.forEach(m=>m.map=null);markers=letters.map(d=>{const button=document.createElement('button');button.className='stamp';button.style.cssText='background:#203438;width:44px;height:44px;font-size:22px;cursor:pointer';button.textContent='✉';button.setAttribute('aria-label',d.title);button.onclick=()=>onSelect(d.id);return new Marker({map:instance,position:{lat:d.lat,lng:d.lng},content:button,title:d.title})})}
export function panTo(position){instance?.panTo({lat:position.lat,lng:position.lng})}
export async function showPosition(position){if(!instance)return;const {AdvancedMarkerElement}=await google.maps.importLibrary('marker');if(!userMarker){const el=document.createElement('div');el.style.cssText='width:17px;height:17px;background:#e5ca97;border:3px solid white;border-radius:50%';userMarker=new AdvancedMarkerElement({map:instance,content:el});circle=new google.maps.Circle({map:instance,strokeColor:'#e5ca97',strokeOpacity:.2,fillColor:'#e5ca97',fillOpacity:.08})}const point={lat:position.lat,lng:position.lng};userMarker.position=point;circle.setCenter(point);circle.setRadius(position.accuracy)}
export function clearPosition(){if(userMarker)userMarker.map=null;if(circle)circle.setMap(null);userMarker=null;circle=null}

export function invalidate(){instance=null;markers=[];userMarker=null;circle=null;loading=null}
