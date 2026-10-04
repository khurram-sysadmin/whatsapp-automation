<?php
declare(strict_types=1);
ini_set('display_errors', '0');
header('Content-Type: application/json');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
require __DIR__.'/setup-core.php';
function setup_reply(int $status, ?array $data, string $code = '', string $message = ''): never {
    http_response_code($status);
    echo json_encode(['success'=>$status===200,'data'=>$data,'error'=>$code===''?null:['code'=>$code,'message'=>$message]], JSON_UNESCAPED_SLASHES);
    exit;
}
try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') throw new SetupFailure('METHOD_NOT_ALLOWED','Use POST.',405);
    // No cross-origin CORS access; bearer auth, JSON and origin checks resist CSRF.
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== 'https://wamarketing.eightbitsolutions.com' && !(PHP_SAPI==='cli-server' && $origin==='http://127.0.0.1:5173')) throw new SetupFailure('FORBIDDEN','Request origin rejected.',403);
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) throw new SetupFailure('INVALID_REQUEST','Use JSON.',415);
    $auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!preg_match('/^Bearer ([A-Za-z0-9_.-]{32,8192})$/', $auth, $matches)) throw new SetupFailure('UNAUTHORIZED','Sign in again.',401);
    $raw = file_get_contents('php://input',false,null,0,16385);
    if ($raw===false || strlen($raw)>16384) throw new SetupFailure('INVALID_REQUEST','Request too large.',413);
    $p = json_decode($raw,true,16,JSON_THROW_ON_ERROR);
    if (!is_array($p)) throw new SetupFailure('INVALID_REQUEST','Invalid request.');
    // Bounded rate metadata only; no credentials or request bodies in this file.
    $ratePath = sys_get_temp_dir().'/eightbit-setup-rate-'.hash('sha256',__DIR__).'.json';
    $rate = fopen($ratePath,'c+');
    if ($rate===false || !flock($rate,LOCK_EX)) throw new SetupFailure('UNAVAILABLE','Setup is temporarily unavailable.',503);
    @chmod($ratePath,0600);
    $buckets=json_decode(stream_get_contents($rate,262144),true) ?? [];
    $now=time(); $buckets=array_filter($buckets,static fn($b)=>is_array($b)&&($b['until'] ?? 0)>$now);
    $client=hash('sha256',(string)($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
    $b=$buckets[$client] ?? ['until'=>$now+60,'count'=>0];
    $limited=$b['count']>=30 || (!isset($buckets[$client]) && count($buckets)>=1000);
    if (!$limited) {$b['count']++;$buckets[$client]=$b;rewind($rate);ftruncate($rate,0);fwrite($rate,json_encode($buckets));}
    flock($rate,LOCK_UN);fclose($rate);
    if ($limited) throw new SetupFailure('RATE_LIMITED','Please wait a minute before trying again.',429);
    $transport = static function(string $method,string $url,string $key,?array $body): array {
        if (!function_exists('curl_init')) throw new SetupFailure('UNAVAILABLE','Connection setup is unavailable. Contact support.',503);
        $curl = curl_init($url); $response = '';
        curl_setopt_array($curl,[CURLOPT_CUSTOMREQUEST=>$method==='CHECK'?'GET':$method,CURLOPT_HTTPHEADER=>$method==='CHECK'?[]:['Authorization: Bearer '.$key,'Content-Type: application/json'],CURLOPT_FOLLOWLOCATION=>false,CURLOPT_CONNECTTIMEOUT=>5,CURLOPT_TIMEOUT=>20,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_WRITEFUNCTION=>static function($ch,string $chunk) use (&$response): int {if(strlen($response)+strlen($chunk)>1048576)return 0;$response.=$chunk;return strlen($chunk);}]);
        if ($body!==null) curl_setopt($curl,CURLOPT_POSTFIELDS,json_encode($body,JSON_THROW_ON_ERROR));
        $ok=curl_exec($curl); $status=(int)curl_getinfo($curl,CURLINFO_HTTP_CODE); curl_close($curl);
        if ($method==='CHECK') {
            if ($ok!==false && $status===405 && trim($response)==='{"received":false}') return ['success'=>true];
            throw new SetupFailure('RELAY_UNAVAILABLE','Message update setup is unavailable. Contact support; your WASender settings have not been changed.',503);
        }
        if ($ok===false || $status<200 || $status>=300) throw new SetupFailure('UPSTREAM_REJECTED','Setup could not be confirmed. Check your token and connections before retrying.',502);
        $r=json_decode($response,true,32,JSON_THROW_ON_ERROR);
        if (!is_array($r) || ($r['success'] ?? false)!==true) throw new SetupFailure('UPSTREAM_REJECTED','The connection service rejected this request.',502);
        return $r;
    };
    $result=(new WhatsAppSetup($transport))->run($p,$matches[1]);
    unset($p,$raw,$matches,$auth);
    setup_reply(200,$result);
} catch (SetupFailure $e) { setup_reply($e->httpStatus,null,$e->safeCode,$e->getMessage()); }
catch (Throwable $e) { setup_reply(502,null,'SETUP_UNAVAILABLE','Setup could not be confirmed. Refresh connections before retrying.'); }
