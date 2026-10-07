# Template variables - 2026-10-07

Added two compact insertion buttons below the message box in Message templates only: First name inserts {{first_name}}, and Company name inserts {{company}} at the cursor. Existing backend field names and rendering are preserved. Campaign and inbox composers retain the attachment-only menu and separate microphone. No sample preview panel was restored.

Composer tests cover insertion and the absence of variable controls by default. Recording/progress tests, production build and lifecycle checks passed. Local browser verification confirmed both insertions. No real sends were made. No database or n8n deployment is needed for this frontend change.

Billing currently reads the workspace subscription status, plan, trial expiry, limits and monthly sent-message usage. Payment checkout is not implemented; pricing remains deferred. Team is a separate page showing workspace members/roles.

Complete package: `WhatsApp-Automation-Template-Variables-Complete-2026-10-07-cPanel.zip`
SHA256: `2216ae000318e8b8828d81c60568860d22f08f5626cd3e500e99e11bb015955d`

Upload contents to the existing cPanel document root, preserving private configuration and data. Production upload and real media delivery remain unverified.
