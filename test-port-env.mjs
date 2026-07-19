import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';

const port = '3011';
const child = spawn(
  process.execPath,
  ['node_modules/tsx/dist/cli.mjs', 'server.ts'],
  {
    cwd: process.cwd(),
    env: {...process.env, PORT: port, DISABLE_HMR: 'true', INVITE_CODES: '', ACCESS_COOKIE_SECRET: ''},
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

async function waitForServer(url, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {headers: {Accept: 'application/json'}});
      if (response.ok) return response;
    } catch {
      // Keep polling until the server is ready or the timeout expires.
    }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Server did not respond on ${url}. Output:\n${output}`);
}

try {
  const response = await waitForServer(`http://127.0.0.1:${port}/api/debug-env`);
  const body = await response.json();
  assert.equal(body.hasGeminiKey, true);
} finally {
  child.kill();
}
