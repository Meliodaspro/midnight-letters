import * as THREE from '../vendor/three.module.min.js';
import {globePoint,clusterLetters} from './core/globe-math.js';
// Render on demand: no perpetual rotation or background animation.
async function createWebGLGlobe(host,{letters,onCluster,onError,labels}){
 const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<701;
 const renderer=new THREE.WebGLRenderer({alpha:true,antialias:!mobile,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,mobile?1.5:2));renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-hidden','true');host.append(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,1,.1,100),earth=new THREE.Group();scene.add(earth);
 let yaw=105.85,pitch=21.03,radius=3.45,target={yaw,pitch,radius},frame=0,enabled=true,disposed=false,groups=[],pins=[],position=null;
 const reduced=matchMedia('(prefers-reduced-motion:reduce)');
 const geometry=new THREE.SphereGeometry(1,mobile?64:96,mobile?32:48);
 const loader=new THREE.TextureLoader();let textures;
 try{textures=await Promise.all(['day','night'].map(n=>loader.loadAsync(`/textures/earth-${n}-2k.webp`)))}catch(error){renderer.dispose();renderer.domElement.remove();throw error}
 textures.forEach(t=>{t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())});
 const material=new THREE.ShaderMaterial({uniforms:{dayMap:{value:textures[0]},nightMap:{value:textures[1]},sun:{value:new THREE.Vector3(-.5,.6,-1).normalize()}},vertexShader:`varying vec2 vUv;varying vec3 vNormal;void main(){vUv=uv;vNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D dayMap;uniform sampler2D nightMap;uniform vec3 sun;varying vec2 vUv;varying vec3 vNormal;void main(){float light=dot(normalize(vNormal),sun);float day=smoothstep(-.22,.3,light);vec3 land=texture2D(dayMap,vUv).rgb;vec3 night=texture2D(nightMap,vUv).rgb;vec3 color=mix(land*.075+night*1.65,land*(.45+.55*max(light,0.)),day);gl_FragColor=vec4(color,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
 earth.add(new THREE.Mesh(geometry,material));
 const atmosphere=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,vertexShader:`varying vec3 vNormal;varying vec3 vView;void main(){vec4 p=modelViewMatrix*vec4(position,1.);vNormal=normalize(normalMatrix*normal);vView=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,fragmentShader:`varying vec3 vNormal;varying vec3 vView;void main(){float rim=pow(1.-abs(dot(normalize(vNormal),normalize(vView))),3.);gl_FragColor=vec4(.24,.5,.7,rim*.42);}`});
 const shell=new THREE.Mesh(geometry,atmosphere);shell.scale.setScalar(1.035);earth.add(shell);
 const points=new Float32Array(900);let seed=42;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};for(let i=0;i<300;i++){const z=random()*2-1,a=random()*Math.PI*2,s=Math.sqrt(1-z*z);points.set([s*Math.cos(a)*15,z*15,s*Math.sin(a)*15],i*3)}
 const starsGeo=new THREE.BufferGeometry();starsGeo.setAttribute('position',new THREE.BufferAttribute(points,3));const starsMat=new THREE.PointsMaterial({color:0xb8c9d3,size:.025,transparent:true,opacity:.55});scene.add(new THREE.Points(starsGeo,starsMat));
 const user=document.createElement('span');user.className='globe-user';user.hidden=true;user.setAttribute('aria-hidden','true');host.append(user);
 function rebuild(data){groups=clusterLetters(data);pins.forEach(p=>p.remove());pins=groups.map(g=>{const b=document.createElement('button');b.className='globe-pin';b.addEventListener('click',()=>onCluster(g.letters[0].id));host.append(b);return b});setLabels(labels);request()}
 function setLabels(value){labels=value;pins.forEach((b,i)=>{b.textContent='✉ '+groups[i].letters.length+' '+labels.letters;b.setAttribute('aria-label',labels.cluster+' · '+groups[i].letters.length+' '+labels.letters)})}
 function project(el,lat,lng){const p=new THREE.Vector3(...globePoint(lat,lng,1.025));const visible=p.dot(camera.position)>1.04;p.project(camera);el.hidden=!visible;if(visible){el.style.left=(p.x+1)*host.clientWidth/2+'px';el.style.top=(1-p.y)*host.clientHeight/2+'px'}}
 function render(){frame=0;if(disposed||!enabled||document.hidden||!host.clientWidth||!host.clientHeight)return;let moving=false;for(const key of ['yaw','pitch','radius']){let value=key==='yaw'?yaw:key==='pitch'?pitch:radius;let delta=target[key]-value;if(key==='yaw')delta=((delta+540)%360)-180;const next=reduced.matches?value+delta:value+delta*.14;if(Math.abs(delta)>.001)moving=true;if(key==='yaw')yaw=next;else if(key==='pitch')pitch=next;else radius=next}camera.position.set(...globePoint(pitch,yaw,radius));camera.lookAt(0,0,0);camera.updateMatrixWorld();renderer.render(scene,camera);pins.forEach((p,i)=>project(p,groups[i].lat,groups[i].lng));if(position)project(user,position.lat,position.lng);else user.hidden=true;if(moving)request()}
 function request(){if(!frame&&enabled&&!disposed&&!document.hidden)frame=requestAnimationFrame(render)}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();request()}
 const observer=new ResizeObserver(resize);observer.observe(host);
 let drag=null;const canvas=renderer.domElement;
 canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId)});
 canvas.addEventListener('pointermove',e=>{if(!drag)return;target.yaw-=(e.clientX-drag.x)*.3;target.pitch=Math.max(-80,Math.min(80,target.pitch+(e.clientY-drag.y)*.3));drag={x:e.clientX,y:e.clientY};request()});
 const end=()=>drag=null;canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();target.radius=Math.max(2.1,Math.min(5,target.radius+e.deltaY*.002));request()},{passive:false});
 canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();enabled=false;onError()});
 const visibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0}else request()};document.addEventListener('visibilitychange',visibility);
 rebuild(letters);resize();
 return {setLabels,updateLetters:rebuild,setPosition(p){position=p;request()},flyTo(p){target.yaw=p.lng;target.pitch=p.lat;request()},zoom(delta){target.radius=Math.max(2.1,Math.min(5,target.radius+delta));request()},setActive(active){enabled=active;if(!active){cancelAnimationFrame(frame);frame=0}else{resize();request()}},dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();document.removeEventListener('visibilitychange',visibility);geometry.dispose();material.dispose();atmosphere.dispose();starsGeo.dispose();starsMat.dispose();textures.forEach(t=>t.dispose());renderer.dispose();host.replaceChildren()}};
}

export async function createGlobe(host,options){try{return await createWebGLGlobe(host,options)}catch(error){host.replaceChildren();const {createLiteGlobe}=await import("./globe-lite.js");return createLiteGlobe(host,options)}}
