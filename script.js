/*
 * RPM MODAS — catálogo e sacola.
 * IMPORTANTE: troque WHATSAPP_NUMBER pelo número da loja com código do país.
 * Exemplo Brasil: 55 + DDD + número, somente dígitos. Não inclua +, espaços ou traços.
 */
const WHATSAPP_NUMBER = "5500000000000"; // SUBSTITUA PELO NÚMERO REAL DA LOJA

const products = [
  { id: 1, name: "Vestido Aurora", category: "vestidos", categoryLabel: "Vestidos", price: 149.90, tag: "Mais amado", sizes: ["P", "M", "G", "GG"], image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=800&q=85", alt: "Vestido feminino elegante em tom claro" },
  { id: 2, name: "Conjunto Siena", category: "conjuntos", categoryLabel: "Conjuntos", price: 189.90, tag: "Novo", sizes: ["P", "M", "G"], image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=800&q=85", alt: "Look feminino contemporâneo" },
  { id: 3, name: "Blusa Amélie", category: "blusas", categoryLabel: "Blusas", price: 89.90, tag: "", sizes: ["P", "M", "G", "GG"], image: "https://images.unsplash.com/photo-1551163943-3f6a855d1153?auto=format&fit=crop&w=800&q=85", alt: "Blusa feminina de estilo sofisticado" },
  { id: 4, name: "Vestido Serena", category: "vestidos", categoryLabel: "Vestidos", price: 169.90, tag: "Elegante", sizes: ["P", "M", "G"], image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?auto=format&fit=crop&w=800&q=85", alt: "Vestido feminino para ocasião especial" },
  { id: 5, name: "Bolsa Luna", category: "acessorios", categoryLabel: "Acessórios", price: 119.90, tag: "", sizes: ["Único"], image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=800&q=85", alt: "Bolsa feminina elegante" },
  { id: 6, name: "Conjunto Verona", category: "conjuntos", categoryLabel: "Conjuntos", price: 219.90, tag: "Destaque", sizes: ["P", "M", "G", "GG"], image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?auto=format&fit=crop&w=800&q=85", alt: "Conjunto feminino de moda urbana" },
  { id: 7, name: "Blusa Chiara", category: "blusas", categoryLabel: "Blusas", price: 79.90, tag: "", sizes: ["P", "M", "G"], image: "https://images.unsplash.com/photo-1564257577-0a3d7e5d3d48?auto=format&fit=crop&w=800&q=85", alt: "Peça feminina minimalista" },
  { id: 8, name: "Vestido Valentina", category: "vestidos", categoryLabel: "Vestidos", price: 199.90, tag: "Edição especial", sizes: ["P", "M", "G"], image: "https://images.unsplash.com/photo-1539008835657-9e8e9680c956?auto=format&fit=crop&w=800&q=85", alt: "Vestido feminino sofisticado" }
];

const $ = (selector) => document.querySelector(selector);
const productGrid = $("#productGrid");
const cartDrawer = $("#cartDrawer");
const overlay = $("#overlay");
const cartItemsEl = $("#cartItems");
const cartEmpty = $("#cartEmpty");
const cartFooter = $("#cartFooter");
const sizeModal = $("#sizeModal");
let cart = [];
let selectedProduct = null;
let selectedSize = null;
let toastTimer;

const money = (value) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function renderProducts(filter = "todos") {
  const shown = filter === "todos" ? products : products.filter((p) => p.category === filter);
  productGrid.innerHTML = shown.map((p) => `
    <article class="product-card">
      <div class="product-image-wrap">
        <img class="product-image" src="${p.image}" alt="${p.alt}" loading="lazy">
        ${p.tag ? `<span class="product-tag">${p.tag}</span>` : ""}
        <button class="quick-add" data-add="${p.id}" aria-label="Escolher tamanho de ${p.name}">Adicionar à sacola +</button>
      </div>
      <div class="product-info">
        <p class="product-category">${p.categoryLabel}</p>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-price">${money(p.price)} <small>à vista</small></p>
      </div>
    </article>
  `).join("");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function openCart() {
  closeSizeModal();
  cartDrawer.classList.add("open");
  cartDrawer.setAttribute("aria-hidden", "false");
  overlay.classList.add("visible");
  document.body.classList.add("no-scroll");
  renderCart();
}
function closeCart() {
  cartDrawer.classList.remove("open");
  cartDrawer.setAttribute("aria-hidden", "true");
  overlay.classList.remove("visible");
  document.body.classList.remove("no-scroll");
}
function openSizeModal(product) {
  selectedProduct = product;
  selectedSize = null;
  $("#modalProductName").textContent = `${product.name} • ${money(product.price)}`;
  $("#sizeOptions").innerHTML = product.sizes.map((size) =>
    `<button class="size-option" data-size="${size}" aria-pressed="false">${size}</button>`
  ).join("");
  $("#confirmAdd").disabled = true;
  sizeModal.classList.add("open");
  sizeModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("no-scroll");
}
function closeSizeModal() {
  sizeModal.classList.remove("open");
  sizeModal.setAttribute("aria-hidden", "true");
  if (!cartDrawer.classList.contains("open")) document.body.classList.remove("no-scroll");
}
function addToCart(product, size) {
  const existing = cart.find((item) => item.id === product.id && item.size === size);
  if (existing) existing.qty += 1;
  else cart.push({ id: product.id, name: product.name, price: product.price, size, image: product.image, qty: 1 });
  renderCart();
  showToast(`${product.name} adicionado à sacola.`);
}
function renderCart() {
  const count = cart.reduce((sum, item) => sum + item.qty, 0);
  $("#cartCount").textContent = count;
  $("#drawerCount").textContent = `(${count})`;
  $("#cartTotal").textContent = money(cart.reduce((sum, item) => sum + item.price * item.qty, 0));
  cartEmpty.classList.toggle("visible", cart.length === 0);
  cartFooter.classList.toggle("hidden", cart.length === 0);
  cartItemsEl.style.display = cart.length ? "block" : "none";
  cartItemsEl.innerHTML = cart.map((item) => `
    <div class="cart-line">
      <img src="${item.image}" alt="${item.name}">
      <div>
        <h3>${item.name}</h3>
        <p>Tamanho: ${item.size}</p>
        <p>${money(item.price)} cada</p>
        <div class="qty-control">
          <button data-qty="-1" data-id="${item.id}" data-size="${item.size}" aria-label="Diminuir quantidade">−</button>
          <span>${item.qty}</span>
          <button data-qty="1" data-id="${item.id}" data-size="${item.size}" aria-label="Aumentar quantidade">+</button>
        </div>
      </div>
      <button class="remove-item" data-remove="${item.id}" data-size="${item.size}" aria-label="Remover ${item.name}">×</button>
    </div>
  `).join("");
}
function changeQty(id, size, delta) {
  const item = cart.find((entry) => entry.id === Number(id) && entry.size === size);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter((entry) => !(entry.id === Number(id) && entry.size === size));
  renderCart();
}
function checkoutWhatsApp() {
  if (!cart.length) return;
  if (!/^55\d{10,11}$/.test(WHATSAPP_NUMBER) || WHATSAPP_NUMBER === "5500000000000") {
    showToast("Configure o número do WhatsApp no arquivo script.js antes de receber pedidos.");
    return;
  }
  const lines = cart.map((item) => `• ${item.name} | Tam. ${item.size} | Qtd. ${item.qty} | ${money(item.price * item.qty)}`);
  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const message = `Olá! Vim pelo site da RPM MODAS e gostaria de fazer este pedido:\n\n${lines.join("\n")}\n\n*Subtotal: ${money(total)}*\n\nPoderiam confirmar disponibilidade, frete e formas de pagamento?`;
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

productGrid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-add]");
  if (!button) return;
  const product = products.find((p) => p.id === Number(button.dataset.add));
  if (product) openSizeModal(product);
});
$("#sizeOptions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-size]");
  if (!button) return;
  selectedSize = button.dataset.size;
  $("#sizeOptions").querySelectorAll(".size-option").forEach((el) => {
    const selected = el === button;
    el.classList.toggle("selected", selected);
    el.setAttribute("aria-pressed", String(selected));
  });
  $("#confirmAdd").disabled = false;
});
$("#confirmAdd").addEventListener("click", () => {
  if (!selectedProduct || !selectedSize) return;
  addToCart(selectedProduct, selectedSize);
  closeSizeModal();
});
cartItemsEl.addEventListener("click", (event) => {
  const qty = event.target.closest("[data-qty]");
  const remove = event.target.closest("[data-remove]");
  if (qty) changeQty(qty.dataset.id, qty.dataset.size, Number(qty.dataset.qty));
  if (remove) {
    cart = cart.filter((item) => !(item.id === Number(remove.dataset.remove) && item.size === remove.dataset.size));
    renderCart();
  }
});
document.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".filter-chip").forEach((chip) => chip.classList.remove("active"));
    button.classList.add("active");
    renderProducts(button.dataset.filter);
  });
});
$("#openCart").addEventListener("click", openCart);
$("#closeCart").addEventListener("click", closeCart);
$("#continueShopping").addEventListener("click", () => { closeCart(); $("#colecao").scrollIntoView({ behavior: "smooth" }); });
$("#checkoutButton").addEventListener("click", checkoutWhatsApp);
$("#closeSizeModal").addEventListener("click", closeSizeModal);
overlay.addEventListener("click", closeCart);
$("#menuToggle").addEventListener("click", () => {
  const nav = $("#mainNav");
  const isOpen = nav.classList.toggle("open");
  $("#menuToggle").setAttribute("aria-expanded", String(isOpen));
  $("#menuToggle").setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
});
$("#mainNav").querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  $("#mainNav").classList.remove("open");
  $("#menuToggle").setAttribute("aria-expanded", "false");
}));
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") { closeCart(); closeSizeModal(); }
});
$("#year").textContent = new Date().getFullYear();
const whatsappHref = `https://wa.me/${WHATSAPP_NUMBER}`;
$("#footerWhatsApp").href = whatsappHref;
$("#footerWhatsApp").addEventListener("click", (event) => {
  if (WHATSAPP_NUMBER === "5500000000000") {
    event.preventDefault();
    showToast("Configure o número do WhatsApp no arquivo script.js.");
  }
});
renderProducts();
renderCart();
