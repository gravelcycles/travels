// Used only after deploy-pages fails, while the workflow holds the pages lock.
// Actions completion and Pages cancellation are separate asynchronous states.
const recoverable = new Set([
  '', 'unknown_status', 'deployment_queued', 'deployment_in_progress',
  'updating_pages', 'deployment_attempt_error', 'deployment_cancelled', 'deployment_lost'
]);
const terminal = new Set([
  'succeed', 'deployment_cancelled', 'deployment_failed',
  'deployment_perms_error', 'deployment_content_failed', 'deployment_lost'
]);
const failedConclusions = new Set(['failure', 'cancelled', 'timed_out']);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function recoverPages({ github, context, log = console.log, sleep = pause, currentOnly = false }) {
  const repo = context.repo;
  const { data: current } = await github.rest.actions.getWorkflowRun({ ...repo, run_id: context.runId });
  const { data: { workflow_runs: runs } } = await github.rest.actions.listWorkflowRuns({
    ...repo, workflow_id: current.workflow_id, branch: current.head_branch, per_page: 100
  });
  // Never cancel another live run, including another attempt for the same SHA.
  const live = new Set(runs.filter(run => run.id !== current.id && run.status !== 'completed').map(run => run.head_sha));
  // Anything before a later successful release can no longer be its blocker.
  const lastSuccess = Math.max(0, ...runs.filter(run => run.status === 'completed' && run.conclusion === 'success' && run.run_number < current.run_number).map(run => run.run_number));
  const candidates = new Set([current.head_sha]);
  if (!currentOnly) for (const run of runs) {
    if (run.status === 'completed' && failedConclusions.has(run.conclusion) && run.run_number > lastSuccess && run.run_number < current.run_number) {
      candidates.add(run.head_sha);
    }
  }
  const getStatus = async sha => {
    try {
      const { data } = await github.request('GET /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}', {
        ...repo, pages_deployment_id: sha
      });
      return data.status;
    } catch (error) {
      if (error.status === 404) return null; // Build/create failures may have no Pages deployment.
      throw error; // Permissions and service failures must remain visible.
    }
  };
  let recovered = false;
  for (const sha of candidates) {
    if (live.has(sha)) {
      log(`Leaving Pages deployment ${sha} alone: another workflow run is active.`);
      continue;
    }
    const status = await getStatus(sha);
    if (!recoverable.has(status)) continue; // Includes successful releases and invalid artifacts.
    log(`Clearing Pages deployment ${sha} left by a failed attempt (${status || 'empty status'}).`);
    // Reissue cancellation even if Pages says cancelled: the backend lock can lag behind that status.
    await github.request('POST /repos/{owner}/{repo}/pages/deployments/{pages_deployment_id}/cancel', {
      ...repo, pages_deployment_id: sha
    });
    let settled = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const next = await getStatus(sha);
      if (next === null || terminal.has(next)) { settled = true; break; }
      await sleep(5000);
    }
    if (!settled) throw new Error(`Pages deployment ${sha} did not settle after cancellation; retry later when GitHub releases it.`);
    recovered = true;
  }
  if (recovered) {
    log('Waiting 30 seconds for GitHub Pages to release its deployment lock.');
    await sleep(30000);
  }
  return recovered;
}
