export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { items, payerName, total } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Carrinho vazio." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const url = new URL(context.request.url);
    const origin = url.origin;

    const preference = {
      items: items.map(it => ({
        title: it.title,
        quantity: it.quantity,
        unit_price: Number(it.unitPrice),
        currency_id: "BRL"
      })),
      payer: { name: payerName || "Cliente Bela Aromas" },
      back_urls: {
        success: `${origin}/sucesso.html`,
        failure: `${origin}/falha.html`,
        pending: `${origin}/sucesso.html`
      },
      auto_return: "approved",
      external_reference: `bela-aromas-${Date.now()}`
    };

    // Regra: cartão só liberado para pedidos a partir de R$ 50
    if (Number(total) < 50) {
      preference.payment_methods = {
        excluded_payment_types: [{ id: "credit_card" }]
      };
    }

    const mpRes = await fetch("https://api.mercadopago.com/checkout/preferences", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${context.env.MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(preference)
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: mpData.message || "Erro ao criar pagamento." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      initPoint: mpData.init_point,
      sandboxInitPoint: mpData.sandbox_init_point
    }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
