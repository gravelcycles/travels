(function (root) {
  'use strict';
  const line = value => String(value ?? '').replace(/[\r\n\u0000-\u001f]/g, ' ');
  function handoff(report, acknowledged = new Set()) {
    const blockers = report.items.filter(item => item.severity === 'blocker');
    const pending = report.items.filter(item => item.severity === 'review' && !acknowledged.has(item.id));
    return [
      `Publishing handoff: ${line(report.journey.title)} (${report.journey.id})`,
      `Checked: ${report.checkedAt}`, `Assessment: ${report.assessmentRevision}`,
      `Current draft: ${report.revisions.draft}`, `Saved editorial sources: ${report.revisions.savedState}`, `Saved trip plan: ${report.revisions.savedPlan}`, `Saved route geometry and sources: ${report.revisions.savedRoutes}`,
      `Source state: ${report.draft.unsaved ? 'unsaved draft edits' : 'matches saved local sources'}${report.draft.sourceChanged ? '; baseline changed — reconcile before publishing' : ''}.`,
      `Public version: UNVERIFIED. ${report.public.message}`,
      `Outcome: ${blockers.length} blocker(s), ${pending.length} unacknowledged review item(s).${!blockers.length && !pending.length ? ' Ready for agent publishing review; this is not a deployment confirmation.' : ''}`,
      '', 'Items and choices:', ...report.items.map(item => `- [${item.severity === 'blocker' ? 'BLOCKER' : acknowledged.has(item.id) ? 'REVIEWED — keep as described' : 'REVIEW NEEDED'}] ${line(item.title)}. ${line(item.detail)} (${line(item.id)})`),
      '', 'Agent publication checklist:',
      '- Recheck these exact saved revisions; reconcile concurrent edits and resolve blockers. Reassess after any source change.',
      '- Review any local-draft promotion and confirm the intended media selection and access policy.',
      '- Publish pending protected photo/video derivatives with the existing publishers, then verify uploaded objects. Never commit originals or credentials.',
      '- Fetch and integrate the latest remote main while preserving concurrent work. Run npm test and npm run build; commit regenerated public output with sources.',
      '- Before Pages deployment, regenerate the community photo eligibility index, apply any required community database migrations and deploy the shared photo/community Worker with that index. Verify its service and eligibility checks before exposing new commentable photos.',
      '- Publish the reviewed commit without force-pushing. Verify the Pages deployment succeeds and check a fresh public journey and its media.',
      '- Report the deployed commit, deployment result and public URL. Until then the public version remains unverified.',
    ].join('\n');
  }
  function createSession({ getInput, request }) {
    let sequence = 0, fingerprint = null, report = null, acknowledged = new Set();
    const current = () => report && fingerprint === JSON.stringify(getInput());
    return {
      invalidate() { sequence++; fingerprint = null; report = null; acknowledged.clear(); },
      async check() {
        const serial = ++sequence, input = structuredClone(getInput()), before = JSON.stringify(input);
        const next = await request(input);
        if (serial !== sequence || before !== JSON.stringify(getInput())) return null;
        if (report?.assessmentRevision !== next.assessmentRevision) acknowledged.clear();
        report = next; fingerprint = before;
        return report;
      },
      get report() { return current() ? report : null; },
      get acknowledged() { return new Set(current() ? acknowledged : []); },
      acknowledge(id, value) {
        if (!current() || !report.items.some(item => item.id === id && item.severity === 'review')) return false;
        if (value) acknowledged.add(id); else acknowledged.delete(id);
        return true;
      },
      brief() { if (!current()) throw new Error('The draft changed. Check again before preparing a handoff.'); return handoff(report, acknowledged); },
    };
  }

  function create({ document, getInput, openEditor, fetch, clipboard }) {
    const $ = id => document.getElementById(id), dialog = $('ready-share-dialog'), status = $('ready-share-status');
    const session = createSession({ getInput, request: async input => {
      const response = await fetch('/api/readiness', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not check this draft.');
      return result.report;
    } });
    let busy = false;
    function clearBrief() { $('ready-share-brief').hidden = true; $('ready-share-text').value = ''; $('ready-share-copy').disabled = true; }
    function invalidate() {
      session.invalidate(); clearBrief(); $('ready-share-items').replaceChildren(); $('ready-share-sources').replaceChildren();
      $('ready-share-journey').textContent = getInput().changes.title || 'Current journey';
      $('ready-share-prepare').disabled = true;
      if (dialog.open) status.textContent = 'The draft or journey changed. Check again; earlier acknowledgements no longer apply.';
    }
    function render() {
      const report = session.report;
      if (!report) { invalidate(); return; }
      $('ready-share-journey').textContent = report.journey.title;
      const blockers = report.items.filter(item => item.severity === 'blocker').length;
      const pending = report.items.filter(item => item.severity === 'review' && !session.acknowledged.has(item.id)).length;
      status.textContent = blockers ? `${blockers} blocker${blockers === 1 ? '' : 's'} before publishing · ${pending} review item${pending === 1 ? '' : 's'} left` : pending ? `Local checks passed · ${pending} review item${pending === 1 ? '' : 's'} left` : 'Ready for agent publishing review · public version still unverified';
      const sources = $('ready-share-sources'); sources.replaceChildren();
      for (const [title, text] of [
        ['Current draft', report.draft.unsaved ? 'Includes edits not yet saved to sources.' : 'Matches the saved local sources.'],
        ['Saved sources', report.draft.sourceChanged ? 'Changed since this editor loaded. Save locally to reconcile.' : 'Compared with current files on disk.'],
        ['Public version', report.public.message],
      ]) { const box = document.createElement('div'), heading = document.createElement('strong'), copy = document.createElement('p'); heading.textContent = title; copy.textContent = text; box.append(heading, copy); sources.append(box); }
      const list = $('ready-share-items'); list.replaceChildren();
      for (const item of report.items) {
        const card = document.createElement('li'); card.dataset.severity = item.severity;
        const title = document.createElement('strong'); title.textContent = `${item.severity === 'blocker' ? 'Resolve' : 'Review'} · ${item.title}`;
        const detail = document.createElement('p'); detail.textContent = item.detail;
        const edit = document.createElement('button'); edit.type = 'button'; edit.textContent = item.action.label;
        edit.addEventListener('click', () => { dialog.close(); openEditor(item.action); }); card.append(title, detail, edit);
        if (item.severity === 'review') {
          const label = document.createElement('label'), check = document.createElement('input'); check.type = 'checkbox'; check.checked = session.acknowledged.has(item.id); check.id = `ready-ack-${item.id}`;
          check.addEventListener('change', () => { session.acknowledge(item.id, check.checked); clearBrief(); render(); $(check.id)?.focus(); });
          label.append(check, document.createTextNode('Reviewed — keep as described')); card.append(label);
        }
        list.append(card);
      }
      $('ready-share-prepare').disabled = false;
    }
    async function check() {
      if (busy) return null;
      busy = true; $('ready-share-check').disabled = true; $('ready-share-prepare').disabled = true; $('ready-share-copy').disabled = true;
      status.textContent = 'Checking the current draft, saved files and local assets…';
      try { const report = await session.check(); if (report) render(); else { invalidate(); status.textContent = 'The journey changed while checking. Check again.'; } return report; }
      catch (error) { invalidate(); status.textContent = `Check unavailable: ${error.message}`; return null; }
      finally { busy = false; $('ready-share-check').disabled = false; }
    }
    $('ready-to-share').addEventListener('click', () => { clearBrief(); dialog.showModal(); check(); });
    $('ready-share-close').addEventListener('click', () => dialog.close());
    $('ready-share-check').addEventListener('click', () => { clearBrief(); check(); });
    async function prepare() {
      clearBrief(); if (!await check()) return false;
      $('ready-share-text').value = session.brief(); $('ready-share-brief').hidden = false; $('ready-share-copy').disabled = false;
      return true;
    }
    $('ready-share-prepare').addEventListener('click', prepare);
    $('ready-share-copy').addEventListener('click', async () => {
      if (!await prepare()) return;
      try { if (!clipboard?.writeText) throw new Error('Clipboard unavailable'); await clipboard.writeText(session.brief()); status.textContent = 'Publishing handoff copied. Nothing was saved, uploaded or deployed.'; }
      catch { $('ready-share-text').focus(); $('ready-share-text').select(); status.textContent = 'Copy the selected handoff text. Automatic clipboard access is unavailable.'; }
    });
    return { invalidate };
  }
  root.JOURNEY_ATLAS_READINESS = { create, createSession, handoff };
})(typeof window === 'undefined' ? globalThis : window);
