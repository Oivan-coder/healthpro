const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const {JSDOM} = require('jsdom');
const tick = () => new Promise(resolve => setImmediate(resolve));
const copy = value => JSON.parse(JSON.stringify(value));

(async () => {
  const dom = new JSDOM('<main id="pageRoot"></main>', {url:'https://healthpro.test/#assistant', runScripts:'outside-only', pretendToBeVisual:true});
  const w = dom.window, d = w.document;
  w.scrollTo = () => {};
  w.matchMedia = () => ({matches:false});
  w.UI = {root:() => d.getElementById('pageRoot'), firstName:() => 'Тестовый'};
  const calls = [];
  w.HealthAPI = {
    getSummary:async () => ({patient:{name:'Тестовый пациент',age:36},labs:[]}),
    assistantChat:payload => new Promise((resolve,reject) => calls.push({payload:copy(payload),resolve,reject}))
  };
  w.App = {render:() => w.Pages.assistant()};
  w.eval(fs.readFileSync(path.resolve(__dirname,'../../frontend/pages/assistant.js'),'utf8'));
  await w.Pages.assistant();
  async function send(question) {
    d.getElementById('assistantInput').value = question;
    d.getElementById('assistantForm').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));
    await tick();
  }
  w.AssistantState.mode = 'result_explanation';
  w.AssistantState.context = {test_code:'DD',test_name:'D-димер'};
  w.AssistantState.messages = [{role:'user',text:'А гемоглобин?'},{role:'assistant',text:'Гемоглобин 150 г/л.'}];
  await send('а почему он высокий?');
  assert.equal(calls[0].payload.mode,'assistant_chat');
  assert.deepEqual(calls[0].payload.history,[{role:'user',content:'А гемоглобин?'},{role:'assistant',content:'Гемоглобин 150 г/л.'}]);
  calls[0].resolve({answer:'Гемоглобин выше диапазона.',resolvedContext:{test_code:'HB',test_name:'Гемоглобин'},provider:'gigachat'});
  await tick(); await tick();
  assert.equal(w.AssistantState.context.test_code,'HB');
  await send('сколько мне лет');
  assert.equal(calls[1].payload.history.at(-1).content,'Гемоглобин выше диапазона.');
  calls[1].resolve({answer:'Вам 36 лет. <img src=x onerror=alert(1)>',contextAction:'clear',mode:'assistant_chat'});
  await tick(); await tick();
  assert.equal(w.AssistantState.context,null);
  assert(d.getElementById('assistantMessages').textContent.includes('Вам 36 лет.'));
  assert.equal(d.querySelector('#assistantMessages img'),null);
  console.log('PASS dialogue history, typed questions ignore stale mode, resolved/cleared context and escaped answers');

  await send('старый вопрос');
  d.getElementById('assistantClear').click();
  await tick();
  await send('новый вопрос');
  assert.deepEqual(calls[3].payload.history,[]);
  calls[2].resolve({answer:'старый ответ',resolvedContext:{test_code:'DD',test_name:'D-димер'}});
  await tick();
  assert.equal(w.AssistantState.pending,true);
  assert.equal(w.AssistantState.messages.length,1);
  assert.equal(w.AssistantState.context,null);
  calls[3].resolve({answer:'новый ответ',contextAction:'clear'});
  await tick(); await tick();
  assert.equal(w.AssistantState.messages.at(-1).text,'новый ответ');
  assert(!d.body.textContent.includes('старый ответ'));
  console.log('PASS clear while a request is pending cannot revive the old conversation');

  await send('вопрос первого пациента');
  // The existing account reset replaces the conversation array.
  w.AssistantState.messages = [];
  w.AssistantState.pending = false;
  calls[4].reject(new Error('late failure'));
  await tick();
  assert.equal(w.AssistantState.messages.length,0);
  console.log('PASS late failure after account reset cannot inject a message');
  dom.window.close();
})().catch(error => {console.error(error);process.exitCode=1;});
