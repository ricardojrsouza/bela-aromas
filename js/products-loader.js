/* ==========================================================================
   Bela Aromas — Carregador de produtos
   Os produtos agora vivem em data/products.json (editável pela dona da loja
   através do painel /admin, sem precisar mexer em código).
   ========================================================================== */

let PRODUCTS = [];

async function loadProducts() {
  try {
    const res = await fetch('data/products.json');
    const data = await res.json();
    PRODUCTS = data.products || [];
  } catch (e) {
    console.error('Não foi possível carregar o catálogo:', e);
    PRODUCTS = [];
  }
}
