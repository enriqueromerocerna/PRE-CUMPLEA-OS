(() => {
  const KEY = "cumple-ahorros-v1";
  const uid = () => Math.random().toString(36).slice(2, 10);

  const defaultState = () => ({
    eventDate: "",
    items: ["Alquiler de sonido", "Comida", "Cerveza", "Mikes", "Decoración", "Dj", "Gaseosas (vidrio)"]
      .map(name => ({ id: uid(), name, budget: 0, savings: [] }))
  });

  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return defaultState();
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }

  const money = n => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const saved = it => it.savings.reduce((a, s) => a + s.amount, 0);
  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const daysLeft = () => {
    if (!state.eventDate) return null;
    const [y, m, d] = state.eventDate.split("-").map(Number);
    const target = new Date(y, m - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((target - today) / 86400000));
  };

  const $ = id => document.getElementById(id);

  function render() {
    const totalBudget = state.items.reduce((a, i) => a + i.budget, 0);
    const totalSaved = state.items.reduce((a, i) => a + saved(i), 0);
    const remaining = Math.max(0, totalBudget - totalSaved);
    const pct = totalBudget > 0 ? Math.min(100, (totalSaved / totalBudget) * 100) : 0;

    $("totalBudget").textContent = money(totalBudget);
    $("totalSaved").textContent = money(totalSaved);
    $("totalRemaining").textContent = money(remaining);
    $("totalBar").style.width = pct + "%";
    $("totalPct").textContent = pct.toFixed(0) + "% completado";
    $("eventDate").value = state.eventDate;

    const days = daysLeft();
    const sg = $("suggest");
    if (days === null) {
      sg.textContent = "Elige la fecha para ver cuánto ahorrar por día.";
    } else if (days === 0) {
      sg.textContent = "¡Es hoy o ya pasó la fecha! 🎂";
    } else if (remaining === 0) {
      sg.textContent = `Faltan ${days} días. ¡Ya tienes todo cubierto! ✅`;
    } else {
      sg.innerHTML = `Faltan <b>${days}</b> días → ahorra <b>${money(remaining / days)}</b> por día en total.`;
    }

    const wrap = $("items");
    wrap.innerHTML = "";
    state.items.forEach(it => {
      const s = saved(it);
      const rem = Math.max(0, it.budget - s);
      const p = it.budget > 0 ? Math.min(100, (s / it.budget) * 100) : 0;
      const done = it.budget > 0 && s >= it.budget;
      const perDay = days && rem > 0 ? ` · ${money(rem / days)}/día` : "";
      const history = [...it.savings].sort((a, b) => b.date.localeCompare(a.date));

      const el = document.createElement("article");
      el.className = "card item-card";
      el.dataset.id = it.id;
      el.innerHTML = `
        <div class="item-head">
          <h3>${esc(it.name)} ${done ? '<span class="badge">Listo</span>' : ""}</h3>
          <button class="icon" data-action="delete-item" title="Eliminar gasto">🗑️</button>
        </div>
        <div class="item-nums">
          <div><span class="label">Presupuesto</span>
            <input type="number" min="0" step="0.01" value="${it.budget}" data-action="budget"></div>
          <div><span class="label">Ahorrado</span><strong class="ok">${money(s)}</strong></div>
          <div><span class="label">Falta</span><strong class="warn">${money(rem)}</strong></div>
        </div>
        <div class="bar"><div class="fill" style="width:${p}%"></div></div>
        <p class="small center">${p.toFixed(0)}%${perDay}</p>
        <form class="inline" data-action="add-saving">
          <input type="number" name="amount" min="0.01" step="0.01" placeholder="Ahorro S/" required>
          <input type="date" name="date" value="${todayStr()}" required>
          <button type="submit">Ahorrar</button>
        </form>
        ${history.length ? `
        <details>
          <summary>Historial (${history.length})</summary>
          <ul class="history">
            ${history.map(h => `
              <li><span>${esc(h.date)}</span><span>${money(h.amount)}
                <button class="icon" data-action="delete-saving" data-sid="${h.id}" title="Quitar">✕</button></span></li>`).join("")}
          </ul>
        </details>` : ""}
      `;
      wrap.appendChild(el);
    });
  }

  // Eventos
  $("eventDate").addEventListener("change", e => {
    state.eventDate = e.target.value;
    save(); render();
  });

  $("addItemForm").addEventListener("submit", e => {
    e.preventDefault();
    const name = $("newName").value.trim();
    if (!name) return;
    state.items.push({ id: uid(), name, budget: parseFloat($("newBudget").value) || 0, savings: [] });
    e.target.reset();
    save(); render();
  });

  const itemOf = el => {
    const card = el.closest(".item-card");
    return card ? state.items.find(i => i.id === card.dataset.id) : null;
  };

  $("items").addEventListener("submit", e => {
    if (e.target.dataset.action !== "add-saving") return;
    e.preventDefault();
    const it = itemOf(e.target);
    const amount = parseFloat(e.target.amount.value);
    if (!it || !(amount > 0)) return;
    it.savings.push({ id: uid(), date: e.target.date.value || todayStr(), amount });
    save(); render();
  });

  $("items").addEventListener("change", e => {
    if (e.target.dataset.action !== "budget") return;
    const it = itemOf(e.target);
    if (!it) return;
    it.budget = Math.max(0, parseFloat(e.target.value) || 0);
    save(); render();
  });

  $("items").addEventListener("click", e => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;
    const it = itemOf(btn);
    if (!it) return;
    if (btn.dataset.action === "delete-item") {
      if (confirm(`¿Eliminar "${it.name}" y todo su ahorro?`)) {
        state.items = state.items.filter(i => i.id !== it.id);
        save(); render();
      }
    } else if (btn.dataset.action === "delete-saving") {
      it.savings = it.savings.filter(s => s.id !== btn.dataset.sid);
      save(); render();
    }
  });

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ahorro-cumple.json";
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("importFile").addEventListener("change", e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!Array.isArray(data.items)) throw new Error("Formato inválido");
        state = data;
        save(); render();
      } catch (err) {
        alert("Archivo no válido.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  });

  $("resetBtn").addEventListener("click", () => {
    if (confirm("¿Borrar todos los datos y empezar de cero?")) {
      state = defaultState();
      save(); render();
    }
  });

  render();
})();
