// Hostinger entry point: runs the compiled server in production or ts-node in development
if (process.env.NODE_ENV === 'production') {
  require('./dist-server/server/index.js');
} else {
  require('ts-node/register');
  require('./src/server/index.ts');
}
