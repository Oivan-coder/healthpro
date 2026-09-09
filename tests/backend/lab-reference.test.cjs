const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');

// Run production services with in-memory repositories; no database or live writes.
function load(relative, dependencies) {
  const filename = path.resolve(__dirname, '../../backend/src', relative);
  const instance = new Module(filename, module);
  const actualRequire = Module.createRequire(filename);
  instance.filename = filename;
  instance.require = id => Object.hasOwn(dependencies, id) ? dependencies[id] : actualRequire(id);
  instance._compile(fs.readFileSync(filename, 'utf8'), filename);
  return instance.exports;
}

const ref = (id, group, low, high, unit) => ({id, group, low, high, unit, lowRaw:String(low), highRaw:String(high)});
function fixture() {
  const patient = {id:'own-patient', name:'Тестовый пациент', sex:'male', age:36};
  const catalog = [
    {id:1, code:'RBC', name:'Эритроциты', group:'ОАК', unit:'10^12/л', low:null, high:null},
    {id:2, code:'HB', name:'Гемоглобин', group:'ОАК', unit:'г/л', low:null, high:null},
    {id:3, code:'WBC', name:'Лейкоциты', group:'ОАК', unit:'10^9/л', low:null, high:null}
  ];
  const dictionary = catalog.map(item => ({...item, references: item.code === 'RBC'
    ? [ref(11,'Женщины',3.76,5.5,item.unit),ref(12,'Мужчины',4.37,5.79,item.unit)]
    : item.code === 'HB' ? [ref(21,'Женщины',120,140,item.unit),ref(22,'Мужчины',130,160,item.unit)]
    : [ref(31,'',4,10,item.unit)]}));
  const observations = [
    {code:'RBC',value:'3.000',date:'05.09.2026',reportId:'saved-report'},
    {code:'HB',value:'150.000',date:'05.09.2026',reportId:'saved-report'},
    {code:'WBC',value:'12.000',date:'05.09.2026',reportId:'saved-report'}
  ];
  const saved = {'saved-report':{1:11,2:21,3:31}};
  const manualRepository = {
    getPatient:async id => {assert.equal(id,patient.id);return patient;},
    getReferenceDataByCodes:async codes => dictionary.filter(item=>codes.includes(item.code)),
    getReportReferenceSelections:async id => saved[id] || {}
  };
  const manual = load('services/manualLabService.js',{'../repositories/manualLabRepository':manualRepository});
  const references = load('services/labReferenceService.js',{
    '../repositories/manualLabRepository':manualRepository,'./manualLabService':manual
  });
  const repository = {
    getCatalog:async()=>catalog, getTests:async()=>catalog,
    getObservations:async id=>{assert.equal(id,patient.id);return observations;},
    getTestHistory:async(code,id)=>{assert.equal(id,patient.id);return observations.filter(item=>item.code===code).map(item=>({...catalog.find(meta=>meta.code===code),...item}));}
  };
  const demo = {isSyntheticPatient:()=>false};
  const context = {storagePatientId:id=>id};
  const labs = load('services/labService.js',{
    '../repositories/labRepository':repository,'../repositories/labReportDocumentRepository':{},
    '../repositories/integrationRepository':{},'../data/demoPatients':demo,'../utils/demoPatientContext':context
  });
  const patients = load('services/patientService.js',{
    './labService':labs,'./labReferenceService':references,
    '../repositories/patientRepository':{getPatient:manualRepository.getPatient,getMeta:async()=>({})},
    '../repositories/integrationRepository':{getEvents:async()=>[]},
    '../repositories/visitRepository':{getVisits:async()=>[]},
    '../repositories/reportRepository':{getReports:async()=>[]},
    '../data/demoPatients':demo,'../utils/demoPatientContext':context
  });
  const report = async id => ({id,observations:observations.filter(item=>item.reportId===id).map(item=>({
    ...catalog.find(meta=>meta.code===item.code),...item,value:Number(item.value),flag:'normal'
  }))});
  return {patient,catalog,dictionary,observations,saved,references,labs,patients,report};
}

test('summary, reports, history and trends use the same saved reference after a profile change',async()=>{
  const f=fixture(),id=f.patient.id;
  const summary=await f.patients.getSummary(id);
  const labs=await f.references.enrichLabs(await f.labs.getLabs(id),id);
  const history=await f.references.enrichHistory(await f.labs.getHistory(id),id);
  const report=await f.references.enrichReport(await f.report('saved-report'),id);
  assert.equal(summary.abnormalCount,3);
  assert.equal(report.abnormalCount,3);
  assert.equal(history.filter(row=>['low','high'].includes(row.flag)).length,3);
  for (const [code,flag,low,high] of [['RBC','low',3.76,5.5],['HB','high',120,140],['WBC','high',4,10]]) {
    const trend=await f.references.enrichTestHistory(await f.labs.getTestHistory(code,id),id);
    const rows=[summary.labs.find(row=>row.code===code),labs.labs.find(row=>row.code===code),
      history.find(row=>row.code===code),report.observations.find(row=>row.code===code),trend,...trend.history];
    for(const row of rows) {
      assert.deepEqual([row.flag,row.low,row.high],[flag,low,high],code);
      assert.equal(row.referenceStatus,'selected');
      assert.equal(row.referenceLabel,rows[0].referenceLabel);
    }
  }
  assert(summary.labs.find(row=>row.code==='RBC').interpretation.includes('ниже'));
  const summaries=await f.references.enrichReportSummaries([{id:'saved-report',abnormalCount:0}],id,f.report);
  assert.equal(summaries[0].abnormalCount,3);
});

