import {spawn} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const projectDir = path.dirname(fileURLToPath(import.meta.url));
const out = fs.openSync(path.join(projectDir, 'dev-server.log'), 'a');
const err = fs.openSync(path.join(projectDir, 'dev-server.err.log'), 'a');
const child = spawn(process.execPath, ['dist/server.cjs'], {
  cwd: projectDir,
  detached: true,
  env: {...process.env, NODE_ENV: 'production'},
  stdio: ['ignore', out, err],
  windowsHide: true,
});

child.unref();
console.log(`Started local server with PID ${child.pid}`);
