# AGEN8 Example Workflows (Copy-Paste Ready, Step-by-Step)

This guide contains ready-to-use workflows with exact steps and field values. You only provide your API keys where noted. All examples avoid Google-related nodes (google*, gmail, youtube).

Template usage: only `{{prev.*}}` so you never need node IDs.

How to run any workflow below:
1) Add nodes exactly in the listed order from the Palette onto the canvas.
2) Connect them left → right as listed (source handle to target handle).
3) Open each node card and paste the field values under Configure in the exact field names.
4) Click Run and check the Execution Log and the final Response message.

---

## Core Basics

### W1. Function → Response
- Add nodes: Starter, Function, Response
- Connect: Starter → Function → Response
- Configure:
  - Function → Function Code (paste):
    ```javascript
    return {
      result: "hello-world",
      value: 123,
      ts: new Date().toISOString()
    };
    ```
  - Response → Response Message: `Function says: {{prev.result}} ({{prev.value}})`
- Expected: "Function says: hello-world (123)"

### W2. API (GET) → Condition → Response
- Add nodes: Starter, API, Condition, Response
- Connect: Starter → API → Condition → Response
- Configure:
  - API → Method: `GET`
  - API → URL: `https://jsonplaceholder.typicode.com/todos/1`
  - API → Headers: `{}`
  - Condition → Condition Expression: `{{prev.status}} == 200`
  - Response → Response Message: `Status: {{prev.status}} | Title: {{prev.data.title}}`
- Expected: 200 and a todo title

### W3. Function → API (GET by ID) → Response
- Add nodes: Starter, Function, API, Response
- Connect: Starter → Function → API → Response
- Configure:
  - Function → Function Code:
    ```javascript
    return { todoId: 2 };
    ```
  - API → Method: `GET`
  - API → URL: `https://jsonplaceholder.typicode.com/todos/{{prev.todoId}}`
  - API → Headers: `{}`
  - Response → Response Message: `Todo: {{prev.data.title}}`
- Expected: Shows the title for todo #2

### W4. API (POST) → Response
- Add nodes: Starter, API, Response
- Connect: Starter → API → Response
- Configure:
  - API → Method: `POST`
  - API → URL: `https://httpbin.org/post`
  - API → Headers: `{"Content-Type":"application/json"}`
  - API → Body: `{"name":"agen8","purpose":"test"}`
  - Response → Response Message: `POST status: {{prev.status}}`
- Expected: 200

---

## AI

### W5. Agent (OpenAI) → Response
- Add nodes: Starter, Agent, Response
- Connect: Starter → Agent → Response
- Configure:
  - Agent → System Prompt: `Be brief.`
  - Agent → User Prompt: `Say hello.`
  - Agent → Model: `openai:gpt-4o-mini` (or another OpenAI model)
  - Agent → API Key: YOUR_OPENAI_KEY
  - Agent → Temperature: `0.2`
  - Response → Response Message: `AI: {{prev.content}}`
- Expected: Short greeting

### W6. Agent (Ollama local) → Response
- Add nodes: Starter, Agent, Response
- Connect: Starter → Agent → Response
- Configure:
  - Agent → System Prompt: `Be brief.`
  - Agent → User Prompt: `Say hello.`
  - Agent → Model: `ollama:llama3.2`
  - Agent → Endpoint: `http://localhost:11434`
  - Agent → Temperature: `0.2`
  - Response → Response Message: `AI: {{prev.content}}`
- Expected: Short greeting (requires Ollama running locally)

---

## Integration Quick Tests (each as its own mini flow)
Pattern for each: Starter → [Block] → Response
- Connect: Starter → Block → Response
- Response → Response Message: `{{prev.status}}` unless specified otherwise
- Set API Key fields to your key where present. Non-Google integrations here are mocked and accept any non-empty key.

For blocks that have specific required fields, use the values provided.

### I1. Airtable → Response
- Airtable → API Key: your key
- Airtable → Base ID: `app_demo`
- Airtable → Table ID: `tbl_demo`
- Response → Response Message: `Airtable: {{prev.status}}`

### I2. ArXiv → Response
- ArXiv → Search Query: `machine learning`
- ArXiv → Max Results: `5`
- Response → Response Message: `ArXiv: {{prev.status}}`

### I3. BrowserUse → Response
- BrowserUse → API Key: your key
- Response → Response Message: `BrowserUse: {{prev.status}}`

