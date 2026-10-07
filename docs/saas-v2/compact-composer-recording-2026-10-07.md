# Compact composer, recording and campaign progress - 7 October 2026

## Customer experience
Campaigns and inbox now share a clean message composer. The default view contains only the message box, three-dot options and microphone shortcut. Attachments (image, video, audio, document), personalization and sample preview are opened on demand. The inbox uses a compact reply box and message bubbles. Attachment previews and removal remain available without opening a full example-message section.

Record audio asks for microphone permission only on a click. Recording shows elapsed time, Stop and Discard. Stop prepares a playable MP3 voice note for review; it is not uploaded until campaign creation or reply submission. Five-minute maximum, cancellation during permission/encoding, immediate track release on Stop/Discard/navigation, and blocked form submission while capturing/preparing. Unsupported or denied microphone access has a clear message; file attachment remains available. Temporary recording chunks are cleared after processing. The original browser recording is decoded/mixed to mono and locally encoded to MP3; existing mediaType=audio, mediaUrl, mediaMime=audio/mpeg, mediaFilename and mediaSizeBytes contract is unchanged.

Campaign details restore an animated progress bar and only Queued, Sent and Failed counters. Sent includes delivered/read, so those are not added twice. Queued includes dispatching work. Completion still comes from the backend and is terminal; no restart is added. Uncertain outcomes remain visible in a conditional delivery-check notice and are not resent. Existing 15-second detail polling stays in place. Campaign attachment preview and attachment labels in message rows avoid blank media-only messages.

## Verification
- Production build passed; latest asset manifest is release-local/frontend-manifest.json.
- New test:composer passes MP3 encoding/cancellation, counters for 30 messages, unknown outcomes, completion, actual React controls with simulated microphone/recorder, Stop/preview, blocked submit, discard, permission denial, late permission cancellation and unmount cleanup.
- Local browser fixture uses actual composers/progress components and generated contacts only. Menus, personalization insertion, image selection, attachment-only reply validation, progress changes, green Completed at 30/30 and mobile width390 without horizontal overflow were verified.
- Native browser MediaRecorder with generated audio was converted and decoded as playable MP3. No real microphone or customer audio was used.
- Existing media/frontend/lifecycle tests and automatic PHP connection fixture passed.
- npm audit reports zero vulnerabilities; source-map-js was updated to its compatible patched release. Encoder LGPL license/source notice shipped in third-party/lamejs.

## Deployment
Full cPanel ZIP: WhatsApp-Automation-Simple-UI-Recording-Complete-2026-10-07-cPanel.zip. Includes built frontend, separately loaded MP3 encoder, license notices, connection PHP endpoints and branded webhook. Existing private configuration and legacy api files are excluded and must be preserved. Back up the product root, upload/extract into the same document root, then reload. Supabase/n8n require no new migration or workflow deployment for this UI/recording release. Existing media backend is reused, subscriptions/schedules unchanged.

Live upload, a real microphone recording on the customer's browser and authorized real WhatsApp voice/media delivery are still pending. Synthetic and fixture results do not certify end-to-end production delivery. Pricing/three-day trial activation remains a separate rollout.
