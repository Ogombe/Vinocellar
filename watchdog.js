const { spawn } = require('child_process');
const path = require('path');

const cwd = '/home/z/my-project';
const logFile = path.join(cwd, 'dev.log');

const fs = require('fs');
// Clear log
fs.writeFileSync(logFile, '');

function startServer() {
  const child = spawn('node', [
    '--max-old-space-size=512',
    './node_modules/.bin/next',
    'dev', '-p', '3000'
  ], {
    cwd,
    stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
    env: { ...process.env, NODE_OPTIONS: '--max-old-space-size=512' }
  });

  child.on('exit', (code, signal) => {
    const msg = `\n[${new Date().toISOString()}] Server exited (code=${code}, signal=${signal}). Restarting in 2s...\n`;
    fs.appendFileSync(logFile, msg);
    setTimeout(startServer, 2000);
  });

  child.on('error', (err) => {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] Spawn error: ${err.message}\n`);
    setTimeout(startServer, 2000);
  });
}

console.log('Watchdog started');
startServer();