// Pastel storybook styling applied to Google's road, park and water data.
export const cartoonStyles = [
 {elementType:'geometry',stylers:[{color:'#f3ead3'}]},
 {elementType:'labels.text.fill',stylers:[{color:'#586653'}]},
 {elementType:'labels.text.stroke',stylers:[{color:'#fff9e9'},{weight:3}]},
 {elementType:'labels.icon',stylers:[{visibility:'off'}]},
 {featureType:'administrative',elementType:'geometry.stroke',stylers:[{color:'#c4c9a5'}]},
 {featureType:'landscape.natural',elementType:'geometry',stylers:[{color:'#d8e7b5'}]},
 {featureType:'landscape.man_made',elementType:'geometry',stylers:[{color:'#eee1c7'}]},
 {featureType:'poi',stylers:[{visibility:'off'}]},
 {featureType:'poi.park',elementType:'geometry',stylers:[{visibility:'on'},{color:'#b9d797'}]},
 {featureType:'poi.park',elementType:'labels.text',stylers:[{visibility:'on'}]},
 {featureType:'road',elementType:'geometry.fill',stylers:[{color:'#fffbee'}]},
 {featureType:'road',elementType:'geometry.stroke',stylers:[{color:'#d7c6a0'},{weight:1.5}]},
 {featureType:'road.highway',elementType:'geometry.fill',stylers:[{color:'#f4cd8d'}]},
 {featureType:'road.highway',elementType:'geometry.stroke',stylers:[{color:'#d3ac72'}]},
 {featureType:'road.local',elementType:'labels.text.fill',stylers:[{color:'#839078'}]},
 {featureType:'transit',stylers:[{visibility:'off'}]},
 {featureType:'water',elementType:'geometry',stylers:[{color:'#9dd5d6'}]},
 {featureType:'water',elementType:'labels.text.fill',stylers:[{color:'#43868b'}]}
];
let instance,markers=[],userMarker,circle,loading,PinOverlay;

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
  script.src='https://maps.googleapis.com/maps/api/js?key='+encodeURIComponent(key)+'&loading=async&callback=midnightMapReady&v=weekly';
  script.onerror=()=>fail('Google Maps unavailable');
  document.head.append(script);
 });
 await loading;
}

export async function connectMap(key,container,letters,onSelect){
 if(instance)return instance;
 await loadGoogle(key);
 const {Map,OverlayView}=await google.maps.importLibrary('maps');
 // OverlayView keeps our illustrated pins while allowing local JSON styling,
 // which Google does not support together with a map ID.
 PinOverlay=class extends OverlayView{
  constructor(position,element){super();this.position=position;this.element=element;this.element.style.position='absolute';this.element.style.transform='translate(-50%,-100%)';OverlayView.preventMapHitsAndGesturesFrom(element);this.setMap(instance)}
  onAdd(){this.getPanes().overlayMouseTarget.append(this.element)}
  draw(){const point=this.getProjection().fromLatLngToDivPixel(new google.maps.LatLng(this.position));if(point){this.element.style.left=point.x+'px';this.element.style.top=point.y+'px'}}
  onRemove(){this.element.remove()}
  move(position){this.position=position;this.draw()}
 };
 instance=new Map(container,{
  center:{lat:21.0285,lng:105.8525},zoom:16,
  mapTypeId:'roadmap',renderingType:google.maps.RenderingType.RASTER,
  styles:cartoonStyles,backgroundColor:'#f3ead3',
  disableDefaultUI:true,zoomControl:true,zoomControlOptions:{position:google.maps.ControlPosition.RIGHT_CENTER},
  gestureHandling:'greedy',clickableIcons:false,streetViewControl:false,mapTypeControl:false,
  tilt:0
 });
 refreshMarkers(letters,onSelect);
 return instance;
}

export function refreshMarkers(letters,onSelect){
 if(!instance)return;
 markers.forEach(marker=>marker.setMap(null));
 markers=letters.map(letter=>{
  const button=document.createElement('button');
  button.className='storybook-pin';
  button.setAttribute('aria-label',letter.title);
  button.title=letter.title;
  button.innerHTML='<svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true"><rect x="2" y="3" width="26" height="18" rx="4" fill="#fff7df" stroke="#8b7051" stroke-width="2"/><path d="m3 5 12 9L27 5M3 20l9-8m15 8-9-8" fill="none" stroke="#8b7051" stroke-width="1.6"/><circle cx="15" cy="14" r="3" fill="#d98874"/></svg>';
  button.onclick=()=>onSelect(letter.id);
  return new PinOverlay({lat:letter.lat,lng:letter.lng},button);
 });
}
export function panTo(position){instance?.panTo({lat:position.lat,lng:position.lng})}
export function showPosition(position){
 if(!instance)return;
 if(!userMarker){
  const element=document.createElement('div');
  element.className='storybook-user';
  element.setAttribute('role','img');element.setAttribute('aria-label','GPS');
  userMarker=new PinOverlay(position,element);
  circle=new google.maps.Circle({map:instance,strokeColor:'#5a9b91',strokeWeight:2,strokeOpacity:.5,fillColor:'#83c7b0',fillOpacity:.18,clickable:false});
 }
 const point={lat:position.lat,lng:position.lng};
 userMarker.move(point);circle.setCenter(point);circle.setRadius(position.accuracy);
}
export function clearPosition(){userMarker?.setMap(null);circle?.setMap(null);userMarker=null;circle=null}
export function invalidate(){markers.forEach(marker=>marker.setMap(null));clearPosition();instance=null;markers=[];loading=null}
