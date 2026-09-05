const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const root = path.resolve(__dirname,'../../frontend');
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'),{url:'https://healthpro.test/',runScripts:'outside-only',pretendToBeVisual:true});
  const w = dom.window, d = w.document;
  w.scrollTo = () => {};
  w.HTMLElement.prototype.scrollIntoView = () => {};
  w.eval(fs.readFileSync(path.join(root,'components/ui.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'components/cabinet.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'components/search-picker.js'),'utf8'));
  w.Pages = {};
  let renderCount = 0, profilePayload = null, reportPayload = null;
  const tester = {id:'tester-1',login:'tester',displayName:'Тестировщик Тестовый',role:'tester',patientId:'patient-own',status:'active'};
  w.App = {user:()=>tester,render:async()=>{renderCount++;},logout(){},navigate(){}};
  w.HealthAPI = {
    API_BASE:'https://healthpro.test/api',
    summary:async()=>({patient:{name:'Иванов Иван',birthDate:'2000-09-06',sex:'male',phone:null,policy:'null',clinic:'Тестовая клиника',region:'Москва',misCard:'MIS-READ-ONLY'}}),
    updatePatient:async payload=>{profilePayload=payload;},
    adminListUsers:async()=>{throw Error('tester must not request all users');}
  };
  const services = Array.from({length:12},(_,index)=>({id:`service-${index}`,name:`Исследование ${index}`,code:`S${index}`,testCount:2}));
  const tests = [{id:'test-glu',name:'Глюкоза',code:'GLU',sourceTestCode:'GLU-SOURCE',unit:'ммоль/л',biomaterial:'Венозная кровь',referenceStatus:'selected',recommendedReferenceId:7,referenceLabel:'3,9–6,1',references:[{id:7,label:'3,9–6,1'}]}];
  w.fetch = async (url,options={}) => {
    const pathname = new URL(url).pathname;
    let body;
    if (pathname === '/api/admin/lab-entry/services') body={services};
    else if (pathname === '/api/admin/lab-entry/services/service-0/tests') body={tests};
    else if (pathname === '/api/admin/lab-entry/reports') {reportPayload=JSON.parse(options.body);body={report:{name:'Исследование 0',date:'2026-09-05',testCount:1}};}
    else throw Error(`Unexpected request ${pathname}`);
    return {ok:true,status:200,json:async()=>body};
  };
  w.eval(fs.readFileSync(path.join(root,'pages/profile-edit.js'),'utf8'));
  w.eval(fs.readFileSync(path.join(root,'pages/manual-lab-entry.js'),'utf8'));

  await w.Pages.profile();
  assert(!d.getElementById('pageRoot').textContent.includes('null'));
  assert(d.getElementById('pageRoot').textContent.includes('25 лет'));
  d.getElementById('profileEditBtn').click();
  assert.equal(d.querySelector('[aria-readonly="true"]').value,'MIS-READ-ONLY');
  d.getElementById('profileName').value='Иванов Иван Иванович';
  d.getElementById('profileEditForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  await tick();
  assert.equal(profilePayload.name,'Иванов Иван Иванович');
  assert.equal(profilePayload.birthDate,'2000-09-06');
  assert.equal(renderCount,1);
  console.log('PASS editable profile uses derived age, em dash and read-only MIS card');

  await w.Pages['manual-lab-entry']();
  assert.equal(d.getElementById('manualPatientSelect').disabled,true);
  assert.equal(d.getElementById('manualPatientSelect').value,'patient-own');
  const serviceSearch=d.getElementById('manualServiceSearch');
  serviceSearch.focus();serviceSearch.dispatchEvent(new w.Event('focus'));
  assert.equal(d.querySelectorAll('#manualServiceSearchOptions [role="option"]').length,8);
  assert(d.getElementById('manualServiceSearchOptions').textContent.includes('Показаны 8 из 12'));
  d.querySelector('#manualServiceSearchOptions [role="option"]').click();
  await tick();await tick();
  assert.equal(d.getElementById('manualTestSearch').disabled,false);
  const testSearch=d.getElementById('manualTestSearch');
  testSearch.value='GLU';testSearch.dispatchEvent(new w.Event('input',{bubbles:true}));
  d.querySelector('#manualTestSearchOptions [role="option"]').click();
  d.getElementById('manualValueInput').value='6,2';
  d.getElementById('manualResultForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
  assert.equal(w.ManualLabEntryState.entries.length,1);
  d.getElementById('manualSaveBtn').click();await tick();await tick();
  assert.deepEqual(reportPayload,{patientId:'patient-own',serviceId:'service-0',reportDate:w.ManualLabEntryState.reportDate,observations:[{testId:'test-glu',value:'6,2',referenceId:7}]});
  console.log('PASS tester is bound to own patient; autocomplete is bounded and preserves report API contract');
  dom.window.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
