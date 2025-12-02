const fs = require('fs');
const http = require('http');

const patterns = JSON.parse(fs.readFileSync('./data/pattern-templates.json', 'utf8'));

const postData = JSON.stringify({
  data: patterns,
  mode: 'add'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/admin/import/pattern-templates',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

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
