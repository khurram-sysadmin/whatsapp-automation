<?php
require __DIR__.'/../public/connect/setup-core.php';
function check($ok,$message){if(!$ok)throw new Exception($message);}
check(setup_upstream_failure(false,401,false)->safeCode==='WASENDER_TOKEN_REJECTED','provider token failure classification');
check(setup_upstream_failure(true,401,false)->httpStatus===401,'backend auth failure classification');
check(setup_upstream_failure(true,0,true)->safeCode==='BACKEND_UNREACHABLE','backend transport failure classification');
check(setup_upstream_failure(false,0,true)->safeCode==='PROVIDER_UNREACHABLE','provider transport failure classification');
check(setup_upstream_failure(false,403,false)->safeCode==='WASENDER_ACCESS_DENIED','provider access failure classification');
check(setup_upstream_failure(false,429,false)->httpStatus===429,'provider rate limit classification');
check(setup_backend_failure(['error'=>['code'=>'PROVIDER_NOT_CONNECTED','message'=>'secret-upstream-text']],'sessionConnect')->safeCode==='CONNECTION_SAVE_PROVIDER_NOT_CONNECTED','safe save-stage classification');
check(!str_contains(setup_backend_failure(['error'=>['code'=>'INVALID_REQUEST','message'=>'secret-upstream-text']],'sessionCreate')->getMessage(),'secret-upstream-text'),'raw backend error exposure');
$wid='11111111-1111-4111-8111-111111111111';$sid='22222222-2222-4222-8222-222222222222';$key='fixture-session-secret-123456';$secret='fixture-webhook-secret-12345';$pat='fixture-account-token-123456';
$base=['workspaceId'=>$wid,'requestId'=>'fixture-request-123456','operation'=>'list','personalAccessToken'=>$pat];
function transportFor($role,$existing='', $fail=false,$known=[]){global $wid,$sid,$key,$secret; $calls=[];
 $fn=function($method,$url,$token,$body)use($role,$existing,$fail,$known,&$calls,$wid,$sid,$key,$secret){$calls[]=[$method,$url,$token,$body];
 if(str_contains($url,'n8n.')){switch($body['action']){case 'bootstrap':return ['success'=>true,'data'=>['workspaces'=>[['workspaceId'=>$wid,'status'=>'active','role'=>$role]]]];case 'sessionList':return ['success'=>true,'data'=>$known];case 'sessionCreate':return ['success'=>true,'data'=>['whatsappSessionId'=>$sid]];case 'sessionConnect':check($body['apiSecret']===$key,'wrong session key');return ['success'=>true,'data'=>['whatsappSessionId'=>$sid,'status'=>'connected','configured'=>true,'apiSecret'=>$key,'webhookSecret'=>$secret]];}}
 if($method==='CHECK')return ['success'=>true];
 if($fail)throw new SetupFailure('PROVIDER_FAILURE','Fixture failure',502);
 if($method==='PUT')return ['success'=>true,'data'=>$body+['api_key'=>$key,'webhook_secret'=>$secret]];
 $s=['id'=>12,'name'=>'Sales','phone_number'=>'+12025550101','status'=>'connected','api_key'=>$key,'webhook_secret'=>$secret,'webhook_url'=>$existing,'webhook_enabled'=>true,'webhook_events'=>['messages.upsert','messages.update','message-receipt.update','message.sent','session.status']];
 return ['success'=>true,'data'=>str_ends_with($url,'/12')?$s:[$s]];
 };return [$fn,&$calls];}
