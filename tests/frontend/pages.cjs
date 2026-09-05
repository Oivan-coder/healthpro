const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM,VirtualConsole}=require('jsdom');
const root=path.resolve(__dirname, '../../frontend');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
const vc=new VirtualConsole();vc.on('jsdomError',error=>{throw error});
const dom=new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://healthpro.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
w.scrollTo=()=>{};
w.matchMedia=query=>({matches:false,addEventListener(){}});
const contexts=new Map(),observed=new Set();let resizeCallback;
w.ResizeObserver=class {constructor(cb){resizeCallback=cb}observe(el){observed.add(el)}unobserve(el){observed.delete(el)}};
w.HTMLCanvasElement.prototype.getContext=function(){
 if(!contexts.has(this)) contexts.set(this,new Proxy({canvas:this,font:'',fonts:[],measureText:t=>({width:String(t).length*6}),createLinearGradient:()=>({addColorStop(){}})},{get:(target,key)=>key in target?target[key]:()=>{},set(target,key,value){target[key]=value;if(key==='font')target.fonts.push(value);return true}}));
 return contexts.get(this);
};
w.eval(fs.readFileSync(path.join(root,'js/data/mock-db.js'),'utf8'));const base=w.HealthMockDB;
const labs=base.labCatalog.slice(0,4).map(lab=>{const history=base.labObservations.filter(p=>p.code===lab.code);const latest=history.at(-1);return {...lab,history:history.map(p=>({...p,flag:p.value>lab.high?'high':p.value<lab.low?'low':'normal'})),latestValue:latest.value,latestDate:latest.date,flag:latest.value>lab.high?'high':latest.value<lab.low?'low':'normal',interpretationRequirements:[]}});
const report={id:'fixture-report',name:'Биохимия',date:labs[0].latestDate,testCount:labs.length,abnormalCount:labs.filter(l=>l.flag!=='normal').length,observations:labs.map(l=>({...l,value:l.latestValue}))};
const summary={...base,labs,abnormal:labs.filter(l=>l.flag!=='normal'),nextVisit:base.visits[0],documents:base.docs};
const responses={
 '/api/auth/me':{user:{id:'fixture',login:'fixture',displayName:'Тестовый пользователь',role:'user',patientId:'p_fixture',mustChangePassword:false}},
 '/api/summary':summary,'/api/labs':{labs,catalog:base.labCatalog},'/api/lab-reports':[report],'/api/lab-reports/fixture-report':report,
 '/api/labs/history':labs.flatMap(l=>l.history.map(p=>({...l,...p}))),'/api/reports':base.reports,'/api/documents':base.docs,'/api/visits':base.visits,
 '/api/appointments/dictionary':{specialties:base.specialties,doctors:base.doctors,slots:base.slots},'/api/integration/status':{mode:'mysql'},'/api/audit/events':{events:[]},'/api/admin/users':{users:[]}
};
for(const lab of labs) responses[`/api/lab-tests/${lab.code}/history`]=lab;
w.fetch=async url=>{const p=new URL(url).pathname;assert(p in responses,'Unexpected request '+p);return{ok:true,status:200,json:async()=>responses[p]}};
for(const el of d.querySelectorAll('script')) {
 const file=el.getAttribute('src');w.eval(file?fs.readFileSync(path.join(root,file.split('?')[0]),'utf8'):el.textContent);
}
await tick();await tick();
for(const route of ['dashboard','profile','labs','lab-history','reports','appointments','visits','assistant']){
 await w.App.navigate(route);assert(!d.getElementById('pageRoot').textContent.includes('Не удалось загрузить данные'),route);assert(d.getElementById('pageRoot').querySelector('h2'),route);console.log('PASS actual page render:',route);
}
for(const mode of ['reports','abnormal','tests']){w.LabState.mode=mode;await w.App.navigate('labs');assert(d.querySelector('.lab-detail'),'labs '+mode);assert(!d.getElementById('pageRoot').textContent.includes('Не удалось загрузить данные'));}
console.log('PASS three lab modes with synthetic results');
await w.Pages['admin-users']();assert(d.querySelector('#createDemoUserForm.form-stack'));assert(d.querySelector('.user-table-wrap table'));await w.Pages.integration();assert(d.querySelector('.integration-hero'));
console.log('PASS actual admin forms and integration page render');
const holder=d.createElement('div'),canvas=d.createElement('canvas');holder.append(canvas);d.body.append(holder);canvas.style.fontFamily='"Inter Variable", Arial, sans-serif';let width=240,height=280;canvas.getBoundingClientRect=()=>({width,height,left:0,top:0,right:width,bottom:height});
Object.defineProperty(w,'devicePixelRatio',{value:1,configurable:true});
const originalData=JSON.stringify(labs);
w.Charts.drawLabChart(canvas,labs[0]);assert.equal(canvas.width,240);assert.equal(canvas.height,280);assert(contexts.get(canvas).fonts.every(font=>font.includes('Inter Variable')));
w.Charts.drawDashboardTrendChart(canvas,labs);assert.equal(canvas.width,240);assert.equal(canvas.height,280);
width=600;height=320;Object.defineProperty(w,'devicePixelRatio',{value:2,configurable:true});resizeCallback();await new Promise(r=>setTimeout(r,50));assert.equal(canvas.width,1200);assert.equal(canvas.height,640);assert.equal(JSON.stringify(labs),originalData);
canvas.remove();resizeCallback();await new Promise(r=>setTimeout(r,30));assert(!observed.has(canvas));
console.log('PASS chart font, narrow canvas size, resize/DPR, unchanged data and observer cleanup');
dom.window.close();
})().catch(error=>{console.error(error);process.exitCode=1});
