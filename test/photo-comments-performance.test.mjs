import test from 'node:test';
import assert from 'node:assert/strict';
import { commentsFixture, comments } from './photo-comments-performance-harness.mjs';

test('unopened comments and unchanged closes do not write drafts; typed and cleared drafts persist', async () => {
  const f = commentsFixture(); f.resetCounts();
  for (const photo of f.photos.slice(1)) f.controller.photoChanged(photo);
  assert.equal(f.counts.writes, 0); assert.deepEqual(f.saved(), {});
  await f.controller.open(); f.resetCounts();
  f.node('#comment-body').value = 'Keep this'; await f.node('#comment-body').fire('input');
  assert.equal(f.counts.writes, 1);
  await f.node('#close-comments').fire('click');
  assert.equal(f.counts.writes, 1, 'Closing does not repeat a confirmed input save');
  f.controller.photoChanged(f.photos[0]); f.controller.photoChanged(f.photos[3]);
  assert.equal(f.node('#comment-body').value, 'Keep this');
  await f.controller.open(); f.node('#comment-body').value = ''; await f.node('#comment-body').fire('input');
  assert.equal(Object.hasOwn(f.saved(), 'photo-comment:d'), false);
  assert.equal(f.counts.writes, 2, 'Clearing removes the saved draft exactly once');
});

test('failed draft writes remain honest and retry until confirmed without losing local text', async () => {
  const f = commentsFixture({initialDrafts: {'photo-comment:a': 'Saved earlier'}});
  await f.controller.open(); f.resetCounts(); f.fail();
  f.node('#comment-body').value = 'New local text'; await f.node('#comment-body').fire('input');
  assert.equal(f.saved()['photo-comment:a'], 'Saved earlier');
  assert.equal(f.node('#comment-draft-state').textContent, 'Draft kept on this page');
  f.controller.photoChanged(f.photos[1]); f.controller.photoChanged(f.photos[0]);
  assert.equal(f.node('#comment-body').value, 'New local text');
  f.fail(false); await f.node('#comment-body').fire('input');
  assert.equal(f.saved()['photo-comment:a'], 'New local text');
  assert.equal(f.node('#comment-draft-state').textContent, 'Draft saved');
  const writes = f.counts.writes; await f.node('#close-comments').fire('click');
  assert.equal(f.counts.writes, writes);
});

test('a failed draft clear keeps the local composer empty and retries the persisted deletion', async () => {
  const f = commentsFixture({initialDrafts: {'photo-comment:a': 'Old saved draft'}});
  await f.controller.open(); f.fail(); f.node('#comment-body').value = '';
  await f.node('#comment-body').fire('input');
  assert.equal(f.saved()['photo-comment:a'], 'Old saved draft');
  f.controller.photoChanged(f.photos[1]); f.controller.photoChanged(f.photos[0]);
  assert.equal(f.node('#comment-body').value, '');
  f.fail(false); await f.node('#close-comments').fire('click');
  assert.equal(Object.hasOwn(f.saved(), 'photo-comment:a'), false);
});

test('cached refresh and reopen retain row nodes, scroll and disclosures; only changed rows rebuild', async () => {
  const rows = comments(50), f = commentsFixture({initialRows: rows});
  await f.controller.open(); const list = f.node('#comments-list'), original = [...list.children];
  original[1].disclosure = true; f.node('#comments-thread').scrollTop = 310; f.resetCounts();
  await f.node('#close-comments').fire('click'); await f.controller.open();
  assert.deepEqual(list.children, original); assert.equal(f.counts.rowBuilds, 0); assert.equal(f.counts.listReplacements, 0);
  assert.equal(original[1].disclosure, true); assert.equal(f.node('#comments-thread').scrollTop, 310);
  f.rows([...rows.map(row => row.id === 'row-3' ? {...row, body: 'Edited'} : row), {...rows[2], id: 'new-row'}]);
  await f.controller.open();
  assert.equal(f.counts.rowBuilds, 2); assert.equal(list.children[1], original[1]); assert.notEqual(list.children[3], original[3]);
  assert.equal(list.children.length, 51); assert.equal(f.node('#comments-thread').scrollTop, 310);
});

test('a live edit remains mounted through unrelated refresh and pagination; lock discards private rows', async () => {
  const rows = comments(3), f = commentsFixture({initialRows: rows}); await f.controller.open();
  await f.node('#comments-list').fire('click', {target: {closest: selector => selector === '[data-edit-comment]' ? {dataset: {editComment: 'row-0'}} : null}});
  const editorRow = f.node('#comments-list').children[0], field = f.node('#comment-edit-body');
  field.value = 'Still writing'; field.selectionStart = 4; field.selectionEnd = 9;
  await f.node('#comments-list').fire('input', {target: {id: 'comment-edit-body', value: field.value}});
  field.disabled = true;
  f.rows([...rows.map(row => row.id === 'row-2' ? {...row, body: 'Another update'} : row), {...rows[1], id: 'row-new'}]);
  await f.controller.open();
  assert.equal(f.node('#comments-list').children[0], editorRow); assert.equal(field.value, 'Still writing');
  assert.equal(field.selectionStart, 4); assert.equal(field.selectionEnd, 9); assert.equal(field.disabled, true);
  assert.equal(f.saved()['comment-edit:row-0'], 'Still writing');
  f.emit('atlas-photos-locked'); assert.equal(f.node('#comments-list').children.length, 0);
  assert.equal(editorRow.isConnected, false);
  await f.controller.open(); assert.notEqual(f.node('#comments-list').children[0], editorRow);
});

test('row removal and reordering preserve survivors while ownership changes rebuild controls', async () => {
  const rows = comments(4), f = commentsFixture({initialRows: rows}); await f.controller.open();
  const list = f.node('#comments-list'), original = [...list.children]; f.resetCounts();
  f.rows([rows[3], rows[0], rows[1]]); await f.controller.open();
  assert.deepEqual(list.children, [original[3], original[0], original[1]]);
  assert.equal(original[2].isConnected, false); assert.equal(f.counts.rowBuilds, 0);
  f.visitor({id: 'other', name: 'Sam'}); await f.controller.open();
  assert.equal(list.children[0].className, 'photo-comment is-own');
  assert.equal(list.children[1].className, 'photo-comment');
  assert.equal(f.counts.rowBuilds, 3);
  assert.match(list.children[0].innerHTML, /data-edit-comment="row-3"/);
  assert.doesNotMatch(list.children[1].innerHTML, /data-edit-comment/);
  f.rows([]); await f.controller.open();
  assert.equal(list.children.length, 0); assert.match(list.innerHTML, /No comments yet/);
});

test('empty loading, failure, retry and first result remain visible with only necessary replacements', async () => {
  const f = commentsFixture({loaded: false}); f.defer(); f.resetCounts();
  const opening = f.controller.open();
  assert.match(f.node('#comments-list').innerHTML, /Loading comments/);
  assert.equal(f.counts.listReplacements, 1, 'Duplicate synchronous renders share the loading state');
  f.pending.shift().reject(new Error('Offline')); await opening;
  assert.match(f.node('#comments-list').innerHTML, /Comments unavailable/);
  assert.equal(f.node('#comments-retry').hidden, false);
  const retry = f.node('#comments-retry').fire('click');
  assert.match(f.node('#comments-list').innerHTML, /Loading comments/);
  f.pending.shift().resolve(comments(1)); await retry;
  assert.equal(f.node('#comments-list').children.length, 1);
  assert.equal(f.node('#comments-list')['aria-busy'], 'false');
  assert.equal(f.node('#comments-retry').hidden, true);
});
