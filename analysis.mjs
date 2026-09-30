import {makePayload,interpret} from './core.mjs';
export async function analyze(records,definition,{key,emit,fetchImpl=fetch,signal}){
 const start=performance.now(),lots=[];for(let i=0;i<records.length;i+=10)lots.push(records.slice(i,i+10));
 let cursor=0,completed=0,failed=0,requests=0;
 emit({event:'start',total:records.length,batches:lots.length});
 async function worker(){while(cursor<lots.length){if(signal?.aborted)throw Error('Procesamiento interrumpido.');const index=cursor++,lot=lots[index];const payload=JSON.stringify(makePayload(lot,definition));const began=performance.now();let data,error;
  if(new TextEncoder().encode(payload).length>150000){error='Lote demasiado grande.';}else{
   for(let attempt=0;attempt<3;attempt++){
    requests++;let response;
    try{response=await fetchImpl('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:payload,signal:signal?AbortSignal.any([signal,AbortSignal.timeout(45000)]):AbortSignal.timeout(45000)});}catch(e){if(signal?.aborted)throw Error('Procesamiento interrumpido.');error='No se pudo conectar con TypeSafe o venció la espera.';break;}
    if([429,529,503].includes(response.status)&&attempt<2){const retry=Number(response.headers.get('retry-after'));await response.body?.cancel();await new Promise(r=>setTimeout(r,Number.isFinite(retry)&&retry>0?Math.min(retry*1000,5000):500*2**attempt));continue;}
    if(!response.ok){await response.body?.cancel();error='TypeSafe respondió HTTP '+response.status+'.';break;}
    try{data=await response.json();if(typeof data.model!=='string'||!data.answers)throw Error();}catch{error='TypeSafe devolvió una respuesta inválida.';}break;
   }
  }
  for(const r of lot){let result;
   try{if(error)throw Error(error);const answer=data.answers['fila_'+r.row];result={event:'row',row:r.row,id:r.id,status:'completada',...interpret(answer,definition),model:data.model,answer};completed++;}
   catch(e){result={event:'row',row:r.row,id:r.id,status:'error',decision:null,probability:null,error:e.message};failed++;}
   emit(result);
  }
  emit({event:'batch',index:index+1,rows:lot.length,ms:Math.round(performance.now()-began),completed,failed});
 }}
 await Promise.all(Array.from({length:Math.min(4,lots.length)},worker));
 const done={event:'done',completed,failed,requests,ms:Math.round(performance.now()-start)};emit(done);return done;
}
