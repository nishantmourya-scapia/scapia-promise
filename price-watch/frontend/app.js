const API_BASE = "http://localhost:8000";

const body = document.getElementById("products-body");
const toast = document.getElementById("toast");
const statCards = document.getElementById("stat-cards");
const dashboardBody = document.getElementById("dashboard-body");

function showToast(message, isError = false) {
  const el = document.createElement("div");
  el.className = "toast-msg" + (isError ? " error" : "");
  el.textContent = message;
  toast.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function renderRow(product) {
  const tr = document.createElement("tr");
  tr.dataset.productId = product.id;

  const dtcPrice = product.dtc?.price ?? "—";

  tr.innerHTML = `
    <td>${product.title}</td>
    <td class="price dtc">₹${dtcPrice}</td>
    <td class="price scapia" data-role="current-price">₹${product.price}</td>
    <td><input type="number" min="1" step="1" placeholder="${product.price}" /></td>
    <td><button data-role="save">Update</button></td>
  `;

  tr.querySelector("[data-role='save']").addEventListener("click", () => updatePrice(product.id, tr));
  return tr;
}

async function updatePrice(productId, row) {
  const input = row.querySelector("input");
  const button = row.querySelector("[data-role='save']");
  const price = parseInt(input.value, 10);

  if (!Number.isFinite(price) || price <= 0) {
    showToast("Enter a valid price", true);
    return;
  }

  button.disabled = true;
  try {
    const res = await fetch(`${API_BASE}/api/demo/products/${productId}/scapia-price`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ price }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const updated = await res.json();
    row.querySelector("[data-role='current-price']").textContent = `₹${updated.price}`;
    input.value = "";
    input.placeholder = updated.price;
    showToast(`${updated.title} → ₹${updated.price}`);
  } catch (err) {
    showToast(`Failed to update: ${err.message}`, true);
  } finally {
    button.disabled = false;
  }
}

async function loadProducts() {
  try {
    const res = await fetch(`${API_BASE}/api/products`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const products = await res.json();
    body.innerHTML = "";
    if (products.length === 0) {
      body.innerHTML = `<tr><td colspan="5" class="empty">No products</td></tr>`;
      return;
    }
    products.forEach((p) => body.appendChild(renderRow(p)));
  } catch (err) {
    body.innerHTML = `<tr><td colspan="5" class="empty">Failed to load products: ${err.message}</td></tr>`;
  }
}

function pricePosition(scapiaPrice, dtcPrice) {
  if (dtcPrice == null) return { label: "No DTC data", cls: "" };
  if (scapiaPrice > dtcPrice) return { label: `Expensive (+₹${scapiaPrice - dtcPrice})`, cls: "expensive" };
  if (scapiaPrice === dtcPrice) return { label: "At parity", cls: "parity" };
  return { label: `Cheaper (−₹${dtcPrice - scapiaPrice})`, cls: "cheaper" };
}

function renderStatCard(label, value) {
  const div = document.createElement("div");
  div.className = "stat-card";
  div.innerHTML = `<div class="value">${value}</div><div class="label">${label}</div>`;
  return div;
}

function renderDashboardRow(product, watchesForProduct) {
  const tr = document.createElement("tr");
  const total = watchesForProduct.length;
  const active = watchesForProduct.filter((w) => w.status === "ACTIVE").length;
  const triggered = watchesForProduct.filter((w) => w.status === "TRIGGERED").length;
  const dtcPrice = product.dtc?.price ?? null;
  const position = pricePosition(product.price, dtcPrice);

  tr.innerHTML = `
    <td>${product.title}</td>
    <td>${total}</td>
    <td>${active}</td>
    <td>${triggered}</td>
    <td class="price scapia">₹${product.price}</td>
    <td class="price dtc">${dtcPrice != null ? `₹${dtcPrice}` : "—"}</td>
    <td><span class="badge ${position.cls}">${position.label}</span></td>
  `;
  return tr;
}

async function loadDashboard() {
  try {
    const [products, watches, stats] = await Promise.all([
      fetch(`${API_BASE}/api/products`).then((r) => r.json()),
      fetch(`${API_BASE}/api/watches`).then((r) => r.json()),
      fetch(`${API_BASE}/api/dashboard/stats`).then((r) => r.json()),
    ]);

    statCards.innerHTML = "";
    statCards.appendChild(renderStatCard("Active watches", stats.activeWatches));
    statCards.appendChild(renderStatCard("Triggered", stats.triggered));
    statCards.appendChild(renderStatCard("DTC sources", stats.dtcSources));
    statCards.appendChild(renderStatCard("Notifications sent", stats.notificationsSent));
    statCards.appendChild(renderStatCard("Buy clicks", stats.buyClicks));

    const watchesByProduct = new Map();
    for (const w of watches) {
      if (!watchesByProduct.has(w.productId)) watchesByProduct.set(w.productId, []);
      watchesByProduct.get(w.productId).push(w);
    }

    dashboardBody.innerHTML = "";
    if (products.length === 0) {
      dashboardBody.innerHTML = `<tr><td colspan="7" class="empty">No products</td></tr>`;
      return;
    }
    products
      .slice()
      .sort((a, b) => (watchesByProduct.get(b.id)?.length ?? 0) - (watchesByProduct.get(a.id)?.length ?? 0))
      .forEach((p) => dashboardBody.appendChild(renderDashboardRow(p, watchesByProduct.get(p.id) ?? [])));
  } catch (err) {
    dashboardBody.innerHTML = `<tr><td colspan="7" class="empty">Failed to load dashboard: ${err.message}</td></tr>`;
  }
}

function setupTabs() {
  const buttons = document.querySelectorAll(".tab-btn");
  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      buttons.forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
      if (btn.dataset.tab === "dashboard") loadDashboard();
    });
  });
}

setupTabs();
loadProducts();
