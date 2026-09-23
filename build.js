const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, 'dist');
if (!fs.existsSync(dist)) {
  fs.mkdirSync(dist, { recursive: true });
}

const files = ['index.html', 'styles.css', 'app.js', 'data_ifimed.js', 'ifimed-logo.jpg', 'xlsx.full.min.js'];

for (const file of files) {
  const src = path.join(__dirname, file);
  const dest = path.join(dist, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} -> dist/${file}`);
  } else {
    console.warn(`Warning: ${file} not found`);
  }
}

console.log('Static build ready in dist/');
