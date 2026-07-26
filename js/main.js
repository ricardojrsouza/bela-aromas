/* ==========================================================================
   Bela Aromas — Lógica principal (carrinho, filtros, favoritos)
   ========================================================================== */

const STORAGE_KEY = "belaAromasCart";
const WHATSAPP_NUMBER = "5537998332591"; // WhatsApp da Bela Aromas (com DDI 55 + DDD 37)

/* ---------- Configuração de pagamento ---------- */
const PIX_KEY = "9bdfa4c9-d365-450e-95ee-0e232495b7cc";
const PIX_MERCHANT_NAME = "LUIZ PEGO DA CRUZ"; // sem acentos, máx. 25 caracteres (regra do Pix)
const PIX_MERCHANT_CITY = "MARAVILHAS";        // sem acentos, máx. 15 caracteres (regra do Pix)
const CASH_ALLOWED_CITY = "maravilhas";        // cidade onde dinheiro é aceito (comparação sem acento/maiúsculas)

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

/* ---------- Geração do Pix (padrão BR Code / EMV do Banco Central) ---------- */
function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function crc16(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

function emvField(id, value) {
  const len = String(value.length).padStart(2, "0");
  return `${id}${len}${value}`;
}

function buildPixPayload(amount) {
  const merchantAccountInfo = emvField("26",
    emvField("00", "br.gov.bcb.pix") + emvField("01", PIX_KEY)
  );
  const additionalData = emvField("62", emvField("05", "***"));

  let payload = "";
  payload += emvField("00", "01");                      // Payload Format Indicator
  payload += emvField("01", "12");                       // Point of Initiation (uso único)
  payload += merchantAccountInfo;                        // Chave Pix
  payload += emvField("52", "0000");                     // Merchant Category Code
  payload += emvField("53", "986");                      // Moeda: Real (BRL)
  payload += emvField("54", amount.toFixed(2));           // Valor do pedido
  payload += emvField("58", "BR");                        // País
  payload += emvField("59", PIX_MERCHANT_NAME.slice(0, 25)); // Nome do recebedor
  payload += emvField("60", PIX_MERCHANT_CITY.slice(0, 15)); // Cidade do recebedor
  payload += additionalData;                              // Identificador da transação
  payload += "6304";                                      // CRC (id + tamanho fixo)
  payload += crc16(payload);

  return payload;
}

function renderPixBlock() {
  const container = document.getElementById("pix-block");
  const codeInput = document.getElementById("pix-code");
  if (!container || !codeInput) return;

  const payload = buildPixPayload(cartTotalPrice());
  codeInput.value = payload;

  const qrEl = document.getElementById("pix-qrcode");
  if (qrEl && window.QRCode) {
    qrEl.innerHTML = "";
    new QRCode(qrEl, {
      text: payload,
      width: 180,
      height: 180,
      colorDark: "#2E2117",
      colorLight: "#FBF4EA"
    });
  }
}

function copyPixCode() {
  const codeInput = document.getElementById("pix-code");
  const feedback = document.getElementById("pix-copy-feedback");
  if (!codeInput) return;

  codeInput.select();
  codeInput.setSelectionRange(0, 99999);

  navigator.clipboard.writeText(codeInput.value).then(() => {
    if (feedback) {
      feedback.textContent = "Código copiado! Cole no app do seu banco. ✅";
      setTimeout(() => { feedback.textContent = ""; }, 3500);
    }
  }).catch(() => {
    document.execCommand("copy");
    if (feedback) feedback.textContent = "Código copiado!";
  });
}

/* ---------- Regra: dinheiro só para a cidade da loja ---------- */
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
      document.getElementById("payment-pix").checked = true;
      renderPixBlock();
      document.getElementById("pix-block").style.display = "block";
    }
  });
}

/* ---------- Trava do botão de envio conforme confirmação de pagamento Pix ---------- */
function updatePixSubmitState() {
  const selected = document.querySelector("input[name='payment']:checked");
  const pixConfirm = document.getElementById("pix-confirm");
  const submitBtn = document.getElementById("checkout-submit-btn");
  if (!submitBtn || !selected) return;

  if (selected.value === "Pix") {
    submitBtn.disabled = !(pixConfirm && pixConfirm.checked);
  } else {
    submitBtn.disabled = false;
  }
}

/* ---------- Alternância visual do bloco Pix + trava do botão de envio ---------- */
function setupPaymentToggle() {
  const radios = document.querySelectorAll("input[name='payment']");
  const pixBlock = document.getElementById("pix-block");
  const pixConfirm = document.getElementById("pix-confirm");
  if (!radios.length || !pixBlock) return;

  radios.forEach(radio => {
    radio.addEventListener("change", () => {
      if (radio.value === "Pix" && radio.checked) {
        pixBlock.style.display = "block";
        renderPixBlock();
      } else {
        pixBlock.style.display = "none";
      }
      updatePixSubmitState();
    });
  });

  if (pixConfirm) {
    pixConfirm.addEventListener("change", updatePixSubmitState);
  }

  updatePixSubmitState();
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

  renderPixBlock();

  const pixConfirm = document.getElementById("pix-confirm");
  if (pixConfirm) pixConfirm.checked = false;
  updatePixSubmitState();
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
    msg += `• ${item.qty}x ${p.name} — ${formatPrice(p.price * item.qty)}\n`;
  });

  msg += `\n*Total: ${formatPrice(cartTotalPrice())}*`;
  msg += `\n*Forma de pagamento:* ${payment}`;

  if (payment === "Pix") {
    msg += `\n📎 _Vou enviar o comprovante do Pix aqui em seguida._`;
  }

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

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const name = document.getElementById("checkout-name").value.trim();
    const paymentInput = form.querySelector("input[name='payment']:checked");
    const notes = document.getElementById("checkout-notes").value;

    const rua = document.getElementById("checkout-street").value.trim();
    const numero = document.getElementById("checkout-number").value.trim();
    const bairro = document.getElementById("checkout-neighborhood").value.trim();
    const cidade = document.getElementById("checkout-city").value.trim();

    if (!name || !paymentInput) return;

    const pixConfirm = document.getElementById("pix-confirm");
    if (paymentInput.value === "Pix" && !(pixConfirm && pixConfirm.checked)) {
      pixConfirm.closest(".pix-block").scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    let address = "";
    if (rua || numero || bairro || cidade) {
      address = `${rua}${numero ? ", " + numero : ""}${bairro ? " — " + bairro : ""}${cidade ? ", " + cidade : ""}`.trim();
    }

    const payment = paymentInput.value;
    const message = buildOrderMessage(name, payment, address, notes);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;

    window.open(url, "_blank");

    saveCart([]);
    renderCartDrawer();
    closeCheckout();
    form.reset();
    document.getElementById("pix-block").style.display = "block";
    updatePixSubmitState();
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
  setupPaymentToggle();

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
