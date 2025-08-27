# Test Your Fixed Workflow

## Quick Test Steps

### 1. Fix Template Variables in Your Workflow
In your Gmail node, update the field values:

**Current (Incorrect):**
- To: `{{email_agent.recipient_email}}` ✅ (This is correct)
- Subject: `{{agent.subject}}` ❌ 
- Body: `{{agent.body}}` ❌

**Fixed (Correct):**
- To: `{{email_agent.recipient_email}}`
- Subject: `{{email_agent.subject}}`
- Body: `{{email_agent.body}}`

### 2. Enable Mock Mode for Testing
1. In your Gmail node, find the "Skip Live Check (Mock Mode)" toggle
2. Turn it ON
3. This allows testing without OAuth setup

### 3. Run the Workflow
1. Click "Run Workflow"
2. Check the execution log for detailed output

## Expected Results

### Email Agent Output
The email_agent should generate JSON like:
```json
{
  "recipient_email": "anjan.b.s.007@gmail.com",
  "subject": "AI Workflow Demo - Save 10+ Hours Weekly",
  "cc": "",
  "bcc": "",
  "body": "Hi Ajith,\n\nI hope this email finds you well. I'm reaching out because I believe our AI Workflow Automation Tool could significantly benefit your team.\n\nOur tool saves 10+ hours per week for teams by automating repetitive workflows and processes. This means your team can focus on high-value work while our AI handles the routine tasks.\n\nWould you be interested in scheduling a 15-min demo to see how this could work for your specific use case?\n\nBest regards,\nAnajn B"
}
```

### Gmail Node Output (Mock Mode)
```
📧 Mock Gmail Operation Details:
   Operation: send
   To: anjan.b.s.007@gmail.com
   Subject: AI Workflow Demo - Save 10+ Hours Weekly
   Body: Hi Ajith, I hope this email finds you well. I'm reaching out because I believe our AI Workflow...
   HTML Format: No
✅ Mock send operation completed successfully!
   Mock Message ID: mock-1756057530080-abc123def
```

## If You Want to Send Real Emails

### 1. Set Up Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add redirect URI: `http://localhost:8080/oauth/gmail-callback`

### 2. Configure Gmail Node
1. Turn OFF "Skip Live Check (Mock Mode)"
2. Enter your Client ID and Client Secret
3. Click "Sign in with Google" to authenticate

### 3. Run Workflow
The workflow will now send real emails through Gmail!

## Troubleshooting

### "Template variables showing as empty"
- Check that you're using `{{email_agent.field_name}}` not `{{agent.field_name}}`

### "Authentication issue: Failed to get user info"
- Enable "Skip Live Check (Mock Mode)" for testing
- Or set up proper OAuth credentials

### "To address and subject are required"
- Verify the email_agent is generating the expected JSON output
- Check template variable names are correct