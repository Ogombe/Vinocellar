#!/bin/bash
cd /home/z/my-project
while true; do
  ulimit -n 4096
  node --max-old-space-size=512 ./node_modules/.bin/next dev -p 3000 >> dev.log 2>&1
  echo "[$(date)] Server exited, restarting..." >> dev.log
  sleep 1
done
