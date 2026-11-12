import {rm,mkdir,cp,readFile,writeFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {join} from 'node:path';

async function sourceFiles(directory){
 const entries=await readdir(directory,{withFileTypes:true});
 const lists=await Promise.all(entries.map(entry=>entry.isDirectory()?sourceFiles(join(directory,entry.name)):[join(directory,entry.name)]));
 return lists.flat().sort();
}
const files=await sourceFiles('src');
const html=await readFile('index.html','utf8');
const hash=createHash('sha256').update(html);
const sources=new Map();
for(const file of files){const data=await readFile(file);hash.update(file).update(data);sources.set(file,data);}
const version=hash.digest('hex').slice(0,16);
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
await cp('public','dist',{recursive:true});
await cp('src','dist/src',{recursive:true});
// Version the entire local module graph, not just the entry point: CDN/browser
// caches can otherwise keep an old moderation module behind the new app.
for(const [file,data] of sources){
 if(!file.endsWith('.js'))continue;
 const code=data.toString().replace(/(\bfrom\s*|\bimport\s*)(['"])(\.{1,2}\/[^'"\n]+\.js)\2/g,(_,prefix,quote,path)=>`${prefix}${quote}${path}?v=${version}${quote}`);
 await writeFile(join('dist',file),code);
}
await writeFile('dist/index.html',html.replace(/(\/src\/(?:app\.js|styles\.css))(?=["'])/g,`$1?v=${version}`));
console.log(`Built Midnight Letters → dist (${version})`);
