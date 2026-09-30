import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,readFileSync,writeFileSync,mkdirSync,readdirSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,extname} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const source=fileURLToPath(new URL('../infra/apps/website',import.meta.url));
if (!process.env.WEBSITE_PLAYWRIGHT_MODULE) throw Error('Set WEBSITE_PLAYWRIGHT_MODULE to Playwright index.mjs.');
const {chromium}=await import(pathToFileURL(process.env.WEBSITE_PLAYWRIGHT_MODULE));
const fixture=mkdtempSync(join(tmpdir(),'website-consent-test-'));
const root=join(fixture,'app');
cpSync(source,root,{recursive:true,filter:p=>!/\/(node_modules|dist|out|\.next)(\/|$)/.test(p.slice(source.length))});
// A clean install from the committed lockfile. Turbopack refuses a node_modules
// symlinked from outside the app, so the fixture gets its own copy.
execFileSync('npm',['ci','--prefer-offline','--no-audit','--no-fund'],{cwd:root,stdio:'ignore'});
mkdirSync(join(root,'public'),{recursive:true});
const tracker='window.__trackerLoads = (window.__trackerLoads || 0) + 1; window.Snitcher = {giveCookieConsent(){window.__grants=(window.__grants||0)+1},denyCookieConsent(){window.__denials=(window.__denials||0)+1}};';
writeFileSync(join(root,'public/website-visitors-provider.js'),tracker);
// The package's own build: next build, out/ -> dist/, then the source marker.
const build=()=>execFileSync('npm',['run','build'],{cwd:root,encoding:'utf8',env:{...process.env,NEXT_TELEMETRY_DISABLED:'1'}});
const files=dir=>readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):[join(dir,e.name)]);
build();
for (const page of ['index.html','about/index.html','robots.txt','sitemap.xml','website-build.json']) assert.ok(existsSync(join(root,'dist',page)),page);
// Off by default: no consent loader or tracker reference in any exported file.
assert.ok(!files(join(root,'dist')).some(f=>/company-website-visitors-consent|startVisitorConsent/.test(readFileSync(f,'utf8'))));
const outcomes=['Disabled export ships no consent loader or tracker code'];
writeFileSync(join(root,'visitor-browser.json'),JSON.stringify({enabled:true,siteUrl:'https://fixture.cargo.app/',privacyPolicyUrl:'/privacy.html',approvedScriptSha256:createHash('sha256').update(tracker).digest('hex')}));
build();
const browser=await chromium.launch({...(process.env.WEBSITE_CHROME ? {executablePath:process.env.WEBSITE_CHROME} : {}),headless:true});
// Serves dist/ the way Cargo's static routing does: /about and /about/
// read about/index.html; a file path is served as that file.
function distFile(pathname){
 if(pathname.endsWith('/')) return join(root,'dist',pathname,'index.html');
 if(!extname(pathname)) return join(root,'dist',pathname,'index.html');
 return join(root,'dist',pathname);
}
async function pageFor(origin='https://fixture.cargo.app',options={}){
 const context=await browser.newContext({viewport:{width:390,height:844},...options});
 const page=await context.newPage(); const requests=[]; const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());requests.push(url.pathname);
  if(url.origin!==origin) throw Error('Unexpected remote request: '+url.origin);
  const file=distFile(url.pathname);
  try{await route.fulfill({status:200,body:readFileSync(file),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'text/plain'});}catch{await route.fulfill({status:404,body:'not found'});}
 });
 return {context,page,requests,errors,count:()=>requests.filter(x=>x==='/website-visitors-provider.js').length,origin};
}
{
 const s=await pageFor('https://preview.fixture.test',{viewport:{width:1440,height:900}});
 await s.page.goto(s.origin+'/');
 assert.match(await s.page.title(),/\|/);
 assert.equal(await s.page.locator('meta[name="robots"]').first().getAttribute('content'),'noindex, nofollow');
 await s.page.getByRole('link',{name:'About',exact:true}).first().click();
 await s.page.waitForURL(/\/about\/$/);await s.page.getByRole('heading',{level:1}).waitFor();
 assert.match(await s.page.title(),/^About/);outcomes.push('Client navigation reaches the prerendered about page');
 await s.page.goto(s.origin+'/about');assert.match(await s.page.title(),/^About/);outcomes.push('Direct /about entry serves about/index.html under static routing');
 const toggle=s.page.getByRole('button',{name:/Use (dark|light) theme/});await toggle.click();
 const dark=await s.page.evaluate(()=>document.documentElement.classList.contains('dark'));
 await s.page.reload();assert.equal(await s.page.evaluate(()=>document.documentElement.classList.contains('dark')),dark);outcomes.push('Theme control persists across reloads');
 await s.page.setViewportSize({width:390,height:844});assert.ok(await s.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));outcomes.push('No horizontal overflow at 390px');
 await s.page.screenshot({path:join(fixture,'about-mobile.png'),fullPage:true});
 assert.deepEqual(s.errors,[]);await s.context.close();
}
let f=await pageFor();
await f.page.goto(f.origin);await f.page.locator('[data-visitor-consent]').waitFor();
assert.equal(f.count(),0);outcomes.push('No tracker before a choice');
await f.page.screenshot({path:join(fixture,'consent-mobile.png'),fullPage:true});
assert.ok(await f.page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
await f.page.getByRole('button',{name:'Reject tracking',exact:true}).click();
await f.page.reload();await f.page.getByRole('button',{name:'Privacy choices',exact:true}).waitFor();
assert.equal(f.count(),0);outcomes.push('Reject persists across reload without tracker requests');
await f.page.getByRole('button',{name:'Privacy choices',exact:true}).click();
await f.page.getByRole('button',{name:'Accept tracking',exact:true}).click();
await f.page.waitForFunction(()=>window.__trackerLoads===1);assert.equal(f.count(),1);await f.page.waitForFunction(()=>window.__grants===1);outcomes.push('Accept loads tracker once and explicitly grants provider consent');
await f.page.getByRole('button',{name:'Privacy choices',exact:true}).click();
await f.page.getByRole('button',{name:'Accept tracking',exact:true}).click();assert.equal(f.count(),1);
await f.page.reload();await f.page.waitForFunction(()=>window.__trackerLoads===1);assert.equal(f.count(),2);outcomes.push('Accepted preference applies once per later page');
await f.page.getByRole('button',{name:'Privacy choices',exact:true}).click();
await Promise.all([f.page.waitForEvent('domcontentloaded'),f.page.getByRole('button',{name:'Reject tracking',exact:true}).click()]);
await f.page.getByRole('button',{name:'Privacy choices',exact:true}).waitFor();assert.equal(f.count(),2);assert.equal(await f.page.evaluate(()=>window.__trackerLoads),undefined);outcomes.push('Withdrawal reloads without reloading tracker');
await f.page.getByRole('button',{name:'Privacy choices',exact:true}).click();
await f.page.getByRole('button',{name:'Accept tracking',exact:true}).click();await f.page.waitForFunction(()=>window.__grants===1);outcomes.push('Re-acceptance grants provider consent after withdrawal');
const other=await f.context.newPage();await other.goto(f.origin);await other.waitForFunction(()=>window.__grants===1);const beforeWithdrawal=f.count();
await other.getByRole('button',{name:'Privacy choices',exact:true}).click();
await Promise.all([f.page.waitForEvent('domcontentloaded'),other.waitForEvent('domcontentloaded'),other.getByRole('button',{name:'Reject tracking',exact:true}).click()]);
await f.page.getByRole('button',{name:'Privacy choices',exact:true}).waitFor();await other.getByRole('button',{name:'Privacy choices',exact:true}).waitFor();assert.equal(f.count(),beforeWithdrawal);assert.equal(await f.page.evaluate(()=>window.__trackerLoads),undefined);outcomes.push('Withdrawal in another tab stops both active trackers');
assert.deepEqual(f.errors,[]);await f.context.close();
f=await pageFor();await f.page.addInitScript(()=>{Object.defineProperty(navigator,'globalPrivacyControl',{value:true});localStorage.setItem('company-website-visitors-consent-v1','accepted');});
await f.page.goto(f.origin);await f.page.getByRole('button',{name:'Privacy choices',exact:true}).click();assert.equal(await f.page.getByRole('button',{name:'Accept tracking',exact:true}).isDisabled(),true);assert.equal(f.count(),0);outcomes.push('Global Privacy Control overrides saved acceptance');await f.context.close();
f=await pageFor('https://preview.fixture.test');await f.page.goto(f.origin);assert.equal(await f.page.locator('[data-visitor-consent]').count(),0);assert.equal(f.count(),0);outcomes.push('Another-origin preview never loads tracker');await f.context.close();
f=await pageFor();await f.page.addInitScript(()=>{Storage.prototype.getItem=()=>{throw Error('denied')};Storage.prototype.setItem=()=>{throw Error('denied')};});await f.page.goto(f.origin);await f.page.getByRole('button',{name:'Accept tracking',exact:true}).click();await f.page.waitForFunction(()=>window.__trackerLoads===1);assert.deepEqual(f.errors,[]);outcomes.push('Storage denial does not break explicit per-page consent');await f.page.setViewportSize({width:1440,height:1000});await f.page.getByRole('button',{name:'Privacy choices',exact:true}).click();await f.page.screenshot({path:join(fixture,'consent-desktop.png'),fullPage:true});await f.context.close();
await browser.close();
writeFileSync(join(fixture,'results.json'),JSON.stringify({kind:'synthetic browser consent test; inert local tracker; no Cargo ingestion claim',outcomes,fixture},null,2)+'\n');console.log(JSON.stringify({outcomes,evidence:fixture},null,2));
