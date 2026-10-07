# Attachment-only message composer - 2026-10-07

Removed Personalize message and Preview message from the shared editor in campaigns, inbox and message templates, including their field-insertion and sample-preview panels. The three-dot menu now contains Image, Video, Audio and Document. Recording is available only through the separate microphone button beside the message box. Screenshot paste, actual attachment playback and recording remain available. Existing template variable rendering on the backend is unchanged.

Validation: composer tests, production build and lifecycle checks passed. Local browser checks confirmed the attachment choices in all three views; a follow-up browser check confirmed the duplicate recording menu choice was removed. No customer data, microphone input or outbound message was used. No Supabase or n8n changes are required for this UI update.

Complete cPanel package: `WhatsApp-Automation-Clean-Composer-Complete-2026-10-07-cPanel.zip`
SHA256: `a6d9664261473a6133c657bcde62cb669fb10531e13e5f3f1dc8088e8fe64141`

Upload/extract the package contents into the existing site document root, preserving the private configuration and database. The archive includes the connection and webhook endpoints, public assets and license notices. Production upload and real media delivery remain unverified.
