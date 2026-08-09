/* ==========================================================================
   Bela Aromas — Lógica principal (carrinho, filtros, favoritos)
   ========================================================================== */

const STORAGE_KEY = "belaAromasCart";
const WHATSAPP_NUMBER = "5537998332591"; // WhatsApp da Bela Aromas (com DDI 55 + DDD 37)

/* ---------- Configuração de pagamento ---------- */
const CASH_ALLOWED_CITY = "maravilhas"; // cidade onde dinheiro é aceito (comparação sem acento/maiúsculas)
const CARD_MIN_VALUE = 50; // valor mínimo do pedido para liberar cartão (regra aplicada no servidor também)

/* ---------- Estado do carrinho (em memória + localStorage) ---------- */
function getCart() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
  updateCartCount();
}

function addToCart(productId) {
  const product = PRODUCTS.find(p => p.id === productId);
  if (!product) return;

  const cart = getCart();
  const existing = cart.find(item => item.id === productId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ id: product.id, qty: 1 });
  }

  saveCart(cart);
  renderCartDrawer();
}

function updateQty(productId, delta) {
  const cart = getCart();
  const item = cart.find(i => i.id === productId);
  if (!item) return;

  item.qty += delta;
  const newCart = item.qty <= 0 ? cart.filter(i => i.id !== productId) : cart;

  saveCart(newCart);
  renderCartDrawer();
}

function removeFromCart(productId) {
  const cart = getCart().filter(i => i.id !== productId);
  saveCart(cart);
  renderCartDrawer();
}

function cartTotalItems() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}

function cartTotalPrice() {
  return getCart().reduce((sum, i) => {
    const product = PRODUCTS.find(p => p.id === i.id);
    return sum + (product ? product.price * i.qty : 0);
  }, 0);
}

function formatPrice(value) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function updateCartCount() {
  const countEl = document.getElementById("cart-count");
  if (countEl) countEl.textContent = cartTotalItems();
}

/* ---------- Drawer do carrinho ---------- */
function renderCartDrawer() {
  const itemsEl = document.getElementById("cart-items");
  const totalEl = document.getElementById("cart-total-value");
  if (!itemsEl) return;

  const cart = getCart();

  if (cart.length === 0) {
    itemsEl.innerHTML = `<p class="cart-empty">Seu carrinho está vazio.<br>Que tal acender uma vela nova? 🕯️</p>`;
  } else {
    itemsEl.innerHTML = cart.map(item => {
      const p = PRODUCTS.find(pr => pr.id === item.id);
      if (!p) return "";
      return `
        <div class="cart-item">
          <img src="${p.image}" alt="${p.name}">
          <div class="cart-item-info">
            <h4>${p.name}</h4>
            <span>${formatPrice(p.price)}</span>
            <div class="qty-control">
              <button onclick="updateQty(${p.id}, -1)" aria-label="Diminuir quantidade">−</button>
              <span>${item.qty}</span>
              <button onclick="updateQty(${p.id}, 1)" aria-label="Aumentar quantidade">+</button>
            </div>
            <button class="remove-item" onclick="removeFromCart(${p.id})">Remover</button>
          </div>
        </div>
      `;
    }).join("");
  }

  if (totalEl) totalEl.textContent = formatPrice(cartTotalPrice());
}

function toggleCart(forceState) {
  const drawer = document.getElementById("cart-drawer");
  const overlay = document.getElementById("cart-overlay");
  if (!drawer || !overlay) return;

  const shouldOpen = forceState !== undefined ? forceState : !drawer.classList.contains("open");

  drawer.classList.toggle("open", shouldOpen);
  overlay.classList.toggle("open", shouldOpen);

  if (shouldOpen) renderCartDrawer();
}

/* ---------- Regra: dinheiro só para a cidade da loja ---------- */
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function setupCityPaymentRule() {
  const cityInput = document.getElementById("checkout-city");
  const cashOption = document.getElementById("payment-cash");
  const cashLabel = document.getElementById("payment-cash-label");
  const cashHint = document.getElementById("cash-city-hint");
  if (!cityInput || !cashOption) return;

  cityInput.addEventListener("input", () => {
    const typedCity = removeAccents(cityInput.value.trim().toLowerCase());
    const isLocal = typedCity.length > 0 && typedCity === CASH_ALLOWED_CITY;

    cashOption.disabled = !isLocal;
    cashLabel.classList.toggle("disabled", !isLocal);
    cashHint.style.display = isLocal ? "none" : "block";

    if (!isLocal && cashOption.checked) {
      document.getElementById("payment-online").checked = true;
    }
  });
}

