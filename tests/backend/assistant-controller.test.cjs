const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');

function setup() {
  const saved=[],audits=[];let fallbackCalls=0,now=1000;
  const filename=path.resolve(__dirname,'../../backend/src/controllers/assistantController.js');
  const m=new Module(filename,module);m.filename=filename;
  m.require=id=>({
    '../services/assistantService':{chat:async body=>({answer:'Ответ',historySuggestion:body.suggestion??null})},
    '../services/patientHistoryService':{
      suggestFromMessage:()=>{fallbackCalls++;return null;},
      create:async (patientId,payload)=>{saved.push({patientId,payload});return {id:saved.length,...payload};}
    },
    '../services/auditService':{createAuditEventFromRequest:async (req,event)=>audits.push(event)},
    '../utils/demoPatientContext':{getDemoPatientId:req=>req.patientId}
  })[id];
  // Scoped clock for expiry, without mutating the global Date used by other tests.
  m._compile('const Date={now:()=>module.clock()};\n'+fs.readFileSync(filename,'utf8'),filename);
  m.clock=()=>now;
  return {
    saved,audits,fallbackCalls:()=>fallbackCalls,expire:()=>{now+=300001;},
    send:async (message,suggestion,patientId='own',history)=>{
      let response;
      await m.exports.chat({body:{message,suggestion,history},patientId},{json:value=>{response=value;}},error=>{throw error;});
      return response;
    }
  };
}
const suggestion={event_type:'patient_note',title:'У меня кашель',details:'У меня кашель'};

test('AI null suppresses legacy keyword suggestions; new topics and refusals cancel pending consent',async()=>{
  for(const intervening of ['сколько мне лет','нет']) {
    const h=setup();
    await h.send('У меня кашель',suggestion);
    await h.send(intervening);
    await h.send('да');
    assert.equal(h.saved.length,0);assert.equal(h.fallbackCalls(),0);
  }
});
test('history consent is patient-scoped, expires and is consumed once',async()=>{
  const h=setup();
  await h.send('У меня кашель',suggestion);
  await h.send('да',null,'other');
  assert.equal(h.saved.length,0);
  await Promise.all([h.send('да'),h.send('да')]);
  assert.equal(h.saved.length,1);assert.equal(h.saved[0].patientId,'own');
  await h.send('У меня кашель',suggestion);h.expire();await h.send('да');
  assert.equal(h.saved.length,1);
});

test('clearing a conversation cancels its confirmation even if the old request completed late',async()=>{
  const h=setup();
  await h.send('У меня кашель',suggestion);
  await h.send('да',null,'own',[]);
  assert.equal(h.saved.length,0);
  const proposed=await h.send('У меня кашель',suggestion);
  await h.send('да',null,'own',[{role:'assistant',content:proposed.answer}]);
  assert.equal(h.saved.length,1);
});
