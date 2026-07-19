import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const port = '3012';
const env = {
  ...process.env,
  PORT: port,
  DISABLE_HMR: 'true',
  GEMINI_API_KEY: 'test-key',
  INVITE_CODES: 'alpha,beta',
  ACCESS_COOKIE_SECRET: 'test-secret-for-access-control',
};

const child = spawn(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'server.ts'],
  {
    cwd: process.cwd(),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

let output = '';
child.stdout.on('data', chunk => {
  output += chunk.toString();
});
child.stderr.on('data', chunk => {
  output += chunk.toString();
});

async function request(path, options = {}) {
  return fetch(`http://127.0.0.1:${port}${path}`, {
    redirect: 'manual',
    ...options,
  });
}

async function waitForServer(timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await request('/');
      if (response.status < 500) return;
    } catch {
      // Keep polling until the server is reachable.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not become reachable. Output:\n${output}`);
}

try {
  await waitForServer();

  const unauthorized = await request('/api/debug-env', {
    headers: {Accept: 'application/json'},
  });
  assert.equal(unauthorized.status, 401);

  const invalidInvite = await request('/?invite=wrong-code');
  assert.equal(invalidInvite.status, 401);

  const inviteResponse = await request('/?invite=alpha');
  assert.equal(inviteResponse.status, 302);
  assert.equal(inviteResponse.headers.get('location'), '/');

  const cookie = inviteResponse.headers.get('set-cookie');
  assert.match(cookie, /anquandian_access=/);
  assert.match(cookie, /HttpOnly/i);

  const authorized = await request('/api/debug-env', {
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
    },
  });
  assert.equal(authorized.status, 200);
  assert.deepEqual(await authorized.json(), {hasGeminiKey: true});
} finally {
  child.kill();
}
