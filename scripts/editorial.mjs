#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { getDb, REPO_ROOT } from './lib/db.mjs';
import { table } from './lib/format.mjs';

export const specs = {
 help: '', campaigns: '', stories: '', show: '<story>', 'editorial-week': '', 'approval-chase': '', 'claims-review': '',
 'production-tasks': '', 'publication-handover': '', 'content-refresh': '', performance: '', attention: '', compliance: '', insights: '', history: '<story>',
 'add-campaign': '--code= --name= --objective= --owner= --ends= --actor=',
 add: '--code= --campaign= --title= --owner= --due= --body-file= --brief= [--channel= --language=] --actor=',
 revise: '<story> --body-file= [--title=] --actor=',
 assign: '<story> --owner= --due= --actor=',
 'request-review': '<story> --reviewer= --due= --actor=',
 review: '<story> --reviewer= --decision=approved|changes --note= --actor=',
 claim: '<story> --claim= --source= --reviewer= --checked= --until= --actor=',
 'check-claims': '<story> --advertising=yes|no --disclosure= --note= --actor=',
 'add-task': '<story> --code= --title= --owner= --due= --actor=',
 'complete-task': '<task> --actor=',
 log: '<story> --note= --actor=', ready: '<story> --actor=',
 'record-publication': '<story> --url= --date= --actor=',
 'record-metrics': '<story> --date= --views= --leads= --source= --actor=',
 archive: '<story> --note= --actor=',
 import: 'storychief <saved-json-file-or-folder> --source= --campaign= --actor= [--dry-run]',
 export: '--out=<new.json>', 'weekly-review': '', 'draft-brief': '<story>', 'draft-handover': '<story>'
};
const mutations=new Set(['add-campaign','add','revise','assign','request-review','review','claim','check-claims','add-task','complete-task','log','ready','record-publication','record-metrics','archive','import']);
const hash=x=>createHash('sha256').update(x).digest('hex');
function canonical(x){if(Array.isArray(x))return x.map(canonical);if(x&&typeof x==='object')return Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])]));return x;}
function required(o,k){if(typeof o[k]!=='string'||!o[k].trim())throw Error(`Required --${k}=value`);return o[k].trim();}
function date(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s))||new Date(s).toISOString().slice(0,10)!==s)throw Error(`Invalid calendar date: ${s}`);return s;}
function integer(s){if(!/^\d+$/.test(String(s))||!Number.isSafeInteger(Number(s))||Number(s)>2147483647)throw Error('Expected non-negative integer');return Number(s);}
function url(s){const u=new URL(s);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Expected public HTTP(S) URL without credentials');return s;}
function code(s){if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/.test(s))throw Error('Code must contain letters, digits, underscores or hyphens');return s;}
function parse(argv){const args=[],opts={};for(const a of argv){if(a.startsWith('--')){const i=a.indexOf('=');const k=a.slice(2,i<0?undefined:i);if(k in opts)throw Error(`Duplicate --${k}`);opts[k]=i<0?true:a.slice(i+1);}else args.push(a);}return {command:args.shift()||'help',args,opts};}
async function resolve(db,t,q,lock=false){if(!q)throw Error(`Specify a ${t} reference`);const field=t==='campaigns'?'name':'title';const exact=await db.query(`select * from ${t} where lower(code)=lower($1) or id::text=$1`,[q]);const rows=exact.length?exact:await db.query(`select * from ${t} where left(id::text,length($1))=$1 or position(lower($1) in lower(${field}))>0 order by code`,[q]);if(rows.length!==1)throw Error(`${rows.length?'Ambiguous':'No matching'} ${t}: ${q}${rows.length?'\n'+rows.map(r=>`${r.code} | ${r[field]} | ${r.id}`).join('\n'):''}`);if(lock)return (await db.query(`select * from ${t} where id=$1 for update`,[rows[0].id]))[0];return rows[0];}
async function audit(db,id,actor,action,detail){await db.query('insert into activity(story_id,actor,action,detail) values($1,$2,$3,$4)',[id,actor,action,JSON.stringify(detail)]);if(id)await db.query('update stories set last_activity_on=current_date where id=$1',[id]);}
const queries={
 campaigns:'select code,name,objective,owner,ends_on from campaigns order by ends_on,code',
 stories:'select code,title,campaign,owner,status,revision,due_on from v_editorial order by due_on nulls last,code',
 'editorial-week':"select code,title,owner,status,due_on,reviews_waiting,tasks_open from v_editorial where status not in ('published','archived') and (due_on<=current_date+7 or due_on is null) order by due_on nulls last,code",
 'approval-chase':"select * from v_review_queue where decision<>'approved' order by due_on,code",
 'claims-review':"select s.code,c.claim,c.reviewer,c.checked_on,c.valid_until,case when c.valid_until<greatest(current_date,coalesce(s.due_on,current_date)) then 'Refresh evidence' else 'Current' end as evidence from claims c join stories s on s.id=c.story_id and s.revision=c.revision where s.status<>'archived' order by c.valid_until,s.code",
 'production-tasks':"select t.code,s.code as story,t.title,t.owner,t.due_on from tasks t join stories s on s.id=t.story_id where closed_on is null and s.status<>'archived' order by due_on,t.code",
 'publication-handover':"select code,title,owner,status,can_handover,reviews_waiting,tasks_open,expired_evidence from v_readiness where status not in ('published','archived') order by due_on nulls last,code",
 'content-refresh':"select code,title,published_on,observed_on,views,leads,case when observed_on is null then 'No results recorded' when observed_on<current_date-7 then 'Results older than seven days' when views>=100 and leads=0 then 'Visits without enquiries' else 'Review content age' end as reason from v_performance where observed_on is null or observed_on<current_date-7 or (views>=100 and leads=0) or published_on<current_date-90 order by code",
 performance:'select * from v_performance order by code',attention:'select * from v_attention order by due_on nulls last,code,reason',
 compliance:`select code,'EDITORIAL-01' as rule,'Missing owner, date or content' as finding from v_readiness where status not in ('published','archived') and (owner='' or due_on is null or not has_content)
 union all select code,'ASA-2B','Claims inventory not reviewed for current revision' from v_readiness where status<>'archived' and not claims_checked
 union all select code,'ASA-2B','Evidence expires before the intended handover date' from v_readiness where status<>'archived' and expired_evidence>0
 union all select code,'ASA-2A','Advertising identification not recorded' from v_readiness where status<>'archived' and (advertising='unknown' or (advertising='yes' and disclosure=''))
 union all select code,'EDITORIAL-02','Current revision has no requested reviewer' from v_readiness where status in ('review','ready') and reviews_total=0
 union all select code,'EDITORIAL-03','Ready item no longer passes handover checks' from v_readiness where status='ready' and not can_handover order by code,rule`
};
export const questions=[
 'Which overdue articles also have outstanding reviews?', 'Which near-term articles lack an owner?',
 'Which current drafts rely on expired evidence?', 'Which published articles have no recorded results?',
 'Which articles have visits but no enquiries?', 'Which campaigns contain stale unfinished content?',
 'Which writers have overdue production tasks?', 'Which reviewed articles still lack an advertising decision?',
 'Which articles can be handed over with no outstanding checks?', 'Which edits have left historical approvals behind?'
];
const insightSql=[
 "select code,title from v_editorial where due_on<current_date and reviews_waiting>0 and status not in ('published','archived')",
 "select code,title from v_editorial where owner='' and due_on<=current_date+7 and status not in ('published','archived')",
 "select code,title from v_editorial where expired_evidence>0 and status not in ('published','archived')",
 'select code,title from v_performance where observed_on is null',
 'select code,title,views,leads from v_performance where views>=100 and leads=0',
 "select campaign,count(*)::int as stale_articles from v_editorial where last_activity_on<current_date-14 and status not in ('published','archived') group by campaign order by campaign",
 'select owner,count(*)::int as overdue_tasks from tasks where due_on<current_date and closed_on is null group by owner order by owner',
 "select code,title from v_editorial where reviews_total>0 and reviews_waiting=0 and advertising='unknown' and status not in ('published','archived')",
 "select code,title from v_readiness where can_handover and status not in ('published','archived')",
 "select distinct s.code,s.title,s.revision from stories s join reviews r on r.story_id=s.id and r.revision<s.revision where r.decision='approved' and s.status<>'archived'"
];
async function full(db,s){return {...s,revisions:await db.query('select * from revisions where story_id=$1 order by number',[s.id]),reviews:await db.query('select * from reviews where story_id=$1 order by revision,reviewer',[s.id]),claims:await db.query('select * from claims where story_id=$1 order by created_at',[s.id]),tasks:await db.query('select * from tasks where story_id=$1 order by code',[s.id])};}
function writeNew(file,text){file=path.resolve(file);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});fs.writeFileSync(file,text,{flag:'wx',mode:0o600});return file;}
async function loadImport(file){const files=fs.statSync(file).isDirectory()?fs.readdirSync(file).filter(x=>x.endsWith('.json')).sort().map(x=>path.join(file,x)):[file];if(!files.length)throw Error('No JSON export files');const rows=new Map();for(const p of files){const root=JSON.parse(fs.readFileSync(p,'utf8'));const data=Array.isArray(root)?root:root.data;const items=Array.isArray(data)?data:data&&typeof data==='object'?[data]:null;if(!items)throw Error('Expected a StoryChief data object or data array');for(const r of items){if(!r||!['string','number'].includes(typeof r.id)||!String(r.id).trim()||typeof r.title!=='string'||!r.title.trim())throw Error('Each story requires an id and title');const key=String(r.id);const old=rows.get(key);if(old){for(const k of ['title','content','updated_at'])if(old[k]!=null&&r[k]!=null&&old[k]!==r[k])throw Error(`Conflicting saved exports for story ${key}`);rows.set(key,{...old,...r});}else rows.set(key,r);}}
 return [...rows.values()];}
