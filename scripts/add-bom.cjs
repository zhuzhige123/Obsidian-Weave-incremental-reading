const fs = require('fs');
const content = fs.readFileSync('scripts/sync-to-mobile.ps1', 'utf8');
if (!content.startsWith('\uFEFF')) {
  fs.writeFileSync('scripts/sync-to-mobile.ps1', '\uFEFF' + content, 'utf8');
  console.log('BOM added');
} else {
  console.log('BOM already exists');
}
