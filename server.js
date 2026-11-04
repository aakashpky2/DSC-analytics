// Unified Server Entry Point
// Always uses the compiled TypeScript server output for fast, reliable execution.
const path = require('path');
const fs = require('fs');

const compiledServerPath = path.resolve(__dirname, 'dist-server/server/index.js');

if (!fs.existsSync(compiledServerPath)) {
  console.log('> dist-server not found. Building server with tsc...');
  const { execSync } = require('child_process');
  execSync('npm run build:server', { stdio: 'inherit' });
}

require(compiledServerPath);
