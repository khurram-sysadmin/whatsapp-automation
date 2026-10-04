<?php
declare(strict_types=1);
// Public branded entry point. Authentication and tenant attribution remain in the
// existing backend. Never redirect a provider or accept a caller-supplied target.
header('Content-Type: application/json');
header('Cache-Control: no-store');
function reject(int $status): never {
    http_response_code($status);
    echo '{"received":false}';
    exit;
}
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') reject(405);
$session = $_GET['whatsappSessionId'] ?? '';
if (!is_string($session) || !preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $session)) reject(400);
$signature = $_SERVER['HTTP_X_WEBHOOK_SIGNATURE'] ?? '';
if (!is_string($signature) || strlen($signature) < 16 || strlen($signature) > 1024 || preg_match('/[\r\n]/', $signature)) reject(401);
$body = file_get_contents('php://input', false, null, 0, 1048577);
if ($body === false || strlen($body) > 1048576) reject(413);
try { json_decode($body, true, 64, JSON_THROW_ON_ERROR); } catch (JsonException $e) { reject(400); }
if (!function_exists('curl_init')) reject(503);
$handle = curl_init('https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/provider-webhook?whatsappSessionId=' . rawurlencode($session));
curl_setopt_array($handle, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $body,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'X-Webhook-Signature: ' . $signature],
    CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => false,
    CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 25, CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2]);
$result = curl_exec($handle);
$status = (int) curl_getinfo($handle, CURLINFO_HTTP_CODE);
curl_close($handle);
if ($result === false || $status < 100) reject(502);
// No provider payloads, credentials, upstream response bodies or internal URLs
// are logged or returned. Preserve rejection/retry semantics.
http_response_code($status >= 200 && $status < 300 ? 200 : ($status >= 400 && $status < 500 ? $status : 502));
echo $status >= 200 && $status < 300 ? '{"received":true}' : '{"received":false}';
