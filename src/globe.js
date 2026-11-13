import * as THREE from '../vendor/three.module.min.js';
import {earthVertex,earthFragment} from './earth-shaders/earth.js';
import {cloudsVertex,cloudsFragment} from './earth-shaders/clouds.js';
import {atmosphereVertex,atmosphereFragment} from './earth-shaders/atmosphere.js';
import {sunDirection} from './core/sun.js';
import {globePoint,clusterLetters} from './core/globe-math.js';
// Render on demand: no perpetual rotation or background animation.
async function createWebGLGlobe(host,{letters,onCluster,onError,labels}){
 const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<701;
 const canvasEl=document.createElement('canvas');const context=canvasEl.getContext('webgl2',{alpha:true,antialias:!mobile,powerPreference:'low-power'});if(!context)throw Error('WebGL 2 unavailable');
 const renderer=new THREE.WebGLRenderer({canvas:canvasEl,context,alpha:true,antialias:!mobile,powerPreference:'low-power'});renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.debug.onShaderError=(gl,program)=>{throw Error('Earth shader: '+gl.getProgramInfoLog(program))};
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100),earth=new THREE.Group();scene.add(earth);
 let yaw=105.85,pitch=21.03,radius=3.6,target={yaw,pitch,radius},frame=0,enabled=true,disposed=false,groups=[],pins=[],position=null;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const geometry=new THREE.SphereGeometry(1,mobile?128:192,mobile?64:96);
 // Upstream Earth/cloud/atmosphere GLSL, with image-paint uniforms disabled.
 const loader=new THREE.TextureLoader();let textures;
 const resolution=mobile?'2k':'4k';
 const paths=[`day-${resolution}`,`night-${resolution}`,'clouds-2k','data-1k'];
 try{textures=await Promise.all(paths.map(n=>loader.loadAsync(`/textures/earth-${n}.webp`)))}catch(error){renderer.dispose();renderer.domElement.remove();throw error}
 textures.forEach((t,i)=>{t.colorSpace=i<2?THREE.SRGBColorSpace:THREE.NoColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=Math.min(mobile?4:8,renderer.capabilities.getMaxAnisotropy())});
 const sun={value:new THREE.Vector3(...sunDirection(Date.now()))},cloudOffset={value:0};
 const paint={uCtxMap:{value:textures[0]},uCtxUv:{value:new THREE.Vector4(0,0,1,1)},uCtxOn:{value:0},uCtxLod:{value:0},uDecalMap:{value:textures[0]},uDecalUv:{value:new THREE.Vector4(0,0,1,1)},uDecalOn:{value:0},uDecal2Map:{value:textures[0]},uDecal2Uv:{value:new THREE.Vector4(0,0,1,1)},uDecal2On:{value:0},uDecalLit:{value:0},uDecal2Lit:{value:0},uScanT0:{value:new THREE.Vector3(1,0,0)},uScanS:{value:0},uFull:{value:1},uFreshRad:{value:.001}};
 const material=new THREE.ShaderMaterial({defines:mobile?{LITE:''}:{},vertexShader:earthVertex,fragmentShader:earthFragment,uniforms:{...paint,uDay:{value:textures[0]},uNight:{value:textures[1]},uClouds:{value:textures[2]},uData:{value:textures[3]},uDataTexel:{value:new THREE.Vector2(1/1024,1/512)},uSunDir:sun,uCloudOffset:cloudOffset,uSunIntensity:{value:1.08},uBump:{value:.01},uCloudHeight:{value:.006},uCityColor:{value:new THREE.Color('#ffbd82')},uTwilightColor:{value:new THREE.Color('#ec9c63')},uHazeColor:{value:new THREE.Color('#b4cde6')},uNightTint:{value:new THREE.Color(.86,.92,1)},uReveal:{value:1},uFreshColor:{value:new THREE.Color('#e4bd83')},uDayLod:{value:0},uPanelHalf:{value:0},uPanelTurn:{value:new THREE.Vector2(1,0)},uPanelColor:{value:new THREE.Color('#e8dfcf')}}});
 earth.add(new THREE.Mesh(geometry,material));
 const cloudMaterial=new THREE.ShaderMaterial({defines:mobile?{LITE:''}:{},vertexShader:cloudsVertex,fragmentShader:cloudsFragment,transparent:true,depthWrite:false,uniforms:{...paint,uClouds:{value:textures[2]},uTexel:{value:new THREE.Vector2(1/2048,1/1024)},uSunDir:sun,uCloudOffset:cloudOffset,uSunIntensity:{value:1.08},uCloudColor:{value:new THREE.Color('#e4e3de')},uTwilightColor:{value:new THREE.Color('#ec9c63')},uNightColor:{value:new THREE.Color('#11151c')},uOpacity:{value:1},uCloudFade:{value:1}}});
 const clouds=new THREE.Mesh(geometry,cloudMaterial);clouds.scale.setScalar(1.006);clouds.renderOrder=1;earth.add(clouds);
 const atmosphere=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,vertexShader:atmosphereVertex,fragmentShader:atmosphereFragment,uniforms:{uSunDir:sun,uShell:{value:1.025},uScaleHeight:{value:.0042},uRayleigh:{value:new THREE.Color('#8fb4ec')},uHorizon:{value:new THREE.Color('#dfe9f5')},uTwilightColor:{value:new THREE.Color('#ec9c63')},uIntensity:{value:.85},uReveal:{value:1}}});
 const shell=new THREE.Mesh(geometry,atmosphere);shell.scale.setScalar(1.025);shell.renderOrder=-1;earth.add(shell);
 const points=new Float32Array(2700);let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<900;i++){const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z);points.set([s*Math.cos(a)*15,z*15,s*Math.sin(a)*15],i*3)}
 const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(points,3));const starsMat=new THREE.PointsMaterial({color:0xb8c9d3,size:.018,transparent:true,opacity:.35});scene.add(new THREE.Points(starsGeo,starsMat));
 const user=document.createElement('span');user.className='globe-user';user.hidden=true;user.setAttribute('aria-hidden','true');host.append(user);
 function rebuild(data){groups=clusterLetters(data);pins.forEach(p=>p.remove());pins=groups.map(g=>{const b=document.createElement('button');b.className='globe-pin';b.addEventListener('click',()=>onCluster(g.letters[0].id));host.append(b);return b});setLabels(labels);request()}
 function setLabels(value){labels=value;pins.forEach((b,i)=>{b.textContent='✉ '+groups[i].letters.length+' '+labels.letters;b.setAttribute('aria-label',labels.cluster+' · '+groups[i].letters.length+' '+labels.letters)})}
 function project(el,lat,lng){const p=new THREE.Vector3(...globePoint(lat,lng,1.025));const visible=p.dot(camera.position)>1.04;p.project(camera);el.hidden=!visible;if(visible){el.style.left=(p.x+1)*host.clientWidth/2+'px';el.style.top=(1-p.y)*host.clientHeight/2+'px'}}
 function render(){frame=0;if(disposed||!enabled||document.hidden||!host.clientWidth||!host.clientHeight)return;sun.value.set(...sunDirection(Date.now()));let moving=false;for(const key of ['yaw','pitch','radius']){let value=key==='yaw'?yaw:key==='pitch'?pitch:radius;let delta=target[key]-value;if(key==='yaw')delta=((delta+540)%360)-180;const next=reduced.matches?value+delta:value+delta*.14;if(Math.abs(delta)>.001)moving=true;if(key==='yaw')yaw=next;else if(key==='pitch')pitch=next;else radius=next}camera.position.set(...globePoint(pitch,yaw,radius));camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.render(scene,camera);pins.forEach((p,i)=>project(p,groups[i].lat,groups[i].lng));if(position)project(user,position.lat,position.lng);else user.hidden=true;if(moving)request()}
 function request(){if(!frame&&enabled&&!disposed&&!document.hidden)frame=requestAnimationFrame(render)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=2*Math.atan(Math.tan(17.5*Math.PI/180)/Math.min(1,camera.aspect))*180/Math.PI;camera.updateProjectionMatrix();request()}
 const observer=new ResizeObserver(resize);observer.observe(host);
 let drag=null;const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;target.yaw-=(e.clientX-drag.x)*.3;target.pitch=Math.max(-80,Math.min(80,target.pitch+(e.clientY-drag.y)*.3));drag={x:e.clientX,y:e.clientY};request()});
 const end=()=>drag=null;canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();target.radius=Math.max(2.1,Math.min(5,target.radius+e.deltaY*.002));request()},{passive:false});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();enabled=false;onError()});
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else request()};document.addEventListener('visibilitychange',visibility);
 const sunlightTimer=setInterval(request,60000);
 rebuild(letters);resize();
 try{camera.position.set(...globePoint(pitch,yaw,radius));camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.compile(scene,camera);renderer.render(scene,camera)}catch(error){clearInterval(sunlightTimer);cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);geometry.dispose();material.dispose();cloudMaterial.dispose();atmosphere.dispose();textures.forEach(t=>t.dispose());renderer.dispose();host.replaceChildren();throw error}
 return {setLabels,updateLetters:rebuild,setPosition(p){position=p;request()},flyTo(p){target.yaw=p.lng;target.pitch=p.lat;request()},zoom(delta){target.radius=Math.max(2.1,Math.min(5,target.radius+delta));request()},setActive(active){enabled=active;if(!active){cancelAnimationFrame(frame);frame=0}else{resize();request()}},dispose(){disposed=true;clearInterval(sunlightTimer);cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);geometry.dispose();material.dispose();cloudMaterial.dispose();atmosphere.dispose();starsGeo.dispose();starsMat.dispose();textures.forEach(t=>t.dispose());renderer.dispose();host.replaceChildren()}};
}

export async function createGlobe(host,options){try{return await createWebGLGlobe(host,options)}catch(error){host.replaceChildren();const {createLiteGlobe}=await import("./globe-lite.js");return createLiteGlobe(host,options)}}
