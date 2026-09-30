<?php
require __DIR__.'/bootstrap.php';authenticated();
function connectionState():array {global $connection;return ['success'=>true,'configured'=>$connection['auth_key']!=='','apiUrl'=>$connection['api_url'],'savedAt'=>(int)$connection['updated_at'],'lastCheck'=>$connection['last_check']?json_decode($connection['last_check'],true):null];}
if(($_SERVER['REQUEST_METHOD']??'')==='GET')respond(connectionState());
postOnly();$data=body();
if(($data['mode']??'save')==='test') {
 if($connection['auth_key']==='')respond(['success'=>false,'error'=>'Save your n8n Frontend Auth key first.'],400);
 session_write_close();
 function probe(string $kind,array $payload=[]):array {
  global $connection,$config,$isLocal;
  $base=substr($connection['api_url'],0,-3);if($isLocal && isset($config['test_upstream']))$base=$config['test_upstream'];
  $url=$base.$kind;
  // An empty upload is a non-mutating credential check: it fails validation before any import.
  if($kind==='import')$url.='?campaignId=00000000-0000-4000-8000-000000000000&requestId=connection-check-'.bin2hex(random_bytes(8));
  $ch=curl_init($url);curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>json_encode($payload?:new stdClass()),CURLOPT_HTTPHEADER=>['Content-Type: application/json','X-Outreach-Key: '.$connection['auth_key']],CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>3,CURLOPT_TIMEOUT=>6,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>$isLocal?(CURLPROTO_HTTP|CURLPROTO_HTTPS):CURLPROTO_HTTPS]);
  $raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$failed=curl_errno($ch);curl_close($ch);$result=is_string($raw)?json_decode($raw,true):null;
  return ['ok'=>!$failed&&$status>=200&&$status<300&&is_array($result)&&($result['success']??false)===true,'status'=>$status,'error'=>is_array($result)?($result['error']??''):'' ];
 }
 $api=probe('api',['action'=>'health']);$storage=$api['ok']?probe('api',['action'=>'stats']):['ok'=>false,'status'=>0];
 $import=$api['ok']?probe('import'):['ok'=>false,'status'=>0,'error'=>''];
 $authOK=$import['status']===400 && $import['error']==='Upload exactly one file in multipart field file';
 $missing=[];
 if($storage['ok'])foreach(['contacts','suppressions'] as $action){$feature=probe('api',['action'=>$action,'limit'=>1,'offset'=>0]);if(!$feature['ok'])$missing[]=$action;}
 $check=['checkedAt'=>time(),'apiReachable'=>$api['ok'],'supabaseReachable'=>$storage['ok'],'authVerified'=>$authOK,'importReady'=>$authOK,'missingFeatures'=>$missing,'connected'=>$api['ok']&&$storage['ok']&&$authOK];
 if(!$api['ok'])$check['message']=in_array($api['status'],[401,403],true)?'n8n rejected the saved Frontend Auth key. Update that key in Settings.':'The n8n Campaign API is unavailable or returned an invalid response. Saved settings have been retained.';
 elseif(!$storage['ok'])$check['message']='n8n is reachable, but its Supabase data request failed. Check the Supabase credential in the n8n workflow.';
 elseif(!$authOK)$check['message']=in_array($import['status'],[401,403],true)?'The import webhook rejected this key. Use the exact EightBit Frontend Auth credential value from n8n.':'n8n and Supabase respond, but import authorization could not be verified. Saved settings have been retained.';
 elseif($missing)$check['message']='n8n and Supabase are connected. A backend update is still needed for contacts and suppression lists.';
 else $check['message']='n8n, Supabase data and import authorization verified.';
 $q=$db->prepare('UPDATE backend_connection SET last_check=? WHERE id=1 AND auth_key=? AND api_url=?');$q->execute([json_encode($check),$connection['auth_key'],$connection['api_url']]);
 respond(['success'=>true,'data'=>$check]);
}
$url=normalizeBackendURL(is_string($data['apiUrl']??null)?$data['apiUrl']:$connection['api_url']);
$key=$data['key']??'';if(!is_string($key))respond(['success'=>false,'error'=>'Enter the n8n Frontend Auth key.'],400);
// A blank replacement field preserves the existing key; a short real key is accepted.
if($key==='')$key=$connection['auth_key'];
if($key===''||strlen($key)>4096||str_starts_with($key,'REPLACE_')||str_contains($key,"\n")||str_contains($key,"\r"))respond(['success'=>false,'error'=>'Enter the existing n8n Frontend Auth key.'],400);
$q=$db->prepare('UPDATE backend_connection SET api_url=?,auth_key=?,updated_at=?,last_check=NULL WHERE id=1');$q->execute([$url,$key,time()]);
$connection=$db->query('SELECT * FROM backend_connection WHERE id=1')->fetch(PDO::FETCH_ASSOC);
respond(connectionState());
