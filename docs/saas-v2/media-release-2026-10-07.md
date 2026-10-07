> Deployment correction: use the Complete cPanel ZIP or the connection repair ZIP. Live connection and webhook endpoints returned 404 after the frontend release. See connection-endpoint-repair-2026-10-07.md. Live restoration is pending upload.

# Attachments and international time zones — 7 October 2026

This checkpoint supersedes the earlier staging-only media instructions. The separate billing/trial rollout remains staged. Existing production subscriptions and customer data have not been migrated to a new plan.

## Installed backend

Supabase project `lreolnewuapcurpskqwr` has the private `outreach-media` bucket and campaign/message/conversation media columns. Live inspection found the customer API still used text-only inserts despite those columns. `011-production-media-compatibility.sql` now narrowly patches the active function definition: create, campaign queue insert, reply, message reads and conversation reads. `finish_send_v2` copies media into the inbox. Unrelated signup, subscription, provider connection, import, lifecycle and permission code is retained.

`010-media-validation.sql` requires a real private object with a path under the authorized workspace, matching MIME and size metadata and supported formats. The public URL must use the project's authenticated object reference. New uploads are limited by `012-media-upload-policy.sql` to active workspace owners, admins and agents. Read previews remain member-scoped. Database function rollback copies are in `outreach_v2.release_function_backups`, with privileges revoked and RLS enabled; there is no client access to that table.

The existing n8n workflow `biQP0tU694qWD8P9` now has 99 unique nodes (93 original + 6 media preparation nodes). The imported draft was exported and compared with the intended patch before publishing: all node parameters, connections and workflow settings matched. The existing schedule remains enabled. There is no second sender workflow. Published version name: `Private attachments – 7 October 2026`.

## Shared contract

Frontend/API: `mediaType`, `mediaUrl`, `mediaMime`, `mediaFilename`, `mediaSizeBytes`.
Database: `media_type`, `media_url`, `media_mime`, `media_filename`, `media_size_bytes`.
Kinds: `image`, `video`, `audio`, `document`. Existing `template`, `text`, `personalizedMessage`, `workspaceId` and `whatsappSessionId` names are preserved.

The stored mediaUrl is `https://lreolnewuapcurpskqwr.supabase.co/storage/v1/object/authenticated/outreach-media/<workspaceId>/<objectName>`; it contains no download token. n8n validates the workspace path and creates a fresh 600-second signed URL just before sending. A signing failure commits a safe retry/failure without calling WASender. Provider timeouts still remain unknown and are never automatically resent. Inbox previews obtain their own signed URL through the signed-in user's Storage permissions and refresh it while displayed. Retried submissions reuse a successful upload so uncertain API writes can reuse their request ID.

## Customer UI

Campaign and inbox composers support Text, Image, Video, Voice note and Document. They show format/size limits, attachment names, preview/playback and removal. Switching types clears the previous file. An attachment can be sent without a caption. Personalization controls and sample previews remain available.

Voice notes currently mean uploaded audio, not microphone recording in the dashboard. [WASender audio documentation](https://app.wasenderapi.com/api-docs/messages/send-audio-message) states that audioUrl is delivered as a voice note. Supported files: JPEG/PNG (5 MB), MP4/3GP (50 MB), AAC/MP3/OGG/AMR (16 MB), and supported office/PDF/TXT documents (100 MB). See provider documentation before adding formats; WebP is not advertised as an image format for this release.

The frontend offers 419 browser-supported IANA zones, including `Asia/Riyadh` labelled Saudi Arabia. Every offered zone was checked against the live `pg_timezone_names`; none were unsupported. Canonical zone values are sent unchanged. Offset labels describe the current offset; scheduling uses the stored IANA zone and backend daylight-saving rules.

## Verification and deployment status

Build, lifecycle, v2 runtime, frontend request, workflow and new media regression checks passed. New tests cover migration from a text-only API, repeated migration, media-only campaign/reply flow, all four media types, inbox persistence, cross-company/role rejection, metadata rejection, write idempotency and signer failure routes. Browser checks confirmed optional captions, clearing media on type change, image preview and no horizontal overflow at 390px. These tests used fixtures and sent no new WhatsApp messages.

Supabase live readiness returned true for API media validation, queue media, inbox media, private bucket and Riyadh; three rollback function copies were recorded. n8n visibly shows Published. This is not a claim that all provider formats were delivered on a real phone: final real media delivery is pending an authorized recipient and frontend upload.

The verified frontend-only artifact is `outputs/WhatsApp-Automation-Media-Timezones-2026-10-07-cPanel.zip`. It contains public static frontend files at ZIP root, including hidden `.htaccess`. Existing `api/`, `connect/`, `webhooks/` and private PHP configuration are deliberately excluded from this frontend release. The public Supabase key was recovered and verified from the existing release; no service key belongs in the frontend.

Back up the existing product document root, then extract this ZIP into the existing `wamarketing.eightbitsolutions.com` document root. Upload the new assets first and index.html last if copying individual files. Preserve existing PHP services and private folders. Keep old assets for rollback. Hard-refresh, verify sign-in and campaign/inbox forms, then send one authorized test per media type before advertising media support to all clients. Restoring the previous index/assets rolls the frontend back without altering customer records.

Do not run the entire staged runtime or trial migration on production to deploy this frontend. The trial/paid checkout release still needs its separate plan/provider decisions and staging verification.
