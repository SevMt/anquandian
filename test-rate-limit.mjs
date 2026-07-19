import assert from 'node:assert/strict';
import {createRateLimit} from './src/utils/accessControl.ts';

const middleware = createRateLimit({windowMs: 60_000, maxRequests: 2});

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function runOnce() {
  const req = {path: '/api/test-limit', ip: '127.0.0.1', headers: {}};
  const res = createResponse();
  let nextCalled = false;
  middleware(req, res, () => {
    nextCalled = true;
  });
  return {res, nextCalled};
}

assert.equal((await runOnce()).nextCalled, true);
assert.equal((await runOnce()).nextCalled, true);

const limited = await runOnce();
assert.equal(limited.nextCalled, false);
assert.equal(limited.res.statusCode, 429);
assert.deepEqual(limited.res.body, {error: 'Too many requests, please try again later'});
