export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const preferenceId = url.searchParams.get("id");

  if (!preferenceId) {
    return new Response(JSON.stringify({ error: "Passe o ID da preferência assim: ?id=XXXXX" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const mpRes = await fetch(`https://api.mercadopago.com/checkout/preferences/${preferenceId}`, {
      headers: { "Authorization": `Bearer ${context.env.MP_ACCESS_TOKEN}` }
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível consultar essa preferência.", detalhe: mpData }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      purpose: mpData.purpose ?? "(campo ausente/vazio)",
      payment_methods: mpData.payment_methods ?? "(campo ausente/vazio)",
      operation_type: mpData.operation_type ?? "(campo ausente/vazio)",
      binary_mode: mpData.binary_mode ?? "(campo ausente/vazio)"
    }, null, 2), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
