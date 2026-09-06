const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{EventEmitter}=require('node:events');
const config={authKey:'synthetic-key',authUrl:'https://provider.test/oauth',apiUrl:'https://provider.test/api',scope:'test',model:'test',timeoutMs:1000};
const completion={choices:[{finish_reason:'stop',message:{content:'{"answer":"ok"}'}}]};
function setup(queue) {
  const calls=[];
  const https={Agent:class {},request:(url,options,callback)=>{
    const req=new EventEmitter();req.destroy=error=>req.emit('error',error);
    req.end=body=>{
      calls.push({url:String(url),options,body});
      setImmediate(()=>{
        const next=queue.shift();
        if(next==='timeout') return req.emit('timeout');
        const response=new EventEmitter();response.statusCode=next.status||200;
        callback(response);response.emit('data',Buffer.from(JSON.stringify(next.json)));response.emit('end');
      });
    };
    return req;
  }};
  const filename=path.resolve(__dirname,'../../backend/src/services/ai/gigachatClient.js');
  const m=new Module(filename,module);m.filename=filename;
  m.require=id=>id==='https'?https:require(id);
  m._compile(fs.readFileSync(filename,'utf8'),filename);
  return {client:m.exports,calls};
}
const token=()=>({json:{access_token:'synthetic-token',expires_at:Date.now()+1800000}});
test('concurrent calls share OAuth and subsequent stages reuse the token',async()=>{
  const h=setup([token(),{json:completion},{json:completion},{json:completion}]);
  await Promise.all([h.client.complete([],config),h.client.complete([],config)]);
  await h.client.complete([],config);
  assert.equal(h.calls.filter(c=>c.url.endsWith('/oauth')).length,1);
  assert.equal(h.calls.length,4);
  assert.equal(JSON.parse(h.calls[1].body).stream,false);
});
test('a rejected token is refreshed once and persistent 401 propagates',async()=>{
  const h=setup([token(),{status:401,json:{}},token(),{status:401,json:{}}]);
  await assert.rejects(()=>h.client.complete([],config),{statusCode:401});
  assert.equal(h.calls.length,4);
});
test('timeout, truncated output and non-JSON responses fail closed',async()=>{
  const h=setup(['timeout']);
  await assert.rejects(()=>h.client.complete([],config),/gigachat_timeout/);
  const truncated=setup([token(),{json:{choices:[{finish_reason:'length',message:{content:'{"answer":'}}]}}]);
  await assert.rejects(()=>truncated.client.complete([],config),/gigachat_truncated_answer/);
  assert.equal(h.client.parseObject('prefix {"answer":"ok"}'),null);
  assert.equal(h.client.parseObject('[]'),null);
  assert.deepEqual(h.client.parseObject('```json\n{"answer":"ok"}\n```'),{answer:'ok'});
});
