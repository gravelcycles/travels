import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverPages } from '../scripts/recover-pages.mjs';

const run = (id, sha, status = 'completed', conclusion = 'failure') => ({
  id, head_sha: sha, status, conclusion, run_number: id, workflow_id: 7, head_branch: 'main'
});
function fixture({ runs = [], statuses = {}, cancelError, stayActive = false } = {}) {
  const current = run(10, 'current', 'in_progress', null);
  const cancelled = [], waits = [], reads = [];
  const github = {
    rest: { actions: {
      getWorkflowRun: async args => { assert.equal(args.run_id, 10); return { data: current }; },
      listWorkflowRuns: async args => {
        assert.equal(args.workflow_id, 7); assert.equal(args.branch, 'main'); assert.equal(args.per_page, 100);
        return { data: { workflow_runs: [current, ...runs] } };
      }
    } },
    request: async (route, args) => {
      assert.equal(args.owner, 'owner'); assert.equal(args.repo, 'atlas');
      const sha = args.pages_deployment_id;
      if (route.startsWith('POST ')) {
        assert.ok(route.endsWith('/cancel'));
        if (cancelError) throw cancelError;
        cancelled.push(sha);
        return { status: 204 };
      }
      reads.push(sha);
      if (cancelled.includes(sha) && !stayActive) return { data: { status: 'deployment_cancelled' } };
      if (statuses[sha] instanceof Error) throw statuses[sha];
      if (!(sha in statuses)) throw Object.assign(new Error('not found'), { status: 404 });
      return { data: { status: statuses[sha] } };
    }
  };
  return { cancelled, waits, reads, options: {
    github, context: { repo: { owner: 'owner', repo: 'atlas' }, runId: 10 },
    sleep: async ms => { waits.push(ms); }, log: () => {}
  } };
}

test('recovers the orphan that blocked later releases even when Pages already reports cancelled', async () => {
  const f = fixture({ runs: [run(9, 'blocked'), run(8, 'orphan')], statuses: { orphan: 'deployment_cancelled' } });
  assert.equal(await recoverPages(f.options), true);
  assert.deepEqual(f.cancelled, ['orphan']);
  assert.deepEqual(f.waits, [30000]);
});

test('cleans up the current timed-out deployment before retrying', async () => {
  const f = fixture({ statuses: { current: 'updating_pages' } });
  assert.equal(await recoverPages(f.options), true);
  assert.deepEqual(f.cancelled, ['current']);
});

test('leaves successful, live and newer releases alone and deduplicates failed SHAs', async () => {
  const f = fixture({ runs: [
    run(9, 'success'), run(8, 'active'), run(7, 'active', 'in_progress', null),
    run(11, 'newer'), run(6, 'orphan'), run(5, 'orphan')
  ], statuses: { success: 'succeed', active: 'updating_pages', newer: 'updating_pages', orphan: 'deployment_queued' } });
  assert.equal(await recoverPages(f.options), true);
  assert.deepEqual(f.cancelled, ['orphan']);
  assert.ok(!f.reads.includes('active')); assert.ok(!f.reads.includes('newer'));
});

test('does not cancel the current SHA if another run for it is queued', async () => {
  const f = fixture({ runs: [run(11, 'current', 'queued', null)], statuses: { current: 'updating_pages' } });
  assert.equal(await recoverPages(f.options), false);
  assert.deepEqual(f.cancelled, []);
});

test('missing deployments and permanent content errors do not trigger a retry', async () => {
  const f = fixture({ runs: [run(9, 'bad-artifact')], statuses: { 'bad-artifact': 'deployment_content_failed' } });
  assert.equal(await recoverPages(f.options), false);
  assert.deepEqual(f.cancelled, []); assert.deepEqual(f.waits, []);
});

test('an empty HTTP 200 status is not evidence of a deployment to cancel', async () => {
  const f = fixture({ runs: [run(9, 'missing')], statuses: { current: '', missing: '' } });
  assert.equal(await recoverPages(f.options), false);
  assert.deepEqual(f.cancelled, []); assert.deepEqual(f.waits, []);
});

test('API permission and cancellation failures stay visible', async () => {
  const denied = Object.assign(new Error('forbidden'), { status: 403 });
  const read = fixture({ statuses: { current: denied } });
  await assert.rejects(recoverPages(read.options), /forbidden/);
  const cancel = fixture({ statuses: { current: 'updating_pages' }, cancelError: denied });
  await assert.rejects(recoverPages(cancel.options), /forbidden/);
});

test('stops after bounded polling if cancellation never settles', async () => {
  const f = fixture({ statuses: { current: 'updating_pages' }, stayActive: true });
  await assert.rejects(recoverPages(f.options), /did not settle/);
  assert.deepEqual(f.waits, Array(6).fill(5000));
});

test('final cleanup is limited to this release', async () => {
  const f = fixture({ runs: [run(9, 'orphan')], statuses: { current: 'updating_pages', orphan: 'updating_pages' } });
  await recoverPages({ ...f.options, currentOnly: true });
  assert.deepEqual(f.cancelled, ['current']);
});

test('does not revisit historical cancellations preceding the last successful release', async () => {
  const f = fixture({ runs: [run(9, 'success', 'completed', 'success'), run(8, 'old')], statuses: { old: 'deployment_cancelled' } });
  assert.equal(await recoverPages(f.options), false);
  assert.ok(!f.reads.includes('old'));
});
