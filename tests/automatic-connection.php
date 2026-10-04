<?php
require __DIR__.'/../public/connect/setup-core.php';
function check($ok,$message){if(!$ok)throw new Exception($message);}
$wid='11111111-1111-4111-8111-111111111111';$sid='22222222-2222-4222-8222-222222222222';$key='fixture-session-secret-123456';$secret='fixture-webhook-secret-12345';$pat='fixture-account-token-123456';
$base=['workspaceId'=>$wid,'requestId'=>'fixture-request-123456','operation'=>'list','personalAccessToken'=>$pat];
function transportFor($role,$existing='', $fail=false){global $wid,$sid,$key,$secret; $calls=[];
 $fn=function($method,$url,$token,$body)use($role,$existing,$fail,&$calls,$wid,$sid,$key,$secret){$calls[]=[$method,$url,$token,$body];
 if(str_contains($url,'n8n.')){switch($body['action']){case 'bootstrap':return ['success'=>true,'data'=>['workspaces'=>[['workspaceId'=>$wid,'status'=>'active','role'=>$role]]]];case 'sessionList':return ['success'=>true,'data'=>[]];case 'sessionCreate':return ['success'=>true,'data'=>['whatsappSessionId'=>$sid]];case 'sessionConnect':check($body['apiSecret']===$key,'wrong session key');return ['success'=>true,'data'=>['whatsappSessionId'=>$sid,'status'=>'connected','configured'=>true,'apiSecret'=>$key,'webhookSecret'=>$secret]];}}
 if($method==='CHECK')return ['success'=>true];
 if($fail)throw new SetupFailure('PROVIDER_FAILURE','Fixture failure',502);
 if($method==='PUT')return ['success'=>true,'data'=>$body+['api_key'=>$key,'webhook_secret'=>$secret]];
 $s=['id'=>12,'name'=>'Sales','phone_number'=>'+12025550101','status'=>'connected','api_key'=>$key,'webhook_secret'=>$secret,'webhook_url'=>$existing];
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
echo "PASS: owner/admin access, company isolation, allowlisted responses, explicit webhook replacement, no automatic transfer, provider rejection and setup success. No external calls.\n";
