# Research Studio — website and YouTube audit readiness

Reviewed: 20 November 2026. Application baseline: `a5cc6daf31fe7fb5f96140c45b8efa6412700676` (`main`). Website-only scope: `docs/` and this checklist; no backend, frontend, schema, database or existing tests changed.

This is an evidence checklist, not a certification. Website publication alone does not establish YouTube API compliance. A checked implementation item means source evidence exists, not that YouTube has approved it.

## Implemented in the application — source evidence

- [x] Public YouTube Data API v3 client using the user's API key: `backend/app/clients/youtube_client.py` (`call_youtube_api`, video/channel parsers). No OAuth/account authorization flow found in `backend/app/` or `frontend/src/`.
- [x] Actual screens and API wiring for global trends/search, projects, competitors/uploads, project keywords, RSS, ideas and details: `frontend/src/App.tsx`, `frontend/src/screens/`, `frontend/src/state/PrototypeWorkspaceContext.tsx`, `frontend/src/api/client.ts`, `backend/app/routers/`. The provider's legacy “Prototype” name does not establish that its requests are fake; requests are wired to local API functions. Marketing avoids claiming live-service execution was tested.
- [x] Current Standard Mode uses raw metrics and manual research labels; no VPH/outlier multiplier implementation found. `backend/app/repositories/youtube_repo.py` and `frontend/src/components/SparklineCell.tsx`.
- [x] SQLite local storage and loopback binding: `backend/app/core/config.py`, `backend/app/db/connection.py`, `backend/app/main.py`.
- [x] Current-Windows-user DPAPI key storage and removal: `backend/app/core/security.py`, `backend/app/repositories/settings_repo.py`, `backend/app/routers/system.py`.
- [x] Legal consent required before key storage/use; revocation available but separate from key removal and deletion: `settings_repo.set_legal_consent`, `save_youtube_api_key`, `get_decrypted_youtube_api_key`; Settings UI in `DetailAndSystemScreens.tsx`.
- [x] 30-day expiry timestamps, read filtering, startup/hourly runtime cleanup and explicit cache purge: `youtube_repo.py`, `retention_service.py`, `scheduler_service.py`.
- [x] User-requested cache purge clears live API metadata/snapshots/search sessions, source-title snapshots, and DB copies inside the active `backups/`; preserves user research and key/consent. `purge_all_youtube_api_data_by_user_request`.
- [x] Regular manual/automatic backups sanitize API key and transient YouTube cache and compact the copy: `storage_service.create_user_backup`. Does not establish all backup paths are sanitized.
- [x] Project JSON export and confirmed deletion with recovery JSON: `project_repo.build_project_export_payload`, `delete_project_safely`.
- [x] RSS/Atom network client and 60-day cleanup for unprotected articles: `rss_client.py`, `rss_service.py`, `scheduler_service._purge_stale_unlinked_rss_articles`.
- [x] No developer telemetry/cloud research upload implementation found. Direct external thumbnail rendering exists in `VideoResearchTable.tsx`; do not claim all external communication passes through the backend.

## Website requirements

- [x] Four static English pages: `docs/index.html`, `privacy.html`, `terms.html`, `contact.html`.
- [x] Warm VOXLAB-inspired palette, editorial typography, semantic landmarks, skip link, keyboard focus, mobile media queries, reduced-motion handling.
- [x] Only local CSS/favicon; no JavaScript, forms, advertising, analytics, third-party fonts, fake screenshots, fabricated metrics or inert buttons.
- [x] Relative navigation/assets suitable for `/Research-Studio/`; privacy and terms links on every page; `.nojekyll` for buildless Pages hosting.
- [x] Verified current features distinguished from proposed AI, Google Trends, cross-topic intelligence and advanced analytics.
- [x] Explicit API attribution, YouTube terms applicability, independence statement and no approval claim.
- [x] Privacy explains OAuth absence, DPAPI scope, external connections, storage, runtime-only expiry, RSS, backups, copied-title limitation, deletion and revocation.
- [x] Owner supplied public email `lucpro911@gmail.com` in this chat. Public contact configuration is marked `PUBLIC_CONTACT_EMAIL` in `docs/contact.html`. It is a real owner-provided address, not a placeholder. Update all addresses/mailto links together if it changes.
- [x] Effective date and policy update procedure provided. Prior policy versions remain in Git history.
- [x] Local validation: four pages parsed without HTML5 errors; CSS rules/declarations parsed without syntax errors; all internal files and fragment targets resolve; six served HTML/assets returned HTTP 200 with exact byte matches. No sensitive-file or credential-pattern findings in `docs/`.
- [x] Chrome checks: all four pages at 320, 390, 768 and 1440 CSS pixels; no horizontal overflow, console warnings/errors or third-party resource loads; navigation and feature-anchor clicks passed. Desktop homepage, mobile homepage and privacy layout visually inspected. This is not a complete accessibility certification or W3C conformance audit.
- [x] Existing backend verification: 63 tests executed, 62 passed, one failure in `test_scheduler_and_ttl.SchedulerAndTtlTests.test_controlled_auto_refresh_priorities_caps_zero_search_and_clean_shutdown`, assertion `ideaVideosRenewed` expected 1, received 0. Backend and tests remain byte-for-byte unchanged from the baseline. No failure suppressed or fixed in this website task. Python compilation and isolated dependency integrity passed. No app frontend build was run because app frontend source/dependencies were not changed.
- [ ] Record final deployment evidence in the delivery report; do not infer publication from source being present.

