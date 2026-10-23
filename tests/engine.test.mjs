import fs from 'fs'; import {JSDOM} from 'jsdom';
const html=fs.readFileSync('android/assets/assistant.html','utf8');
const kb=fs.readFileSync('android/assets/tiva_knowledge.js','utf8');
const inline=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
const APPS=[{label:'Telegram',pkg:'org.telegram.messenger',sys:false},{label:'Bale',pkg:'ir.bale.messenger',sys:false},{label:'Chrome',pkg:'com.android.chrome',sys:false},{label:'Gallery',pkg:'com.miui.gallery',sys:false},{label:'Camera',pkg:'com.android.camera',sys:false},{label:'Settings',pkg:'com.android.settings',sys:true}];
const dom=new JSDOM(html,{runScripts:'outside-only',url:'https://local.test/',pretendToBeVisual:true,beforeParse(w){
 w.__calls=[]; w.TivaNative={listApps:()=>JSON.stringify(APPS),deviceInfo:()=>JSON.stringify({battery:78,ramTotal:6144,ramAvail:2150,ramUsed:3994,storageTotal:120,storageFree:38.6,storageUsed:81.4,cpuTemp:41,batteryTemp:35,status:'شارژ',health:'خوب',voltage:4210,apps:6,model:'Redmi'}),permissions:()=>JSON.stringify({overlay:true,accessibility:true,batteryOpt:true,notifications:true}),isFloating:()=>false,version:()=> '1.0.1',vaultList:()=> '[]',vaultStatus:()=> '{}',setBubble:()=> '{"ok":true}',openApp:(p)=>{w.__calls.push(['openApp',p]);return '{"ok":true}';},appInfo:(p)=>{w.__calls.push(['appInfo',p]);return '{"ok":true}';},openAppInfo:(p)=>{w.__calls.push(['openAppInfo',p]);return '{"ok":true}';},openMediaPicker:(t)=>{w.__calls.push(['openMediaPicker',t]);return '{"ok":true}';},openFilePicker:()=>{w.__calls.push(['openFilePicker']);return '{"ok":true}';},composeMessage:(p,c,m)=>{w.__calls.push(['composeMessage',p,c,m]);return '{"started":true}';},flashlight:()=> '{"ok":true}',openSettings:()=>{},searchWeb:(q)=>{w.__calls.push(['searchWeb',q]);return '{"ok":true}';},resolveContact:(c)=>{w.__calls.push(['resolveContact',c]);return '{"ok":true}';},setAlarm:(h,m,l)=>{w.__calls.push(['setAlarm',h,m]);return '{"ok":true}';},setTimer:(s)=>{w.__calls.push(['setTimer',s]);return '{"ok":true}';},copyText:()=>{},startVoice:()=>{},closeOverlayChat:()=>{},openFullApp:()=>{},confirmAction:()=>{},requestVaultUnlock:()=>{},lockVault:()=>{}};
 w.matchMedia=()=>({matches:false,addListener(){},removeListener(){}}); w.scrollTo=()=>{};
}});
const w=dom.window; w.eval(kb); w.eval(inline); await new Promise(r=>setTimeout(r,300));
const T=w.__tivaTest;
const tests=[
 ['آلارم 6:30', 'آلارم ساعت 6:30 بذار', r=>r.type==='alarm'&&r.payload.hour===6&&r.payload.minute===30],
 ['آلارم ۸ شب', 'ساعت ۸ شب بیدارم کن', r=>r.type==='alarm'&&r.payload.hour===20&&r.payload.minute===0],
 ['تایمر یک ساعت', 'تایمر یک ساعت', r=>r.type==='timer'&&r.payload===3600],
 ['Telegram', 'Telegram رو باز کن', r=>r.type==='openApp'&&/telegram/i.test(r.app.pkg)],
 ['telegram lower', 'telegram', r=>r.type==='openApp'&&/telegram/i.test(r.app.pkg)],
 ['بله', 'بله رو باز کن', r=>r.type==='openApp'&&/bale/i.test(r.app.pkg)],
 ['بستن تلگرام', 'تلگرام رو ببند', r=>r.type==='appInfo'&&/telegram/i.test(r.app.pkg)],
 ['گرم شدن', 'گوشی گرمه', r=>r.type==='temp'],
 ['کش و فضا', 'کش‌ها رو پاک کن و فضا رو بهینه کن', r=>r.type==='settings'&&/کش/.test(r.intent)],
 ['کشور', 'کشور ایران کجاست', r=>r.type==='clarify'],
 ['جستجو', 'کروم رو باز کن و قیمت دلار رو سرچ کن', r=>r.type==='search'&&r.payload==='قیمت دلار'],
 ['رم', 'رم چقدره', r=>r.type==='ram'],
 ['تماس با نام مخاطب', 'به علی زنگ بزن', r=>r.type==='callContact'&&r.payload.contact.includes('علی')],
 ['پیامک بی‌شماره', 'یه پیامک بفرست', r=>r.type==='clarify'],
 ['حذف عکس', 'عکس‌های گالری رو حذف کن', r=>r.type==='mediaPicker'],
 ['حذف فایل', 'فایل PDF رو پاک کن', r=>r.type==='filePicker'],
 ['فرمت', 'فرمت گوشی چیه', r=>r.type==='clarify'],
 ['کرم', 'کرم ضدآفتاب چیه', r=>r.type==='clarify'],
 ['گرم شدن هوا', 'گرم شدن هوا', r=>r.type==='clarify'],
 ['هوا گرم شده', 'هوا گرم شده', r=>r.type==='clarify'],
 ['تایمر نامشخص', 'یه تایمر بذار', r=>r.type==='clarify'],
 ['گالری', 'گالری رو باز کن', r=>r.type==='openApp'&&/gallery/i.test(r.app.pkg)],
 ['بستن ناشناس', 'برنامه رو ببند', r=>r.type==='clarify'],
 ['حذف برنامه', 'تلگرام رو حذف کن', r=>r.type==='appInfo'&&/telegram/i.test(r.app.pkg)],
 ['تنظیمات', 'تنظیمات رو باز کن', r=>r.type==='settings'],
 ['هیچ عملیات خطرناک بی‌تأیید', 'به 09121234567 زنگ بزن', r=>r.type==='confirm'&&r.confirmType==='call'],
];
let fail=0;
for(const [name,text,check] of tests){let r;try{r=T.parseCommand(text);}catch(e){console.log('THROW',name,e.message);fail++;continue;}const ok=check(r);if(!ok)fail++;console.log(ok?'PASS':'FAIL',name,'=>',r.type, r.intent, r.payload||r.app&&r.app.label, (r.reply||'').slice(0,80));}

