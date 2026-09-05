const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom'),postcss=require('postcss');
const dir=path.resolve(__dirname, '../../frontend');
const styles=['theme.css','layout.css','mobile.css','responsive-fixes.css'].map(f=>postcss.parse(fs.readFileSync(path.join(dir,'css',f),'utf8')));
function matches(query,width,height) {
 if(/prefers-reduced-motion|hover/.test(query))return false;
 return [...query.matchAll(/\((min|max)-(width|height):\s*(\d+)px\)/g)].every(([,bound,axis,value])=>bound==='min'?(axis==='width'?width:height)>=Number(value):(axis==='width'?width:height)<=Number(value));
}
function cssAt(width,height) {
 return styles.map(style=>{const tree=style.clone();tree.walkAtRules('media',rule=>{if(matches(rule.params,width,height))rule.replaceWith(...rule.nodes);else rule.remove();});return tree.toString();}).join('\n');
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
 d.getElementById('pageRoot').innerHTML='<div class="history-table-card feed-card"><div class="history-table-grid"><div class="history-table-row history-table-head">Header</div><article class="history-table-row"><div class="history-row-actions"><button class="btn small">Динамика</button></div></article></div></div><div class="user-table-wrap table-wrap"><table><tr><td>Long name</td></tr></table></div>';
 assert.equal(get('.history-table-grid').minWidth,width<=900?'0px':'1040px',`history min-width ${width}`);
 assert.equal(get('.history-table-head').display,width<=900?'none':'grid',`history head ${width}`);
 assert.equal(get('.history-table-card').overflowX,'auto',`history scroll ${width}`);
 assert.equal(get('.user-table-wrap table').minWidth,'1040px',`user table scroll ${width}`);
 d.getElementById('passwordChangeModal').classList.add('show');d.body.classList.add('modal-open');
 assert.equal(get('#passwordChangeModal').display,'block');assert.equal(get('#passwordChangeModal').overflowY,'auto');assert.equal(get('#passwordChangeForm').display,'grid');assert.equal(get('#currentPasswordInput').width,'100%');assert.equal(get('#passwordChangeError').display,'none');assert.equal(get('body').overflow,'hidden');
 d.body.className='is-login';d.getElementById('loginView').classList.remove('hidden');d.getElementById('privacyModal').classList.add('show');d.getElementById('modalBackdrop').classList.add('show');
 assert.equal(get('#modalBackdrop').display,'block');assert.equal(get('.login-preview-image').display,width<=900?'none':'block');
 assert.equal(get('#appView').display,'none');assert.equal(get('#loginView').display,'grid');
 dom.window.close();console.log('PASS stylesheet cascade at',width,'px');
}
console.log('CSS/media rules checked; this does not measure rendered geometry or browser visuals.');
