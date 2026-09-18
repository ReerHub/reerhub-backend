import assert from 'node:assert/strict';
import test from 'node:test';

import { resolveQueueName } from '../src/config/queue.js';

test('queue name defaults and honors QUEUE_NAME override', () => {
  assert.equal(resolveQueueName({}), 'reerhub-sync');
  assert.equal(
    resolveQueueName({ QUEUE_NAME: 'reerhub-sync-staging' }),
    'reerhub-sync-staging'
  );
  assert.equal(resolveQueueName({ QUEUE_NAME: '' }), 'reerhub-sync');
});
