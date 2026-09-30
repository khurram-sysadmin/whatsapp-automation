<?php
declare(strict_types=1);
ini_set('display_errors','0');
function respond(array $body,int $status=200):never {http_response_code($status);header('Content-Type: application/json; charset=utf-8');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');echo json_encode($body,JSON_INVALID_UTF8_SUBSTITUTE);exit;}
set_exception_handler(function(Throwable $e){error_log('[Outreach] server request failed: '.get_class($e));respond(['success'=>false,'error'=>'Server configuration or request failure. Contact your administrator.'],503);});
$configPath=getenv('OUTREACH_CONFIG')?:'';
if($configPath==='' && is_file(__DIR__.'/private-path.php'))$configPath=require __DIR__.'/private-path.php';
if(!is_string($configPath) || !is_file($configPath)) {
 $home=null;$documentRoot=realpath($_SERVER['DOCUMENT_ROOT']??dirname(__DIR__));
 if($documentRoot && preg_match('~^(/home/[^/]+)(?:/|$)~',$documentRoot,$match))$home=$match[1];
 if(!$home && function_exists('posix_getpwuid') && function_exists('posix_geteuid')) {
  $account=posix_getpwuid(posix_geteuid());$candidate=$account['dir']??'';
  if(is_dir($candidate) && $candidate!=='/' && $candidate!==$documentRoot && !str_starts_with($candidate,$documentRoot.'/'))$home=$candidate;
 }
 if(!$home)respond(['success'=>false,'error'=>'Hosting could not locate a private account folder. Contact your hosting provider to set OUTREACH_CONFIG outside the website.'],503);
 $directory=$home.'/eightbit-outreach-private';
 if(!is_dir($directory) && !mkdir($directory,0700,true))throw new RuntimeException('Cannot create private directory');
 $configPath=$directory.'/config.php';
 if(!is_file($configPath)) {
  $handle=fopen($configPath,'x');
  if($handle){fwrite($handle,"<?php\nreturn ['app_origin'=>'https://wamarketing.eightbitsolutions.com','outreach_key'=>''];\n");fclose($handle);chmod($configPath,0600);}
 }
}
if(function_exists('opcache_invalidate'))opcache_invalidate($configPath,true);
$config=require $configPath;
if(!is_array($config))throw new RuntimeException('Invalid config');
$private=realpath(dirname($configPath));$docroot=realpath($_SERVER['DOCUMENT_ROOT']??dirname(__DIR__));
if(!$private || ($docroot && ($private===$docroot || str_starts_with(strtolower($private),strtolower($docroot).DIRECTORY_SEPARATOR))) || preg_match('~(?:^|[/\\\\])public_html(?:[/\\\\]|$)~i',$private))throw new RuntimeException('Private config must be outside web roots');
if(!is_dir($private.'/sessions'))mkdir($private.'/sessions',0700,true);
$origin=rtrim((string)($config['app_origin']??''),'/');
$isLocal=PHP_SAPI==='cli-server' && in_array($origin,['http://127.0.0.1:4188','http://127.0.0.1:4189'],true);
if(!str_starts_with($origin,'https://')&&!$isLocal)throw new RuntimeException('HTTPS origin required');
if(PHP_SAPI!=='cli'){
 if(!$isLocal && (($_SERVER['HTTPS']??'')!=='on') && (($_SERVER['HTTPS']??'')!=='1'))respond(['success'=>false,'error'=>'HTTPS is required.'],400);
 ini_set('session.use_strict_mode','1');ini_set('session.use_only_cookies','1');session_save_path($private.'/sessions');session_name('eightbit_session');session_set_cookie_params(['lifetime'=>0,'path'=>'/','secure'=>!$isLocal,'httponly'=>true,'samesite'=>'Strict']);session_start();
 $_SESSION['csrf']??=bin2hex(random_bytes(32));
}
$db=new PDO('sqlite:'.$private.'/auth.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$db->exec('PRAGMA busy_timeout=5000');
$db->exec('CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,email TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,session_version INTEGER NOT NULL DEFAULT 1); CREATE TABLE IF NOT EXISTS login_limits(bucket TEXT PRIMARY KEY,attempts INTEGER NOT NULL,window_start INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS preferences(user_id INTEGER PRIMARY KEY,data TEXT NOT NULL); CREATE UNIQUE INDEX IF NOT EXISTS single_admin ON users((1))');
if(!$db->query("SELECT value FROM metadata WHERE key='dummy_hash'")->fetchColumn()) {
 $q=$db->prepare('INSERT OR IGNORE INTO metadata(key,value) VALUES(?,?)');$q->execute(['dummy_hash',password_hash(bin2hex(random_bytes(24)),PASSWORD_DEFAULT,['cost'=>12])]);
}
chmod($private.'/auth.sqlite',0600);
// Connection data is stored in private SQLite, not executable PHP configuration.
// This remains current even on hosts with PHP OPcache timestamp checks disabled.
$db->exec('CREATE TABLE IF NOT EXISTS backend_connection(id INTEGER PRIMARY KEY CHECK(id=1),api_url TEXT NOT NULL,auth_key TEXT NOT NULL,updated_at INTEGER NOT NULL,last_check TEXT)');
$seedKey=is_string($config['outreach_key']??null)?$config['outreach_key']:'';
if(str_starts_with($seedKey,'REPLACE_'))$seedKey='';
$q=$db->prepare('INSERT OR IGNORE INTO backend_connection(id,api_url,auth_key,updated_at) VALUES(1,?,?,?)');$q->execute(['https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api',$seedKey,time()]);
$connection=$db->query('SELECT * FROM backend_connection WHERE id=1')->fetch(PDO::FETCH_ASSOC);
function normalizeBackendURL(string $url):string {
 $url=rtrim(trim($url),'/');
 if($url==='https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1')$url.='/api';
 if($url!=='https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v1/api')respond(['success'=>false,'error'=>'Use the production EightBit n8n Campaign API webhook URL.'],400);
 return $url;
}
function setupRequired():bool {global $db;return (int)$db->query('SELECT count(*) FROM users')->fetchColumn()===0;}

function body():array {if((int)($_SERVER['CONTENT_LENGTH']??0)>1048576)respond(['success'=>false,'error'=>'Request is too large.'],413);if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))respond(['success'=>false,'error'=>'JSON content type required.'],415);try{$raw=json_decode(file_get_contents('php://input'),true,32,JSON_THROW_ON_ERROR);}catch(Throwable $e){respond(['success'=>false,'error'=>'Malformed JSON request.'],400);}if(!is_array($raw)||array_is_list($raw))respond(['success'=>false,'error'=>'JSON object required.'],400);return $raw;}
function postOnly():void {global $origin;if(($_SERVER['REQUEST_METHOD']??'')!=='POST')respond(['success'=>false,'error'=>'POST required.'],405);if(($_SERVER['HTTP_ORIGIN']??'')!==$origin)respond(['success'=>false,'error'=>'Invalid request origin.'],403);if(!hash_equals($_SESSION['csrf']??'',$_SERVER['HTTP_X_CSRF_TOKEN']??'')||empty($_SESSION['csrf']))respond(['success'=>false,'error'=>'Session validation failed. Reload and sign in again.'],403);}
function invalidate():void {$_SESSION=[];session_destroy();setcookie(session_name(),'', ['expires'=>time()-3600,'path'=>'/','secure'=>!$GLOBALS['isLocal'],'httponly'=>true,'samesite'=>'Strict']);}
function authenticated():array {global $db;$id=$_SESSION['user_id']??null;if(!$id || time()-(int)($_SESSION['last_active']??0)>1800 || time()-(int)($_SESSION['created_at']??0)>28800){invalidate();respond(['success'=>false,'error'=>'Your session expired. Please sign in.'],401);}$query=$db->prepare('SELECT id,email,session_version FROM users WHERE id=?');$query->execute([$id]);$user=$query->fetch(PDO::FETCH_ASSOC);if(!$user || (int)$user['session_version']!==(int)($_SESSION['session_version']??-1)){invalidate();respond(['success'=>false,'error'=>'Your session expired. Please sign in.'],401);}$_SESSION['last_active']=time();return $user;}
function upstream(string $kind,mixed $payload,array $query=[]):array {global $config,$isLocal,$connection;$base=substr($connection['api_url'],0,-3);if($isLocal && isset($config['test_upstream']))$base=$config['test_upstream'];$key=$connection['auth_key']??'';if(!is_string($key)||strlen($key)<1||str_starts_with($key,'REPLACE_')||str_contains($key,"\n")||str_contains($key,"\r"))respond(['success'=>false,'error'=>'Connect n8n in Settings to load your outreach data.'],503);$url=$base.$kind.($query?'?'.http_build_query($query):'');$ch=curl_init($url);$headers=['Accept: application/json','X-Outreach-Key: '.$key];if($kind==='api'){$headers[]='Content-Type: application/json';$payload=json_encode($payload,JSON_THROW_ON_ERROR);}curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>$payload,CURLOPT_HTTPHEADER=>$headers,CURLOPT_RETURNTRANSFER=>true,CURLOPT_CONNECTTIMEOUT=>10,CURLOPT_TIMEOUT=>55,CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_PROTOCOLS=>$isLocal?(CURLPROTO_HTTP|CURLPROTO_HTTPS):CURLPROTO_HTTPS]);$raw=curl_exec($ch);$status=(int)curl_getinfo($ch,CURLINFO_HTTP_CODE);$error=curl_errno($ch);curl_close($ch);if($error||!is_string($raw))respond(['success'=>false,'error'=>'Backend unavailable or request outcome unconfirmed. Refresh before retrying a write.'],502);if(in_array($status,[401,403],true))respond(['success'=>false,'error'=>'n8n rejected the saved Frontend Auth key. Update it in Settings > Connection. Your admin login is still valid.'],502);try{$result=json_decode($raw,true,64,JSON_THROW_ON_ERROR);}catch(Throwable $e){respond(['success'=>false,'error'=>'Backend returned an invalid response.'],502);}if(!is_array($result)||!isset($result['success'])||!is_bool($result['success']))respond(['success'=>false,'error'=>'Backend returned an invalid response.'],502);if($status<200||$status>=300||$result['success']!==true){$public=['success'=>false,'error'=>is_string($result['error']??null)?mb_substr($result['error'],0,500):'Backend request failed.'];respond($public,($status>=400&&$status<=599)?$status:((int)($result['httpStatus']??400)));}return $result;}
