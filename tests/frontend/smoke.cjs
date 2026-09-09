const { JSDOM, VirtualConsole } = require('jsdom');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const postcss = require('postcss');
const root = path.resolve(__dirname, '../../frontend');
const tick = () => new Promise(resolve => setImmediate(resolve));
const routes = ['dashboard','labs','lab-history','appointments','visits','reports','assistant','profile','admin-users','integration','manual-lab-entry'];
let passed = 0;
function pass(label) { passed++; console.log('PASS', label); }
(async () => {
const vc = new VirtualConsole();
vc.on('jsdomError', error => { throw error; });
const dom = new JSDOM(fs.readFileSync(path.join(root,'index.html'),'utf8'), {url:'https://healthpro.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const w = dom.window, d = w.document;
const mediaListeners=[]; const compactQuery={matches:false,addEventListener(type,fn){mediaListeners.push(fn);}};
w.matchMedia = query => query.includes('1180px') ? compactQuery : ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} });
w.scrollTo = () => {};
let meUser = null, loginUser = {id:'fixture',login:'fixture',displayName:'Тестовый Пользователь',role:'user',patientId:'p_fixture',mustChangePassword:false}, invalid = false;
let calls = [], renders = [];
w.fetch = async (url, options) => {
  const endpoint = new URL(url).pathname;
  calls.push({endpoint,url,options});
  let status = 200, data = {ok:true};
  if (endpoint === '/api/auth/me') { status = meUser ? 200 : 401; data = meUser ? {user:meUser} : {error:'authentication_required'}; }
  else if (endpoint === '/api/auth/login') { status = invalid ? 401 : 200; data = invalid ? {error:'invalid_credentials'} : {user:loginUser}; }
  else if (!['/api/auth/logout','/api/auth/change-password'].includes(endpoint)) throw Error('Unexpected API request: '+endpoint);
  return {ok:status>=200&&status<300,status,json:async()=>data};
};
for (const file of ['js/core/api-client.js','components/ui.js']) w.eval(fs.readFileSync(path.join(root,file),'utf8'));
w.Pages = Object.fromEntries(routes.map(route => [route, async () => {renders.push(route);d.getElementById('pageRoot').innerHTML = `<section class="card"><h2>${route}</h2></section>`;} ]));
for (const script of d.querySelectorAll('script:not([src])')) w.eval(script.textContent);
w.eval(fs.readFileSync(path.join(root,'js/core/app.js'),'utf8'));
await tick(); await tick();
assert(d.body.classList.contains('is-login'));
assert.equal(d.getElementById('appView').classList.contains('hidden'), true);
pass('anonymous session shows only login');
function field(id,value) { d.getElementById(id).value = value; }
async function submit(id) {d.getElementById(id).dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await tick();await tick();}
field('loginInput','fixture'); field('passwordInput','fixture-only-secret');
invalid=true;await submit('loginForm');assert.equal(d.getElementById('loginError').hidden,false);assert(d.getElementById('loginError').textContent.includes('Неверный'));
pass('login errors remain visible');
invalid=false;await submit('loginForm');assert.equal(w.App.user().role,'user');assert.equal(renders.at(-1),'dashboard');
assert([...d.querySelectorAll('[data-admin-only]')].every(el=>el.hidden));
const loginCall = calls.find(c=>c.endpoint.endsWith('/login'));
assert.equal(loginCall.options.credentials,'include');assert.equal(new URL(loginCall.url).origin,'https://healthpro.test');assert.deepEqual(JSON.parse(loginCall.options.body),{login:'fixture',password:'fixture-only-secret'});
pass('server login payload, same-origin cookies and role display unchanged');
for (const route of routes.slice(0,8)) {
  await w.App.navigate(route);assert.equal(renders.at(-1),route);
}
await w.App.navigate('integration');assert.equal(renders.at(-1),'dashboard');
const labLink=d.querySelector('.nav-link[data-route="labs"]'); const before=renders.length;
labLink.click(); await tick();assert.equal(renders.length-before,1);assert.equal(renders.at(-1),'labs');
pass('all patient routes, route guards and click navigation');
w.ManualLabEntryState={owner:'fixture:p_fixture',patientId:'p_fixture',serviceId:'service',entries:[{testId:'x'}]};
await w.App.logout();assert(d.body.classList.contains('is-login'));assert.equal(w.PatientStorage.getCurrentPatientId(),'');assert.equal(w.ManualLabEntryState.entries.length,0);
pass('logout clears patient UI session');
const legal=d.querySelector('[data-legal-modal="privacyModal"]');legal.focus();legal.click();
assert(d.getElementById('privacyModal').classList.contains('show'));assert(d.getElementById('modalBackdrop').classList.contains('show'));assert(d.getElementById('loginView').hasAttribute('inert'));
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!d.getElementById('privacyModal').classList.contains('show'));assert.equal(d.activeElement,legal);assert(!d.getElementById('loginView').hasAttribute('inert'));
pass('legal modal opens on login, Escape and focus restoration');
loginUser={...loginUser,mustChangePassword:true};field('passwordInput','fixture-only-secret');await submit('loginForm');
assert(d.getElementById('passwordChangeModal').classList.contains('show'));const renderBefore=renders.length;await w.App.navigate('labs');assert.equal(renders.length,renderBefore);
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));d.getElementById('modalBackdrop').click();assert(d.getElementById('passwordChangeModal').classList.contains('show'));
const save=d.querySelector('#passwordChangeForm button[type="submit"]');save.focus();d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(d.activeElement.id,'currentPasswordInput');
pass('temporary password gate survives navigation, Escape and backdrop; focus trapped');
field('currentPasswordInput','fixture-old-secret');field('newPasswordInput','fixture-new-secret');field('newPasswordConfirmInput','mismatch');const beforeChange=calls.length;await submit('passwordChangeForm');assert.equal(calls.length,beforeChange);assert.equal(d.getElementById('passwordChangeError').hidden,false);
field('newPasswordConfirmInput','fixture-new-secret');await submit('passwordChangeForm');assert(d.body.classList.contains('is-login'));assert(!d.body.classList.contains('modal-open'));assert.equal(d.getElementById('newPasswordInput').value,'');
assert.deepEqual(JSON.parse(calls.find(c=>c.endpoint.endsWith('change-password')).options.body),{currentPassword:'fixture-old-secret',newPassword:'fixture-new-secret'});
pass('password mismatch and successful change return to login; contract unchanged');
loginUser={...loginUser,role:'tester',mustChangePassword:false,patientId:'p_tester'};field('passwordInput','fixture-only-secret');await submit('loginForm');assert.equal(renders.at(-1),'dashboard');assert.equal(d.querySelector('[data-route="manual-lab-entry"]').hidden,false);await w.App.navigate('manual-lab-entry');assert.equal(renders.at(-1),'manual-lab-entry');await w.App.logout();
loginUser={...loginUser,role:'admin',mustChangePassword:false,patientId:null};field('passwordInput','fixture-only-secret');await submit('loginForm');assert.equal(renders.at(-1),'admin-users');assert.equal(d.getElementById('bottomNav').style.display,'none');assert([...d.querySelectorAll('[data-user-only]')].every(el=>el.hidden));await w.App.navigate('integration');assert.equal(renders.at(-1),'integration');await w.App.navigate('profile');assert.equal(renders.at(-1),'admin-users');
pass('admin routes and user isolation');
compactQuery.matches=true;mediaListeners.forEach(fn=>fn());
assert(d.getElementById('sidebar').hasAttribute('inert'));
d.getElementById('menuBtn').click();assert(d.getElementById('sidebar').classList.contains('open'));assert(!d.getElementById('sidebar').hasAttribute('inert'));assert(d.querySelector('.workspace').hasAttribute('inert'));assert.equal(d.getElementById('menuBtn').getAttribute('aria-expanded'),'true');assert.equal(d.getElementById('navOverlay').hidden,false);
const lastAdmin=d.querySelector('[data-route=integration]');lastAdmin.focus();d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));assert.equal(d.activeElement.id,'closeSidebarBtn');
d.dispatchEvent(new w.KeyboardEvent('keydown',{key:'Escape',bubbles:true}));assert(!d.getElementById('sidebar').classList.contains('open'));assert.equal(d.activeElement.id,'menuBtn');assert(!d.querySelector('.workspace').hasAttribute('inert'));
d.getElementById('menuBtn').click();const n=renders.length;lastAdmin.dispatchEvent(new w.Event('pointerdown',{bubbles:true,cancelable:true}));lastAdmin.click();await tick();assert.equal(renders.length-n,1);assert.equal(renders.at(-1),'integration');assert(!d.getElementById('sidebar').classList.contains('open'));assert.equal(lastAdmin.getAttribute('aria-current'),'page');
d.getElementById('menuBtn').click();compactQuery.matches=false;mediaListeners.forEach(fn=>fn());assert(!d.getElementById('sidebar').hasAttribute('inert'));assert.equal(d.getElementById('navOverlay').hidden,true);
await w.App.navigate('admin-users');
pass('mobile admin drawer, focus loop, Escape, single touch navigation and desktop resize');
w.Pages['admin-users']=async()=>{throw Object.assign(new Error('expired'),{status:401});};await w.App.render();assert(d.body.classList.contains('is-login'));assert(d.getElementById('loginError').textContent.includes('Сессия'));
pass('expired server session returns to login');
for (const f of ['theme.css','layout.css','mobile.css','responsive-fixes.css']) postcss.parse(fs.readFileSync(path.join(root,'css',f),'utf8'),{from:f});
const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(ids.length,new Set(ids).size);
for(const el of d.querySelectorAll('[src],link[href]')) {const p=el.getAttribute('src')||el.getAttribute('href');if(p.startsWith('./'))assert(fs.existsSync(path.join(root,p.split('?')[0])),'Missing asset '+p);}
pass('CSS parses; HTML IDs and referenced assets are valid');
dom.window.close();console.log(`${passed} checks passed (DOM + simulated API; no live server or layout engine)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
