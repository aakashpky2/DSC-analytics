const fs = require('fs');
const b64 = fs.readFileSync('public/signsync-logo.png').toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="100%" height="100%">
  <image href="data:image/png;base64,${b64}" width="512" height="512" />
</svg>`;
fs.writeFileSync('public/next.svg', svg);
fs.writeFileSync('public/vercel.svg', svg);
console.log('Replaced next.svg and vercel.svg successfully');

