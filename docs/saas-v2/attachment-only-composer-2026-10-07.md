# Attachment-only message composer - 2026-10-07

Removed Personalize message and Preview message from the shared editor in campaigns, inbox and message templates, including their field-insertion and sample-preview panels. The three-dot menu now contains Image, Video, Audio, Document and Record audio. Screenshot paste, actual attachment playback and recording remain available. Existing template variable rendering on the backend is unchanged.

Validation: composer tests, production build and lifecycle checks passed. Local browser checks confirmed the five menu choices in all three views. No customer data, microphone input or outbound message was used. No Supabase or n8n changes are required for this UI update.

Complete cPanel package: `WhatsApp-Automation-Clean-Composer-Complete-2026-10-07-cPanel.zip`
SHA256: `910016610f3d75fecc65f5c39e5a8f9414fe800be57ae1848a2595cc6200d777`

Upload/extract the package contents into the existing site document root, preserving the private configuration and database. The archive includes the connection and webhook endpoints, public assets and license notices. Production upload and real media delivery remain unverified.
