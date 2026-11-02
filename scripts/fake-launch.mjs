const rpm = Number(process.argv[2] ?? 4200);
const url = `http://localhost:${process.env.BACKEND_PORT || 4567}/api/debug/launch`;

try {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rpm }),
  });
  const body = await res.json().catch(() => ({}));
  console.log(res.status, JSON.stringify(body));
  if (!res.ok) {
    console.error('Hint: start the backend with DEBUG=true (e.g. DEBUG=true npm run backend-start).');
    process.exit(1);
  }
} catch (err) {
  console.error(`Request failed: ${err.message}`);
  console.error('Hint: start the backend with DEBUG=true (e.g. DEBUG=true npm run backend-start).');
  process.exit(1);
}
