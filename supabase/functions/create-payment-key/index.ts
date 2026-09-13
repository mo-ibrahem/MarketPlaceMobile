// Retired: trusted client prices without a verified order association.
// Active clients use /api/paymob/session with a server-priced order ID.
Deno.serve((req: Request) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  return new Response(JSON.stringify({ error: 'This payment endpoint has been retired. Please update the app.' }), {
    status: 410, headers,
  });
});
