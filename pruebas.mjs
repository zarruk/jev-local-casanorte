import fs from 'node:fs/promises';import vm from 'node:vm';import assert from 'node:assert/strict';
import {CONFIG} from './config.mjs';import {prepareGrid,makePayload,validateRequest,applyResults,interpret} from './core.mjs';import {analyze} from './analysis.mjs';import {createAppServer} from './server.mjs';
const sandbox={Buffer};vm.createContext(sandbox);vm.runInContext(await fs.readFile(new URL('./public/xlsx.full.min.js',import.meta.url),'utf8'),sandbox);const XLSX=sandbox.XLSX;
let passed=0;async function test(name,fn){await fn();passed++;console.log('OK '+name);}
const mockAnswer=q=>q.type==='choice'?{type:'choice',choice:'facturacion',probabilities:{facturacion:.9,logistica:.05,soporte_producto:.02,ventas:.02,otro:.01},confidence:.8}:q.type==='score'?{type:'score',score:1.7,probabilities:{'0':.1,'1':.1,'2':.8},confidence:.8}:{type:'noul',noul:.08};
const mock=async(url,opts)=>{const payload=JSON.parse(opts.body);return Response.json({model:'TEST_SIMULADO',answers:Object.fromEntries(Object.entries(payload.questions).map(([id,q])=>[id,mockAnswer(q)]))});};
const fixtures=[];
for(const file of ['01_Tickets_soporte.xlsx','02_Resenas_clientes.xlsx','03_Revision_respuestas.xlsx']){
 const bytes=await fs.readFile(new URL('./public/ejemplos/'+file,import.meta.url));const wb=XLSX.read(bytes,{type:'buffer',cellStyles:true,cellNF:true});const name=wb.SheetNames[0];const grid=XLSX.utils.sheet_to_json(wb.Sheets[name],{header:1,defval:'',blankrows:true,raw:true});const plan=prepareGrid(grid);fixtures.push({wb,name,grid,plan,file});
 await test('Leer '+file+' con 15 casos',()=>{assert.equal(plan.records.length,15);assert.equal(plan.records.filter(r=>r.status==='pendiente').length,15);assert.equal(plan.records[0].decision,null);});
 await test('Analizar, exportar y releer '+plan.type+' sin cambiar entradas',async()=>{const events=[];const summary=await analyze(plan.records,plan.definition,{key:'not-real',emit:e=>events.push(e),fetchImpl:mock});assert.equal(summary.completed,15);assert.equal(summary.requests,2);const result=events.filter(e=>e.event==='row');assert.equal(result[0].probability,plan.type==='tickets'?.9:plan.type==='resenas'?.8:.92);assert.equal(events.at(-1).event,'done');applyResults(XLSX,wb,name,plan.headers,result);const output=XLSX.write(wb,{type:'buffer',bookType:'xlsx'});const reread=XLSX.read(output,{type:'buffer',cellNF:true});const after=XLSX.utils.sheet_to_json(reread.Sheets[name],{header:1,defval:'',blankrows:true,raw:true});const di=plan.headers.indexOf('decision_jev'),pi=plan.headers.indexOf('probabilidad_decision');for(let r=0;r<grid.length;r++){for(let c=0;c<grid[r].length;c++){if(c!==di&&c!==pi)assert.equal(after[r][c]??'',grid[r][c]??'');}}assert.equal(after[1][di],result[0].decision);assert.equal(after[1][pi],result[0].probability);assert.equal(reread.Sheets[name][XLSX.utils.encode_cell({r:1,c:pi})].z,'0.0%');});
}
await test('Formato XLS heredado leído por el mismo front',()=>{const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(fixtures[0].grid),'Tickets');const b=XLSX.write(book,{type:'buffer',bookType:'biff8'});const r=XLSX.read(b,{type:'buffer'});assert.equal(prepareGrid(XLSX.utils.sheet_to_json(r.Sheets.Tickets,{header:1,defval:''})).records.length,15);});
await test('Noul negativo usa probabilidad complementaria',()=>assert.equal(interpret({type:'noul',noul:.03},CONFIG.casos.respuestas).probability,.97));
await test('Empates no asignan categoría arbitraria',()=>{assert.equal(interpret({type:'noul',noul:.5},CONFIG.casos.respuestas).probability,null);assert.equal(interpret({type:'score',score:1,confidence:0,probabilities:{'0':.5,'1':0,'2':.5}},CONFIG.casos.resenas).decision,'EMPATE');});
await test('Duplicados y datos inválidos bloquean la entrada al backend',()=>{const r=fixtures[0].plan.records;assert.throws(()=>validateRequest({type:'tickets',records:[r[0],r[0]]}),/repetida/);assert.throws(()=>validateRequest({type:'invalid',records:r}),/inválida/);});
await test('Los datos incompletos se muestran como error antes de llamar a Jev',()=>{const grid=structuredClone(fixtures[0].grid);grid[1][3]='';assert.equal(prepareGrid(grid).records[0].status,'error');});
await test('Error HTTP 401 sin probabilidades inventadas',async()=>{const events=[];const r=await analyze(fixtures[0].plan.records,CONFIG.casos.tickets,{key:'fake',emit:e=>events.push(e),fetchImpl:async()=>new Response('',{status:401})});assert.equal(r.failed,15);assert.ok(events.filter(e=>e.event==='row').every(e=>e.probability===null&&e.status==='error'));});
await test('Distribución inválida rechazada',()=>assert.throws(()=>interpret({type:'choice',choice:'facturacion',probabilities:{facturacion:9},confidence:1},CONFIG.casos.tickets),/incompatible/));
await test('Reintento 429 y resultados por lote',async()=>{let n=0;const events=[];const r=await analyze(fixtures[0].plan.records.slice(0,3),CONFIG.casos.tickets,{key:'fake',emit:e=>events.push(e),fetchImpl:async(...args)=>++n===1?new Response('',{status:429}):mock(...args)});assert.equal(r.requests,2);assert.equal(r.completed,3);assert.equal(events.filter(e=>e.event==='row').length,3);});
await test('Respuesta fuera de orden conserva la fila',async()=>{const events=[];const r=await analyze(fixtures[0].plan.records,CONFIG.casos.tickets,{key:'fake',emit:e=>events.push(e),fetchImpl:async(...args)=>{const payload=JSON.parse(args[1].body);if(Object.hasOwn(payload.questions,'fila_2'))await new Promise(r=>setTimeout(r,20));return mock(...args);}});assert.equal(r.completed,15);assert.equal(events.find(e=>e.event==='row').row,12);assert.equal(new Set(events.filter(e=>e.event==='row').map(e=>e.row)).size,15);});
await test('Exportación parcial borra resultados antiguos pendientes',()=>{const f=fixtures[0];const rec=[{row:2,status:'error',decision:null,probability:null},{row:3,status:'pendiente'}];applyResults(XLSX,f.wb,f.name,f.plan.headers,rec);const di=f.plan.headers.indexOf('decision_jev');assert.equal(f.wb.Sheets[f.name][XLSX.utils.encode_cell({r:1,c:di})].t,'z');});
await test('Otras pestañas y fórmulas se conservan al exportar',()=>{
 const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(fixtures[0].grid),'Tickets');
 const other={A1:{t:'n',v:3},A2:{t:'n',v:6,f:'A1*2'},A1500:{t:'s',v:'No truncar'},'!ref':'A1:A1500'};XLSX.utils.book_append_sheet(wb,other,'Otra');
 applyResults(XLSX,wb,'Tickets',[...fixtures[0].plan.headers],[{row:2,status:'completada',decision:'facturacion',probability:.9}]);
 const after=XLSX.read(XLSX.write(wb,{type:'buffer',bookType:'xlsx'}),{type:'buffer'});
 assert.equal(after.Sheets.Otra.A2.f,'A1*2');assert.equal(after.Sheets.Otra.A1500.v,'No truncar');
});

