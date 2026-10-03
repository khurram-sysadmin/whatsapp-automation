# SaaS v2 upgrade

Foundation and owner linking are installed and verified. The user approved separate private customer queues and multiple customer-key WASender connections per company. n8n and Supabase remain operator-managed. See approved-amendments.md.

The backend review package is ready; runtime SQL and workflow are NOT installed. The single proposed workflow has 92 nodes, preserving all original 41 nodes and connections. The new customer schedule is disabled. Existing v1 production remains current.

Review runtime-review.md, the isolated-storage migration, supabase-v2-runtime.sql and the updated workflow JSON before installation, as required by upgrade-guide.md. Local tests cover all 31 actions, tenant/role/key boundaries, completion and deletion retry; workflow validation, legacy regressions and build pass. Actual Vault encryption, live concurrent transactions, provider delivery and n8n execution still need operator validation after review approval.

customer-WASender-onboarding.md specifies the future step-by-step wizard. Frontend v2 is not implemented or deployed. Customer keys are per session; partner provisioning remains pending and is not required for this customer-supplied-key path. Legacy history remains intact in v1 storage.

Git push is a source checkpoint, not production deployment. progress.json records installed versus prepared phases.