// execution tests: the parser result must reach the right native bridge with correct arguments
const fakeEl={querySelector:()=>null,insertAdjacentHTML:()=>{}};
function resetCalls(){w.__calls.length=0;}
resetCalls(); T.execute(fakeEl,T.parseCommand('آلارم ساعت 6:30 بذار')); const alarmCall=w.__calls.find(c=>c[0]==='setAlarm');
const ex1=!!alarmCall&&alarmCall[1]===6&&alarmCall[2]===30; console.log(ex1?'PASS':'FAIL','execute alarm args',w.__calls); if(!ex1)fail++;
resetCalls(); T.execute(fakeEl,T.parseCommand('تلگرام رو ببند')); const infoCall=w.__calls.find(c=>c[0]==='openAppInfo'||c[0]==='appInfo');
const ex2=!!infoCall&&/telegram/i.test(infoCall[1]); console.log(ex2?'PASS':'FAIL','execute app info',w.__calls); if(!ex2)fail++;
resetCalls(); T.execute(fakeEl,T.parseCommand('کروم رو باز کن و قیمت دلار رو سرچ کن')); const searchCall=w.__calls.find(c=>c[0]==='searchWeb');
const ex3=!!searchCall&&searchCall[1]==='قیمت دلار'; console.log(ex3?'PASS':'FAIL','execute search query',w.__calls); if(!ex3)fail++;
resetCalls(); T.execute(fakeEl,T.parseCommand('عکس‌های گالری رو حذف کن')); const mediaCall=w.__calls.find(c=>c[0]==='openMediaPicker');
const ex4=!!mediaCall; console.log(ex4?'PASS':'FAIL','execute media picker',w.__calls); if(!ex4)fail++;
resetCalls(); T.execute(fakeEl,T.parseCommand('فایل PDF رو پاک کن')); const fileCall=w.__calls.find(c=>c[0]==='openFilePicker');
const ex5=!!fileCall; console.log(ex5?'PASS':'FAIL','execute file picker',w.__calls); if(!ex5)fail++;
resetCalls(); const contactRes=T.parseCommand('به علی زنگ بزن'); T.execute(fakeEl,contactRes); const contactCall=w.__calls.find(c=>c[0]==='resolveContact');
const ex6=contactRes.type==='callContact'&&!!contactCall&&contactCall[1].includes('علی'); console.log(ex6?'PASS':'FAIL','execute contact resolver',w.__calls); if(!ex6)fail++;

// dataset quality gates
const k=JSON.parse(kb.match(/window\.TIVA_KB=(\{.*\})\s*;/s)[1]);
const counts={}; for(const e of k.examples) counts[e.intent]=(counts[e.intent]||0)+1;
const dup=k.examples.length-new Set(k.examples.map(e=>e.text)).size;
const min=Math.min(...Object.values(counts));
const quality=min>=300&&dup===0&&k.examples.length>=10000;
console.log(quality?'PASS':'FAIL','dataset',{examples:k.examples.length,classes:Object.keys(counts).length,min,duplicates:dup,negative:counts.negative});
if(!quality)fail++;
console.log(fail?`${fail} FAILED`:'ALL TESTS PASSED'); process.exit(fail?1:0);
