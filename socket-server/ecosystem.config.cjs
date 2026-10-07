// pm2 process definition for the auction socket relay.
//
// instances MUST stay 1: the relay keeps the room in one process's memory, so
// a second instance would hold a second set of sockets and bids broadcast by
// one would never reach clients on the other. Add the Socket.IO Redis adapter
// before raising this.
module.exports = {
  apps: [
    {
      name: 'voicestack-socket',
      cwd: '/home/ubuntu/voicestack-socket',
      script: 'dist/index.js',
      node_args: '--env-file=/home/ubuntu/voicestack-socket/.env',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 20,
      env: { NODE_ENV: 'production' },
      out_file: '/home/ubuntu/.pm2/logs/voicestack-socket-out.log',
      error_file: '/home/ubuntu/.pm2/logs/voicestack-socket-error.log',
      merge_logs: true,
      time: true,
    },
  ],
};
