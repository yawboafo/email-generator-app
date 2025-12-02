// Simple query using fetch to the already-running server
const http = require('http');

// Test if pattern elements are loaded by generating a test email
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/generate-emails',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const postData = JSON.stringify({
  firstName: 'John',
  lastName: 'Doe',
  providers: ['gmail.com'],
  count: 5,
  patterns: ['firstname.hobby', 'city.petname', 'adjective.thing']
});

console.log('Testing email generation with pattern elements...\n');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.emails && result.emails.length > 0) {
        console.log('✓ Pattern elements are working! Generated emails:');
        result.emails.slice(0, 5).forEach(email => {
          console.log(`  - ${email}`);
        });
        
        // Check if emails have proper pattern element substitution
        const hasNumbers = result.emails.some(e => /\d/.test(e.split('@')[0]));
        const hasWords = result.emails.some(e => e.split('@')[0].includes('.'));
        
        console.log('\n✓ Email patterns look good!');
        if (!hasNumbers && !hasWords) {
          console.warn('⚠ Warning: Emails may still be using fallback values');
        }
      } else {
        console.log('✗ No emails generated');
      }
    } catch (err) {
      console.error('Error parsing response:', err);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error.message);
  console.log('\n⚠ Make sure the server is running: railway run npm run dev');
});

req.write(postData);
req.end();
