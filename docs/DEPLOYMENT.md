# GitHub Pages deployment and recovery

Run `npm test` and `npm run build`, commit regenerated `dist/` output, fetch and
integrate the latest remote `main`, then push without force. The workflow builds
and validates the exact commit, checks `git diff --exit-code -- dist/`, uploads
that artifact, and deploys it. Verify both a successful Actions run and fresh
public HTML/assets before reporting delivery. Preserve unrelated local edits.

## Timed-out Pages deployments

On 10 September 2026, run
[34470003144](https://github.com/gravelcycles/travels/actions/runs/34470003144)
passed its build but spent ten minutes in `updating_pages`. The action timed out
and reported cancellation. Later runs failed with HTTP 400 because Pages still
held that release's deployment lock. The Pages status endpoint reported
`deployment_cancelled` while new requests still identified it as active.
This is separate from build failures and Node deprecation warnings.

`actions/deploy-pages@v4` caps its own timeout at ten minutes. Increasing the
job timeout alone cannot extend it. Keep `cancel-in-progress: false` so a new
push does not interrupt a live release.

The deploy job now keeps that concurrency lock while performing one bounded
recovery and retry. `scripts/recover-pages.mjs` inspects this workflow's latest
100 runs on the same branch, considers only older completed failed/cancelled/
timed-out runs plus the current failed attempt, and excludes SHAs belonging to
other live runs. Failures preceding a later successful release are ignored.
Missing Pages deployments (including HTTP 200 with an empty status), unknown
states, and successful or permanent-error statuses are skipped. Only an explicit
recoverable state permits cancellation. Orphaned or cancelled Pages jobs receive a cancellation
request, up to six status checks, and a 30-second settling delay. Cancellation
acknowledgement alone does not prove GitHub has released its backend lock.

The retry uses the same artifact and the official Pages action. It runs only
when recovery found something to clear. A failed retry gets current-release
cleanup; an explicit final check requires an actual successful deploy action.
API errors remain visible. The 25-minute job limit allows two ten-minute
attempts and cleanup; it does not change the action's timeout.

## If recovery still fails

1. Read the failed deploy log to identify the blocking SHA and verify the
   corresponding workflow has ended. Do not cancel a live release.
2. Inspect `GET /repos/gravelcycles/travels/pages/deployments/<blocking-sha>`.
   The [Pages API](https://docs.github.com/en/rest/pages/pages) accepts either
   the Pages deployment ID or its commit SHA; the numeric environment
   deployment ID is a different resource.
3. For that confirmed orphan, request
   `POST /repos/gravelcycles/travels/pages/deployments/<blocking-sha>/cancel`.
   Check the status and allow GitHub time to release the lock, even after 204
   or `deployment_cancelled`. The workflow does this automatically for recent
   runs; older orphans outside the 100-run window require this targeted check.
4. Fetch/integrate remote `main`. If the latest release's artifact is still
   current, rerun its failed jobs. If source changed, test/build and push the
   new release. Avoid repeatedly rerunning while the same backend lock persists.
5. If GitHub continues rejecting a cancelled deployment, check
   [GitHub Status](https://www.githubstatus.com/) and retain the failed run URL,
   blocking SHA and request ID for GitHub Support. Do not delete the Pages
   site or change its publishing source merely to clear a stale lock.

Recovery tests cover the observed cancelled-but-blocking state, a current
timeout, successful/live/newer releases, duplicate SHAs, missing deployments,
content/API failures, polling limits, and final cleanup scope.
