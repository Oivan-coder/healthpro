const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),postcss=require('postcss');
const dir=path.resolve(__dirname, '../../frontend');
const styles=['theme.css','layout.css','mobile.css','responsive-fixes.css','mobile-polish.css','assistant-polish.css'].map(f=>postcss.parse(fs.readFileSync(path.join(dir,'css',f),'utf8')));
function matches(query,width,height) {
 if(/prefers-reduced-motion|hover|display-mode/.test(query))return false;
 return [...query.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)].every(([,bound,axis,value])=>bound==='min'?(axis==='width'?width:height)>=Number(value):(axis==='width'?width:height)<=Number(value));
}
function cssAt(width,height,containers={workspace:width,detail:width}) {
 return styles.map(style=>{const tree=style.clone();tree.walkAtRules('media',rule=>{if(matches(rule.params,width,height))rule.replaceWith(...rule.nodes);else rule.remove();});tree.walkAtRules('container',rule=>{const name=rule.params.split(/\s/)[0];if(matches(rule.params,containers[name],height))rule.replaceWith(...rule.nodes);else rule.remove();});return tree.toString();}).join('\n');
}
for (const width of [320,390,768,820,900,1024,1180,1280,1440,1536,1728,1920]) {
 const dom=new JSDOM(fs.readFileSync(path.join(dir,'index.html'),'utf8'),{url:'https://healthpro.test/'});
 const w=dom.window,d=w.document,style=d.createElement('style');style.textContent=cssAt(width,720);d.head.append(style);
 const get=s=>w.getComputedStyle(d.querySelector(s));
 d.body.className='is-app has-bottom-nav';d.getElementById('appView').classList.remove('hidden');d.getElementById('loginView').classList.add('hidden');d.getElementById('bottomNav').style.display='';
 assert.equal(get('#menuBtn').display,width<=1180?'grid':'none',`menu ${width}`);
 assert.equal(get('#sidebar').visibility,width<=1180?'hidden':'visible',`sidebar ${width}`);
 assert.equal(get('[data-admin-only]').display,'none',`role hidden ${width}`);
 assert.equal(get('#bottomNav').display,width<=820?'grid':'none',`bottom nav ${width}`);
 d.getElementById('pageRoot').innerHTML='<div class="user-table-wrap table-wrap"><table><tr><td>Long name</td></tr></table></div>';
 assert.equal(get('.user-table-wrap table').minWidth,'1040px',`user table scroll ${width}`);
 d.getElementById('passwordChangeModal').classList.add('show');d.body.classList.add('modal-open');
 assert.equal(get('#passwordChangeModal').display,'block');assert.equal(get('#passwordChangeModal').overflowY,'auto');assert.equal(get('#passwordChangeForm').display,'grid');assert.equal(get('#currentPasswordInput').width,'100%');assert.equal(get('#passwordChangeError').display,'none');assert.equal(get('body').overflow,'hidden');
 d.body.className='is-login';d.getElementById('loginView').classList.remove('hidden');d.getElementById('privacyModal').classList.add('show');d.getElementById('modalBackdrop').classList.add('show');
 assert.equal(get('#modalBackdrop').display,'block');assert.equal(get('.login-preview-image').display,width<=900?'none':'block');
 assert.equal(get('#appView').display,'none');assert.equal(get('#loginView').display,'grid');
 dom.window.close();console.log('PASS stylesheet cascade at',width,'px');
}
// Fixed viewport, independently varied content width: these rules must react to
// the space beside the sidebar and report list, not just the window width.
for(const [workspace,detail] of [[1320,850],[1100,710],[1000,650],[920,870],[840,790],[640,604],[358,322]]) {
 const dom=new JSDOM('<div class="cabinet-page"><div class="today-columns"></div><div class="results-layout"></div><table class="compact-table history-values"><thead><tr><th>Дата</th></tr></thead><tbody><tr><td>05.09.2026</td></tr></tbody></table><table class="compact-table observation-table"><thead><tr><th>Значение</th></tr></thead><tbody><tr><th>Эритроциты</th><td>3</td></tr></tbody></table></div>');
 const d=dom.window.document,style=d.createElement('style');style.textContent=cssAt(1536,900,{workspace,detail});d.head.append(style);
 const get=s=>dom.window.getComputedStyle(d.querySelector(s));
 assert.equal(get('.results-layout').gridTemplateColumns,workspace<=920?'minmax(0,1fr)':'minmax(250px,.68fr) minmax(0,1.6fr)');
 assert.equal(get('.today-columns').alignItems,'start');
 assert.equal(get('.history-values thead').display,workspace<=840?'none':'table-header-group');
 assert.equal(get('.history-values td').whiteSpace,'nowrap');
 assert.equal(get('.observation-table thead').display,detail<=740?'none':'table-header-group');
 assert.equal(get('.observation-table thead th').whiteSpace,'nowrap');
 dom.window.close();console.log('PASS container cascade at workspace/detail',workspace,detail,'px');
}
console.log('CSS/media/container rules checked; this does not measure rendered geometry or browser visuals.');
