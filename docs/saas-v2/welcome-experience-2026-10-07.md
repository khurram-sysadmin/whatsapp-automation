# Welcome experience - 2026-10-07

Refined the sign-in, signup and password recovery presentation. Added a branded green/orange welcome story, soft mint/peach background, an explicitly illustrative campaign-to-conversation card, short staggered bubble entrances, refined form surfaces and focus/hover states. Preserved the EightBit logo and existing authentication handlers. Motion respects reduced-motion preferences. Mobile hides the decorative showcase to prioritize account access.

Validation: production build, lifecycle tests and frontend authentication/transport regression checks passed. Actual Auth component reviewed with a local synthetic client (network disabled). Desktop and 390 CSS-pixel phone width reviewed; no horizontal page overflow. Signup and forgot-password navigation verified without submitting credentials or sending reset mail. No browser console errors. Existing main bundle size advisory remains.

No Supabase, n8n, API, billing or sender changes. Full package includes all previous UI/workspace changes and required PHP connection/webhook endpoints. Production upload remains pending.

Artifact: WhatsApp-Automation-Welcome-Experience-Complete-2026-10-07-cPanel.zip. Upload contents into the existing public document root, preserving private configuration/data. No SQL or n8n update required.

Verified ZIP: 15 public files. SHA256: 9f26d0929058df340f38a5c9c89cbca9d1fd629dc93b8776e3d5a9d42908d037.
