
Deno.serve(async (req) => {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
  if (req.method === 'OPTIONS') { return new Response('ok', { headers: corsHeaders }) }

  try {
    const { product, userProfile } = await req.json();
    const {
      PAYMOB_API_KEY,
      PAYMOB_INTEGRATION_ID,
    } = Deno.env.toObject();

    // Step 1: Authenticate
    const authResponse = await fetch('https://accept.paymob.com/api/auth/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ "api_key": PAYMOB_API_KEY }),
    });
    const authData = await authResponse.json();
    const authToken = authData.token;
    if (!authToken) throw new Error("Paymob authentication failed. Check your API Key.");

    // Step 2: Create Order
    const orderResponse = await fetch('https://accept.paymob.com/api/ecommerce/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: "false",
        amount_cents: product.price * 100,
        currency: "EGP",
        items: [],
      }),
    });
    const orderData = await orderResponse.json();
    const orderId = orderData.id;
    if (!orderId) throw new Error("Paymob order creation failed.");

    // Step 3: Get Payment Key
    const paymentKeyResponse = await fetch('https://accept.paymob.com/api/acceptance/payment_keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: product.price * 100,
        expiration: 3600,
        order_id: orderId,
        // --- THIS IS THE CORRECTED BILLING DATA ---
        billing_data: {
          email: userProfile.email || 'test@example.com',
          first_name: userProfile.full_name?.split(' ')[0] || 'Test',
          last_name: userProfile.full_name?.split(' ').slice(1).join(' ') || 'User',
          phone_number: userProfile.phone || '+201234567890',
          // --- THESE ARE THE MISSING FIELDS ---
          apartment: "NA",
          street: "NA", 
          floor: "NA", 
          building: "NA", 
          city: "Cairo", 
          country: "EGY",
          postal_code: "NA",
          state: "Cairo"
        },
        currency: "EGP",
        integration_id: parseInt(PAYMOB_INTEGRATION_ID, 10),
      }),
    });
    
    const paymentKeyData = await paymentKeyResponse.json();
    const paymentToken = paymentKeyData.token;

    if (!paymentToken) {
      const detail = paymentKeyData.detail || JSON.stringify(paymentKeyData);
      throw new Error(`Failed to get payment token. Paymob says: ${detail}`);
    }

    return new Response(JSON.stringify({ paymentToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in create-payment-key function:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});