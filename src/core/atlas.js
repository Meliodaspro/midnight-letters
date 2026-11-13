// One camera and one globe projection from world scale to street scale.
export const DEFAULT_PLACE={lat:21.0285,lng:105.8525};
export const atlasView=zoom=>zoom<6?'globe':'street';
export function atlasFlight(place,overview=false,reduced=false){const p=place||DEFAULT_PLACE;return {center:[p.lng,p.lat],zoom:overview?1.2:16.2,pitch:overview?0:48,bearing:overview?0:-18,duration:reduced?0:overview?2200:4200,essential:false}}
export function atlasStyle(style,origin){
 style.projection={type:'globe'};
 style.sky={'sky-color':'#07101b','horizon-color':'#bbd7e8','fog-color':'#d4e2e8','sky-horizon-blend':.65,'horizon-fog-blend':.5,'fog-ground-blend':.3,'atmosphere-blend':['interpolate',['linear'],['zoom'],0,.9,4,.75,7,0]};
 style.sources['midnight-earth']={type:'raster',tiles:[`${origin}/earth-tiles/{z}/{x}/{y}.webp`],tileSize:256,minzoom:0,maxzoom:2,attribution:'Earth: <a href="https://www.solarsystemscope.com/textures/" target="_blank" rel="noopener">Solar System Scope</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>'};
 const layer={id:'midnight-earth',type:'raster',source:'midnight-earth',maxzoom:6,paint:{'raster-opacity':['interpolate',['linear'],['zoom'],0,1,3,1,5.5,0],'raster-fade-duration':0}};
 const firstSymbol=style.layers.findIndex(l=>l.type==='symbol');style.layers.splice(firstSymbol<0?style.layers.length:firstSymbol,0,layer);return style;
}