foreach(['viewer','member']as$role){[$fn,$calls]=transportFor($role);try{(new WhatsAppSetup($fn))->run($base,'jwt');throw new Exception('unauthorized accepted');}catch(SetupFailure $e){check($e->httpStatus===403,'role check');}}
[$fn,$calls]=transportFor('owner');try{(new WhatsAppSetup($fn))->run(array_replace($base,['workspaceId'=>'99999999-9999-4999-8999-999999999999']),'jwt');throw new Exception('other company accepted');}catch(SetupFailure $e){check($e->httpStatus===403,'workspace check');}
[$fn,$calls]=transportFor('owner');$r=(new WhatsAppSetup($fn))->run($base,'jwt');check(!str_contains(json_encode($r),$key)&&!str_contains(json_encode($r),$secret),'secret in list');check($r['sessions'][0]['id']==='12','session mapping');
$connect=array_replace($base,['operation'=>'connect','providerSessionId'=>'12','displayName'=>'Sales']);
[$fn,$calls]=transportFor('owner','https://other.example/webhook');try{(new WhatsAppSetup($fn))->run($connect,'jwt');throw new Exception('unconfirmed webhook accepted');}catch(SetupFailure $e){check($e->safeCode==='WEBHOOK_CONFIRMATION_REQUIRED','replacement check');}
[$fn,$calls]=transportFor('owner','https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php?whatsappSessionId=other');try{(new WhatsAppSetup($fn))->run($connect+['replaceWebhook'=>true],'jwt');throw new Exception('company transfer accepted');}catch(SetupFailure $e){check($e->safeCode==='EXISTING_EIGHTBIT_CONNECTION','transfer check');}
[$fn,$calls]=transportFor('owner');$r=(new WhatsAppSetup($fn))->run($connect,'jwt');check($r['connection']['status']==='connected','save failed');check(!str_contains(json_encode($r),$key)&&!str_contains(json_encode($r),$secret),'secret in result');
[$fn,$calls]=transportFor('owner','',true);try{(new WhatsAppSetup($fn))->run($connect,'jwt');throw new Exception('failure accepted');}catch(SetupFailure $e){check($e->httpStatus===502,'provider failure');}
$pending=['whatsappSessionId'=>$sid,'status'=>'pending','configured'=>false,'providerMode'=>'manual_session_key'];
$existing='https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php?whatsappSessionId='.$sid;
[$fn,$calls]=transportFor('owner',$existing,false,[$pending]);$seen=[];
$wrapped=function($method,$url,$token,$body)use($fn,&$seen){$seen[]=[$method,$body['action']??''];return $fn($method,$url,$token,$body);};
$r=(new WhatsAppSetup($wrapped))->run($connect,'jwt');check($r['connection']['configured'],'resume did not save');
check(!in_array(['POST','sessionCreate'],$seen,true),'resume created a duplicate');check(!in_array('PUT',array_column($seen,0),true),'resume changed provider webhook');
$list=(new WhatsAppSetup($wrapped))->run($base,'jwt');check($list['sessions'][0]['resumingSetup']===true,'recovery UI flag missing');
[$fn,$calls]=transportFor('admin',$existing,false,[$pending]);check((new WhatsAppSetup($fn))->run($connect,'jwt')['connection']['configured'],'admin recovery rejected');
[$fn,$calls]=transportFor('owner',$existing,false,[$pending]);$attempt=0;$seen=[];
$retryable=function($method,$url,$token,$body)use($fn,&$attempt,&$seen){$seen[]=[$method,$body['action']??''];if(($body['action']??'')==='sessionConnect'&&++$attempt===1)throw new SetupFailure('CONNECTION_SAVE_PROVIDER_NOT_CONNECTED','Fixture verification failure',409);return $fn($method,$url,$token,$body);};
try{(new WhatsAppSetup($retryable))->run($connect,'jwt');throw new Exception('unverified save accepted');}catch(SetupFailure $e){check($e->httpStatus===409,'save failure classification');}
check((new WhatsAppSetup($retryable))->run(array_replace($connect,['requestId'=>'fixture-recovery-second-attempt']),'jwt')['connection']['configured'],'explicit recovery after failed save');
check(!in_array(['POST','sessionCreate'],$seen,true)&&!in_array('PUT',array_column($seen,0),true),'recovery retry performed a duplicate mutation');
foreach([[],[array_replace($pending,['configured'=>true])],[array_replace($pending,['status'=>'disconnected'])]]as$known){[$fn,$calls]=transportFor('owner',$existing,false,$known);try{(new WhatsAppSetup($fn))->run($connect,'jwt');throw new Exception('unowned or configured recovery accepted');}catch(SetupFailure $e){check($e->safeCode==='EXISTING_EIGHTBIT_CONNECTION','recovery scope guard');}}
[$fn,$calls]=transportFor('owner',$existing,false,[$pending]);$saved=false;
$missingEvents=function($method,$url,$token,$body)use($fn,&$saved){$r=$fn($method,$url,$token,$body);if(str_ends_with($url,'/12'))$r['data']['webhook_events']=[];if(($body['action']??'')==='sessionConnect')$saved=true;return $r;};
try{(new WhatsAppSetup($missingEvents))->run($connect,'jwt');throw new Exception('incomplete recovery accepted');}catch(SetupFailure $e){check($e->safeCode==='PROVIDER_RESPONSE'&&!$saved,'incomplete webhook recovery must fail closed');}
echo "PASS: owner/admin access, company isolation, allowlisted responses, explicit webhook replacement, no automatic transfer, provider rejection and setup success. No external calls.\n";
