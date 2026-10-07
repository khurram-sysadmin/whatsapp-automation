# Simple templates with private attachments - 7 October 2026

## Delivered behavior
Templates now use the same compact composer as campaigns and inbox: template name followed by one message box; attachments stay inside the three-dot menu (Image, Video, Document, Audio). Record audio and personalization remain available without a permanent row of message-type buttons. Screenshots can be pasted directly into the message box as PNG/JPEG attachments. Plain-text paste keeps working. One supported attachment per message.

Saved templates preserve body and attachment metadata. Loading a saved template into a campaign loads both, and reuses the stable private storage object reference instead of reuploading or persisting an expiring signed URL. Editing a template previews its saved attachment through the signed-in user's access. Removing an attachment and saving a text message clears its metadata. Draft attachments are cleared when changing workspace. Save notices no longer carry into another page through dashboard navigation.

## Backend alignment
Applied live migration backend/supabase/v2-review/013-template-media.sql to Supabase project lreolnewuapcurpskqwr. It adds five nullable fields to outreach.workspace_templates: media_type, media_url, media_mime, media_filename, media_size_bytes. Existing text templates are retained. API actions templates/saveTemplate return templateId, name, body plus mediaType, mediaUrl, mediaMime, mediaFilename, mediaSizeBytes. Those are the same camelCase attachment fields campaigns/replies already use.

The migration patches only the template branches of outreach_v2.api_v2 and saves its prior definition under release 2026-10-07-template-media. Writes reuse validate_media_v2 to check actual private storage objects, workspace prefix, MIME, size and filename. Existing authenticated membership/role checks and idempotency remain intact. Helper function is not exposed to browser/public roles. No sender schedules, subscriptions, client messages or active campaign state were changed. n8n already forwards these fields to the verified-user API and needs no additional publication.

Live readiness result: template_api_ready=true, template_media_columns=5, template_validation_ready=true. A second live comparison against the saved API definition returned other_api_logic_preserved=true outside the template branches. Screenshot: release-local/template-backend-ready.png.

## Verification
PGlite contract tests passed for all four media types in saved templates, reload, campaign/queue reuse, clearing metadata, viewer write rejection, cross-company attachment rejection and independent company template lists. Migration was applied twice in fixtures to verify idempotency. Existing media, frontend and lifecycle regressions passed. Composer tests cover screenshot paste, saved row conversion and recording safeguards; actual browser screenshot paste added clipboard.png. Build passed. No customer microphone data or external WhatsApp messages were used.

## Full upload package
WhatsApp-Automation-Templates-Recording-Complete-2026-10-07-cPanel.zip supersedes the prior frontend ZIPs. SHA256: fe5b6cbcc99012c9f39200eff58dd47ae836552bd68b68f27b0df2cfeffc5d4a. Includes frontend, international timezones, compact composers, campaign progress, MP3 encoder/license, connect/wasender.php, connect/setup-core.php and webhooks/whatsapp.php. Preserve existing private configuration and legacy api/ when extracting into the product document root.

Frontend upload and real WhatsApp template-media delivery remain pending. Pricing, payment provider and three-day trial rollout are explicitly deferred by the user; existing subscription behavior remains in place.
