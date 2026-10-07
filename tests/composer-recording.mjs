import {JSDOM} from 'jsdom';
import React,{act} from 'react';
import {createRequire} from 'node:module';
import fs from 'node:fs';import vm from 'node:vm';import ts from 'typescript';import assert from 'node:assert/strict';
const dom=new JSDOM('<!doctype html><div id="root"></div>',{url:'https://fixture.invalid'});
Object.assign(globalThis,{window:dom.window,document:dom.window.document,HTMLElement:dom.window.HTMLElement,IS_REACT_ACT_ENVIRONMENT:true});
const {createRoot}=await import('react-dom/client');
let denied=false,pendingPermission=null,stops=0,conversions=0,submission=0;
const getUserMedia=async()=>{if(denied)throw new dom.window.DOMException('Denied','NotAllowedError');if(pendingPermission)return pendingPermission;return {getTracks:()=>[{stop:()=>stops++}]};};
class Recorder{
 static isTypeSupported(){return true;}
 constructor(){this.state='inactive';this.mimeType='audio/webm';}
 start(){this.state='recording';}
 stop(){this.state='inactive';queueMicrotask(()=>{this.ondataavailable?.({data:new Blob(['synthetic audio'])});this.onstop?.();});}
}
const exports={},require=createRequire(import.meta.url);
const compiled=ts.transpileModule(fs.readFileSync('src/saas/MessageEditor.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
new vm.Script(compiled).runInContext(vm.createContext({exports,require:id=>id==='./MediaPreview'?{MediaPreview:()=>null}:id==='./voiceRecording'?{MAX_RECORDING_SECONDS:300,recordingToFile:async()=>{conversions++;return new File(['fixture mp3'],'voice-note.mp3',{type:'audio/mpeg'});}}:require(id),navigator:{mediaDevices:{getUserMedia}},window:dom.window,document:dom.window.document,MediaRecorder:Recorder,DOMException:dom.window.DOMException,URL:{createObjectURL:()=>`blob:fixture-${conversions}`,revokeObjectURL:()=>{}},requestAnimationFrame:fn=>setTimeout(fn,0),Blob,File,AbortController,setTimeout,clearTimeout,setInterval,clearInterval,console}));
const {MessageEditor,mediaDraftFromRow}=exports;
assert.equal(mediaDraftFromRow({mediaType:'image',mediaUrl:'https://fixture.invalid/private.png',mediaMime:'image/png',mediaFilename:'saved.png',mediaSizeBytes:12}).filename,'saved.png');assert.equal(mediaDraftFromRow({mediaType:null}),null);
let current=null;
function Harness(){const [media,setMedia]=React.useState(null);current=media;return React.createElement('form',{onSubmit:event=>{event.preventDefault();submission++;}},React.createElement(MessageEditor,{name:'text',compact:true,media,onMediaChange:setMedia}),React.createElement('button',{type:'submit'},'Send'));}
const root=createRoot(document.getElementById('root'));
await act(async()=>root.render(React.createElement(Harness)));
const button=label=>[...document.querySelectorAll('button')].find(button=>button.getAttribute('aria-label')===label||button.textContent.trim()===label);
const click=async label=>{assert.ok(button(label),label);await act(async()=>{button(label).dispatchEvent(new dom.window.MouseEvent('click',{bubbles:true}));await new Promise(resolve=>setTimeout(resolve,5));});};
assert.equal(document.querySelector('.v2-composer-panel'),null);assert.equal(document.querySelector('.v2-composer-menu'),null);
await click('Message options');await click('Personalize message');await click('Company');assert.equal(document.querySelector('textarea').value,'{{company}}');await click('Close message panel');
const paste=new dom.window.Event('paste',{bubbles:true,cancelable:true});Object.defineProperty(paste,'clipboardData',{value:{files:[new File(['screenshot'],'clipboard',{type:'image/png'})]}});await act(async()=>document.querySelector('textarea').dispatchEvent(paste));assert.equal(current.type,'image');assert.match(current.filename,/screenshot-.*\.png$/);await click('Remove attachment');
await click('Record audio');assert.ok(document.querySelector('.v2-recording').textContent.includes('Recording'));
await act(async()=>document.querySelector('form').dispatchEvent(new dom.window.Event('submit',{bubbles:true,cancelable:true})));
assert.equal(submission,0);assert.match(document.querySelector('[role=alert]').textContent,/Finish or discard/);
await click('Stop');assert.equal(current.type,'audio');assert.equal(current.mime,'audio/mpeg');assert.equal(current.filename,'voice-note.mp3');assert.equal(stops,1);assert.equal(conversions,1);assert.equal(document.querySelector('textarea').required,false);
await click('Remove attachment');await click('Record audio');await click('Discard recording');assert.equal(current,null);assert.equal(stops,2);assert.equal(conversions,1);
denied=true;await click('Record audio');assert.match(document.querySelector('[role=alert]').textContent,/Microphone access was denied/);denied=false;
let grant;pendingPermission=new Promise(resolve=>grant=resolve);
await click('Record audio');await click('Discard recording');
await act(async()=>{grant({getTracks:()=>[{stop:()=>stops++}]});await new Promise(resolve=>setTimeout(resolve,5));});
assert.equal(stops,3);assert.equal(current,null);assert.equal(conversions,1);
pendingPermission=null;await click('Record audio');await act(async()=>root.unmount());await new Promise(resolve=>setTimeout(resolve,5));assert.equal(stops,4);assert.equal(conversions,1);
console.log('PASS: compact menu/fields, recording stop/preview, blocked submit while capturing, discard, permission denial, late permission cancellation and microphone cleanup on unmount. No microphone or network used.');
