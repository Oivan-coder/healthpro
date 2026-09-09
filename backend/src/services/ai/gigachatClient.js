const crypto = require("crypto");
const https = require("https");

let cached = {key:"", token:"", expiresAt:0, pending:null};
const error = (message, statusCode=502) => Object.assign(new Error(message), {statusCode});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
function requestJson(url, options, config) {
  return new Promise((resolve,reject) => {
    const target = new URL(url);
    if (target.protocol !== "https:") return reject(error("gigachat_https_required"));
    const body = String(options.body || "");
    const req = https.request(target, {
      method:"POST", headers:{...options.headers,"Content-Length":Buffer.byteLength(body)},
      timeout:Math.max(1000, Math.min(Number(config.timeoutMs) || 12000, 30000)),
      agent:new https.Agent({rejectUnauthorized:config.rejectUnauthorized !== false,ca:config.caCert})
    }, response => {
      const chunks=[];let size=0;
      response.on("data",chunk => {
        size+=chunk.length;
        if(size>1048576) return req.destroy(error("gigachat_response_too_large"));
        chunks.push(chunk);
      });
      response.on("error",()=>reject(error("gigachat_network_error")));
      response.on("end",()=>{
        if(response.statusCode<200 || response.statusCode>=300) return reject(error("gigachat_http_"+response.statusCode,response.statusCode));
        try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
        catch { reject(error("gigachat_invalid_json")); }
      });
    });
    req.on("timeout",()=>req.destroy(error("gigachat_timeout",504)));
    req.on("error",err=>reject(err.message.startsWith("gigachat_")?err:error("gigachat_network_error")));
    req.end(body);
  });
}
async function accessToken(config) {
  if(!config.authKey) throw error("gigachat_auth_key_missing",401);
  const key=crypto.createHash("sha256").update([config.authUrl,config.scope,config.authKey].join("|")).digest("hex");
  if(cached.key!==key) cached={key,token:"",expiresAt:0,pending:null};
  const state=cached;
  if(state.token && Date.now()<state.expiresAt-60000) return state.token;
  if(!state.pending) state.pending=requestJson(config.authUrl,{
    headers:{Authorization:"Basic "+config.authKey,RqUID:crypto.randomUUID(),"Content-Type":"application/x-www-form-urlencoded",Accept:"application/json"},
    body:new URLSearchParams({scope:config.scope})
  },config).then(json=>{
    if(!json.access_token) throw error("gigachat_token_missing");
    state.token=json.access_token;state.expiresAt=Number(json.expires_at)||Date.now()+25*60000;
    return state.token;
  }).finally(()=>{state.pending=null;});
  return state.pending;
}
async function complete(messages, config, options={}) {
  let token;
  try {
    token=await accessToken(config);
    const payload={model:config.model,messages,stream:false,max_tokens:options.maxTokens||900,temperature:options.temperature??0};
    if(options.responseFormat) payload.response_format=options.responseFormat;
    const json=await requestJson(config.apiUrl.replace(/\/$/,"")+"/chat/completions",{
      headers:{Authorization:"Bearer "+token,"Content-Type":"application/json",Accept:"application/json"},
      body:JSON.stringify(payload)
    },config);
    const choice=json.choices?.[0];
    if(choice?.finish_reason==="length") throw error("gigachat_truncated_answer");
    if(typeof choice?.message?.content!=="string" || !choice.message.content.trim()) throw error("gigachat_answer_missing");
    return choice.message.content.trim();
  } catch(err) {
    if(err.statusCode===401 && !options.retried) {
      if(token && cached.token===token) {cached.token="";cached.expiresAt=0;}
      return complete(messages,config,{...options,retried:true});
    }
    if(options.responseFormat && !options.formatFallback && [400,404,415,422].includes(err.statusCode)) {
      return complete(messages,config,{...options,responseFormat:null,formatFallback:true});
    }
    const transient=err.message==="gigachat_network_error" || err.message==="gigachat_timeout" || [429,500,502,503,504].includes(err.statusCode);
    if(transient && !options.transientRetried) {
      await sleep(300);
      return complete(messages,config,{...options,transientRetried:true});
    }
    throw err;
  }
}
function parseObject(text) {
  const raw=String(text||"").trim().replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");
  const parse=value=>{
    try {
      let result=JSON.parse(value);
      if(typeof result==="string") result=JSON.parse(result);
      return result && typeof result==="object" && !Array.isArray(result)?result:null;
    } catch {return null;}
  };
  const direct=parse(raw);
  if(direct) return direct;
  const start=raw.indexOf("{");
  const end=raw.lastIndexOf("}");
  return start>=0 && end>start ? parse(raw.slice(start,end+1)) : null;
}
module.exports={complete,parseObject};
