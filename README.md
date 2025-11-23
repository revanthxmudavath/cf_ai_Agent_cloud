# Agent Cloud - AI Personal Assistant

An AI-powered personal assistant built on Cloudflare's platform, featuring:
- Real-time chat interface with WebSockets
- Multi-layer memory (session, persistent, semantic)
- Task management and reminders
- RAG-powered knowledge retrieval
- MCP tool-calling capabilities

## Architecture

- **Frontend**: Cloudflare Pages + React + WebSockets
- **Backend**: Agents SDK + Durable Objects
- **LLM**: Workers AI (Llama 3.3 70B fp8-fast)
- **Memory**: Durable Objects + D1 + Vectorize
- **Orchestration**: Cloudflare Workflows

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Login to Cloudflare

```bash
npx wrangler login
```

### 3. Create D1 Database

```bash
npx wrangler d1 create agent-db
```

Copy the database ID and update `wrangler.toml`:
```toml
database_id = "YOUR_DATABASE_ID_HERE"
```

### 4. Run Migrations

```bash
npm run d1:migrate
```

Or for local development:
```bash
npm run d1:local
```

### 5. Create Vectorize Index

```bash
npm run vectorize:create
```

### 6. Create AI Gateway

```bash
npx wrangler ai-gateway create agent-gateway
```

### 7. Run Development Server

```bash
npm run dev
```

## Project Structure

```
agent-cloud/
├── src/
│   ├── agent/              # Agent logic
│   ├── mcp/                # MCP tools
│   ├── workflows/          # Workflow definitions
│   ├── types/              # TypeScript types
│   └── index.ts            # Worker entry point
├── frontend/               # React frontend
├── migrations/             # D1 migrations
├── wrangler.toml          # Cloudflare config
└── schema.sql             # Database schema
```

## Development

- `npm run dev` - Start development server
- `npm run deploy` - Deploy to Cloudflare
- `npm run d1:migrate` - Run database migrations

## License

MIT