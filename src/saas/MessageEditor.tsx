import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import { MoreHorizontal, Mic, Square, Image, Video, FileText, AudioLines, X, Paperclip } from 'lucide-react';
import { MAX_RECORDING_SECONDS, recordingToFile } from './voiceRecording';
import { MediaPreview } from './MediaPreview';

export type MediaDraft = {type:'image'|'video'|'audio'|'document';url:string;mime:string;filename:string;size:number;file?:File}|null;
export function mediaDraftFromRow(row?: Record<string, unknown> | null): MediaDraft {
  if (!row || !['image','video','audio','document'].includes(String(row.mediaType)) || typeof row.mediaUrl !== 'string' || !row.mediaUrl) return null;
  return {type:row.mediaType as NonNullable<MediaDraft>['type'],url:row.mediaUrl,mime:String(row.mediaMime || ''),filename:String(row.mediaFilename || 'Attachment'),size:Number(row.mediaSizeBytes) || 0};
}
const mediaRules = {
  image:{label:'Image',accept:'image/jpeg,image/png',max:5*1024*1024,icon:Image},
  video:{label:'Video',accept:'video/mp4,video/3gpp',max:50*1024*1024,icon:Video},
  audio:{label:'Audio',accept:'audio/aac,audio/mpeg,audio/ogg,audio/amr,.aac,.mp3,.ogg,.amr',max:16*1024*1024,icon:AudioLines},
  document:{label:'Document',accept:'.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',max:100*1024*1024,icon:FileText},
};
type Kind = keyof typeof mediaRules;
export function MessageEditor({value,defaultValue='',onChange,name,media,onMediaChange,compact=false,disabled=false}:{value?:string;defaultValue?:string;onChange?:(value:string)=>void;name?:string;media?:MediaDraft;onMediaChange?:(media:MediaDraft)=>void;compact?:boolean;disabled?:boolean}) {
  const [local,setLocal]=useState(defaultValue),[menu,setMenu]=useState(false),[kind,setKind]=useState<Kind>('image'),[error,setError]=useState(''),[recording,setRecording]=useState(false),[processing,setProcessing]=useState(false),[seconds,setSeconds]=useState(0);
  const ref=useRef<HTMLTextAreaElement>(null),fileRef=useRef<HTMLInputElement>(null),root=useRef<HTMLDivElement>(null),recorder=useRef<MediaRecorder|null>(null),stream=useRef<MediaStream|null>(null),mounted=useRef(true),cancelled=useRef(false),active=useRef(false),generation=useRef(0),encoding=useRef<AbortController|null>(null),clock=useRef<ReturnType<typeof setInterval>|null>(null),hardStop=useRef<ReturnType<typeof setTimeout>|null>(null);
  const text=value??local;
  const change=(next:string)=>{setLocal(next);onChange?.(next);};
  const cleanup=()=>{
    if(clock.current)clearInterval(clock.current);
    if(hardStop.current)clearTimeout(hardStop.current);
    stream.current?.getTracks().forEach(track=>track.stop());stream.current=null;
  };
  useEffect(()=>{
    mounted.current=true;
    return()=>{mounted.current=false;encoding.current?.abort();generation.current++;cancelled.current=true;if(recorder.current?.state==='recording')recorder.current.stop();cleanup();};
  },[]);
  useEffect(()=>()=>{if(media?.url.startsWith('blob:'))URL.revokeObjectURL(media.url);},[media?.url]);
  useEffect(()=>{
    const form=ref.current?.form;
    const reset=()=>{if(value===undefined)setLocal(defaultValue);setMenu(false);};
    form?.addEventListener('reset',reset);
    const block=(event:Event)=>{if(active.current){event.preventDefault();event.stopImmediatePropagation();setError('Finish or discard your recording before sending.');}};
    form?.addEventListener('submit',block,true);
    return()=>{form?.removeEventListener('reset',reset);form?.removeEventListener('submit',block,true);};
  },[defaultValue,value]);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setMenu(false);};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setMenu(false);}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  const pickMedia=(file:File|undefined,type:Kind=kind)=>{
    if(!file)return;
    const rule=mediaRules[type];
    const extensions={image:/\.(jpe?g|png)$/i,video:/\.(mp4|3gp)$/i,audio:/\.(aac|mp3|ogg|amr)$/i,document:/\.(pdf|docx?|xlsx?|pptx?|txt)$/i};
    if(file.size>rule.max){setError(`${rule.label} files must be ${rule.max/1024/1024} MB or smaller.`);return;}
    if(!file.size||!extensions[type].test(file.name)||(type!=='document'&&file.type&&!rule.accept.split(',').includes(file.type))){setError(`Choose a supported ${rule.label.toLowerCase()} file.`);return;}
    setError('');
    onMediaChange?.({type,url:URL.createObjectURL(file),mime:file.type,filename:file.name,size:file.size,file});
  };
  const chooseFile=(next:Kind)=>{setKind(next);setMenu(false);setError('');requestAnimationFrame(()=>fileRef.current?.click());};
  const pasteAttachment=(event: ClipboardEvent<HTMLTextAreaElement>)=>{
    if(!onMediaChange || disabled || active.current || !event.clipboardData.files.length)return;
    event.preventDefault();
    if(event.clipboardData.files.length!==1){setError('Attach one file at a time.');return;}
    let file=event.clipboardData.files[0];
    const type:Kind=file.type.startsWith('image/')?'image':file.type.startsWith('video/')?'video':file.type.startsWith('audio/')?'audio':'document';
    if(type==='image'&&!/\.(jpe?g|png)$/i.test(file.name)&&['image/png','image/jpeg'].includes(file.type))file=new File([file],`screenshot-${Date.now()}.${file.type==='image/png'?'png':'jpg'}`,{type:file.type});
    pickMedia(file,type);
  };
  const startRecording=async()=>{
    if(active.current||disabled)return;
    const recordingId=++generation.current;const controller=new AbortController();encoding.current=controller;active.current=true;cancelled.current=false;setError('');setMenu(false);setProcessing(true);setSeconds(0);
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Recording is unavailable in this browser. You can attach an audio file instead.');
      const input=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true}});
      if(!mounted.current||recordingId!==generation.current){input.getTracks().forEach(track=>track.stop());return;}
      stream.current=input;
      const mime=['audio/webm;codecs=opus','audio/mp4','audio/ogg;codecs=opus'].find(type=>MediaRecorder.isTypeSupported(type));
      const capture=new MediaRecorder(input,mime?{mimeType:mime}:undefined);recorder.current=capture;
      const chunks:Blob[]=[];
      capture.ondataavailable=event=>{if(event.data.size)chunks.push(event.data);};
      capture.onerror=()=>{if(recordingId!==generation.current)return;generation.current++;cancelled.current=true;cleanup();active.current=false;if(mounted.current){setRecording(false);setProcessing(false);setError('Recording was interrupted. Please try again.');}};
      capture.onstop=async()=>{
        if(recordingId!==generation.current)return;
        cleanup();if(mounted.current)setRecording(false);
        try{
          if(cancelled.current||!mounted.current)return;
          setProcessing(true);
          const file=await recordingToFile(new Blob(chunks,{type:capture.mimeType}),controller.signal);
          if(recordingId===generation.current&&!cancelled.current&&mounted.current)pickMedia(file,'audio');
        }catch{if(recordingId===generation.current&&mounted.current&&!cancelled.current)setError('Your recording could not be prepared. Try again or attach an audio file.');}
        finally{chunks.length=0;if(recorder.current===capture)recorder.current=null;if(recordingId===generation.current){active.current=false;if(mounted.current)setProcessing(false);}}
      };
      capture.start(1000);setProcessing(false);setRecording(true);
      clock.current=setInterval(()=>setSeconds(current=>current+1),1000);
      hardStop.current=setTimeout(()=>{if(capture.state==='recording')capture.stop();},MAX_RECORDING_SECONDS*1000);
    }catch(reason){if(recordingId!==generation.current)return;cleanup();active.current=false;if(mounted.current){setProcessing(false);setRecording(false);setError(reason instanceof DOMException&&reason.name==='NotAllowedError'?'Microphone access was denied. Allow it in your browser or attach an audio file.':reason instanceof Error?reason.message:'Unable to access your microphone.');}}
  };
  const discard=()=>{encoding.current?.abort();generation.current++;cancelled.current=true;if(recorder.current?.state==='recording')recorder.current.stop();recorder.current=null;cleanup();active.current=false;setRecording(false);setProcessing(false);};
  const locked=disabled||recording||processing;
  return <div ref={root} className={'v2-message-editor v2-composer'+(compact?' compact':'')}>
    <div className="v2-composer-box">
      <textarea aria-label="Message" ref={ref} name={name} value={text} onChange={event=>change(event.target.value)} onPaste={pasteAttachment} required={!media} maxLength={4096} rows={compact?2:4} placeholder="Write a message…" disabled={locked}/>
      <div className="v2-composer-toolbar">
        <div className="v2-composer-tools">
          <button type="button" className="v2-icon-button" aria-label="Message options" aria-expanded={menu} title="Attachments" disabled={locked} onClick={()=>setMenu(current=>!current)}><MoreHorizontal size={20}/></button>
          {onMediaChange&&<button type="button" className="v2-icon-button" aria-label="Record audio" title="Record audio" disabled={locked} onClick={()=>void startRecording()}><Mic size={18}/></button>}
          {media&&<span className="v2-composer-hint"><Paperclip size={13}/> Attachment ready</span>}
        </div>
        <span className="v2-composer-count">{text.length?`${text.length.toLocaleString()} / 4,096`:''}</span>
      </div>
    </div>
    {menu&&<div className="v2-composer-menu" aria-label="Message options menu">
      {onMediaChange&&(Object.keys(mediaRules) as Kind[]).map(type=>{const Icon=mediaRules[type].icon;return <button type="button" key={type} onClick={()=>chooseFile(type)}><Icon size={17}/>{mediaRules[type].label}</button>;})}
      {onMediaChange&&<button type="button" onClick={()=>void startRecording()}><Mic size={17}/>Record audio</button>}
    </div>}
    {onMediaChange&&<input ref={fileRef} className="v2-hidden-file" type="file" accept={mediaRules[kind].accept} aria-label="Attach file" onChange={event=>{pickMedia(event.target.files?.[0]);event.target.value='';}}/>}
    {(recording||processing)&&<div className="v2-recording" role="status"><span className={recording?'v2-recording-dot':''}/><strong>{recording?`Recording ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:'Preparing voice note…'}</strong>{recording&&<button type="button" onClick={()=>recorder.current?.stop()}><Square size={13}/> Stop</button>}<button type="button" aria-label="Discard recording" onClick={discard}><X size={16}/></button></div>}
    {media&&<div className="v2-composer-attachment"><div className="v2-attachment-content">{!media.file?<MediaPreview url={media.url} type={media.type} filename={media.filename}/>:media.type==='image'?<img src={media.url} alt={media.filename}/>:media.type==='video'?<video src={media.url} controls preload="metadata"/>:media.type==='audio'?<audio src={media.url} controls preload="metadata"/>:<FileText size={26}/>}<span><strong>{media.filename}</strong><small>{(media.size/1024/1024).toFixed(1)} MB</small></span></div><button type="button" className="v2-icon-button" disabled={locked} aria-label="Remove attachment" onClick={()=>onMediaChange?.(null)}><X size={16}/></button></div>}
    {error&&<p className="v2-error" role="alert">{error}</p>}
  </div>;
}