### I4. Clay → Response
- Clay → API Key: your key
- Response → Response Message: `Clay: {{prev.status}}`

### I5. Confluence → Response
- Confluence → API Key: your key
- Confluence → Domain: `example.atlassian.net`
- Response → Response Message: `Confluence: {{prev.status}}`

### I6. Discord → Response
- Discord → API Key: your key
- Discord → Webhook URL: `https://httpbin.org/post`
- Response → Response Message: `Discord: {{prev.status}}`

### I7. ElevenLabs → Response
- ElevenLabs → API Key: your key
- ElevenLabs → Voice ID: `21m00Tcm4TlvDq8ikWAM`
- ElevenLabs → Model: `eleven_multilingual_v2`
- Response → Response Message: `ElevenLabs: {{prev.status}}`

### I8. Exa → Response
- Exa → API Key: your key
- Response → Response Message: `Exa: {{prev.status}}`

### I9. File → Response
- File → API Key: your key
- File → Operation: `read`
- File → File Path: `/tmp/agen8-demo.txt`
- Response → Response Message: `File: {{prev.status}}`

### I10. Firecrawl → Response
- Firecrawl → API Key: your key
- Firecrawl → URL: `https://example.com`
- Response → Response Message: `Firecrawl: {{prev.status}}`

### I11. GitHub → Response
- GitHub → API Key: your key
- GitHub → Repository: `vercel/next.js`
- Response → Response Message: `GitHub: {{prev.status}}`

### I12. Hugging Face → Response
- HuggingFace → API Key: your key
- Response → Response Message: `HuggingFace: {{prev.status}}`

### I13. Hunter → Response
- Hunter → API Key: your key
- Response → Response Message: `Hunter: {{prev.status}}`

### I14. Image Generator → Response
- Image Generator → API Key: your key
- Response → Response Message: `ImageGen: {{prev.status}}`

### I15. Jina → Response
- Jina → API Key: your key
- Response → Response Message: `Jina: {{prev.status}}`

### I16. Jira → Response
- Jira → API Key: your key
- Jira → Domain: `example.atlassian.net`
- Response → Response Message: `Jira: {{prev.status}}`

### I17. Linear → Response
- Linear → API Key: your key
- Response → Response Message: `Linear: {{prev.status}}`

### I18. LinkedIn → Response
- LinkedIn → API Key: your key
- Response → Response Message: `LinkedIn: {{prev.status}}`

### I19. Mem0 → Response
- Mem0 → API Key: your key
- Response → Response Message: `Mem0: {{prev.status}}`

### I20. Microsoft Excel → Response
- Microsoft Excel → API Key: your key
- Response → Response Message: `Excel: {{prev.status}}`

### I21. Microsoft Planner → Response
- Microsoft Planner → API Key: your key
- Response → Response Message: `Planner: {{prev.status}}`

### I22. Microsoft Teams → Response
- Microsoft Teams → API Key: your key
- Response → Response Message: `Teams: {{prev.status}}`

### I23. Mistral Parse → Response
- Mistral Parse → API Key: your key
- Response → Response Message: `MistralParse: {{prev.status}}`

### I24. Notion → Response
- Notion → API Key: your key
- Response → Response Message: `Notion: {{prev.status}}`

### I25. OneDrive → Response
- OneDrive → API Key: your key
- Response → Response Message: `OneDrive: {{prev.status}}`

### I26. OpenAI (Integration) → Response
- OpenAI (integration) → API Key: your key
- Response → Response Message: `OpenAI Integration: {{prev.status}}`

### I27. Outlook → Response
- Outlook → API Key: your key
- Response → Response Message: `Outlook: {{prev.status}}`

### I28. Perplexity → Response
- Perplexity → API Key: your key
- Response → Response Message: `Perplexity: {{prev.status}}`

### I29. Pinecone → Response
- Pinecone → API Key: your key
- Response → Response Message: `Pinecone: {{prev.status}}`

### I30. Qdrant → Response
- Qdrant → API Key: your key
- Response → Response Message: `Qdrant: {{prev.status}}`

### I31. Reddit → Response
- Reddit → API Key: your key
- Response → Response Message: `Reddit: {{prev.status}}`

### I32. S3 → Response
- S3 → API Key: your key
- Response → Response Message: `S3: {{prev.status}}`

### I33. Serper → Response
- Serper → API Key: your key
- Response → Response Message: `Serper: {{prev.status}}`

### I34. SharePoint → Response
- SharePoint → API Key: your key
- Response → Response Message: `SharePoint: {{prev.status}}`

