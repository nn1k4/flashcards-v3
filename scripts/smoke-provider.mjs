#!/usr/bin/env node
// Simple smoke script for /claude/provider/single
const API = process.env.API || 'http://localhost:3001';
const text = process.env.TEXT || 'Sveiki! Es mācos latviešu valodu.';
const max = Number(process.env.MAX_TOKENS || 1024);

async function main() {
  const r = await fetch(`${API}/claude/provider/single`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, max_tokens: max }),
  });
  const t = await r.text();
  console.log(r.status, r.statusText);
  console.log(t);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

