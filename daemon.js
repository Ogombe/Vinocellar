// Double-fork daemon to survive parent death
const { fork } = require('child_process');
const path = require('path');

// Fork once to detach from terminal
const child = fork(path.join(__dirname, 'watchdog-worker.js'), [], {
  detached: true,
  stdio: 'ignore',
  cwd: '/home/z/my-project'
});

child.unref();

console.log(`Daemon started with PID ${child.pid}`);