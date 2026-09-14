(function (root) {
  'use strict';
  // One stream per tab, scoped to the local checkout. Browser storage is
  // synchronous so even a refresh before the debounce fires retains the edit.
  function create({workspaceId, storage, session, fetch, onStatus, delay = 600}) {
    const sessionKey = `atlas-studio-session:${workspaceId}`;
    let id = session.getItem(sessionKey);
    if (!id) { id = root.crypto.randomUUID(); session.setItem(sessionKey, id); }
    const key = `atlas-studio-draft:${workspaceId}:${id}`;
    let pending = null, timer = null, running = null, sequence = 0, storedSequence = -1, diskSequence = -1;
    const readLocal = () => { try { return JSON.parse(storage.getItem(key)); } catch { return null; } };
    sequence = readLocal()?.sequence || 0;
    async function flush() {
      clearTimeout(timer);
      if (running) return running;
      running = (async () => {
        while (pending) {
          const draft = pending;
          try {
            const response = await fetch(`/api/drafts/${id}`, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(draft)});
            const result = await response.json();
            if (!response.ok || !result.ok) throw new Error(result.error || 'Draft save failed');
            diskSequence = draft.sequence;
            if (pending === draft) {
              pending = null;
              onStatus(draft.dirty ? `Draft autosaved locally at ${new Date(result.draft.updatedAt).toLocaleTimeString()} · unpublished` : '', false);
            }
          } catch (error) {
            onStatus(`Local draft autosave failed: ${error.message}. Autosave will retry; keep this tab open.`, true);
            timer = setTimeout(flush, 5000);
            break;
          }
        }
      })();
      try { await running; } finally { running = null; }
    }
    function capture(snapshot) {
      pending = {...snapshot, schema:1, sequence:++sequence};
      try {
        storage.setItem(key, JSON.stringify(pending));
        storedSequence = sequence;
        onStatus(snapshot.dirty ? 'Draft kept in this browser · saving locally…' : '', false);
      } catch {
        onStatus('Browser draft storage is unavailable. Keep this tab open until local autosave succeeds.', true);
      }
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    }
    async function recover() {
      const local = readLocal();
      let remote;
      try { const response=await fetch(`/api/drafts/${id}`); if(response.ok) remote=(await response.json()).draft; } catch {}
      const draft = !remote || (local?.sequence || 0) >= remote.sequence ? local : remote;
      sequence = Math.max(sequence, draft?.sequence || 0);
      storedSequence = local?.sequence || -1; diskSequence = remote?.sequence || -1;
      return draft?.dirty ? draft : null;
    }
    return {capture, flush, recover, get id() {return id;}, get sequence() {return sequence;}, get safeToReload() {return storedSequence === sequence || diskSequence === sequence;}};
  }
  root.JOURNEY_ATLAS_STUDIO_RECOVERY = {create};
})(typeof window === 'undefined' ? globalThis : window);
