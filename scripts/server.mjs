import { createServer } from 'node:http';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { hasAbuse } from '../src/moderation.js';

const derive = promisify(scrypt);
const directory = process.env.MIDNIGHT_DATA_DIR || 'data';
mkdirSync(directory, { recursive: true, mode: 0o700 });
const db = new DatabaseSync(directory + '/midnight.sqlite');
db.exec(`
 PRAGMA journal_mode=WAL;
 CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, salt TEXT NOT NULL, hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS ai_usage(user_id INTEGER PRIMARY KEY REFERENCES users(id), last_request INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS letters(id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), payload TEXT NOT NULL);
`);
const digest = value => createHash('sha256').update(value).digest('hex');
const maxAge = 7 * 86400;
const attempts = new Map();
let activeAuth = 0;
let activeSuggestions = 0;
setInterval(() => {
 for (const [key, entry] of attempts) if (entry.until < Date.now()) attempts.delete(key);
 db.prepare('DELETE FROM sessions WHERE expires <= ?').run(Date.now());
}, 60000).unref();

function respond(res, status, data, cookie) {
 res.writeHead(status, {'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})});
 res.end(JSON.stringify(data));
}
function session(req) {
 const token = req.headers.cookie?.match(/(?:^|;\s*)midnight_session=([a-f0-9]{64})(?:;|$)/)?.[1];
 return token ? db.prepare('SELECT users.id,username FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>?').get(digest(token),Date.now()) : null;
}
async function body(req) {
 if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(Error('json_required'),{status:415});
 const chunks=[];let size=0;
 for await (const chunk of req) {
  size+=chunk.length;
  if(size>16000)throw Object.assign(Error('body_too_large'),{status:413});
  chunks.push(chunk);
 }
 try { const data=JSON.parse(Buffer.concat(chunks));if(!data||Array.isArray(data)||typeof data!=='object')throw Error();return data; }
 catch { throw Object.assign(Error('invalid_json'),{status:400}); }
}
function cookie(token, age) {
 return `midnight_session=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`;
}
function sameOrigin(req) {
 const site=req.headers['sec-fetch-site'];
 if(site&&site!=='same-origin')return false;
 try {
  const origin=new URL(req.headers.origin);
  // Browser fetch metadata describes the public URL even when a proxy rewrites Host.
  return origin.protocol==='https:'&&(site==='same-origin'||origin.host===req.headers.host);
 }catch{return false}
}
const server = createServer(async (req,res) => {
 try {
  const route=new URL(req.url,'http://localhost').pathname;
  const user=session(req);
  if(req.method==='GET'&&route==='/api/session')return respond(res,200,{user:user?{username:user.username}:null});
  if(req.method==='GET'&&route==='/api/letters'){
   if(!user)return respond(res,401,{error:'login_required'});
   return respond(res,200,{letters:db.prepare('SELECT payload FROM letters WHERE user_id=?').all(user.id).map(row=>JSON.parse(row.payload))});
  }
  if(req.method!=='POST')return respond(res,404,{error:'not_found'});
  if(!sameOrigin(req))return respond(res,403,{error:'invalid_origin'});
  if(route==='/api/logout'){
   const token=req.headers.cookie?.match(/(?:^|;\s*)midnight_session=([a-f0-9]{64})/)?.[1];
   if(token)db.prepare('DELETE FROM sessions WHERE token=?').run(digest(token));
   return respond(res,200,{user:null},cookie('',0));
  }
  if(route==='/api/login'||route==='/api/register'){
   const data=await body(req);
   const username=typeof data.username==='string'?data.username.trim().toLowerCase():'';
   const password=typeof data.password==='string'?data.password:'';
   if(!/^[a-z0-9_]{3,30}$/.test(username)||password.length<10||password.length>128)return respond(res,400,{error:'invalid_credentials'});
   const now=Date.now();
   const client=req.headers['cf-connecting-ip']||req.socket.remoteAddress;
   const key=String(client);
   const previous=attempts.get(key);
   const entry=previous?.until>now?previous:{count:0,until:now+60000};
   if(entry.count>=10||activeAuth>=4||attempts.size>=5000&&!previous)return respond(res,429,{error:'try_later'});
   entry.count++;attempts.set(key,entry);
   activeAuth++;
   try{
    let row=db.prepare('SELECT id,salt,hash FROM users WHERE username=?').get(username);
    const salt=row?.salt||randomBytes(16).toString('hex');
    const hash=await derive(password,salt,64);
    if(route==='/api/register'){
     if(row)return respond(res,409,{error:'username_taken'});
     try{const result=db.prepare('INSERT INTO users(username,salt,hash) VALUES(?,?,?)').run(username,salt,hash.toString('hex'));row={id:result.lastInsertRowid};}
     catch(error){if(String(error.message).includes('UNIQUE'))return respond(res,409,{error:'username_taken'});throw error}
    }else if(!row||!timingSafeEqual(hash,Buffer.from(row.hash,'hex')))return respond(res,401,{error:'invalid_credentials'});
    const token=randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),row.id,now+maxAge*1000);
    return respond(res,200,{user:{username}},cookie(token,maxAge));
   }finally{activeAuth--}
  }
  if(route==='/api/suggest-letter'){
   if(!user)return respond(res,401,{error:'login_required'});
   const key=process.env.OPENAI_API_KEY;
   if(!key)return respond(res,503,{error:'ai_unconfigured'});
   const {tag,lang}=await body(req);
   const topics={peace:'rest and kindness',love:'gratitude and connection',journey:'courage and new beginnings'};
   if(!Object.hasOwn(topics,tag)||!['vi','en'].includes(lang))return respond(res,400,{error:'invalid_suggestion'});
   const now=Date.now();
   if(activeSuggestions>=2)return respond(res,429,{error:'ai_busy'});
   const reservation=db.prepare('INSERT INTO ai_usage VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET last_request=excluded.last_request WHERE ai_usage.last_request <= ?').run(user.id,now,now-30000);
   if(!reservation.changes)return respond(res,429,{error:'ai_wait'});
   activeSuggestions++;
   try{
    const response=await fetch('https://api.openai.com/v1/chat/completions',{
     method:'POST',signal:AbortSignal.timeout(11000),
     headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},
     body:JSON.stringify({
      model:process.env.OPENAI_MODEL||'gpt-4.1-mini',
      response_format:{type:'json_object'},max_completion_tokens:450,
      messages:[
       {role:'system',content:'Write one warm, original letter for a stranger to discover. Use one concrete image and a gentle thought. Avoid cliches, insults and invented facts about the reader. Return JSON with title and body strings. Title at most 80 characters. Body 2–3 short paragraphs, at most 130 words.'},
       {role:'user',content:'Language: '+(lang==='vi'?'natural Vietnamese':'English')+'. Theme: '+topics[tag]+'.'}
      ]
     })
    });
    if(!response.ok){
     const error=await response.json().catch(()=>null);
     const code=error?.error?.code;
     console.warn('AI provider rejected request:',response.status,typeof code==='string'&&/^[a-z_0-9]+$/i.test(code)?code:'unknown');
     if(response.status===401||response.status===403)return respond(res,503,{error:'ai_key_rejected'});
     if(code==='insufficient_quota')return respond(res,503,{error:'ai_quota_exhausted'});
     if(code==='model_not_found')return respond(res,503,{error:'ai_model_unavailable'});
     if(response.status===429)return respond(res,429,{error:'ai_provider_rate_limit'});
     return respond(res,503,{error:'ai_unavailable'});
    }
    const result=await response.json();
    const suggestion=JSON.parse(result.choices?.[0]?.message?.content||'null');
    const title=typeof suggestion?.title==='string'?suggestion.title.trim():'';
    const message=typeof suggestion?.body==='string'?suggestion.body.trim():'';
    if(!title||title.length>80||!message||message.length>3000||[title,message].some(hasAbuse))return respond(res,503,{error:'ai_unavailable'});
    return respond(res,200,{title,body:message});
   }catch(error){console.warn('AI provider request failed:',error.name);return respond(res,503,{error:'ai_unavailable'})}
   finally{activeSuggestions--}
  }
  if(route==='/api/letters'){
   if(!user)return respond(res,401,{error:'login_required'});
   const data=await body(req);
   const {id,title,body:message,author,tag,lat,lng,place}=data;
   if(!/^[a-f0-9-]{32,36}$/i.test(id)||typeof title!=='string'||!title.trim()||title.length>80||typeof message!=='string'||!message.trim()||message.length>3000||typeof author!=='string'||author.length>50||typeof place!=='string'||place.length>200||!['peace','love','journey'].includes(tag)||!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lng)||Math.abs(lng)>180)return respond(res,400,{error:'invalid_letter'});
   if([title,message,author].some(hasAbuse))return respond(res,422,{error:'abusive_language'});
   if(db.prepare('SELECT count(*) AS count FROM letters WHERE user_id=?').get(user.id).count>=500)return respond(res,429,{error:'letter_limit'});
   const letter={id,title,body:message,author,tag,lat,lng,place,date:new Date().toISOString(),local:true};
   const result=db.prepare('INSERT OR IGNORE INTO letters VALUES(?,?,?)').run(id,user.id,JSON.stringify(letter));
   if(!result.changes)return respond(res,409,{error:'duplicate_letter'});
   return respond(res,201,{letter});
  }
  return respond(res,404,{error:'not_found'});
 }catch(error){
  if(!res.headersSent)respond(res,error.status||500,{error:error.status?error.message:'server_error'});
 }
});
server.requestTimeout=15000;
server.headersTimeout=10000;
server.listen(8787,'127.0.0.1',()=>console.log('Midnight API listening on 127.0.0.1:8787'));
