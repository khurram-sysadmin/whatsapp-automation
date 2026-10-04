// Only fixed reasons and HTTP status cross the private diagnostic boundary.
const failure = String.raw`function reject(reason){const status=Number.isInteger(r.statusCode)&&r.statusCode>=0&&r.statusCode<=599?r.statusCode:0;return [{json:{valid:false,result:{success:false,data:null,error:{code:'PROVIDER_NOT_CONNECTED',message:'Unable to verify this WhatsApp connection.'},requestId:req.payload.requestId},diagnostic:{userId:req.userId,whatsappSessionId:req.payload.whatsappSessionId,phase:PHASE,httpStatus:status,reason}}}];}`;
export const statusCode = (contextName) => String.raw`
const r=$input.first().json,req=$('${contextName}').first().json,body=r.body??{};
${failure.replace('PHASE',"'status'")}
if(r.statusCode!==200)return reject('status_http');
const providerStatus=body.status??body.data?.status;
if(!['connected','connecting','disconnected','expired','need_scan','need_passkey','logged_out'].includes(providerStatus))return reject('status_unknown');
if(req.payload.action==='sessionConnect'&&providerStatus!=='connected')return reject('status_disconnected');
return [{json:{valid:true,...req,providerStatus}}];`;
export const identityCode = (contextName) => String.raw`
const r=$input.first().json,req=$('${contextName}').first().json,body=r.body??{};
${failure.replace('PHASE',"'identity'")}
if(req.payload.action==='sessionStatus'&&req.providerStatus!=='connected')return [{json:{userId:req.userId,payload:req.payload,providerProof:{status:({need_scan:'connecting',need_passkey:'connecting',logged_out:'disconnected'}[req.providerStatus]??req.providerStatus)}}}];
if(r.statusCode!==200)return reject('user_http');
if(body.success!==true)return reject('user_envelope');
const id=String(body.data?.id??'');
if(!id)return reject('user_missing_id');
const phone='+'+id.split('@')[0].split(':')[0].replace(/^\+/,'');
if(!/^\+[1-9][0-9]{7,14}$/.test(phone))return reject('user_invalid_phone');
return [{json:{userId:req.userId,payload:req.payload,providerProof:{status:req.providerStatus,phoneE164:phone}}}];`;
export const diagnosticBody = '={{ ({user_id:$json.diagnostic.userId,whatsapp_session_id:$json.diagnostic.whatsappSessionId,phase:$json.diagnostic.phase,http_status:$json.diagnostic.httpStatus,reason:$json.diagnostic.reason,request_id:$json.result.requestId}) }}';
