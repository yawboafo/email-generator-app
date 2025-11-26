// Test AI Email Generator
const http = require('http');

function testAIGenerator(prompt, count = 15) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      prompt,
      count,
      providers: ['gmail.com', 'yahoo.com', 'outlook.com']
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/ai-generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          reject(new Error(`Parse error: ${body.substring(0, 100)}`));
        }
      });
    });

    req.on('error', (e) => reject(new Error(`Connection error: ${e.message}`)));
    req.write(data);
    req.end();
  });
}

async function runTests() {
  console.log('🧪 Testing AI Email Generator with CHAR_SETS Integration\n');
  console.log('═'.repeat(70));

  const tests = [
    { prompt: 'Generate emails for French bankers', label: '🇫🇷 French Bankers (Professional)' },
    { prompt: 'Create creative emails for young Japanese developers', label: '🇯🇵 Young Japanese Developers (Creative)' },
    { prompt: 'Make random complex emails for Nigerian lawyers', label: '🇳🇬 Nigerian Lawyers (Random/Complex)' },
    { prompt: 'Generate emails for American students', label: '🇺🇸 American Students (Young/Casual)' }
  ];

  for (const test of tests) {
    console.log(`\n\n📧 ${test.label}`);
    console.log(`   Prompt: "${test.prompt}"`);
    console.log('─'.repeat(70));

    try {
      const result = await testAIGenerator(test.prompt, 15);
      
      if (result.emails) {
        result.emails.forEach((email, i) => {
          console.log(`   ${(i + 1).toString().padStart(2, ' ')}. ${email}`);
        });
        
        console.log(`\n   ✅ Generated ${result.meta.count} unique emails`);
        console.log(`   📊 Patterns used: ${result.meta.patterns.join(', ')}`);
        
        if (result.contexts && result.contexts.length > 0) {
          console.log(`\n   💡 Sample context: ${result.contexts[0].persona}`);
        }
      } else if (result.error) {
        console.log(`   ❌ Error: ${result.error}`);
      }
    } catch (err) {
      console.log(`   ❌ Failed: ${err.message}`);
    }
  }

  console.log('\n\n' + '═'.repeat(70));
  console.log('✨ Test Complete! Notice the uniqueness features:');
  console.log('   • Leet speak variations (e→3, o→0, a→4, etc.)');
  console.log('   • Pronounceable random segments (ko, mira, tano)');
  console.log('   • Special characters strategically placed');
  console.log('   • Theme words for young users');
  console.log('   • Numbers with various intensities');
  console.log('═'.repeat(70) + '\n');
}

runTests().catch(console.error);