## Desktop-app gaps requiring remediation or audit confirmation

1. **Full-copy backup retention:** `db/migrator.py:create_sqlite_backup` copies the DB before schema upgrades and prunes by count, not age. `storage_service.py`'s `copy_overwrite` branch writes a full target DB safety copy in `user_backups/`. Scheduled TTL cleanup only handles the active DB. Establish a complete deletion/refresh process for API data in these copies; evaluate encrypted key copies too. A manual cache purge removes DB files only in the active `backups/`, not every historical or external location.
2. **Copied YouTube titles:** `VideoResearchTable.tsx` and `Modals.tsx` prefill editable idea `title` with the API video title. Cache purge clears `source_title_snapshot` but leaves `ideas.title`. That value can persist into regular backups, project exports and recovery JSON. Do not treat copying an API field into an editable user record as automatically exempting it from API-data requirements. Resolve provenance/retention handling and add targeted verification in a separately authorized app task.
3. **Closed-app expiry:** physical cleanup occurs only at startup/hourly while the backend is running. Read filters hide expired metadata, but they do not delete stale files while closed. Document the operating limitation and resolve whether the lifecycle satisfies the audit's deletion expectations.
4. **Policy access/consent in the app:** the existing legal modal links YouTube Terms and Google Privacy, not this new full Research Studio policy. Verify all-times access to the app's own policy and acceptance before applicable functionality; consider policy-version tracking and re-consent on material changes. Website work deliberately does not alter the desktop app.
5. **Deletion across copies:** there is no single erase-all UI. Verify removal of user work from recovery JSON, exported files, relocated roots, migration backups, external backups and any synchronization copies. Clarify expected timing and support procedure; current public policy gives manual cleanup instructions and does not promise remote deletion.
6. **Attribution and derived-data boundaries:** audit actual UI attribution/branding, raw snapshot presentation, format hints/classification, RSS cross-reference displays, cross-channel summaries/counts, and locally calculated quota costs against current policy. “Standard Mode” is not an official compliance certification. Do not assume a formula is allowed merely because it is deterministic or already implemented.
7. **Credential model and updates:** ask YouTube to confirm suitability of user-supplied keys for distribution and the actual Cloud project/API client identity. Verify credential restrictions, local threat model, maintenance/update mechanism, and the intended distribution route. No packaged installer or remote updater is claimed here.

## Additional audit evidence to collect

- [ ] Owner confirms maintainer identification and monitors the public mailbox; confirms actual distribution/version, supported Windows environment, service providers and absence of undocumented remote services.
- [ ] Identify the actual Google Cloud project number, API client, credential ownership, scope and request/audit IDs privately. Never publish keys or credentials in `docs/`.
- [ ] Supply a real app recording/screenshots showing consent, key entry/removal, data source attribution, searches, competitor refresh, idea creation, timestamps, cache purge and error/quota handling. Redact credentials and personal data.
- [ ] Supply reproducible retention/deletion evidence covering all backup and export paths and prefills. Test consent revocation separately from deletion and key invalidation.
- [ ] Demonstrate live external API behavior with authorized test credentials; unit tests use controlled inputs and do not establish live access.
- [ ] Document proposed formulas, source fields, time intervals, minimum sample requirements, channel ownership boundaries, purpose, UI labels and proposed retention for advanced analytics, without enabling them.
- [ ] Confirm current YouTube branding and API policy requirements in the client, not only on this website.
- [ ] Verify public website HTTP success, HTTPS, correct content and all page URLs after deployment; record deployment commit and date.

## Approvals still pending

- [ ] YouTube compliance audit outcome / approved scope.
- [ ] Any explicit permission needed for VPH, recent VPH from timestamped snapshots, outlier analysis, channel-relative comparisons and custom content research scores.
- [ ] Any change to the default 30-day API-data retention; no extension is claimed approved.
- [ ] Separate authorization and implementation review for desktop-app fixes; this task does not change core functionality.

## Authoritative references checked on 20 November 2026

- [YouTube Terms of Service](https://www.youtube.com/t/terms)
- [YouTube API Developer Policies](https://developers.google.com/youtube/terms/developer-policies), especially III.A (privacy/terms), III.E.2 (aggregation), III.E.4 (retention/deletion/derived metrics). Non-authorized statistics must not be retained beyond 30 days; the website does not rely on authorized-data exceptions.
- [Google Privacy Policy](https://policies.google.com/privacy)
- [Google Security Permissions](https://security.google.com/settings/security/permissions) redirects to Google sign-in/account permissions; account-specific content was not inspected.
- [GitHub General Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement)

## GitHub Pages setup / maintenance

Target: `main` → `/docs`. Expected address (not a publication claim): `https://lucnguyen911.github.io/Research-Studio/`.

If manual setup is required: **Repository → Settings → Pages → Build and deployment → Deploy from a branch → main → /docs → Save**. Enable **Enforce HTTPS** when available. Only `docs/` is the Pages publication source; keep DBs, credentials, backups, logs and internal task documents outside it.

Edit the HTML/CSS directly; no build tools or runtime dependencies are needed for the website. Change the effective date when policy behavior changes, recheck all privacy claims against source, and update all email links consistently. An owner-supplied public email is configured; no email deployment blocker remains.