test('each historical observation keeps its own choice; latest value uses the latest report',async()=>{
  const f=fixture(),id=f.patient.id;
  f.observations.push({code:'HB',value:'150',date:'06.09.2026',reportId:'new-report'});
  f.saved['new-report']={2:22};
  const labs=await f.references.enrichLabs(await f.labs.getLabs(id),id);
  const hb=labs.labs.find(row=>row.code==='HB');
  assert.equal(hb.flag,'normal');
  assert.equal(hb.referenceId,22);
  assert.deepEqual(hb.history.map(row=>[row.reportId,row.flag,row.referenceId]),[
    ['saved-report','high',21],['new-report','normal',22]
  ]);
  const history=await f.references.enrichHistory(await f.labs.getHistory(id),id);
  assert.equal(history.find(row=>row.code==='HB'&&row.reportId==='saved-report').flag,'high');
  const trend=await f.references.enrichTestHistory(await f.labs.getTestHistory('HB',id),id);
  assert.deepEqual(trend.history.map(row=>row.referenceId),[21,22]);
  assert.equal((await f.patients.getSummary(id)).abnormalCount,2);
  assert.equal((await f.references.enrichReport(await f.report('saved-report'),id)).abnormalCount,3);
});

test('results without a saved choice retain profile matching and ambiguous references remain unassessed',async()=>{
  const f=fixture(),id=f.patient.id;
  delete f.saved['saved-report'];
  let payload=await f.references.enrichLabs(await f.labs.getLabs(id),id);
  assert.equal(payload.labs.find(row=>row.code==='HB').flag,'normal');
  assert.equal(payload.labs.find(row=>row.code==='RBC').low,4.37);
  f.patient.sex='';
  payload=await f.references.enrichLabs(await f.labs.getLabs(id),id);
  const hb=payload.labs.find(row=>row.code==='HB');
  assert.equal(hb.referenceStatus,'ambiguous');
  assert.equal(hb.flag,'info');
  assert.equal(hb.low,null);
});

test('missing and qualitative values are not converted into zero or abnormal results',async()=>{
  for(const raw of [null,'','отрицательно']) {
    const f=fixture(),id=f.patient.id;
    f.observations[0].value=raw;
    const summary=await f.patients.getSummary(id);
    const rbc=summary.labs.find(row=>row.code==='RBC');
    assert.equal(rbc.latestValue,raw);
    assert.equal(rbc.flag,'info');
    assert.equal(summary.abnormalCount,2);
    assert(rbc.interpretation.includes('недоступна'));
    const trend=await f.references.enrichTestHistory(await f.labs.getTestHistory('RBC',id),id);
    assert.equal(trend.history[0].value,raw);
    assert.equal(trend.flag,'info');
  }
  const f=fixture();f.observations[0].value='4,1';
  assert.equal((await f.patients.getSummary(f.patient.id)).labs.find(row=>row.code==='RBC').flag,'normal');
});

test('MySQL read mapping preserves report identity, text values and absent limits',async()=>{
  const row={code:'QUAL',name:'Качественный',value:'отрицательно',date:'2026-09-05',report_id:'report-id',low_value:null,high_value:null};
  const pool={query:async(sql,params)=>{
    if(sql.includes('FROM lab_observations')) {
      assert(sql.includes('COALESCE(o.value_num, o.value_text)'));
      assert(sql.includes('r.id AS report_id'));
      assert.equal(params[0],'own-patient');
    }
    return [[row]];
  }};
  const repo=load('repositories/labRepository.js',{
    '../db/jsonStore':{},'./repositoryMode':{withMysql:fn=>fn(pool)}
  });
  const [observation]=await repo.getObservations('own-patient');
  const [history]=await repo.getTestHistory('QUAL','own-patient');
  const [catalog]=await repo.getTests();
  for(const item of [observation,history]) {
    assert.equal(item.value,'отрицательно');assert.equal(item.reportId,'report-id');
  }
  assert.equal(catalog.low,null);assert.equal(catalog.high,null);
  assert.equal(history.low,null);assert.equal(history.high,null);
});
