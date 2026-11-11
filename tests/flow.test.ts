import test from 'node:test';
import assert from 'node:assert/strict';
import { mutate, query } from '../shared/engine';
import type { Page, Content } from '../shared/model';
import { actor, event, fixture } from './fixtures';

test('etkinlik taslaktan yayımlanır, düzenleme onaya kadar gizli kalır ve arşiv yayından kaldırır', () => {
  const f = fixture();
  const saved = mutate(f.runtime, { action: 'content.save', fields: event, requestId: 'create-event-001' }, actor);
  const id = saved.ids[0];
  assert.equal(f.publication, null);
  assert.equal((query(f.runtime, 'contents') as Page<Content>).items[0].status, 'draft');
  mutate(f.runtime, { action: 'content.publish', id, version: 1, requestId: 'publish-event-001' }, actor);
  assert.equal(f.runtime.repository.readPublic()?.items[0].title, event.title);
  mutate(f.runtime, { action: 'content.save', id, version: 2, fields: { ...event, title: 'Yeni taslak başlık' }, requestId: 'edit-event-001' }, actor);
  assert.equal(f.runtime.repository.readPublic()?.items[0].title, event.title);
  mutate(f.runtime, { action: 'content.publish', id, version: 3, requestId: 'publish-event-002' }, actor);
  assert.equal(f.runtime.repository.readPublic()?.items[0].title, 'Yeni taslak başlık');
  mutate(f.runtime, { action: 'content.archive', id, version: 4, requestId: 'archive-event-001' }, actor);
  assert.equal(f.runtime.repository.readPublic()?.version, 3);
  assert.deepEqual(f.runtime.repository.readPublic()?.items, []);
});
