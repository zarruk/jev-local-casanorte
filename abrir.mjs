import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
if(Number(process.versions.node.split('.')[0])<22){console.error('Necesitas Node.js 22 o posterior: https://nodejs.org/en/download');process.exit(1);}
try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT'){console.error('No se pudo leer .env.');process.exit(1);}}
const port=Number(process.env.PORT||8787);
if(!Number.isInteger(port)||port<1||port>65535){console.error('PORT debe ser un puerto válido.');process.exit(1);}
const url='http://localhost:'+port;
const health='http://127.0.0.1:'+port+'/api/config';
async function ready(){try{const r=await fetch(health,{signal:AbortSignal.timeout(1000)});return r.ok&&(await r.json()).runtime==='local';}catch{return false;}}
function browser(){
 console.log('Comprobación HTTP correcta. Abre '+url);
 if(process.env.JEV_NO_BROWSER==='1')return;
 const [command,args]=process.platform==='darwin'?['open',[url]]:process.platform==='win32'?['cmd.exe',['/c','start','',url]]:['xdg-open',[url]];
 const opener=spawn(command,args,{stdio:'ignore'});
 opener.on('error',()=>console.log('Abre '+url+' manualmente en tu navegador.'));
 opener.unref();
}
if(await ready()){console.log('Ya hay un servidor Jev local activo.');browser();}
else{
 const child=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,stdio:'inherit',env:process.env});
 let ended=false,exitCode=0;
 child.on('error',()=>{ended=true;exitCode=1;console.error('No se pudo iniciar Node.');});
 child.on('exit',code=>{ended=true;exitCode=code??1;process.exitCode=exitCode;});
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));
 let healthy=false;
 for(let i=0;i<50&&!ended;i++){
  if(await ready()){healthy=true;break;}
  await new Promise(resolve=>setTimeout(resolve,150));
 }
 if(healthy)browser();
 else{console.error('El servidor no respondió. Revisa el error en esta ventana.');child.kill();process.exitCode=exitCode||1;}
}
