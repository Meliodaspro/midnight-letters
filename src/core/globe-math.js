// Three.js sphere UV convention: Greenwich is +X, east is -Z.
export function globePoint(lat,lng,r=1){const a=lat*Math.PI/180,b=lng*Math.PI/180;return [r*Math.cos(a)*Math.cos(b),r*Math.sin(a),-r*Math.cos(a)*Math.sin(b)]}
export function clusterLetters(letters){const groups=[];for(const letter of letters){let group=groups.find(g=>Math.hypot(g.lat-letter.lat,((g.lng-letter.lng+540)%360)-180)<2);if(!group)groups.push(group={lat:letter.lat,lng:letter.lng,letters:[]});group.letters.push(letter)}return groups}
