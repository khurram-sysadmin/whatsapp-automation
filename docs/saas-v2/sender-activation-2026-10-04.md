# Customer sender activation — 2026-10-04

The reported campaign remained running with a queued message and zero attempts because the published customer queue schedule was disabled after provider testing had previously been deferred. Connection metadata, saved-key presence, per-session sender settings and campaign sending hours were ready.

Read-only checks confirmed exactly one queued message in one campaign/workspace, no standalone queued messages, and no leased, dispatching or unknown outcomes. The user explicitly authorized sending the selected campaign message. Only the existing `V2 Customer Queue Every 15 Seconds` node was enabled; the existing 92-node workflow and provider/queue safeguards were preserved. No manual duplicate send, credential change, SQL mutation or second workflow was required.

Workflow `biQP0tU694qWD8P9` is active. Published version `1af85b6e-5bfa-41ef-81ee-197106cc0af0` was read back with the customer schedule enabled. The approved message reached `sent` with one attempt and a provider message identifier; the campaign automatically reached `completed` with no error. Provider acceptance does not establish recipient delivery or read status. Signed callback delivery verification and broader concurrent-session checks remain outstanding.

The inactive-on-import workflow templates intentionally retain a disabled customer schedule. They are review/rollback artifacts, not a statement of current published state. Do not reimport them over production without reviewing activation settings. No frontend source or cPanel package changed for this backend activation. Production frontend upload was not independently verified in this repair.