### I35. Slack → Response
- Slack → API Key: your key
- Response → Response Message: `Slack: {{prev.status}}`

### I36. Stagehand → Response
- Stagehand → API Key: your key
- Response → Response Message: `Stagehand: {{prev.status}}`

### I37. Stagehand Agent → Response
- Stagehand Agent → API Key: your key
- Response → Response Message: `Stagehand Agent: {{prev.status}}`

### I38. Supabase → Response
- Supabase → API Key: your key
- Response → Response Message: `Supabase: {{prev.status}}`

### I39. Tavily → Response
- Tavily → API Key: your key
- Response → Response Message: `Tavily: {{prev.status}}`

### I40. Telegram → Response
- Telegram → API Key: your key
- Response → Response Message: `Telegram: {{prev.status}}`

### I41. Thinking → Response
- Thinking → API Key: your key (if shown)
- Response → Response Message: `Thinking: {{prev.status}}`

### I42. Translate → Response
- Translate → API Key: your key
- Response → Response Message: `Translate: {{prev.status}}`

### I43. Twilio → Response
- Twilio → API Key: your key
- Response → Response Message: `Twilio: {{prev.status}}`

### I44. Typeform → Response
- Typeform → API Key: your key
- Response → Response Message: `Typeform: {{prev.status}}`

### I45. Vision → Response
- Vision → API Key: your key
- Response → Response Message: `Vision: {{prev.status}}`

### I46. Wealthbox → Response
- Wealthbox → API Key: your key
- Response → Response Message: `Wealthbox: {{prev.status}}`

### I47. Webhook → Response
- Webhook → API Key: your key
- Response → Response Message: `Webhook: {{prev.status}}`

### I48. WhatsApp → Response
- WhatsApp → API Key: your key
- Response → Response Message: `WhatsApp: {{prev.status}}`

### I49. Wikipedia → Response
- Wikipedia → API Key: your key
- Response → Response Message: `Wikipedia: {{prev.status}}`

### I50. Workflow (Integration) → Response
- Workflow (Integration) → API Key: your key
- Response → Response Message: `Workflow Integration: {{prev.status}}`

---

## Multi-step Integrations (Examples)

### M1. Airtable → Function → Response
- Add: Starter, Airtable, Function, Response
- Connect: Starter → Airtable → Function → Response
- Configure:
  - Airtable: (see I1)
  - Function → Function Code:
    ```javascript
    return { airtableStatus: "{{prev.status}}" };
    ```
  - Response → Response Message: `Airtable says: {{prev.airtableStatus}}`

### M2. GitHub → Discord → Webhook → Response
- Add: Starter, GitHub, Discord, Webhook, Response
- Connect: Starter → GitHub → Discord → Webhook → Response
- Configure:
  - GitHub: (see I11)
  - Discord: (see I6)
  - Webhook: (see I47)
  - Response → Response Message: `Webhook status: {{prev.status}}`

### M3. Exa → Serper → Tavily → Response
- Add: Starter, Exa, Serper, Tavily, Response
- Connect: Starter → Exa → Serper → Tavily → Response
- Configure each as in I8, I33, I39
- Response → Response Message: `Tavily: {{prev.status}}`

### M4. Pinecone → Qdrant → Response
- Add: Starter, Pinecone, Qdrant, Response
- Connect: Starter → Pinecone → Qdrant → Response
- Configure each as in I29, I30
- Response → Response Message: `Qdrant: {{prev.status}}`

### M5. Outlook → Microsoft Teams → Microsoft Planner → Response
- Add: Starter, Outlook, Microsoft Teams, Microsoft Planner, Response
- Connect: Starter → Outlook → Microsoft Teams → Microsoft Planner → Response
- Configure each as in I27, I22, I21
- Response → Response Message: `Planner: {{prev.status}}`

---

## Public API endpoints used (for copy-paste)
- JSONPlaceholder: `https://jsonplaceholder.typicode.com/todos/1`
- JSONPlaceholder with ID: `https://jsonplaceholder.typicode.com/todos/{{prev.todoId}}`
- httpbin POST echo: `https://httpbin.org/post`
- Example site for crawl: `https://example.com`

---

## Notes
- Integrations in this repo are mocked; they accept any non-empty API key and return status-like outputs for testing.
- Only API Key is your input. Everything else here is copy-paste.
- All examples use only `{{prev.*}}` so you don’t need to look up node IDs.