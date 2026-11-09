import {hasAbuse} from './moderation.js';
import {messages} from './i18n.js';import {seeds} from './core/seed.js';import {read,write} from './core/storage.js';import {distanceMeters,canUnlock} from './core/location.js';import * as maps from './maps.js';
const $=s=>document.querySelector(s);const icons={compass:'<circle cx="12" cy="12" r="9"/><path d="m16 8-2.5 5.5L8 16l2.5-5.5Z"/>',pen:'<path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/>',heart:'<path d="M20 5c-3-3-6-1-8 1-2-2-5-4-8-1s-1 7 8 14c9-7 11-11 8-14Z"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',close:'<path d="m6 6 12 12M6 18 18 6"/>',locate:'<circle cx="12" cy="12" r="6"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',shield:'<path d="m12 3 8 3v6c0 4-8 9-8 9s-8-5-8-9V6Z"/><path d="m8 12 3 3 5-6"/>',list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h1M3 12h1M3 18h1"/>',map:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Zm6-2v16m6-14v16"/>',chevron:'<path d="m9 5 7 7-7 7"/>',check:'<path d="m5 12 4 4L19 6"/>'};
const icon=name=>`<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name]||icons.mail}</svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lang=read('language','vi');if(!messages[lang])lang='vi';let view='explore',filter='all',query='',selected='lake',mode='demo',near=new Set(),position=null,watch=null,listMode=false,toastTimer,modalReturn;
let letters=read('letters',[]);if(!Array.isArray(letters))letters=[];letters=letters.filter(d=>d&&typeof d.id==='string'&&typeof d.body==='string'&&Number.isFinite(d.lat)&&Number.isFinite(d.lng));
let account=null,accountLetters=[];
let saved=read('saved',[]);if(!Array.isArray(saved))saved=[];let mapState='idle';const mapHost=document.createElement('div');mapHost.id='map';
const t=k=>messages[lang][k]||k;const localLetters=()=>letters.filter(letter=>!accountLetters.some(saved=>saved.id===letter.id));const all=()=>[...seeds,...localLetters(),...accountLetters];const current=()=>all().find(d=>d.id===selected)||seeds[0];const text=(d,key)=>lang==='en'&&d[key+'En']?d[key+'En']:d[key];
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').style.display='block';toastTimer=setTimeout(()=>$('#toast').style.display='none',3300)}
function distance(d){return position?distanceMeters(position,d):null}
function range(d){const n=distance(d);return n===null?t('unknown'):(n>=1000?(n/1000).toFixed(1)+' km':n+' m')+' '+t('away')}
function unlocked(d){return mode==='demo'?near.has(d.id):canUnlock(position,d)}
function selectedCards(){return all().filter(d=>(filter==='all'||d.tag===filter)&&(!query||(text(d,'title')+' '+text(d,'place')).toLocaleLowerCase().includes(query.toLocaleLowerCase())))}
function nav(){return `<nav class="nav" aria-label="${t('brand')}"><div class="wordmark">m<span>.</span></div>${['explore','write','saved','profile'].map((key,i)=>`<button class="${view===key?'active':''} ${key==='profile'?'account':''}" data-nav="${key}" ${view===key?'aria-current="page"':''}><span class="nav-icon">${icon(['compass','pen','heart','user'][i])}</span><span class="nav-label">${key==='profile'?(lang==='vi'?'Tài khoản':'Account'):t(key)}</span></button>`).join('')}</nav>`}
function stationery(tag='peace',large=false){return `<div class="stationery ${esc(tag)} ${large?'large':''}" aria-hidden="true"><span class="orbit orbit-one"></span><span class="orbit orbit-two"></span><span class="little-star">✧</span><span class="little-star second">✦</span><div class="envelope"><span class="envelope-flap"></span><span class="envelope-seal">m.</span></div></div>`}
function card(d,readable=false){return `<button class="letter-card topic-${esc(d.tag)} ${selected===d.id?'selected':''}" data-${readable?'read':'select'}="${esc(d.id)}"><div class="card-top"><span class="topic-label"><i></i>${t(d.tag)}</span><span class="card-number">${d.local?'✧':'0'+(seeds.indexOf(d)+1)}</span></div><div class="card-inner">${stationery(d.tag)}<div class="card-copy"><span class="place">${icon('pin')}${esc(text(d,'place'))}</span><h3>${esc(text(d,'title'))}</h3>${readable||unlocked(d)?`<p>${esc(text(d,'body').split('\n')[0])}</p>`:''}</div></div><div class="row meta"><span class="sender"><span class="sender-dot">${esc(d.author.charAt(0))}</span>${esc(d.author)}</span><span class="card-action">${readable?t('read'):mode==='demo'?(near.has(d.id)?t('open'):t('sample')):range(d)} ${icon('arrow')}</span></div></button>`}
function explorePanel(){return `<div class="explore-brand"><span class="brand-spark">✧</span><span class="eyebrow">MIDNIGHT LETTERS</span><span class="brand-edition">VOL. 01</span></div><div class="eyebrow intro-eyebrow">${t('hello')}</div><h1>${t('headline')}</h1><p class="sub">${t('sub')}</p><button class="mobile-switch" id="list-toggle" aria-label="${t(listMode?'map':'list')}">${icon(listMode?'map':'list')}</button><div class="search">${icon('search')}<input id="search" type="search" aria-label="${t('search')}" placeholder="${t('search')}" value="${esc(query)}"></div><div class="filters">${['all','peace','love','journey'].map(k=>`<button class="chip ${filter===k?'active':''}" data-filter="${k}" aria-pressed="${filter===k}">${t(k)}</button>`).join('')}</div><div class="row section-title"><span>${icon('compass')} ${t('nearby')}</span><span class="counter" id="letter-count">${selectedCards().length} ${t('letters')}</span></div><div class="cards" id="cards">${cardsHTML()}</div>`}
function cardsHTML(){const ds=selectedCards();return ds.length?ds.map(d=>card(d)).join(''):`<div class="empty">${t('empty')}</div>`}
function mapHTML(){return `<div class="map-toolbar"><div class="segmented" aria-label="${t('gps')}"><button data-mode="demo" class="${mode==='demo'?'active':''}">${t('demo')}</button><button data-mode="gps" class="${mode==='gps'?'active':''}">${t('gps')}</button></div><div class="row"><button class="icon-button" id="map-settings" aria-label="${t('settings')}">${icon('map')}</button><button class="icon-button" id="locate" aria-label="${t('recenter')}">${icon('locate')}</button></div></div><div class="map-label"><div class="status"><span class="status-dot"></span><span id="position-status">${mode==='demo'?'HÀ NỘI · '+t('demo'):position?t('accuracy')+' ±'+Math.round(position.accuracy)+' m':t('unknown')}</span></div><p>${t(mode==='demo'?'demoHint':'gpsHint')}</p>${navigator.onLine?'':`<p class="offline">${t('offline')}</p>`}</div><div class="map-connect" ${maps.hasMap()?'hidden':''}><span id="map-message">${t(mapState==='loading'?'loadingMap':mapState==='error'?'mapError':'mapMissing')}</span><button id="connect-shortcut">${t('mapSetup')} ↗</button></div><div class="map-canvas"><div class="map-surface"><div class="lake"><span>HỒ HOÀN KIẾM</span></div></div><div id="map-mount" style="position:absolute;inset:0;visibility:${maps.hasMap()?'visible':'hidden'}"></div><div class="sample-pins">${seeds.map((d,i)=>`<button class="marker ${selected===d.id?'selected':''}" style="left:${[47,67,79][i]}%;top:${[48,34,62][i]}%" data-select="${d.id}" aria-label="${esc(text(d,'title'))}">${icon('mail')}<span>${esc(text(d,'place'))}</span></button>`).join('')}<div class="marker me" style="left:54%;top:59%"></div></div></div><div class="proximity-hint" id="proximity-hint">${proximityHTML()}</div><section class="detail" id="detail" aria-live="polite">${detailHTML()}</section><div class="map-credit">${maps.hasMap()?'':t('mapDemo')}</div>`}
function proximityHTML(){if(unlocked(current()))return '';return `<span>${lang==='en'?'Move within 100 m to discover a letter.':'Đến trong phạm vi 100 m để khám phá thư.'}</span><button class="secondary" id="approach">${mode==='demo'?t('approach'):t('locate')}</button>`}
function detailHTML(){const d=current(),ok=unlocked(d);if(!ok)return '';return `<div class="detail-grip" aria-hidden="true"></div><div class="detail-heading"><span class="detail-seal">${icon('mail')}</span><div><div class="eyebrow">${t(d.tag)}</div><div class="place">${esc(text(d,'place'))}</div></div><span class="detail-star" aria-hidden="true">✧</span></div><div class="row detail-meta"><span class="eyebrow">${t(d.local?'local':'preview')}</span><span class="info">${mode==='demo'?t('sample'):range(d)}</span></div><h2>${esc(text(d,'title'))}</h2><p class="teaser">“${esc(text(d,'body').split('\n')[0])}”</p><div class="row"><span class="info">${icon('pin')} ${esc(text(d,'place'))}</span><button class="gold" id="unlock" ${mode==='gps'&&position&&!ok?'disabled':''}>${t(ok?'open':mode==='demo'?'approach':position?'locked':'locate')} ${icon(ok?'mail':'arrow')}</button></div>`}
function writePanel(){if(!account)return `<div class="content-width"><div class="page-emblem">${icon('pen')}</div><h1>${t('composeTitle')}</h1><div class="empty"><p>${lang==='vi'?'Đăng nhập để viết và lưu thư vào tài khoản.':'Sign in to write and save letters to your account.'}</p><button class="gold" id="account-settings">${lang==='vi'?'Đăng nhập / Đăng ký':'Sign in / Register'}</button></div></div>`;return `<div class="content-width"><div class="page-emblem" aria-hidden="true">${icon('pen')}</div><div class="eyebrow">MIDNIGHT · ${t('write')}</div><h1>${t('composeTitle')}</h1><p class="sub">${t('composeSub')}</p><div class="local-note">${icon('shield')} ${lang==='vi'?'Thư được lưu vào tài khoản của bạn.':'Letters are saved to your account.'}</div><form class="form compose-paper" id="compose"><div class="paper-topline"><span>MIDNIGHT POST</span><button class="secondary" type="button" id="suggest-letter" style="color:inherit;border-color:#a7a18f">${lang==='vi'?'✦ Gợi ý bằng AI':'✦ Suggest with AI'}</button></div><label for="letter-title">${t('title')}</label><input id="letter-title" name="title" required maxlength="80" placeholder="${t('titleHint')}"><label for="letter-body">${t('body')}</label><textarea id="letter-body" name="body" required maxlength="3000" placeholder="${t('bodyHint')}"></textarea><div class="char-count"><span id="chars">0</span> / 3000</div><div class="row"><div style="flex:1"><label for="letter-author">${t('author')}</label><input id="letter-author" name="author" maxlength="50" placeholder="${t('anonymous')}"></div><div style="flex:1"><label for="letter-topic">${t('topic')}</label><select id="letter-topic" name="tag">${['peace','love','journey'].map(k=>`<option value="${k}">${t(k)}</option>`).join('')}</select></div></div><label for="letter-place">${t('place')}</label><select name="place" id="letter-place"><option value="current" selected>${t('currentPlace')}</option><option value="selected">${t('selectedPlace')}: ${esc(text(current(),'place'))}</option></select><p id="compose-location-status" class="form-footer" role="status"></p><button class="gold" type="submit">${icon('pen')}${lang==='vi'?'Lưu thư':'Save letter'}</button><p class="form-footer">${t('safe')}</p></form></div>`}
function savedPanel(){const ds=all().filter(d=>saved.includes(d.id)||d.local);return `<div class="content-width"><div class="page-emblem" aria-hidden="true">${icon('heart')}</div><div class="eyebrow">MIDNIGHT · ${t('saved')}</div><h1>${t('savedTitle')}</h1><p class="sub">${t('savedSub')}</p>${ds.length?`<div class="saved-grid">${ds.map(d=>card(d,true)).join('')}</div>`:`<div class="empty">${icon('heart')}<p>${t('savedEmpty')}</p><button class="gold" style="margin-top:20px" data-nav="explore">${t('explore')}${icon('arrow')}</button></div>`}<p class="fine-print">${t('device')}</p></div>`}
function profilePanel(){return `<div class="content-width"><div class="page-emblem" aria-hidden="true">${icon('user')}</div><div class="eyebrow">MIDNIGHT · ${t('profile')}</div><h1>${t('profileTitle')}</h1><p class="sub">${t('profileSub')}</p><div class="profile-card"><div class="avatar">m.</div><div><strong>${t('guest')}</strong><p>${t('device')}</p></div></div><div class="stats"><div class="stat"><strong>${saved.length}</strong><span>${t('memories')}</span></div><div class="stat"><strong>${letters.length}</strong><span>${t('drafts')}</span></div></div><div class="settings-group"><button class="setting-row" id="account-settings"><span>${icon('user')} ${account?esc(account.username):lang==='vi'?'Đăng nhập / Đăng ký':'Sign in / Register'}</span>${icon('chevron')}</button><label class="setting-row" for="language"><span>${icon('globe')}${t('language')}</span><select id="language"><option value="vi" ${lang==='vi'?'selected':''}>Tiếng Việt</option><option value="en" ${lang==='en'?'selected':''}>English</option></select></label><button class="setting-row" id="settings-map"><span>${icon('map')}${t('maps')}</span><small>${t(maps.hasMap()?'connected':'notConnected')} ›</small></button><button class="setting-row" id="privacy"><span>${icon('shield')}${t('privacy')}</span>${icon('chevron')}</button><button class="setting-row" id="about"><span>${icon('mail')}${t('about')}</span><small>0.2.0 ›</small></button></div><p class="fine-print">${t('install')}</p></div>`}
let composeFix=null, pendingComposeFix=null;
function freshComposeFix(fix){
 return fix&&Date.now()-fix.timestamp<=60000&&fix.accuracy<=50;
}
function getComposeFix(){
 if(freshComposeFix(position))return Promise.resolve(position);
 if(freshComposeFix(composeFix))return Promise.resolve(composeFix);
 if(!navigator.geolocation)return Promise.resolve(null);
 if(!pendingComposeFix)pendingComposeFix=new Promise(resolve=>{
  navigator.geolocation.getCurrentPosition(result=>{
   const {latitude:lat,longitude:lng,accuracy}=result.coords;
   composeFix={lat,lng,accuracy,timestamp:result.timestamp};
   resolve(freshComposeFix(composeFix)?composeFix:null);
  },()=>resolve(null),{enableHighAccuracy:true,maximumAge:15000,timeout:15000});
 }).finally(()=>{pendingComposeFix=null});
 return pendingComposeFix;
}
async function updateComposeLocation(form){
 const status=form.querySelector('#compose-location-status');
 if(form.elements.place.value!=='current'){status.textContent='';return null}
 status.textContent=t('waiting');
 const fix=await getComposeFix();
 if(form.isConnected&&form.elements.place.value==='current'){
  status.textContent=fix
   ?(lang==='vi'?'Đã lấy vị trí · sai số ':'Location acquired · accuracy ')+Math.round(fix.accuracy)+' m'
   :(lang==='vi'?'Chưa lấy được vị trí đủ chính xác. Kiểm tra quyền định vị rồi bấm Lưu thư để thử lại.':'Could not get an accurate location. Check location permissions and tap Save letter to retry.');
 }
 return fix;
}
function render(){mapHost.remove();document.documentElement.lang=lang;document.title='Midnight · '+t('brand');$('#app').innerHTML=`<div class="shell view-${view} ${view!=='explore'?'full-page':''} ${listMode?'list-mode':''}">${nav()}<aside class="panel">${view==='explore'?explorePanel():view==='write'?writePanel():view==='saved'?savedPanel():profilePanel()}</aside><main class="map-pane ${maps.hasMap()?'live':''}" aria-label="${t('map')}">${mapHTML()}</main></div>`;$('#map-mount').append(mapHost);const form=$('#compose');if(form)void updateComposeLocation(form)}
function refresh(){if(view==='explore'){$('#cards').innerHTML=cardsHTML();$('#letter-count').textContent=selectedCards().length+' '+t('letters');$('#detail').innerHTML=detailHTML();$('#proximity-hint').innerHTML=proximityHTML();document.querySelectorAll('.marker[data-select]').forEach(el=>el.classList.toggle('selected',el.dataset.select===selected));$('#position-status').textContent=mode==='demo'?'HÀ NỘI · '+t('demo'):position?t('accuracy')+' ±'+Math.round(position.accuracy)+' m':t('unknown')}}
function select(id){selected=id;listMode=false;render();maps.panTo(current())}
function selectMapLetters(ids){
 const letters=ids.map(id=>all().find(letter=>letter.id===id)).filter(Boolean);
 if(letters.length===1){select(letters[0].id);return}
 if(!letters.length)return;
 const vi=lang==='vi';
 const choices=letters.map(letter=>`<button class="secondary" style="width:100%;text-align:left" data-location-letter="${esc(letter.id)}">${esc(text(letter,'title'))} · ${esc(unlocked(letter)?t('open'):t('place')+' '+text(letter,'place'))}</button>`).join('');
 modal(`<div class="eyebrow">MIDNIGHT LETTERS</div><h2>${letters.length} ${vi?'lá thư tại đây':'letters here'}</h2><div class="actions">${choices}</div>`);
}
function modal(html,paper=false){modalReturn=document.activeElement;$('#modal-content').className='modal-content'+(paper?' paper':'');$('#modal-content').innerHTML=`<button class="close" id="close-modal" aria-label="${t('close')}">${icon('close')}</button>`+html;$('#modal-content').setAttribute('aria-label',t(paper?'read':'settings'));$('#modal').hidden=false;$('#close-modal').focus()}
function close(){ $('#modal').hidden=true;modalReturn?.isConnected&&modalReturn.focus() }
function openLetter(id,replay=false){const d=all().find(d=>d.id===id);if(!d)return;if(!replay&&!unlocked(d)){toast(t('locked'));return}modal(`<div class="letter-crest" aria-hidden="true"><span>m.</span></div><div class="eyebrow">MIDNIGHT · ${t(d.local?'local':'sample')}</div><h2>${esc(text(d,'title'))}</h2><div class="place">${icon('pin')} ${esc(text(d,'place'))}</div><div class="letter-body">${esc(text(d,'body'))}</div><div class="signature">${esc(d.author)}<br>${new Intl.DateTimeFormat(lang==='vi'?'vi-VN':'en-GB',{dateStyle:'medium'}).format(new Date(d.date))}</div><div class="actions"><button class="secondary" id="react" data-id="${esc(d.id)}">${icon('heart')} ${t('react')}</button><button class="gold" id="keep" data-id="${esc(d.id)}" ${saved.includes(d.id)?'disabled':''}>${icon('check')} ${t(saved.includes(d.id)?'kept':'keep')}</button></div>`,true)}
function stopGPS(){if(watch!==null)navigator.geolocation.clearWatch(watch);watch=null;position=null;maps.clearPosition()}
let lastGPSUI='';
function updateGPS(p){
 const fix={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,timestamp:p.timestamp};
 if(mode!=='gps'||watch===null||position&&fix.timestamp<position.timestamp)return;
 position=fix;maps.showPosition(position);
 const available=all().filter(unlocked);
 if(!unlocked(current())&&available.length)selected=available.sort((a,b)=>distance(a)-distance(b))[0].id;
 const key=JSON.stringify([selected,available.map(d=>d.id),Math.round(position.accuracy),Math.round(position.lat*10000),Math.round(position.lng*10000)]);
 if(key!==lastGPSUI){lastGPSUI=key;refresh()}
}
function startGPS(){if(!navigator.geolocation){toast(t('permission'));return}if(!confirm(t('consent')))return;stopGPS();mode='gps';render();$('#position-status').textContent=t('waiting');lastGPSUI='';
 watch=navigator.geolocation.watchPosition(updateGPS,error=>{
  if(error.code===1){stopGPS();toast(t('permission'));refresh()}
  else if(!position)$('#position-status').textContent=t('waiting');
 },{enableHighAccuracy:true,maximumAge:5000,timeout:20000});
 navigator.geolocation.getCurrentPosition(updateGPS,()=>{},{enableHighAccuracy:false,maximumAge:30000,timeout:5000})}
async function api(path,data){
 const response=await fetch('/api/'+path,data===undefined?{}:{
  method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)
 });
 const result=await response.json();
 if(!response.ok)throw Error(result.error||'server_error');
 return result;
}
let letterSuggestion=null;
async function suggestLetter(button){
 const form=button.closest('form');
 const vi=lang==='vi';
 button.disabled=true;
 const label=button.textContent;
 button.textContent=vi?'Đang viết gợi ý…':'Writing a suggestion…';
 try{
  const result=await api('suggest-letter',{tag:form.elements.tag.value,lang});
  if(!form.isConnected)return;
  letterSuggestion={...result,form};
  const hasDraft=form.elements.title.value.trim()||form.elements.body.value.trim();
  const action=vi?(hasDraft?'Thay nội dung bản nháp':'Chèn vào bản nháp'):(hasDraft?'Replace draft text':'Insert into draft');
  modal(`<div class="eyebrow">✦ ${vi?'GỢI Ý BẰNG AI':'AI SUGGESTION'}</div><h2>${esc(result.title)}</h2><p style="white-space:pre-wrap">${esc(result.body)}</p><div class="actions"><button class="gold" id="apply-suggestion">${action}</button></div>`);
 }catch(error){
  const errors=vi?{ai_unconfigured:'Máy chủ chưa cấu hình AI.',ai_wait:'Hãy đợi 30 giây giữa các lần gợi ý.',ai_busy:'AI đang bận. Thử lại sau ít phút.'}:{ai_unconfigured:'AI has not been configured on the server.',ai_wait:'Wait 30 seconds between suggestions.',ai_busy:'AI is busy. Try again shortly.'};
  if(form.isConnected)toast(errors[error.message]||(vi?'Chưa lấy được gợi ý. Hãy thử lại.':'Could not get a suggestion. Try again.'));
 }finally{button.disabled=false;button.textContent=label}
}
function applySuggestion(){
 const suggestion=letterSuggestion;
 if(!suggestion?.form.isConnected)return;
 const {form,title,body}=suggestion;
 form.elements.title.value=title;
 form.elements.body.value=body;
 $('#chars').textContent=body.length;
 letterSuggestion=null;
 close();
 form.elements.body.focus();
}
async function loadAccount(user){
 account=user;
 accountLetters=user?(await api('letters')).letters:[];
 maps.refreshMarkers(all(),selectMapLetters);
}
function accountSettings(){
 const vi=lang==='vi';
 if(account){
  modal(`<div class="account-head"><div class="page-emblem">${icon('user')}</div><h2>${esc(account.username)}</h2></div><div class="actions">${localLetters().length?`<button class="gold" id="import-letters">${vi?'Nhập thư từ thiết bị':'Import device letters'} · ${localLetters().length}</button>`:''}<button class="secondary" id="account-logout">${vi?'Đăng xuất':'Sign out'}</button></div>`);
  return;
 }
 modal(`<div class="account-head"><div class="page-emblem">${icon('user')}</div><h2>${vi?'Tài khoản':'Account'}</h2><p>${vi?'Lưu thư và mở lại trên các thiết bị của bạn.':'Save letters and read them across your devices.'}</p></div>
 <div class="account-tabs" role="group" aria-label="${vi?'Chế độ tài khoản':'Account mode'}"><button type="button" data-auth="login" aria-pressed="true">${vi?'Đăng nhập':'Sign in'}</button><button type="button" data-auth="register" aria-pressed="false">${vi?'Đăng ký':'Register'}</button></div>
 <form id="account-form" class="form" data-action="login">
 <label for="account-name">${vi?'Tên đăng nhập':'Username'}</label>
 <input id="account-name" name="username" required minlength="3" maxlength="30" pattern="[a-zA-Z0-9_]{3,30}" autocomplete="username">
 <label for="account-password">${vi?'Mật khẩu (ít nhất 10 ký tự)':'Password (10 characters minimum)'}</label>
 <input id="account-password" name="password" type="password" required minlength="10" maxlength="128" autocomplete="current-password">
 <p id="account-error" role="alert"></p>
 <button class="gold" type="submit">${vi?'Đăng nhập':'Sign in'}</button></form>`);
}
async function importLetters(button){
 const owner=account;
 button.disabled=true;
 let count=0;
 for(const letter of localLetters()){
  if(account!==owner)break;
  try{
   const result=await api('letters',letter);
   if(account!==owner)break;
   accountLetters.push(result.letter);
   count++;
  }catch(error){
   if(error.message!=='abusive_language'&&error.message!=='invalid_letter'&&error.message!=='duplicate_letter')break;
  }
 }
 maps.refreshMarkers(all(),selectMapLetters);
 if(button.isConnected)accountSettings();
 toast(lang==='vi'?`Đã nhập ${count} thư. Thư chưa nhập vẫn còn trên thiết bị.`:`Imported ${count} letters. Remaining letters stay on this device.`);
}
function settings(){modal(`<div class="eyebrow">MIDNIGHT · ${t('settings')}</div><h2>${t('maps')}</h2><p>${t('mapHelp')}</p>${maps.hasMap()?'<div class="actions"><button class="secondary" id="toggle-terrain" aria-pressed="'+maps.terrainEnabled()+'">'+(lang==='vi'?'Địa hình 3D':'3D terrain')+'</button></div>':''}${maps.hasMap()?'':`<div class="actions"><button class="gold" id="retry-map">${t('connect')}</button></div>`}`)}
async function connect(){if(mapState==='loading'||maps.hasMap())return;mapState='loading';render();try{await maps.connectMap(mapHost,all(),selectMapLetters);mapState='ready';render();if(position)maps.showPosition(position);toast(t('mapReady'))}catch{mapState='error';render();toast(t('mapError'))}}
$('#app').addEventListener('input',e=>{if(e.target.id==='search'){query=e.target.value;refresh()}if(e.target.id==='letter-body')$('#chars').textContent=e.target.value.length});
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.auth){const form=$('#account-form');if(form.querySelector('[type=submit]').disabled)return;form.dataset.action=b.dataset.auth;document.querySelectorAll('[data-auth]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===b)));form.querySelector('[type=submit]').textContent=b.textContent;$('#account-password').autocomplete=b.dataset.auth==='register'?'new-password':'current-password';$('#account-error').textContent='';return}if(b.dataset.nav){view=b.dataset.nav;render();return}if(b.dataset.locationLetter){close();select(b.dataset.locationLetter);return}if(b.dataset.select){select(b.dataset.select);return}if(b.dataset.read){openLetter(b.dataset.read,true);return}if(b.dataset.filter){filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(el=>{el.classList.toggle('active',el===b);el.setAttribute('aria-pressed',el===b?'true':'false')});refresh();return}if(b.dataset.mode){if(b.dataset.mode==='demo'){stopGPS();mode='demo';render()}else startGPS();return}switch(b.id){case'list-toggle':listMode=!listMode;render();break;case'approach':if(mode==='demo'){near.add(selected);refresh()}else startGPS();break;case'unlock':if(unlocked(current()))openLetter(current().id);else if(mode==='demo'){near.add(selected);refresh();toast(t('open'))}else startGPS();break;case'locate':position?maps.panTo(position):startGPS();break;case'connect-shortcut':connect();break;case'toggle-terrain':maps.toggleTerrain();b.setAttribute('aria-pressed',String(maps.terrainEnabled()));break;case'retry-map':close();connect();break;case'suggest-letter':void suggestLetter(b);break;case'apply-suggestion':applySuggestion();break;case'import-letters':void importLetters(b);break;case'account-settings':accountSettings();break;case'account-logout':b.disabled=true;api('logout',{}).then(()=>loadAccount(null)).then(()=>{close();render()}).catch(()=>{b.disabled=false;toast(lang==='vi'?'Chưa đăng xuất được.':'Could not sign out.')});break;case'map-settings':case'settings-map':settings();break;case'close-modal':close();break;case'react':if(write('reaction.'+b.dataset.id,true)){toast(t('reacted'));b.disabled=true}else toast(t('storageError'));break;case'keep':{const next=[...new Set([...saved,b.dataset.id])];if(write('saved',next)){saved=next;b.disabled=true;b.innerHTML=icon('check')+' '+t('kept');toast(t('kept'))}else toast(t('storageError'));break}case'privacy':modal(`<div class="eyebrow">MIDNIGHT</div><h2>${t('privacy')}</h2><p>${t('privacyText')}</p>`);break;case'about':modal(`<div class="eyebrow">MIDNIGHT LETTERS</div><h2>${t('brand')}</h2><p>${t('version')}</p><p style="margin-top:16px">${t('localNotice')}</p>`);break}});
$('#app').addEventListener('change',e=>{if(e.target.id==='letter-place'){void updateComposeLocation(e.target.form)}if(e.target.id==='language'){lang=e.target.value;write('language',lang);render()}});
document.addEventListener('submit',async e=>{e.preventDefault();const form=e.target;
 if(form.id==='account-form'){
  const data=new FormData(form);
  const action=form.dataset.action==='register'?'register':'login';
  const buttons=[...form.querySelectorAll('button')];
  buttons.forEach(button=>button.disabled=true);
  try{
   const {user}=await api(action,{username:data.get('username'),password:data.get('password')});
   await loadAccount(user);close();render();
  }catch(error){
   const vi={username_taken:'Tên đăng nhập đã có người dùng.',invalid_credentials:'Kiểm tra tên đăng nhập và mật khẩu.',try_later:'Thử lại sau một phút.'};
   const en={username_taken:'That username is taken.',invalid_credentials:'Check your username and password.',try_later:'Try again in a minute.'};
   form.querySelector('#account-error').textContent=(lang==='vi'?vi:en)[error.message]||(lang==='vi'?'Không kết nối được máy chủ tài khoản.':'Account service unavailable.');
  }finally{buttons.forEach(button=>button.disabled=false)}
  return;
 }
if(form.id!=='compose')return;if(!account){accountSettings();return}const f=new FormData(form),title=f.get('title').trim(),body=f.get('body').trim();if(!title||!body){toast(t('required'));return}if(hasAbuse(title)||hasAbuse(body)||hasAbuse(f.get('author'))){toast(lang==='vi'?'Thư có từ ngữ xúc phạm. Hãy sửa trước khi lưu.':'Please remove abusive language before saving.');return}const submit=form.querySelector('button[type="submit"]');
 if(submit.disabled)return;
 submit.disabled=true;
 const useCurrent=f.get('place')==='current';
 const point=useCurrent?await updateComposeLocation(form):current();
 if(!point||!form.isConnected||form.elements.place.value!==f.get('place')){
  submit.disabled=false;
  return;
 }const d={id:(crypto.randomUUID?.() ?? Array.from(crypto.getRandomValues(new Uint8Array(16)),n=>n.toString(16).padStart(2,"0")).join("")),title,body,author:f.get('author').trim()||t('anonymous'),tag:f.get('tag'),lat:point.lat,lng:point.lng,place:useCurrent?`${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`:text(point,'place'),date:new Date().toISOString(),local:true};if(account){
 try{const {letter}=await api('letters',d);accountLetters.push(letter)}
 catch(error){toast(error.message==='abusive_language'?(lang==='vi'?'Thư có từ ngữ xúc phạm.':'Please remove abusive language.'):t('storageError'));return}
 finally{submit.disabled=false}
 }maps.refreshMarkers(all(),selectMapLetters);view='saved';render();toast(t('created'))});
$('#modal').addEventListener('click',e=>{if(e.target.id==='modal')close()});document.addEventListener('keydown',e=>{if(e.key==='Escape')close();if(e.key==='Tab'&&!$('#modal').hidden){const els=[...$('#modal-content').querySelectorAll('button:not(:disabled),input,select,textarea,a[href]')];const first=els[0],last=els.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='gps'){stopGPS();refresh()}});window.addEventListener('offline',()=>toast(t('offline')));
try{sessionStorage.removeItem('midnight-maps-key')}catch{}
connect();
api('session').then(({user})=>user?loadAccount(user).then(render):null).catch(()=>{});

