import fs from 'node:fs';
import crypto from 'node:crypto';
const [input,output]=process.argv.slice(2);
if(!input||!output)throw new Error('Provide workflow input and output paths');
const w=JSON.parse(fs.readFileSync(input,'utf8'));
if(w.nodes.some(n=>n.name==='V2 Prepare Media Download'))throw new Error('Already patched');
const rpc=w.nodes.find(n=>n.name==='V2 Final Customer State Check');
const make=(name,type,parameters,position)=>({id:crypto.randomUUID(),name,type,typeVersion:type==='n8n-nodes-base.httpRequest'?4.2:type==='n8n-nodes-base.if'?2.2:2,position,parameters});
const prep=make('V2 Prepare Media Download','n8n-nodes-base.code',{jsCode:`return $input.all().map((i,index)=>{
 const m={...i.json,mediaReady:!i.json.mediaType,mediaNeedsSigning:false};
 if(m.mediaType){
  const prefix='https://lreolnewuapcurpskqwr.supabase.co/storage/v1/object/authenticated/outreach-media/';
  const path=typeof m.mediaUrl==='string'&&m.mediaUrl.startsWith(prefix)?m.mediaUrl.slice(prefix.length):'';
  if(['image','video','audio','document'].includes(m.mediaType)&&new RegExp('^'+m.workspaceId+'/[a-zA-Z0-9._-]+$').test(path)){
   m.mediaPath=path;m.mediaNeedsSigning=true;
  }else{m.mediaFailure='invalid_reference';}
 }
 return {json:m,pairedItem:{item:index}};
});`},[2520,1560]);
const boolIf=(name,field,pos)=>make(name,'n8n-nodes-base.if',{conditions:{options:{caseSensitive:true,leftValue:'',typeValidation:'strict',version:2},conditions:[{id:crypto.randomUUID(),leftValue:`={{ $json.${field} }}`,rightValue:true,operator:{type:'boolean',operation:'true',singleValue:true}}],combinator:'and'},options:{}},pos);
const needed=boolIf('V2 Media Requires Signing','mediaNeedsSigning',[2740,1560]);
const sign=make('V2 Sign Private Media','n8n-nodes-base.httpRequest',{method:'POST',url:'={{ "https://lreolnewuapcurpskqwr.supabase.co/storage/v1/object/sign/outreach-media/" + $json.mediaPath }}',authentication:'predefinedCredentialType',nodeCredentialType:'supabaseApi',sendBody:true,specifyBody:'json',jsonBody:'={{ { expiresIn: 600 } }}',options:{redirect:{redirect:{followRedirects:false}},response:{response:{fullResponse:true,neverError:true,responseFormat:'json'}},timeout:20000}},[2960,1420]);
sign.credentials=structuredClone(rpc.credentials);sign.retryOnFail=false;sign.onError='continueRegularOutput';
const context=make('V2 Signed Media Context','n8n-nodes-base.code',{jsCode:`return $input.all().map((i,index)=>{
 const m={...$('V2 Prepare Media Download').itemMatching(index).json};
 const r=i.json,raw=r.body?.signedURL||r.body?.signedUrl||'';
 const base='https://lreolnewuapcurpskqwr.supabase.co';
 const path='/storage/v1/object/sign/outreach-media/'+m.mediaPath;
 let url=raw.startsWith('/object/sign/')?base+'/storage/v1'+raw:raw.startsWith('/storage/v1/object/sign/')?base+raw:raw;
 m.mediaReady=Number(r.statusCode)===200&&typeof url==='string'&&url.startsWith(base+path+'?')&&url.includes('token=');
 if(m.mediaReady)m.mediaUrl=url;
 else{m.mediaFailure=Number(r.statusCode)===404?'missing_object':'signing_unavailable';m.mediaHttpStatus=Number(r.statusCode)||0;}
 return {json:m,pairedItem:{item:index}};
});`},[3180,1420]);
const ready=boolIf('V2 Media Ready To Send','mediaReady',[3400,1560]);
const failed=make('V2 Media Setup Failure','n8n-nodes-base.code',{jsCode:`return $input.all().map((i,index)=>({json:{messageId:i.json.messageId,leaseToken:i.json.leaseToken,outcome:['invalid_reference','missing_object'].includes(i.json.mediaFailure)?'permanent':'retry',error:'Attachment preparation failed before sending.',safeResponse:{stage:'media',httpStatus:i.json.mediaHttpStatus||0}},pairedItem:{item:index}}));`},[3620,1760]);
w.nodes.push(prep,needed,sign,context,ready,failed);
const edge=node=>({node,type:'main',index:0});
w.connections['V2 Verified Send Items']={main:[[edge(prep.name)]]};
w.connections[prep.name]={main:[[edge(needed.name)]]};
w.connections[needed.name]={main:[[edge(sign.name)],[edge(ready.name)]]};
w.connections[sign.name]={main:[[edge(context.name)]]};
w.connections[context.name]={main:[[edge(ready.name)]]};
w.connections[ready.name]={main:[[edge('V2 Send Via Customer Key')],[edge(failed.name)]]};
w.connections[failed.name]={main:[[edge('V2 Commit Customer Send Outcome')]]};
// Preserve active state for the operator's live patch; the repository draft
// remains inactive and keeps its existing disabled scheduler.
delete w.pinData;delete w.shared;delete w.tags;
fs.writeFileSync(output,JSON.stringify(w,null,2)+'\n');
console.log('Added private-media signing and safe failure routes; existing schedules preserved.');
