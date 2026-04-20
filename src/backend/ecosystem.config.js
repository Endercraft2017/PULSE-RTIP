module.exports = {
  apps: [{
    name: 'pulse-rtip-api',
    script: 'server.js',
    cwd: '/opt/PULSE-RTIP/src/backend',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 50,
    min_uptime: '15s',
    restart_delay: 3000,
    max_memory_restart: '512M',
    kill_timeout: 5000,
    env: {
      NODE_ENV: 'production',
    },
    out_file: '/opt/PULSE-RTIP/server.log',
    error_file: '/opt/PULSE-RTIP/server.log',
    merge_logs: true,
    time: true,
  }],
};