/* ---------- Checkout via WhatsApp ---------- */
function openCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    alert("Seu carrinho está vazio. Adicione uma vela antes de finalizar o pedido. 🕯️");
    return;
  }

  renderCheckoutSummary();
  toggleCart(false);

  const overlay = document.getElementById("checkout-overlay");
  const modal = document.getElementById("checkout-modal");
  if (overlay && modal) {
    overlay.classList.add("open");
    modal.classList.add("open");
  }

  const errorEl = document.getElementById("checkout-error");
  if (errorEl) { errorEl.style.display = "none"; errorEl.textContent = ""; }
}

function closeCheckout() {
  const overlay = document.getElementById("checkout-overlay");
  const modal = document.getElementById("checkout-modal");
  if (overlay && modal) {
    overlay.classList.remove("open");
    modal.classList.remove("open");
  }
}

function renderCheckoutSummary() {
  const summaryEl = document.getElementById("checkout-summary");
  const totalEl = document.getElementById("checkout-total-value");
  if (!summaryEl) return;

  const cart = getCart();
  summaryEl.innerHTML = cart.map(item => {
    const p = PRODUCTS.find(pr => pr.id === item.id);
    if (!p) return "";
    return `<div class="checkout-summary-item">
      <span>${item.qty}x ${p.name}</span>
      <span>${formatPrice(p.price * item.qty)}</span>
    </div>`;
  }).join("");

  if (totalEl) totalEl.textContent = formatPrice(cartTotalPrice());
}

function buildOrderMessage(customerName, payment, address, notes) {
  const cart = getCart();
  let msg = `Olá! Meu nome é *${customerName}* e gostaria de fazer o seguinte pedido na Bela Aromas 🕯️\n\n`;

  cart.forEach(item => {
    const p = PRODUCTS.find(pr => pr.id === item.id);
    if (!p) return;
    const variantParts = [item.color, item.aroma].filter(Boolean);
    const variantText = variantParts.length ? ` (${variantParts.join(", ")})` : "";
    msg += `• ${item.qty}x ${p.name}${variantText} — ${formatPrice(p.price * item.qty)}\n`;
  });

  msg += `\n*Total: ${formatPrice(cartTotalPrice())}*`;
  msg += `\n*Forma de pagamento:* ${payment}`;

  if (address && address.trim()) {
    msg += `\n*Endereço:* ${address.trim()}`;
  }

  if (notes && notes.trim()) {
    msg += `\n\n*Observações:* ${notes.trim()}`;
  }

  return msg;
}

function setupCheckoutForm() {
  const form = document.getElementById("checkout-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = document.getElementById("checkout-name").value.trim();
    const paymentInput = form.querySelector("input[name='payment']:checked");
    const notes = document.getElementById("checkout-notes").value;
    const submitBtn = document.getElementById("checkout-submit-btn");
    const errorEl = document.getElementById("checkout-error");

    const rua = document.getElementById("checkout-street").value.trim();
    const numero = document.getElementById("checkout-number").value.trim();
    const bairro = document.getElementById("checkout-neighborhood").value.trim();
    const cidade = document.getElementById("checkout-city").value.trim();

    if (!name || !paymentInput) return;

    let address = "";
    if (rua || numero || bairro || cidade) {
      address = `${rua}${numero ? ", " + numero : ""}${bairro ? " — " + bairro : ""}${cidade ? ", " + cidade : ""}`.trim();
    }

    const payment = paymentInput.value;

    /* ---------- Dinheiro na retirada: continua indo direto pro WhatsApp ---------- */
    if (payment === "Dinheiro") {
      const message = buildOrderMessage(name, "Dinheiro (retirada)", address, notes);
      const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      window.open(url, "_blank");

      saveCart([]);
      renderCartDrawer();
      closeCheckout();
      form.reset();
      return;
    }

    /* ---------- Pagar Online: cria o pagamento no Mercado Pago e redireciona ---------- */
    const cart = getCart();
    const total = cartTotalPrice();

    const items = cart.map(item => {
      const p = PRODUCTS.find(pr => pr.id === item.id);
      const variantParts = [item.color, item.aroma].filter(Boolean);
      const variantText = variantParts.length ? ` (${variantParts.join(", ")})` : "";
      return {
        title: `${p.name}${variantText}`,
        quantity: item.qty,
        unitPrice: p.price
      };
    });

    submitBtn.disabled = true;
    submitBtn.textContent = "Preparando pagamento...";
    if (errorEl) errorEl.style.display = "none";

    try {
      const res = await fetch("/create-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, payerName: name, total })
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Não foi possível iniciar o pagamento.");
      }

      // Como estamos usando credenciais de TESTE, usamos o link de sandbox.
      // Quando trocar para credenciais de produção, usar data.initPoint no lugar.
      const checkoutUrl = data.sandboxInitPoint || data.initPoint;
      window.location.href = checkoutUrl;

    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = "Continuar";
      if (errorEl) {
        errorEl.textContent = "Ops, não conseguimos iniciar o pagamento agora. Tenta de novo em instantes.";
        errorEl.style.display = "block";
      }
      console.error(err);
    }
  });
}

