import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

test('admin deletion enforces role/origin, removes content and prevents reimport across restarts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'midnight-test-'));
 const db=new DatabaseSync(join(dir,'midnight.sqlite'));
 db.exec(`CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL);
 CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE letters(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL,payload TEXT NOT NULL);`);
 const adminToken='a'.repeat(64),memberToken='b'.repeat(64);
 for(const [id,name,token] of [[1,'admin',adminToken],[2,'member',memberToken]]){
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,name,'unused','unused');
  db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(createHash('sha256').update(token).digest('hex'),id,Date.now()+600000);
 }
 const letter={id:'12345678-1234-1234-1234-123456789abc',title:'Bình yên',body:'Chúc bạn một ngày đẹp trời.',author:'Một người bạn',tag:'peace',lat:21,lng:105,place:'Hồ nước'};
 db.prepare('INSERT INTO letters VALUES(?,?,?)').run(letter.id,2,JSON.stringify(letter));
 let child,base;
 async function start(){
  child=spawn(process.execPath,['scripts/server.mjs'],{env:{...process.env,MIDNIGHT_DATA_DIR:dir,MIDNIGHT_PORT:'0'},stdio:['ignore','pipe','pipe']});
  let output='';
  await new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Server startup timed out')),10000);
   child.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited: '+code))});
   child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/127\.0\.0\.1:(\d+)/);if(match){base='http://127.0.0.1:'+match[1];clearTimeout(timeout);resolve()}});
  });
 }
 async function stop(){if(child?.exitCode===null){const exited=once(child,'exit');child.kill();await exited;}}
 t.after(async()=>{await stop();db.close();await rm(dir,{recursive:true,force:true})});
 await start();
 async function request(path,{token=adminToken,data,origin=base.replace('http:','https:')}={}){
  const response=await fetch(base+'/api/'+path,{method:data?'POST':'GET',headers:{...(token?{cookie:'midnight_session='+token}:{}),...(data?{'Content-Type':'application/json',origin}:{})},...(data?{body:JSON.stringify(data)}:{})});
  return {status:response.status,body:await response.json()};
 }
 const target={id:letter.id};
 assert.equal((await request('admin/letters/delete',{token:null,data:target})).status,401);
 assert.equal((await request('admin/letters/delete',{token:memberToken,data:target})).status,403);
 assert.equal((await request('admin/letters/delete',{data:target,origin:'https://evil.test'})).status,403);
 assert.equal((await request('admin/letters/delete',{data:{id:"' OR 1=1 --"}})).status,400);
 assert.equal((await request('admin/letters',{token:memberToken})).status,403);
 assert.equal((await request('admin/letters')).body.letters.length,1);
 assert.equal((await request('admin/letters/delete',{data:target})).status,200);
 assert.equal((await request('admin/letters/delete',{data:target})).status,404);
 assert.equal((await request('admin/letters')).body.letters.length,0);
 const owner=await request('letters',{token:memberToken});
 assert.deepEqual(owner.body.letters,[]);
 assert.deepEqual(owner.body.removedIds,[letter.id]);
 assert.equal(db.prepare('SELECT count(*) AS n FROM letters').get().n,0);
 assert.equal(db.prepare('SELECT removed_by FROM removed_letters').get().removed_by,1);
 await stop();await start();
 assert.equal((await request('letters',{token:memberToken,data:letter})).status,410);
 for(const field of ['title','body','author','place']){
  const result=await request('letters',{token:memberToken,data:{...letter,id:'22345678-1234-1234-1234-123456789abc',[field]:'địt mẹ'}});
  assert.equal(result.status,422,field);
 }
 const newLetter={...letter,id:'32345678-1234-1234-1234-123456789abc'};
 assert.equal((await request('letters',{token:memberToken,data:newLetter})).status,201);
 assert.equal((await request('letters',{token:memberToken})).body.letters.length,1);
 assert.equal((await request('letters',{token:memberToken,data:newLetter})).status,409);
});
