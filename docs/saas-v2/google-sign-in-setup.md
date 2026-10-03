# Enable Continue with Google

The frontend buttons are implemented on both /login and /signup. On 2026-10-03 the project's public Auth settings reported Google disabled. Real Google login is not yet verified. Email authentication remains available. This is a one-time operator setup; each customer does not need a Google Cloud project.

## One-time setup

1. Open https://console.cloud.google.com/ and choose or create the product's project. In Google Auth Platform, configure branding, audience and basic sign-in scopes (openid, email, profile). Use External for customers outside your company. While in testing, add your own email as a test user; public customers require the appropriate production publishing/verification state.
2. In Clients, create a Web application OAuth client. Add authorized JavaScript origins:
   - https://wamarketing.eightbitsolutions.com
   - http://127.0.0.1:5173 (development only)
3. Add this authorized redirect URI in Google:
   - https://lreolnewuapcurpskqwr.supabase.co/auth/v1/callback
4. In the outreach Supabase project, open Authentication → Sign In / Providers → Google. Enable it and enter the Google client ID and client secret privately, then save. Credential creation/entry/save must be done by the owner. Do not send the secret in chat or put it in frontend environment variables, Git or Obsidian.
5. In Supabase Authentication → URL Configuration, retain Site URL https://wamarketing.eightbitsolutions.com and allow these exact return URLs:
   - https://wamarketing.eightbitsolutions.com/login
   - http://127.0.0.1:5173/login (development only)
   Preserve the existing password-reset/email redirects. Avoid broad wildcard redirects. Remove development entries when no longer needed.
6. Click Continue with Google in the preview and finish consent privately. Check that the same tab returns, that your company appears, and that refreshing retains login. Test a new account separately; it should reach company onboarding and must not see another company's records. Do not enable WhatsApp sending for this test.

Google's redirect URI above goes to Supabase; the return URL in step5 goes back to the product. They are different parts of the login journey.

Official setup reference: [Supabase Google login](https://supabase.com/docs/guides/auth/social-login/auth-google).

## Implementation and checks

src/saas/client.ts checks public provider readiness before starting Supabase OAuth. It uses the current preview origin in development and VITE_APP_URL in production, always returning to /login. Only the expected Supabase authorization URL is followed. No custom Google client secret or extra VITE variable is required. The SDK continues to handle the session using tab sessionStorage.

Disabled-provider handling was checked live in the browser; signup stays open with a friendly explanation and email remains usable. Mocked tests cover disabled provider, SDK errors, unexpected redirect origin and both preview/production return addresses. Buttons and logo were visually reviewed on desktop and measured390 CSS px phones (also checked at273 without page overflow). These checks do not prove a completed Google consent/login roundtrip, which awaits operator setup. No authentication settings, passwords or provider credentials were changed by the agent.

## Operator setup verified — 2026-10-03

Owner reported completing Google OAuth setup. Public Supabase Auth settings now report external.google=true. Clicking Continue with Google in the local preview opened Google's account chooser. The authorization request uses the expected Supabase callback and http://127.0.0.1:5173/login return address. No account selected or consent submitted by the agent; full login/new-user onboarding, account linking and production return remain to be checked privately. No OAuth state URL, account list or secrets recorded in Git. The operator-only setup is enabled; earlier disabled-provider results document the prior checkpoint. No frontend rebuild is needed for this server setting.

## Private Google sign-in completed — 2026-10-03

User privately completed Google account selection/consent. Browser returned to /login# and displayed authenticated Set up your company onboarding; hard refresh retained that state and backend loading completed. This confirms preview Google sign-in and session persistence. This signed-in account currently has no linked company in the bootstrap response, as indicated by onboarding; its email/identity was not inspected. No company was created by the agent. Existing-owner workspace access, company creation/new onboarding completion and production redirect remain unverified. Do not describe this account as having reached the existing EightBit dashboard yet.
