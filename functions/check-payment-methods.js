export async function onRequestGet(context) {
  try {
    const mpRes = await fetch("https://api.mercadopago.com/v1/payment_methods", {
      headers: { "Authorization": `Bearer ${context.env.MP_ACCESS_TOKEN}` }
    });

    const mpData = await mpRes.json();

    if (!mpRes.ok) {
      return new Response(JSON.stringify({ error: "Não foi possível consultar os meios de pagamento." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const pixMethod = mpData.find(m => m.id === "pix" || m.payment_type_id === "bank_transfer");

    return new Response(JSON.stringify({
      pixDisponivel: !!pixMethod,
      pixDetalhes: pixMethod || null,
      totalMeiosDisponiveis: mpData.length,
      listaCompleta: mpData.map(m => ({ id: m.id, nome: m.name, tipo: m.payment_type_id, status: m.status }))
    }, null, 2), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ error: "Erro interno: " + err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
