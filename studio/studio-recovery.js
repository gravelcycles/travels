(function (root) {
  'use strict';
  // One stream per tab, scoped to the local checkout. Browser storage is
  // synchronous so even a refresh before the debounce fires retains the edit.
  function create({workspaceId, storage, session, fetch, onStatus, delay = 600, locks = root.navigator?.locks}) {
    // The v2 key separates these streams from older tabs without ownership locks.
    const sessionKey = `atlas-studio-session-v2:${workspaceId}`;
    let sourceId, currentId;
    try { currentId = session.getItem(sessionKey); sourceId = currentId || session.getItem(`atlas-studio-session:${workspaceId}`); } catch {}
    let id = currentId || root.crypto.randomUUID(), ownership, sessionRemembered = Boolean(currentId);
    const keyFor = stream => `atlas-studio-draft:${workspaceId}:${stream}`;
    const remember = () => { try { session.setItem(sessionKey, id); sessionRemembered = true; } catch { sessionRemembered = false; } };
    // Without Web Locks a new stream per page is safer than trusting copied
    // sessionStorage (Duplicate Tab copies it, including the old tab's ID).
    if (!locks) { id = root.crypto.randomUUID(); sessionRemembered = false; }
    function ownStream() {
      if (!ownership) ownership = new Promise((resolve, reject) => {
        if (!locks) return resolve();
        function acquire() {
          locks.request(`atlas-studio:${workspaceId}:${id}`, {ifAvailable:true}, lock => {
            if (!lock) { id = root.crypto.randomUUID(); sessionRemembered = false; acquire(); return; }
            resolve();
            // The browser releases this lock when the document is destroyed.
            return new Promise(() => {});
          }).catch(reject);
        }
        acquire();
      });
      return ownership;
    }
    let pending = null, timer = null, running = null, sequence = 0, storedSequence = -1, diskSequence = -1;
    const readLocal = stream => {
      let value;
      try { value = storage.getItem(keyFor(stream)); } catch { return null; }
      return JSON.parse(value);
    };
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
            if (result.draft?.sequence !== draft.sequence) throw new Error('Draft acknowledgement does not match these edits');
            diskSequence = draft.sequence;
            remember();
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
      // Detach now, not at the delayed network write. Later mutations must not
      // silently change the content represented by an acknowledged sequence.
      pending = {...JSON.parse(JSON.stringify(snapshot)), schema:1, sequence:++sequence};
      try {
        storage.setItem(keyFor(id), JSON.stringify(pending));
        remember();
        storedSequence = sequence;
        onStatus(snapshot.dirty ? 'Draft kept in this browser · saving locally…' : '', false);
      } catch {
        onStatus('Browser draft storage is unavailable. Keep this tab open until local autosave succeeds.', true);
      }
      clearTimeout(timer);
      timer = setTimeout(flush, delay);
    }
    async function recover() {
      await ownStream();
      const recoveryId = sequence ? id : sourceId || id;
      let local, remote, localError;
      try { local = readLocal(recoveryId); } catch(error) { localError = error; }
      try {
        const response = await fetch(`/api/drafts/${recoveryId}`), result = await response.json();
        if (!response.ok || result.ok === false) throw new Error(result.error || 'Could not read the local draft');
        remote = result.draft;
      } catch(error) {
        if (!local) throw error; // Never clear a disk draft that we could not read.
      }
      if (localError && !remote) throw localError;
      const draft = !remote || (local?.sequence || 0) >= remote.sequence ? local : remote;
      sequence = Math.max(sequence, draft?.sequence || 0);
      storedSequence = recoveryId === id ? local?.sequence ?? -1 : -1;
      diskSequence = recoveryId === id ? remote?.sequence ?? -1 : -1;
      return draft?.dirty ? draft : null;
    }
    return {capture, flush, recover, get id() {return id;}, get sequence() {return sequence;}, get safeToReload() {return (sessionRemembered && storedSequence === sequence) || diskSequence === sequence;}};
  }
  root.JOURNEY_ATLAS_STUDIO_RECOVERY = {create};
})(typeof window === 'undefined' ? globalThis : window);