let calls=0;
const server=createAppServer({fetchImpl:async(...args)=>{calls++;return mock(...args);}});
await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
const base='http://127.0.0.1:'+server.address().port;
const post=(route,body,headers={})=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,...headers},body:JSON.stringify(body)});
try {
 await test('Servidor local sirve front, módulos y tres ejemplos sin llamadas de IA',async()=>{
  for(const asset of ['/','/app.mjs','/core.mjs','/config.mjs','/xlsx.full.min.js',...fixtures.map(f=>'/ejemplos/'+f.file)]){const r=await fetch(base+asset);assert.equal(r.status,200);assert.ok((await r.arrayBuffer()).byteLength>100);}
  assert.equal(calls,0);
 });
 await test('Servidor sin clave rechaza el análisis',async()=>{
  const r=await post('/api/analyze',{type:'tickets',records:fixtures[0].plan.records});assert.equal(r.status,409);assert.equal(calls,0);
 });
 await test('Origen ajeno y formulario bloqueados',async()=>{
  assert.equal((await post('/api/config',{key:'secret-test-only'},{Origin:'https://example.com'})).status,403);
  assert.equal((await fetch(base+'/api/config',{method:'POST',headers:{'Content-Type':'text/plain'},body:'{}'})).status,415);
 });
 await test('Configuración en memoria no devuelve la clave',async()=>{
  assert.equal((await post('/api/config',{key:'secret-test-only'})).status,200);
  const r=await fetch(base+'/api/config');assert.deepEqual(await r.json(),{configured:true,runtime:'local'});
 });
 await test('La clave, .env y el código del servidor no se publican por HTTP',async()=>{
  for(const asset of ['/.env','/server.mjs','/package.json','/%2e%2e/server.mjs'])assert.equal((await fetch(base+asset)).status,404);
 });
 await test('Análisis HTTP por streaming completa los tres casos',async()=>{
  for(const f of fixtures){
   const r=await post('/api/analyze',{type:f.plan.type,records:f.plan.records});assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/x-ndjson/);
   const reader=r.body.getReader(),decoder=new TextDecoder();const first=await reader.read();const initial=decoder.decode(first.value);assert.match(initial,/"event":"start"/);
   let text=initial;while(true){const part=await reader.read();if(part.done)break;text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();
   const events=text.trim().split('\n').map(line=>JSON.parse(line));assert.equal(events.filter(e=>e.event==='row').length,15);assert.equal(events.at(-1).completed,15);assert.equal(events.at(-1).failed,0);
  }
  assert.equal(calls,6);
 });
 await test('JSON y entradas excesivas se rechazan antes de llamar a Jev',async()=>{
  assert.equal((await fetch(base+'/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:'{'})).status,400);
  assert.equal((await post('/api/config',{key:'x'.repeat(2100)})).status,413);
  assert.equal(calls,6);
 });
} finally { server.closeAllConnections(); await new Promise(resolve=>server.close(resolve)); }
console.log(passed+' pruebas aprobadas. Respuestas de Jev simuladas; sin llamadas reales a TypeSafe.');
