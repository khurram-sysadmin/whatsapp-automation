<?php
require __DIR__.'/bootstrap.php';postOnly();authenticated();
$uuid='~^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$~i';$cid=$_GET['campaignId']??'';$rid=$_GET['requestId']??'';
if(!is_string($cid)||!preg_match($uuid,$cid)||!is_string($rid)||strlen($rid)<8||strlen($rid)>128)respond(['success'=>false,'error'=>'Valid campaign and request IDs are required.'],400);
$file=$_FILES['file']??null;if(!is_array($file)||$file['error']!==UPLOAD_ERR_OK||!is_uploaded_file($file['tmp_name']))respond(['success'=>false,'error'=>'Upload exactly one valid file.'],400);
$ext=strtolower(pathinfo($file['name'],PATHINFO_EXTENSION));if(!in_array($ext,['csv','xlsx'],true)||$file['size']>5*1024*1024)respond(['success'=>false,'error'=>'Use CSV or XLSX, maximum 5 MB.'],400);
$query=['campaignId'=>$cid,'requestId'=>$rid,'phoneFormat'=>'international'];foreach(['defaultCallingCode','trunkPrefix'] as $field)if(isset($_GET[$field])&&is_string($_GET[$field])&&preg_match('~^\d{1,3}$~',$_GET[$field]))$query[$field]=$_GET[$field];session_write_close();
respond(upstream('import',['file'=>new CURLFile($file['tmp_name'],$ext==='csv'?'text/csv':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','contacts.'.$ext)],$query));
