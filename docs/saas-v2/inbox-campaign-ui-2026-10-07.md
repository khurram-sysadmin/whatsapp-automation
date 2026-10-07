# Conversation workspace and campaign rows - 2026-10-07

Inbox uses a conversation list, chat pane and contact profile. Initials avatars use local text, with no third-party image requests. Search matches contact name/company/phone/email and last message. The profile uses existing contact fields (phone, email, company, city, industry) and selected WhatsApp connection. No New/Waiting/In progress/Completed inbox tabs or tasks were added.

Chat bubbles align by direction with avatars, dates and existing delivery labels. Existing private attachments, media preview, recording and reply backend contract are retained. Switching conversations clears pending attachments. Mobile selection hides the list and exposes Back to conversations; profile stacks below chat. At medium widths the profile moves beneath chat. No selection on mobile hides the empty chat pane.

Campaigns retain the existing actionable table with colored campaign icons, clearer row spacing, light alternate rows, short staggered entrances and hover accents. Reduced-motion preferences disable animation. Sender/status/queue behavior and API field names unchanged.

Validation: production build, composer/recording/progress, frontend auth/request-ID and lifecycle checks passed. Browser tested the actual shared InboxLayout component with synthetic contacts: company search reduced to one matching conversation; selection changed contact/profile; mobile Back restored the list. At 390px width page width was 384px with no horizontal overflow. Desktop inbox and campaign table screenshots inspected. No real sends or customer records used. Production upload/visual verification pending.

Complete package: `WhatsApp-Automation-Inbox-Campaign-UI-Complete-2026-10-07-cPanel.zip`
SHA256: `615a5a2c6724bd0d48e43d3c3981e77b7a3181779e2dc9c8a9bd220383e3e685`

Upload package contents into the existing document root while preserving private configuration and data. No Supabase or n8n change needed for this UI release. Git push alone does not deploy cPanel.
