# Verification and known limits

Evidence date: 2026-09-30. JSON summaries are committed in `docs/verification/`.

| Verification | Result |
| --- | --- |
| TypeScript/Vite production build | Passed |
| Existing browser regressions | 18 passed: admin auth, import, create, pause/resume/stop/delete, routes, error recovery, mobile, CSRF/origin/UUID, password/session behavior |
| Connection checks | 9 passed, also after restart with real PHP OPcache enabled and timestamp validation disabled |
| Database lifecycle suite | 11 passed: final outcome completion, stale controls, restart rejection, first/repeat archive, audit preservation, request conflicts, retries, paused completion, in-flight reconciliation, draft behavior, repeat migration |
| Focused lifecycle browser suite | 3 passed: automatic Completed/no controls, lost delete response plus duplicate click protection, first delete with unknown outcome |
| Live Supabase lifecycle fixture | Passed inside rollback; no test data retained |
| Existing send worker definition | Unchanged comparison passed |
| Live n8n stale completed Stop | Execution 5903 returned success:true, status:completed |
| Public website artifact | index-D_uxLgXs.js referenced and compared with campaign-fix release |

`npm run test:lifecycle` is a portable in-memory PGlite SQL suite and never calls external services. Historic full browser suites ran against local PHP and a SQL-backed mocked upstream; their reports are saved here. Do not present them as live provider-delivery tests. Repeat the manual browser acceptance checklist after future deployments: sign in, Test Connection all three layers, list real data, create/import draft, authorized queue/control test, completion hides controls, archive first click, reload/direct routes, mobile and logo. Use local/rolled-back fixtures for destructive tests.

Before building, use the locked dependencies and a Node runtime accepted by Vite's declared engines. PHP is a separate runtime. No full production provider-delivery receipt was asserted during these repairs. Earlier provider acceptance is different from delivered/read confirmation. Metrics/settings such as WhatsApp session defaults are not proof of provider session health. Exact cPanel home/document-root/account identity is not stored here.

Public bundle verification does not validate the private operator session or all deployed PHP bytes. Credentials/gates and live counts can change. Record new evidence after future edits instead of treating this snapshot as evergreen.


Dependency audit on 2026-09-30 reported one existing high-severity advisory in xlsx 0.18.5, with no automatic npm fix. The Excel import dependency was retained to preserve the current behavior; review a supported replacement or patched distribution before expanding untrusted import usage. This audit finding is distinct from the passed lifecycle/build checks.
