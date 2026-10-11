(function(root) {
  'use strict';
  // Upload progress is measured. FFmpeg preparation has no numeric progress, so
  // its indicator remains indeterminate rather than inventing a percentage.
  function transfer({url, file, onProgress = () => {}, createRequest = () => new XMLHttpRequest()}) {
    const request = createRequest();
    let stage = 'transferring', settled = false;
    const progress = (next, percent = null) => {stage = next; onProgress({stage, percent, cancellable:stage === 'transferring'});};
    let rejectPromise;
    const promise = new Promise((resolve, reject) => {
      rejectPromise = reject;
      request.open('POST', url);
      request.setRequestHeader('Content-Type', 'application/octet-stream');
      request.upload.addEventListener('progress', event => {
        if (!settled && stage === 'transferring') progress('transferring', event.lengthComputable ? Math.round(event.loaded / event.total * 100) : null);
      });
      request.upload.addEventListener('load', () => {if (!settled) progress('preparing');});
      request.addEventListener('load', () => {
        if (settled) return;
        settled = true;
        try {
          const result = JSON.parse(request.responseText);
          if (request.status < 200 || request.status >= 300 || !result.ok) throw new Error(result.error || 'Video preparation failed.');
          progress('ready'); resolve(result);
        } catch(error) {progress('failed'); reject(error);}
      });
      request.addEventListener('error', () => {
        if (settled) return; settled = true; progress('failed');
        reject(new Error('Connection interrupted. Keep the original and retry. If preparation completed, retry finds the existing clip.'));
      });
      request.addEventListener('abort', () => {
        if (settled) return; settled = true; progress('cancelled');
        reject(new Error('Transfer cancelled. Your original is unchanged.'));
      });
      progress('transferring'); request.send(file);
    });
    return {promise, cancel() {
      if (settled || stage !== 'transferring') return false;
      request.abort();
      // Test transports and unusual browsers may not dispatch abort synchronously.
      if (!settled) {settled = true; progress('cancelled'); rejectPromise(new Error('Transfer cancelled. Your original is unchanged.'));}
      return true;
    }, get stage() {return stage;}};
  }
  root.JOURNEY_ATLAS_VIDEO_IMPORT = {transfer};
})(typeof window === 'undefined' ? globalThis : window);
