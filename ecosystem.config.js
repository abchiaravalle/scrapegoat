module.exports = {
  apps: [
    {
      name: 'scrapegoat-backend',
      script: './backend/server.js',
      cwd: './',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5173,
        HOST: '0.0.0.0', // Changed to 0.0.0.0 to allow external access if needed
      },
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      merge_logs: true,
      min_uptime: '10s',
      max_restarts: 10,
    },
    // Note: Frontend is served by backend in production mode
    // If you need to run frontend dev server separately, uncomment below:
    // {
    //   name: 'scrapegoat-frontend',
    //   script: 'npm',
    //   args: 'run dev',
    //   cwd: './frontend',
    //   instances: 1,
    //   exec_mode: 'fork',
    //   env: {
    //     NODE_ENV: 'development',
    //   },
    //   error_file: '../logs/frontend-error.log',
    //   out_file: '../logs/frontend-out.log',
    //   log_file: '../logs/frontend-combined.log',
    //   time: true,
    //   autorestart: true,
    //   watch: false,
    //   max_memory_restart: '500M',
    //   merge_logs: true,
    // },
  ],
};

