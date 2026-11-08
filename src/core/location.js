export function distanceMeters(a,b){const r=Math.PI/180;const q=Math.sin((b.lat-a.lat)*r/2)**2+Math.cos(a.lat*r)*Math.cos(b.lat*r)*Math.sin((b.lng-a.lng)*r/2)**2;return Math.round(12742000*Math.atan2(Math.sqrt(q),Math.sqrt(1-q)))}
export function canUnlock(location,letter){return !!location&&Date.now()-location.timestamp<60000&&location.accuracy<=50&&distanceMeters(location,letter)<=100}
