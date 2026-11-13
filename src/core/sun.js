// Adapted from dev-Armaan/satellites src/lib/geoCore.ts and geo3.ts.
// Copyright (c) 2026 Armaan Gupta, MIT. See /vendor/WATCHED-LICENSE.txt.
const DEG=Math.PI/180;
export function sunDirection(ms){
 const jd=ms/86400000+2440587.5,n=jd-2451545,t=n/36525;
 let gmst=(-6.2e-6*t*t*t+.093104*t*t+(876600*3600+8640184.812866)*t+67310.54841)*DEG/240;
 const L=(280.46+.9856474*n)%360,g=((357.528+.9856003*n)%360)*DEG;
 const lambda=(L+1.915*Math.sin(g)+.02*Math.sin(2*g))*DEG,eps=(23.439-.0000004*n)*DEG;
 const x=Math.cos(lambda),y=Math.cos(eps)*Math.sin(lambda),z=Math.sin(eps)*Math.sin(lambda);
 const ex=Math.cos(gmst)*x+Math.sin(gmst)*y,ey=-Math.sin(gmst)*x+Math.cos(gmst)*y;
 const r=Math.hypot(ex,ey,z)||1;return [ex/r,z/r,-ey/r];
}
