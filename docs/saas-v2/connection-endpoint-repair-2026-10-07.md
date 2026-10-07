# Connection endpoint deployment repair - 7 October 2026

Live diagnosis: GET /connect/wasender.php and /webhooks/whatsapp.php both returned HTTP 404 with HTML. The frontend maps an unparseable JSON response to "Connection setup is unavailable on this server." This failure occurs before provider number lookup; it does not establish a Supabase or n8n malfunction. The n8n API GET returned its expected method-specific JSON refusal, not a missing host.

Packaging error: the previous media/timezones ZIP excluded these required PHP endpoints and assumed existing server files would be preserved. That deployment assumption was not verified. The corrected packaging script requires all three PHP files and includes them. It still excludes legacy api/ and private configuration.

Immediate repair: upload WhatsApp-Automation-Connection-Repair-2026-10-07.zip to the existing wamarketing.eightbitsolutions.com document root and extract there. It contains only connect/wasender.php, connect/setup-core.php and webhooks/whatsapp.php. Preserve all other files and private data. PHP 8.1+ with curl is required. No customer credentials are included or requested.

Complete replacement package: WhatsApp-Automation-Media-Timezones-Complete-2026-10-07-cPanel.zip supersedes the earlier frontend ZIP and includes those three endpoints.

Verification: PHP syntax passed for all three files. The automatic connection fixture passed owner/admin role checks, company isolation, safe responses, webhook confirmation, provider rejection and success. No external WhatsApp sends were made. Archive integrity and required-file checks passed.

Live restoration remains pending upload. After upload, GET setup should return HTTP 405 JSON with METHOD_NOT_ALLOWED and GET webhook should return HTTP 405 {"received":false}. Then privately retry Find my WhatsApp numbers and verify actual connection setup. Successful local tests do not substitute for this live check or real media delivery.