/* ---------- Favoritos (localStorage) ---------- */
const WISHLIST_KEY = "belaAromasWishlist";

function getWishlist() {
  try {
    return JSON.parse(localStorage.getItem(WISHLIST_KEY)) || [];
  } catch {
    return [];
  }
}

function toggleWishlist(productId, btn) {
  let list = getWishlist();
  if (list.includes(productId)) {
    list = list.filter(id => id !== productId);
    btn.classList.remove("active");
  } else {
    list.push(productId);
    btn.classList.add("active");
  }
  localStorage.setItem(WISHLIST_KEY, JSON.stringify(list));
}

/* ---------- Renderização de produtos (usado na página de produtos) ---------- */

function renderProducts(filter = "todas") {
  const grid = document.getElementById("products-grid");
  if (!grid) return;

  const wishlist = getWishlist();
  const filtered = filter === "todas"
    ? PRODUCTS
    : PRODUCTS.filter(p => p.category === filter);

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state">Nenhuma vela encontrada nessa categoria ainda.</div>`;
    return;
  }

  grid.innerHTML = filtered.map(p => `
    <article class="product-card">
      <div class="product-media">
        <span class="product-tag">${p.tag}</span>
        <button class="wishlist-btn ${wishlist.includes(p.id) ? 'active' : ''}"
                onclick="toggleWishlist(${p.id}, this)" aria-label="Favoritar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/>
          </svg>
        </button>
        <img src="${p.image}" alt="${p.name}" loading="lazy"
             onerror="this.onerror=null; this.src='https://placehold.co/600x600/F5EBDD/B96F55?text=Bela+Aromas';">
      </div>
      <div class="product-info">
        <span class="product-category">${p.categoryLabel}</span>
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <div class="product-footer">
          <span class="product-price">${formatPrice(p.price)}</span>
          <button class="add-btn" onclick="handleAddClick(${p.id}, this)">
            Adicionar
          </button>
        </div>
      </div>
    </article>
  `).join("");
}

function handleAddClick(productId, btn) {
  addToCart(productId);
  const original = btn.textContent;
  btn.textContent = "Adicionado ✓";
  btn.classList.add("added");
  setTimeout(() => {
    btn.textContent = original;
    btn.classList.remove("added");
  }, 1200);
}

/* ---------- Filtros da página de produtos ---------- */
function setupFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      buttons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      renderProducts(btn.dataset.filter);
    });
  });
}

/* ---------- Newsletter (simulado) ---------- */
function setupNewsletter() {
  const form = document.getElementById("newsletter-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = document.getElementById("newsletter-msg");
    const input = form.querySelector("input[type='email']");
    if (input.value.trim()) {
      msg.textContent = "Obrigado! Confira seu e-mail para o cupom de 10% OFF. 💌";
      form.reset();
    }
  });
}

/* ---------- Menu mobile ---------- */
function setupMobileMenu() {
  const toggle = document.getElementById("menu-toggle");
  const links = document.getElementById("nav-links");
  if (!toggle || !links) return;

  toggle.addEventListener("click", () => {
    links.classList.toggle("mobile-open");
  });
}

/* ---------- Inicialização ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  await loadProducts();

  updateCartCount();
  renderCartDrawer();
  setupNewsletter();
  setupMobileMenu();
  setupCheckoutForm();
  setupCityPaymentRule();

  const checkoutClose = document.getElementById("checkout-close");
  const checkoutOverlay = document.getElementById("checkout-overlay");
  if (checkoutClose) checkoutClose.addEventListener("click", closeCheckout);
  if (checkoutOverlay) checkoutOverlay.addEventListener("click", closeCheckout);

  if (document.getElementById("products-grid")) {
    setupFilters();
    renderProducts("todas");
  }

  const cartBtn = document.getElementById("cart-btn");
  const cartClose = document.getElementById("cart-close");
  const cartOverlay = document.getElementById("cart-overlay");

  if (cartBtn) cartBtn.addEventListener("click", () => toggleCart(true));
  if (cartClose) cartClose.addEventListener("click", () => toggleCart(false));
  if (cartOverlay) cartOverlay.addEventListener("click", () => toggleCart(false));
});
