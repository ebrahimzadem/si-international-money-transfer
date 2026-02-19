const fs = require('fs');
const path = require('path');

// Try both possible locations
const paths = [
  path.join(__dirname, 'dist', 'main.js'),
  path.join(__dirname, 'dist', 'src', 'main.js')
];

for (const mainPath of paths) {
  if (fs.existsSync(mainPath)) {
    console.log(`Starting from: ${mainPath}`);
    require(mainPath);
    return;
  }
}

console.error('Could not find main.js in dist/ or dist/src/');
process.exit(1);
