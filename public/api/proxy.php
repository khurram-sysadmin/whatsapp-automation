<?php
require __DIR__.'/bootstrap.php';postOnly();authenticated();$data=body();
$allowed=['create','list','detail','start','pause','resume','stop','delete','stats','replies','messages','templates','saveTemplate','deleteTemplate','suppress','import','health','contacts','suppressions'];
$action=$data['action']??null;if(!is_string($action)||!in_array($action,$allowed,true))respond(['success'=>false,'error'=>'Unsupported action.'],400);
$uuid='~^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$~i';
if(in_array($action,['detail','messages','start','pause','resume','stop','delete','import'],true)&&(!is_string($data['campaignId']??null)||!preg_match($uuid,$data['campaignId'])))respond(['success'=>false,'error'=>'A valid campaign ID is required.'],400);
if($action==='deleteTemplate'&&(!is_string($data['templateId']??null)||!preg_match($uuid,$data['templateId'])))respond(['success'=>false,'error'=>'A valid template ID is required.'],400);
if(!in_array($action,['list','detail','stats','replies','messages','templates','health','contacts','suppressions'],true)&&(!is_string($data['requestId']??null)||strlen($data['requestId'])<8||strlen($data['requestId'])>128))respond(['success'=>false,'error'=>'A request ID is required.'],400);
$fields=['action','requestId','campaignId','templateId','name','template','timezone','sendingStartTime','sendingEndTime','sendIntervalSeconds','limit','offset','phone','reason','contacts','phoneFormat','defaultCallingCode','trunkPrefix'];$data=array_intersect_key($data,array_flip($fields));session_write_close();respond(upstream('api',$data));
