module.exports = {
  apps: [
    {
      name: 'whitelist-api',
      script: './src/index.js',
      cwd: './backend',
      env: {
        NODE_ENV: 'production',
        PORT: 6001
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      error_file: '../logs/api-error.log',
      out_file: '../logs/api-out.log',
      log_file: '../logs/api-combined.log',
      time: true
    }
  ]
};