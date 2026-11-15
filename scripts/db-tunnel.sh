#!/bin/sh
# Opens an SSH tunnel: localhost:5432 -> Postgres container on the VPS (bound to 127.0.0.1:55432 there).
# Usage: SSH_KEY=~/.ssh/saturoom_vps_ed25519 scripts/db-tunnel.sh
KEY="${SSH_KEY:-$HOME/.ssh/saturoom_vps_ed25519}"
HOST="${DB_SSH_HOST:-root@202.10.36.167}"
if (exec 3<>/dev/tcp/127.0.0.1/5432) 2>/dev/null; then echo "Port 5432 already open (tunnel or local Postgres)."; exit 0; fi
exec ssh -f -N -i "$KEY" -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -o ServerAliveInterval=30 -L 127.0.0.1:5432:127.0.0.1:55432 "$HOST"
