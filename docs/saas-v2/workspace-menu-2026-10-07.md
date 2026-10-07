# Styled workspace menu - 2026-10-07

Replaced the native Company select with WorkspaceSwitcher. The trigger displays initials and the workspace name; the styled menu lists member workspaces with a selected checkmark and an Add workspace action below a separator. Removed the standalone Add workspace button. Orange accents, rounded surfaces, short entrance motion and reduced-motion support preserve the product theme.

Arrow keys/Home/End move between menu actions; Enter selects, Escape closes and returns focus, outside pointer/blur dismisses. Workspace lists scroll when long. The production component calls the same setWorkspace and AddWorkspaceDialog callbacks. No backend, n8n, membership, subscription or sending contract changes.

References reviewed: ChatGPT workspace menu (https://help.openai.com/en/articles/8265430-what-is-a-chatgpt-enterprise-workspace-how-can-i-switch-workspaces%3F.webm) and Crisp shared inbox (https://crisp.chat/en/shared-inbox/). The implementation uses existing brand colors and local initials, without new asset requests.

Production build and workspace creation regression passed. Local browser checked actual component: keyboard switched workspace, Escape restored trigger focus, menu Add workspace opened existing dialog and closed the menu. Synthetic fixture only; no customer mutation. Lifecycle check passed. Full archive verified, deployment pending.

Full ZIP: WhatsApp-Automation-Workspace-Menu-Complete-2026-10-07-cPanel.zip
SHA256: 35586744ca4b2946a6ef1fed8b9a435406b28a6846625d09d7ce347fbd02303a

Upload public package contents into the existing document root preserving private config/data. No SQL or n8n changes required.
