const fs = require('fs');
const http = require('http');

const patternsData = JSON.parse(fs.readFileSync('./data/patterns.json', 'utf8'));

// Convert to PatternElement format: [{type: 'petNames', value: 'luna'}, ...]
const patternElements = [];

for (const [type, values] of Object.entries(patternsData)) {
  values.forEach(value => {
    patternElements.push({ type, value });
  });
}

console.log(`Converting ${patternElements.length} pattern elements...`);

const postData = JSON.stringify({
  data: patternElements,
  mode: 'add'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/import/patterns',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Uploading to /api/admin/import/patterns...');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();
