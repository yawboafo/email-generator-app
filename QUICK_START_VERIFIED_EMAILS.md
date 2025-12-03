# Quick Start: Generate Verified Emails Only

## 🚀 How to Use

### Step 1: Access the Feature

1. Open your Email Management Platform
2. You'll see three generator mode buttons at the top:
   - **Standard** (default black button)
   - **Verified Only** (green button with PRO badge) ← Click this
   - **AI Powered** (purple button with NEW badge)

### Step 2: Configure Settings

Once in Verified Only mode, you'll see a green-themed form with the following options:

#### Required Settings

1. **Target Number of Valid Emails**
   - Enter how many verified emails you need (1-1000)
   - Example: `100`

2. **Email Providers**
   - Click to expand the providers section
   - Select one or more email domains (gmail.com, yahoo.com, etc.)
   - Use "Select All" for maximum variety

#### Optional Settings (Advanced)

3. **Batch Size**
   - Default: 50 emails per batch
   - Higher = faster (but more API calls)
   - Lower = slower (but fewer API calls)

4. **Demographics**
   - Country/Region: Select target country
   - Age Range: Select age group (18-25, 26-35, etc.)
   - Gender: Any, Male, Female, or Neutral

5. **Name Pattern**
   - Choose email format (firstname.lastname, etc.)

### Step 3: Generate

Click the big green button: **✅ Generate Verified Emails**

### Step 4: Watch Progress

You'll see real-time updates:

```
Valid Emails Collected: 45 / 100   ███████░░░  45%
Time: 1:23

┌─────────────┬─────────────┬─────────────┐
│ Generated   │ Verified    │ Valid ✓     │
│    150      │    150      │    45       │
├─────────────┼─────────────┼─────────────┤
│ Invalid ✗   │ Risky ⚠     │ Unknown ?   │
│    85       │    15       │    5        │
└─────────────┴─────────────┴─────────────┘
```

### Step 5: Get Results

When complete:
- All generated emails appear in the Results panel on the right
- Only VALID emails are included
- You can:
  - Copy all emails to clipboard
  - Save the batch for later use
  - Export to CSV
  - Send to recipients

## 💡 Tips for Best Results

### For Fast Generation
- Increase batch size to 100-150
- Use popular providers (gmail.com, yahoo.com)
- Select simple patterns (firstname.lastname)

### For High Quality
- Stick with well-known providers
- Use realistic parameters
- Allow numbers for more variety

### For Cost Efficiency
- Start with smaller targets (10-50) to test
- Monitor invalid rate and adjust parameters
- Use caching benefit on repeated generations

## 📊 Understanding the Progress Display

### Color Codes
- **Blue** = Generated (total emails created)
- **Purple** = Verified (total emails checked)
- **Green** = Valid ✓ (deliverable emails)
- **Red** = Invalid ✗ (bounce/non-existent)
- **Amber** = Risky ⚠ (catch-all/disposable)
- **Gray** = Unknown ? (couldn't determine)

### What the Numbers Mean

- **Total Generated**: How many emails were created
- **Total Verified**: How many were checked (should equal generated)
- **Valid Count**: Your target - emails that passed verification
- **Invalid Count**: Emails that would bounce
- **Risky Count**: Emails that might work but are uncertain
- **Unknown Count**: Verification couldn't complete

## ⚠️ Common Issues & Solutions

### "Generation Taking Too Long"
**Solution**: Increase batch size or reduce target count

### "High Invalid Rate (>70%)"
**Solution**: Change parameters:
- Try different providers
- Use simpler patterns
- Allow numbers
- Change country

### "Rate Limit Exceeded"
**Solution**: You've hit the 20 requests/hour limit
- Wait for reset time shown in error
- Try again after limit resets

### "Target Not Reached"
**Solution**: System stopped after too many attempts
- Reduce target count
- Adjust parameters for better valid rate
- Try again with different settings

## 🎯 Example Use Cases

### Case 1: Quick Test
```
Target: 10 valid emails
Batch Size: 20
Providers: gmail.com, yahoo.com
Pattern: firstname.lastname
Time: ~30 seconds
```

### Case 2: Marketing Campaign
```
Target: 100 valid emails
Batch Size: 50
Providers: gmail.com, yahoo.com, outlook.com
Pattern: firstnamelastname
Time: ~2 minutes
```

### Case 3: Large Database
```
Target: 500 valid emails
Batch Size: 150
Providers: 5+ providers
Pattern: Various patterns
Time: ~10 minutes
```

## 🔄 What Happens Behind the Scenes

1. **Generate Batch**: System creates 150 emails
2. **Verify Each**: Each email checked against verification API
3. **Filter Valid**: Only emails with "valid" status kept
4. **Check Count**: Do we have enough valid emails?
5. **Repeat**: If not, generate another batch
6. **Complete**: Once target reached, return results

## 📈 Expected Performance

| Target | Time | Typical Invalid Rate |
|--------|------|---------------------|
| 10     | 10-30s | 30-50% |
| 50     | 30-90s | 30-50% |
| 100    | 1-3 min | 30-50% |
| 500    | 5-15 min | 30-50% |

*Times vary based on verification API speed and parameters*

## ✅ Success Indicators

You know it's working when:
- Progress bar is moving
- Numbers are incrementing
- Valid count is increasing
- Timer is running

## 🎓 Pro Tips

1. **Test First**: Always start with 10-20 emails to test your parameters
2. **Monitor Stats**: Watch invalid rate - adjust if too high
3. **Use Cache**: Re-running same parameters uses cached results
4. **Save Batches**: Save successful batches for reuse
5. **Optimize Time**: Balance batch size vs wait time

## 📞 Need Help?

- Check full documentation: `VERIFIED_EMAIL_GENERATION.md`
- Review implementation details: `IMPLEMENTATION_SUMMARY.md`
- Check API errors in browser console (F12)
- Verify API keys are configured correctly

---

**Happy Email Generating! 🎉**

*Remember: Only valid, deliverable emails are returned - guaranteed!*
