// This runs as a detached background process
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = '/home/z/my-project';
const logFile = path.join(cwd, 'dev.log');

// Clear log
try { fs.writeFileSync(logFile, ''); } catch(e) {}

function startServer() {
  const child = spawn('node', [
    '--max-old-space-size=512',
    './node_modules/.bin/next',
    'dev', '-p', '3000'
  ], {
    cwd,
    detached: false,
    stdio: ['ignore', fs.openSync(logFile, 'a'), fs.openSync(logFile, 'a')],
  });

  child.on('exit', (code, signal) => {
    const msg = `[${new Date().toISOString()}] Exit code=${code} signal=${signal}. Restarting...\n`;
    try { fs.appendFileSync(logFile, msg); } catch(e) {}
    setTimeout(startServer, 1500);
  });

  child.on('error', (err) => {
    const msg = `[${new Date().toISOString()}] Error: ${err.message}\n`;
    try { fs.appendFileSync(logFile, msg); } catch(e) {}
    setTimeout(startServer, 1500);
  });
}

startServer();