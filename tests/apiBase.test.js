import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeApiBase } from '../src/lib/apiBase.js';

test('API base defaults to the Vite /api proxy', () => {
  assert.equal(normalizeApiBase(undefined), '/api');
  assert.equal(normalizeApiBase('  '), '/api');
});

test('API base appends /api to a Render origin', () => {
  assert.equal(normalizeApiBase('https://atlas-api.onrender.com'), 'https://atlas-api.onrender.com/api');
  assert.equal(normalizeApiBase('https://atlas-api.onrender.com/'), 'https://atlas-api.onrender.com/api');
});

test('API base preserves a configured /api suffix', () => {
  assert.equal(normalizeApiBase('https://atlas-api.onrender.com/api/'), 'https://atlas-api.onrender.com/api');
  assert.equal(normalizeApiBase('/api'), '/api');
});
