# Gmail Workflow Fix Guide

## Issues Identified and Fixed

### 1. Gmail Authentication Issues
- **Problem**: OAuth credentials not properly configured, causing "Failed to get user info" errors
- **Fix**: Improved error handling in Gmail authentication service and block

### 2. Template Variable Issues  
- **Problem**: Workflow using incorrect template variables
- **Current (Incorrect)**: `{{agent.subject}}`, `{{agent.body}}`
- **Should be**: `{{email_agent.subject}}`, `{{email_agent.body}}`

### 3. Workflow Configuration Issues
- **Problem**: Gmail node not properly configured to receive data from email_agent

## How to Fix Your Workflow

### Step 1: Update Template Variables in Gmail Node
In your Gmail node, change the field values from:
```
To: {{email_agent.recipient_email}}  ✅ (This is correct)
Subject: {{agent.subject}}  ❌ (Wrong - should be {{email_agent.subject}})
Body: {{agent.body}}  ❌ (Wrong - should be {{email_agent.body}})
```

To:
```
To: {{email_agent.recipient_email}}
Subject: {{email_agent.subject}}
Body: {{email_agent.body}}
```

### Step 2: Configure Gmail OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new project or select existing one
3. Enable Gmail API
4. Create OAuth 2.0 credentials
5. Add this redirect URI: `http://localhost:8080/oauth/gmail-callback`
6. Copy the Client ID and Client Secret to your Gmail node

### Step 3: Test the Workflow
1. Configure the email_agent with proper inputs
2. Set up Gmail authentication 
3. Run the workflow

## Expected Workflow Flow

1. **email_agent** receives inputs and generates JSON:
   ```json
   {
     "recipient_email": "anjan.b.s.007@gmail.com",
     "subject": "AI Workflow Demo - Save 10+ Hours Weekly",
     "body": "Hi Ajith,\n\nI hope this email finds you well..."
   }
   ```

2. **gmail_node** uses template variables to access the email_agent outputs:
   - `{{email_agent.recipient_email}}` → "anjan.b.s.007@gmail.com"
   - `{{email_agent.subject}}` → "AI Workflow Demo - Save 10+ Hours Weekly"  
   - `{{email_agent.body}}` → "Hi Ajith,\n\nI hope this email finds you well..."

3. **Gmail API** sends the email using the resolved values

## Testing Without OAuth Setup
If you want to test without setting up OAuth:
1. Enable "Skip Live Check" in the Gmail node
2. The workflow will run in mock mode and show what would be sent

## Common Issues and Solutions

### "Authentication issue: Failed to get user info"
- **Cause**: OAuth credentials not configured or invalid
- **Solution**: Set up proper OAuth credentials or enable "Skip Live Check"

### Template variables showing as empty
- **Cause**: Incorrect template variable names
- **Solution**: Use `{{email_agent.field_name}}` format

### Workflow completes but no email sent
- **Cause**: Authentication required but not completed
- **Solution**: Complete OAuth authentication in Gmail node