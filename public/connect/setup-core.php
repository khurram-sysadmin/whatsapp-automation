<?php
declare(strict_types=1);
final class SetupFailure extends RuntimeException {
    public function __construct(public readonly string $safeCode, string $message, public readonly int $httpStatus = 400) { parent::__construct($message); }
}
// Only fixed, public-safe explanations. Never expose provider bodies or tokens.
function setup_upstream_failure(bool $backend, int $status, bool $network): SetupFailure {
    if ($network) return new SetupFailure($backend?'BACKEND_UNREACHABLE':'PROVIDER_UNREACHABLE', $backend?'Our connection service could not be reached from this server. Contact support.':'This server could not reach WASender securely. Contact support.', 502);
    if ($status===401) return new SetupFailure($backend?'SIGN_IN_EXPIRED':'WASENDER_TOKEN_REJECTED', $backend?'Your sign-in could not be verified. Sign out, sign in again, then retry.':'WASender rejected this token. Use Settings → Personal Access Token, not your WhatsApp session API key.', $backend?401:400);
    if ($status===403) return new SetupFailure($backend?'BACKEND_ACCESS_DENIED':'WASENDER_ACCESS_DENIED', $backend?'Your company access could not be verified. Contact support.':'WASender denied access to this account. Check the token permissions and account subscription in WASender.', 403);
    if ($status===429) return new SetupFailure('UPSTREAM_RATE_LIMITED','The connection service is busy. Wait a minute before trying again.',429);
    return new SetupFailure($backend?'BACKEND_REJECTED':'WASENDER_REQUEST_REJECTED', $backend?'Our connection service rejected the setup request. Contact support.':'WASender could not confirm this request. Check your account and connection status there before retrying.',502);
}
function setup_backend_failure(array $response, string $action): SetupFailure {
    $messages = [
        'UNAUTHORIZED'=>'Your sign-in expired. Sign in again.',
        'FORBIDDEN'=>'Your company access could not be verified.',
        'INVALID_REQUEST'=>'The connection request conflicts with its current state. Keep the existing connection and contact support.',
        'REQUEST_CONFLICT'=>'This setup request was already used. Refresh before continuing.',
        'NOT_FOUND'=>'The pending connection could not be found in this company.',
        'PROVIDER_NOT_CONNECTED'=>'WASender could not verify the connected number. Check its phone mismatch warning and connection status.',
        'PROVIDER_NOT_CONFIGURED'=>'WASender did not provide a usable session API key.',
        'CONNECTION_IN_USE'=>'This WhatsApp number is already linked to another connection.',
        'CONNECTION_MISMATCH'=>'This connection belongs to another WhatsApp number.',
        'WEBHOOK_SECRET_IN_USE'=>'This webhook security key is already used by another connection.',
        'CONNECTION_BUSY'=>'This connection has messages in progress. Finish those before changing it.',
        'PLAN_LIMIT'=>'Your company has reached its WhatsApp connection limit.',
        'SUBSCRIPTION_REQUIRED'=>'Your company needs an active subscription.',
        'BACKEND_UNAVAILABLE'=>'The connection service is temporarily unavailable.',
    ];
    $code = $response['error']['code'] ?? '';
    if (!is_string($code) || !isset($messages[$code])) return setup_upstream_failure(true,502,false);
    $stage = ['bootstrap'=>'ACCOUNT','sessionList'=>'CONNECTION_LIST','sessionCreate'=>'CONNECTION_CREATE','sessionConnect'=>'CONNECTION_SAVE'][$action] ?? 'CONNECTION';
    return new SetupFailure($stage.'_'.$code,$messages[$code],$code==='UNAUTHORIZED'?401:($code==='FORBIDDEN'?403:409));
}
// Transport is injected for isolated tests. No token, body or provider response
// is persisted. Public callers cannot choose any upstream address.
final class WhatsAppSetup {
    public function __construct(private readonly Closure $transport) {}
    private function call(string $method, string $url, string $key, ?array $body = null): array {
        return ($this->transport)($method, $url, $key, $body);
    }
    private function api(string $jwt, array $body): array {
        $r = $this->call('POST', 'https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/v2/api', $jwt, $body);
        if (($r['success'] ?? false) !== true) throw new SetupFailure('BACKEND_REJECTED', 'Unable to save this connection. Refresh your connections before trying again.', 409);
        return $r['data'] ?? [];
    }
    public function run(array $p, string $jwt): array {
        $wid = $p['workspaceId'] ?? '';
        $rid = $p['requestId'] ?? '';
        $mode = $p['operation'] ?? '';
        if (!is_string($wid) || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i', $wid)
            || !is_string($rid) || !preg_match('/^[a-zA-Z0-9-]{16,64}$/', $rid) || !in_array($mode, ['list', 'connect'], true))
            throw new SetupFailure('INVALID_REQUEST', 'Invalid connection request.');
        // Auth-derived membership, before any PAT use or provider request.
        $bootstrap = $this->api($jwt, ['action'=>'bootstrap', 'requestId'=>$rid.'-auth']);
        $member = false;
        foreach ($bootstrap['workspaces'] ?? [] as $w) {
            if (($w['workspaceId'] ?? '') === $wid && in_array($w['role'] ?? '', ['owner','admin'], true) && ($w['status'] ?? '') === 'active') $member = true;
        }
        if (!$member) throw new SetupFailure('FORBIDDEN', 'Only a company owner or administrator can connect WhatsApp.', 403);
        $pat = $p['personalAccessToken'] ?? '';
        if (!is_string($pat) || strlen($pat)<16 || strlen($pat)>4096 || preg_match('/[\x00-\x20\x7f]/', $pat)) throw new SetupFailure('INVALID_TOKEN', 'Enter your WASender Personal Access Token.');
        $base = 'https://www.wasenderapi.com/api/whatsapp-sessions';
        if ($mode === 'list') {
            $data = $this->call('GET', $base, $pat)['data'] ?? null;
            if (!is_array($data) || !array_is_list($data) || count($data)>200) throw new SetupFailure('PROVIDER_RESPONSE', 'WASender returned an unexpected session list.', 502);
            $known = $this->api($jwt, ['action'=>'sessionList','workspaceId'=>$wid,'requestId'=>$rid.'-sessions']);
            $pendingUrls = [];
            foreach ($known as $row) if (($row['status'] ?? '')==='pending' && ($row['configured'] ?? true)===false && ($row['providerMode'] ?? '')==='manual_session_key' && is_string($row['whatsappSessionId'] ?? null))
                $pendingUrls[]='https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php?whatsappSessionId='.$row['whatsappSessionId'];
            return ['sessions'=>array_map(static function(array $s) use ($pendingUrls): array {
                return ['id'=>(string)($s['id'] ?? ''), 'name'=>substr((string)($s['name'] ?? ''),0,200), 'phone'=>substr((string)($s['phone_number'] ?? ''),0,30), 'status'=>strtolower((string)($s['status'] ?? 'unknown')), 'hasWebhook'=>!empty($s['webhook_url']), 'resumingSetup'=>in_array($s['webhook_url'] ?? '',$pendingUrls,true)];
            }, $data)];
        }
        $id = $p['providerSessionId'] ?? '';
        if (!is_string($id) || !preg_match('/^[1-9][0-9]{0,15}$/', $id)) throw new SetupFailure('INVALID_REQUEST', 'Choose your WhatsApp number.');
        // Fetch under this PAT again. Never accept browser-supplied API keys,
        // webhook secrets, provider metadata, phone identity or callback URLs.
        $s = $this->call('GET', $base.'/'.$id, $pat)['data'] ?? [];
        if ((string)($s['id'] ?? '') !== $id || strtolower((string)($s['status'] ?? '')) !== 'connected') throw new SetupFailure('NOT_CONNECTED', 'Connect this number in WASender first, then try again.');
        $apiKey = $s['api_key'] ?? '';
        $secret = $s['webhook_secret'] ?? '';
        if (!is_string($apiKey) || strlen($apiKey)<16) throw new SetupFailure('PROVIDER_RESPONSE', 'WASender did not return a session API key.', 502);
        $existing = (string)($s['webhook_url'] ?? '');
        $sessions = $this->api($jwt, ['action'=>'sessionList','workspaceId'=>$wid,'requestId'=>$rid.'-sessions']);
        $sid = '';
        $prefix = 'https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php?whatsappSessionId=';
        // Recover only an unconfigured pending row that the authenticated owner
        // can already see in this company, with the provider URL matching exactly.
        // Never reassign a configured number or trust a browser-provided row ID.
        foreach ($sessions as $known) {
            $candidate = $known['whatsappSessionId'] ?? '';
            if (is_string($candidate) && preg_match('/^[a-f0-9-]{36}$/i',$candidate) && $existing===$prefix.$candidate
                && ($known['status'] ?? '')==='pending' && ($known['configured'] ?? true)===false
                && ($known['providerMode'] ?? '')==='manual_session_key') $sid=$candidate;
        }
        $resume = $sid !== '';
        if (!$resume && (str_starts_with($existing, 'https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php') || str_starts_with($existing, 'https://n8n.eightbitsolutions.com/webhook/eightbit-outreach/'))) throw new SetupFailure('EXISTING_EIGHTBIT_CONNECTION', 'This number already has an EightBit connection. Open its existing connection or contact support; we will not transfer it automatically.', 409);
        if (!$resume && $existing !== '' && ($p['replaceWebhook'] ?? false) !== true) throw new SetupFailure('WEBHOOK_CONFIRMATION_REQUIRED', 'This number already has a webhook. Confirm replacement to connect it to this company.', 409);
        foreach ($sessions as $known) if (($known['configured'] ?? false) && ($known['phoneE164'] ?? '') === ($s['phone_number'] ?? '')) throw new SetupFailure('ALREADY_CONNECTED', 'This number is already connected. Open its existing connection instead.', 409);
        $name = trim((string)($p['displayName'] ?? $s['name'] ?? 'WhatsApp'));
        if ($name === '' || strlen($name)>200) throw new SetupFailure('INVALID_REQUEST', 'Enter a connection name of up to 200 characters.');
        $this->call('CHECK', 'https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php', '');
        if (!$resume) {
            $created = $this->api($jwt, ['action'=>'sessionCreate','workspaceId'=>$wid,'displayName'=>$name,'requestId'=>$rid.'-create']);
            $sid = $created['whatsappSessionId'] ?? '';
        }
        if (!is_string($sid) || !preg_match('/^[a-f0-9-]{36}$/i', $sid)) throw new SetupFailure('BACKEND_RESPONSE', 'Unable to prepare your connection.', 502);
        $url = 'https://wamarketing.eightbitsolutions.com/webhooks/whatsapp.php?whatsappSessionId='.$sid;
        // Only change webhook configuration, never billing or unrelated settings.
        $u = $resume ? $s : ($this->call('PUT', $base.'/'.$id, $pat, ['webhook_url'=>$url,'webhook_enabled'=>true,'webhook_events'=>['messages.upsert','messages.update','message-receipt.update','message.sent','session.status']])['data'] ?? []);
        if (($u['webhook_url'] ?? '') !== $url || ($u['webhook_enabled'] ?? false) !== true) throw new SetupFailure('PROVIDER_RESPONSE', 'Webhook configuration was not confirmed. Refresh connections before retrying.', 502);
        $secret = $u['webhook_secret'] ?? $secret;
        $apiKey = $u['api_key'] ?? $apiKey;
        if (!is_string($secret) || strlen($secret)<16 || !is_string($apiKey) || strlen($apiKey)<16) throw new SetupFailure('PROVIDER_RESPONSE', 'WASender did not confirm connection security. Contact support before retrying.', 502);
        foreach (['messages.upsert','messages.update','message-receipt.update','message.sent','session.status'] as $event) {
            if (!in_array($event, $u['webhook_events'] ?? [], true)) throw new SetupFailure('PROVIDER_RESPONSE', 'Message update settings were not confirmed. Contact support before retrying.', 502);
        }
        $saved = $this->api($jwt, ['action'=>'sessionConnect','workspaceId'=>$wid,'whatsappSessionId'=>$sid,'apiSecret'=>$apiKey,'webhookSecret'=>$secret,'requestId'=>$rid.'-connect']);
        return ['connection'=>array_intersect_key($saved, array_flip(['whatsappSessionId','displayName','phoneE164','status','configured','webhookReady']))];
    }
}