export async function run(db,argv){const {command,args,opts}=parse(argv);if(!(command in specs))throw Error('Unknown command. Run help.');const allowed=new Set(['json',...[...specs[command].matchAll(/--([a-z-]+)/g)].map(m=>m[1])]);for(const k of Object.keys(opts))if(!allowed.has(k))throw Error(`Unknown option --${k}`);
 const expected=['import'].includes(command)?2:['show','history','revise','assign','request-review','review','claim','check-claims','add-task','complete-task','log','ready','record-publication','record-metrics','archive','draft-brief','draft-handover'].includes(command)?1:0;if(args.length!==expected)throw Error(`Usage: ${command} ${specs[command]}`);
 if(command==='help')return Object.entries(specs).map(([command,usage])=>({command,usage}));
 const mut=mutations.has(command),actor=mut?required(opts,'actor'):null;
 await db.exec(mut?'BEGIN':'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 try{
 let result;
 if(queries[command])result=await db.query(queries[command]);
 else if(command==='insights'){result=[];for(let i=0;i<questions.length;i++)result.push({question:questions[i],rows:await db.query(insightSql[i])});}
 else if(command==='weekly-review'){result={week:await db.query(queries['editorial-week']),reviews:await db.query(queries['approval-chase']),evidence:await db.query(queries['claims-review']),attention:await db.query(queries.attention)};}
 else if(command==='add-campaign'){result=await db.query('insert into campaigns(code,name,objective,owner,ends_on) values($1,$2,$3,$4,$5) returning code,name',[code(required(opts,'code')),required(opts,'name'),required(opts,'objective'),required(opts,'owner'),date(required(opts,'ends'))]);await audit(db,null,actor,command,result);}
 else if(command==='add'){
 const campaign=await resolve(db,'campaigns',required(opts,'campaign'));
 const title=required(opts,'title'),body=fs.readFileSync(required(opts,'body-file'),'utf8');if(!body.trim())throw Error('Content is empty');
 const s=(await db.query('insert into stories(code,campaign_id,title,owner,due_on,brief,channel,language) values($1,$2,$3,$4,$5,$6,$7,$8) returning *',[code(required(opts,'code')),campaign.id,title,required(opts,'owner'),date(required(opts,'due')),required(opts,'brief'),opts.channel||'website',opts.language||'en']))[0];
 await db.query('insert into revisions(story_id,number,title,body,author) values($1,1,$2,$3,$4)',[s.id,title,body,actor]);await audit(db,s.id,actor,command,{code:s.code});result=[{code:s.code,title}];
 }else if(command==='import'){
 if(args[0]!=='storychief')throw Error('Only StoryChief saved JSON exports are supported');
 const namespace=required(opts,'source'),campaign=await resolve(db,'campaigns',required(opts,'campaign'));const rows=await loadImport(args[1]);let added=0,unchanged=0,withoutContent=0;
 // Serialize overlapping namespace imports on PostgreSQL; PGlite is single-process.
 await db.query('select id from campaigns where id=$1 for update',[campaign.id]);
 for(const r of rows){const sourceId=String(r.id),sourceHash=hash(JSON.stringify(canonical(r)));const existing=await db.query('select * from stories where source_namespace=$1 and source_id=$2',[namespace,sourceId]);if(existing.length){if(existing[0].source_hash!==sourceHash)throw Error(`Changed source ${sourceId}: reconcile against local revisions before importing again`);unchanged++;continue;}
 const timestamp=v=>{if(v===undefined||v===null||v==='')return null;if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(v)||!Number.isFinite(Date.parse(v)))throw Error('Invalid vendor timestamp');return new Date(v).toISOString();};
 const due=timestamp(r.due_at),published=timestamp(r.published_at),updated=timestamp(r.updated_at);
 if(r.content!=null&&typeof r.content!=='string')throw Error('Story content must be text');const body=r.content||'';if(!body)withoutContent++;
 const s=(await db.query('insert into stories(code,campaign_id,title,language,due_on,brief,source_namespace,source_id,source_record,source_hash,source_published_at,source_updated_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *',[`SC-${hash(namespace+':'+sourceId).slice(0,16)}`,campaign.id,r.title,r.language||'en',due?due.slice(0,10):null,typeof r.excerpt==='string'?r.excerpt:'',namespace,sourceId,JSON.stringify(r),sourceHash,published,updated]))[0];
 await db.query('insert into revisions(story_id,number,title,body,author) values($1,1,$2,$3,$4)',[s.id,r.title,body,actor]);await audit(db,s.id,actor,command,{source:namespace,source_id:sourceId});added++;
 }
 await db.query('insert into imports(namespace,digest,row_count,actor) values($1,$2,$3,$4)',[namespace,hash(JSON.stringify(canonical(rows))),rows.length,actor]);result=[{read:rows.length,added,unchanged,without_content:withoutContent,preview:Boolean(opts['dry-run']),scope:'Saved files only. Reconcile pagination and account filters before switch.'}];
 }else if(command==='export'){
 const data={format:'editorial-operations-v1',exported_at:new Date().toISOString(),tables:{}};for(const t of ['campaigns','stories','revisions','reviews','claims','tasks','metrics','activity','imports'])data.tables[t]=await db.query(`select * from ${t} order by id`);
 result=[{file:writeNew(required(opts,'out'),JSON.stringify(data,null,2)+'\n'),records:Object.values(data.tables).reduce((n,a)=>n+a.length,0)}];
 }else if(command==='complete-task'){
 const task=await resolve(db,'tasks',args[0],true);await db.query('update tasks set closed_on=current_date where id=$1 and closed_on is null',[task.id]);await audit(db,task.story_id,actor,command,{code:task.code});result=[{code:task.code,closed:true}];
 }else{
 const s=await resolve(db,'stories',args[0],mut);
 if(command==='show')result=await full(db,s);
 else if(command==='history')result=await db.query('select actor,action,detail,created_at from activity where story_id=$1 order by created_at,id',[s.id]);
 else if(command.startsWith('draft-')){
 const all=await full(db,s),current=all.revisions.find(r=>r.number===s.revision);const state=(await db.query('select * from v_readiness where id=$1',[s.id]))[0];
 const body=`# DRAFT: ${s.title}\n\n${command==='draft-brief'?'Editorial brief':'Publication handover for human review'}\n\nOwner: ${s.owner||'UNASSIGNED'}\nDue: ${s.due_on||'UNSET'}\nRevision: ${s.revision}\nChecks clear now: ${state.can_handover}\n\n## Brief\n${s.brief}\n\n## Copy (source text, not executed)\n${current?.body||'MISSING CONTENT'}\n\n## Reviews\n${JSON.stringify(all.reviews,null,2)}\n\n## Claim evidence\n${JSON.stringify(all.claims,null,2)}\n\nNo publication or sending has occurred. Check the exact final copy and destination.\n`;
 result=[{file:writeNew(path.join(process.env.OUTPUT_DIR||REPO_ROOT,'drafts',`${s.code}-${command}-${randomUUID()}.md`),body),can_handover:state.can_handover}];
 }else{
 if(s.status==='archived')throw Error('Archived article cannot be changed');
 if(command==='revise'){
 const body=fs.readFileSync(required(opts,'body-file'),'utf8');if(!body.trim())throw Error('Content is empty');const title=opts.title?required(opts,'title'):s.title;
 await db.query('insert into revisions(story_id,number,title,body,author) values($1,$2,$3,$4,$5)',[s.id,s.revision+1,title,body,actor]);await db.query("update stories set title=$2,revision=revision+1,status='draft',claims_checked=false,advertising='unknown',disclosure='' where id=$1",[s.id,title]);
 }else if(command==='assign')await db.query("update stories set owner=$2,due_on=$3,status=case when status='ready' then 'review' else status end where id=$1",[s.id,required(opts,'owner'),date(required(opts,'due'))]);
 else if(command==='request-review'){
 await db.query('insert into reviews(story_id,revision,reviewer,due_on) values($1,$2,$3,$4)',[s.id,s.revision,required(opts,'reviewer'),date(required(opts,'due'))]);await db.query("update stories set status='review' where id=$1",[s.id]);
 }else if(command==='review'){
 const decision=required(opts,'decision');if(!['approved','changes'].includes(decision))throw Error('Decision must be approved or changes');const reviewer=required(opts,'reviewer');if(actor.toLowerCase()!==reviewer.toLowerCase())throw Error('Actor must be the named reviewer. Labels are not authentication.');
 const r=await db.query("update reviews set decision=$3,note=$4,decided_on=current_date where story_id=$1 and revision=$2 and lower(reviewer)=lower($5) and decision='pending' returning id",[s.id,s.revision,decision,required(opts,'note'),reviewer]);if(r.length!==1)throw Error('No pending review for this reviewer and current revision');await db.query("update stories set status='review' where id=$1",[s.id]);
 }else if(command==='claim'){
 const checked=date(required(opts,'checked')),until=date(required(opts,'until'));const today=(await db.query('select current_date::text as today'))[0].today;if(checked>today)throw Error('Evidence cannot be checked in the future');
 await db.query('insert into claims(story_id,revision,claim,source,reviewer,checked_on,valid_until) values($1,$2,$3,$4,$5,$6,$7)',[s.id,s.revision,required(opts,'claim'),required(opts,'source'),required(opts,'reviewer'),checked,until]);await db.query("update stories set claims_checked=false,status=case when status='ready' then 'review' else status end where id=$1",[s.id]);
 }else if(command==='check-claims'){
 const ad=required(opts,'advertising');if(!['yes','no'].includes(ad))throw Error('Advertising must be yes or no');if(ad==='yes'&&!String(opts.disclosure||'').trim())throw Error('Record advertising identification');required(opts,'note');await db.query("update stories set claims_checked=true,advertising=$2,disclosure=$3,status=case when status='ready' then 'review' else status end where id=$1",[s.id,ad,opts.disclosure||'']);
 }else if(command==='add-task'){
 await db.query('insert into tasks(code,story_id,title,owner,due_on) values($1,$2,$3,$4,$5)',[code(required(opts,'code')),s.id,required(opts,'title'),required(opts,'owner'),date(required(opts,'due'))]);await db.query("update stories set status=case when status='ready' then 'review' else status end where id=$1",[s.id]);
 }else if(command==='log')required(opts,'note');
 else if(command==='ready'||command==='record-publication'){
 const state=(await db.query('select * from v_readiness where id=$1',[s.id]))[0];if(!state.can_handover)throw Error('Handover blocked: inspect show, compliance and publication-handover');if(command==='ready'&&s.status==='published')throw Error('Revise published copy before a new handover');if(command==='ready')await db.query("update stories set status='ready' where id=$1",[s.id]);else{
 if(s.status!=='ready')throw Error('Mark ready before recording an external publication');const on=date(required(opts,'date')),today=(await db.query('select current_date::text as today'))[0].today;if(on>today)throw Error('Cannot record a future publication');
 await db.query("update stories set status='published',publication_url=$2,published_on=$3 where id=$1",[s.id,url(required(opts,'url')),on]);
 }
 }else if(command==='record-metrics'){
 if(s.status!=='published')throw Error('Metrics require a recorded external publication');const on=date(required(opts,'date')),today=(await db.query('select current_date::text as today'))[0].today;if(on>today||on<s.published_on)throw Error('Observation must be between publication and today');
 await db.query('insert into metrics(story_id,observed_on,views,leads,source) values($1,$2,$3,$4,$5)',[s.id,on,integer(required(opts,'views')),integer(required(opts,'leads')),required(opts,'source')]);
 }else if(command==='archive'){required(opts,'note');await db.query("update stories set status='archived' where id=$1",[s.id]);}
 else throw Error('Unimplemented command');
 const detail={...opts};delete detail.json;if(detail['body-file'])detail['body-file']=path.basename(detail['body-file']);await audit(db,s.id,actor,command,detail);result=await db.query('select code,title,status,revision from stories where id=$1',[s.id]);
 }
 }
 await db.exec(opts['dry-run']?'ROLLBACK':'COMMIT');return result;
 }catch(e){await db.exec('ROLLBACK');throw e;}
}
function human(data){if(Array.isArray(data)){if(!data.length)return '(none)';if(data.every(x=>x&&typeof x==='object'&&!Array.isArray(x)))return table(data,Object.keys(data[0]).map(key=>({key,label:key.replaceAll('_',' '),width:80,format:v=>v===null?'':typeof v==='object'?JSON.stringify(v):String(v).replace(/[\x00-\x1f\x7f]/g,' ')})));}return JSON.stringify(data,null,2);}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const result=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(result,null,2):human(result));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
