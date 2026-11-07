// Review witness for PR #13 at e946faa. No network calls; fetch is mocked.
// From repository root: node docs/pr-reviews/witnesses/pr-13-key-replacement-repro.cjs
// This asserts the observed defect, so replace it with a regression test when fixed.
const path = require('path');
const repo = path.resolve(process.argv[2] || process.cwd());
const req = require('module').createRequire(path.join(repo, 'package.json'));
const ts = req('typescript'), fs = require('fs'), vm = require('vm'), assert = require('assert');
const { JSDOM } = req('jsdom');
const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost'});
global.window = dom.window; global.document = dom.window.document;
Object.defineProperty(global, 'navigator', {value:dom.window.navigator, configurable:true});
global.IS_REACT_ACT_ENVIRONMENT = true;
const {renderHook, act, cleanup} = req('@testing-library/react');
const envelopes = {
  MessageType: {OPENROUTER_BALANCE_DATA:'OPENROUTER_BALANCE_DATA', REQUEST_OPENROUTER_BALANCE:'REQUEST_OPENROUTER_BALANCE'},
  createEnvelope: (type, source, payload, correlationId) => ({type,source,payload,correlationId}),
};
const requests=[];
const vscode={postMessage:m=>requests.push(m)};
function load(file, name) {
  const exports={};
  const code=ts.transpileModule(fs.readFileSync(path.join(repo,file),'utf8'), {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code, {exports,require:p=>p==='@messages'?envelopes:p==='../useVSCodeApi'?{useVSCodeApi:()=>vscode}:req(p),Date,Set,Promise,setTimeout,clearTimeout,AbortSignal,fetch:(...args)=>global.fetch(...args)}, {filename:file});
  return exports[name];
}
const Client=load('src/infrastructure/ai/clients/OpenRouterAccountClient.ts','OpenRouterAccountClient');
const Service=load('src/infrastructure/account/AccountBalanceService.ts','AccountBalanceService');
const Handler=load('src/application/handlers/domain/AccountBalanceHandler.ts','AccountBalanceHandler');
const useBalance=load('src/presentation/webview/hooks/domain/useOpenRouterBalance.ts','useOpenRouterBalance');
const logger={debug(){},info(){},warn(){},error(){}};
(async()=>{
  let key='account-A';
  let resolveCredits;
  const deferredCredits=new Promise(resolve=>resolveCredits=resolve);
  global.fetch=async (url,options)=>({ok:true,json:async()=>{
    if(url.endsWith('/key'))return {data:{limit:null,limit_remaining:null}};
    return options.headers.Authorization==='Bearer account-A'
      ? {data:{total_credits:100,total_usage:25}}
      : deferredCredits;
  }});
  const service=new Service(new Client({getApiKey:async()=>key},logger),logger);
  const {result}=renderHook(()=>useBalance(true));
  const messages=[];
  const handler=new Handler(message=>{messages.push(message);result.current.handleBalanceData(message);},service,logger);
  await act(async()=>{await handler.handleRequest(requests[0]);});
  assert.equal(result.current.balance.credits.remaining,75);
  assert.equal(result.current.isLoading,false);
  key='account-B';
  let replacement;
  await act(async()=>{replacement=handler.handleApiKeyChanged();await Promise.resolve();});
  assert.equal(service.lastKnownBalance(),undefined);
  assert.equal(messages.length,1);
  assert.equal(result.current.balance.credits.remaining,75);
  assert.equal(result.current.isLoading,false);
  console.log('CONFIRMED: B is active and fetching; actual hook still displays account A $75, with no loading state.');
  await act(async()=>{resolveCredits({data:{total_credits:10,total_usage:9}});await replacement;});
  assert.equal(result.current.balance.credits.remaining,1);
  console.log('CONFIRMED: only after B fetch resolves does actual hook show B $1.');
  service.dispose();cleanup();dom.window.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
