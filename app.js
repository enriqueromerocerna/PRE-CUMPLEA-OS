(() => {
  const KEY = "cumple-ahorros-v2";
  const OLD_KEY = "cumple-ahorros-v1";
  const uid = () => Math.random().toString(36).slice(2, 10);

  const DEFAULT_ITEMS = [
    { key: "sonido", icon: "🔊", name: "Alquiler de sonido" },
    { key: "comida", icon: "🍽️", name: "Comida" },
    { key: "cerveza", icon: "🍺", name: "Cerveza" },
    { key: "mikes", icon: "🎤", name: "Mikes" },
    { key: "decoracion", icon: "🎈", name: "Decoración" },
    { key: "dj", icon: "🎧", name: "Dj" },
    { key: "gaseosas", icon: "🥤", name: "Gaseosas (vidrio)" }
  ];

  const defaultState = () => ({
    name: "",
    eventDate: "",
    hide: false,
    calc: { pctDrink: 80, beerPer: 6, beerPrice: 6, beerCase: 12, sodaPer: 2, sodaPrice: 3.5, foodPer: 25, includePending: true },
    guests: [],
    items: DEFAULT_ITEMS.map(d => ({ id: uid(), ...d, budget: 0, savings: [] }))
  });

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const s = JSON.parse(raw);
        const d = defaultState();
        return { ...d, ...s, calc: { ...d.calc, ...(s.calc || {}) } };
      }
      const old = localStorage.getItem(OLD_KEY);
      if (old) {
        const o = JSON.parse(old);
        const s = defaultState();
        s.eventDate = o.eventDate || "";
        s.items = (o.items || []).map(it => {
          const d = DEFAULT_ITEMS.find(x => x.name === it.name) || {};
          return { id: it.id || uid(), key: d.key || "", icon: d.icon || "🎁", name: it.name, budget: it.budget || 0, savings: it.savings || [] };
        });
        return s;
      }
    } catch (e) {}
    return defaultState();
  }

  let state = load();
  let view = (location.hash || "#resumen").slice(1);
  if (!["resumen", "gastos", "invitados"].includes(view)) view = "resumen";

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = n => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const m = n => (state.hide ? "S/ ••••" : money(n));
  const round2 = n => Math.round((Number(n) || 0) * 100) / 100;

  const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const fmtDate = ds => {
    if (ds === todayStr()) return "Hoy";
    const [y, mo, d] = ds.split("-").map(Number);
    const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(y, mo - 1, d)) / 86400000);
    if (diff === 1) return "Ayer";
    return `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}`;
  };
  const daysLeft = () => {
    if (!state.eventDate) return null;
    const [y, mo, d] = state.eventDate.split("-").map(Number);
    const target = new Date(y, mo - 1, d);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.max(0, Math.round((target - today) / 86400000));
  };
  const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  };

  // ---------- Cálculos ----------
  const saved = it => it.savings.reduce((a, s) => a + s.amount, 0);
  const totals = () => {
    const budget = state.items.reduce((a, i) => a + i.budget, 0);
    const sv = state.items.reduce((a, i) => a + saved(i), 0);
    const remaining = state.items.reduce((a, i) => a + Math.max(0, i.budget - saved(i)), 0);
    return { budget, saved: sv, remaining, pct: budget > 0 ? Math.min(100, (sv / budget) * 100) : 0 };
  };
  const people = () => {
    let conf = 0, pend = 0, no = 0;
    state.guests.forEach(g => {
      const n = 1 + (g.plus || 0);
      if (g.status === "confirmado") conf += n;
      else if (g.status === "pendiente") pend += n;
      else no += n;
    });
    return { conf, pend, no, total: conf + (state.calc.includePending ? pend : 0) };
  };
  const calcRes = () => {
    const c = state.calc, n = people().total;
    const drinkers = Math.round(n * c.pctDrink / 100);
    const bottles = drinkers * c.beerPer;
    const cases = c.beerCase > 0 ? Math.ceil(bottles / c.beerCase) : 0;
    const sodas = n * c.sodaPer;
    const beerCost = bottles * c.beerPrice, sodaCost = sodas * c.sodaPrice, foodCost = n * c.foodPer;
    return { n, drinkers, bottles, cases, sodas, beerCost, sodaCost, foodCost, total: beerCost + sodaCost + foodCost };
  };
  const suggestionFor = it => {
    const r = calcRes();
    if (r.n === 0) return null;
    if (it.key === "comida") return r.foodCost;
    if (it.key === "cerveza") return r.beerCost;
    if (it.key === "gaseosas") return r.sodaCost;
    return null;
  };

  // ---------- Asistente ----------
  function assistant() {
    const t = totals(), d = daysLeft(), p = people();
    let head;
    if (t.budget === 0) head = "Empecemos: ponle un presupuesto a cada gasto y yo calculo cuánto ahorrar.";
    else if (t.remaining === 0) head = "¡Meta lograda! Ya tienes cubierto todo tu cumpleaños 🎉";
    else if (d === null) head = `Te faltan ${money(t.remaining)}. Dime la fecha de tu cumple y calculo tu ahorro diario.`;
    else if (d === 0) head = `Hoy es el gran día y aún faltan ${money(t.remaining)} por cubrir.`;
    else head = `Ahorra ${money(t.remaining / d)} al día durante ${d} día${d > 1 ? "s" : ""} y llegas a tu meta.`;

    const tips = [];
    if (d !== null && d > 0 && d <= 7 && t.remaining > 0) tips.push("⏰ Falta poco, considera recortar algún gasto.");
    if (state.guests.length === 0) tips.push("👥 Agrega tus invitados y calculo comida, cerveza y gaseosas.");
    else if (p.total > 0 && t.budget > 0) tips.push(`👥 Con ${p.total} personas, cada una cuesta ~${money(t.budget / p.total)}.`);
    if (p.pend > 0) tips.push(`⏳ Tienes ${p.pend} persona${p.pend > 1 ? "s" : ""} pendiente${p.pend > 1 ? "s" : ""} de confirmar.`);
    const noBudget = state.items.filter(i => i.budget === 0).map(i => i.name);
    if (noBudget.length && t.budget > 0) tips.push(`📝 Sin presupuesto: ${noBudget.slice(0, 3).join(", ")}${noBudget.length > 3 ? "…" : ""}.`);
    const worst = [...state.items].sort((a, b) => (b.budget - saved(b)) - (a.budget - saved(a)))[0];
    if (worst && worst.budget - saved(worst) > 0) tips.push(`${worst.icon} Lo que más falta: ${worst.name} (${money(worst.budget - saved(worst))}).`);
    return { head, tips: tips.slice(0, 3) };
  }

  // ---------- Gráficos ----------
  const COLORS = ["#7c5cff", "#2fb36b", "#e9b93b", "#4aa3f0", "#f28b5b", "#b6ee6e", "#e45c8b", "#12361a", "#9aa3b2"];
  const PASTELS = ["lav", "mint", "cream", "blue", "peach"];

  function chartSVG() {
    const byDate = {};
    state.items.forEach(i => i.savings.forEach(s => { byDate[s.date] = (byDate[s.date] || 0) + s.amount; }));
    const dates = Object.keys(byDate).sort();
    if (!dates.length) return '<p class="muted center pad">Aún no hay ahorros registrados.<br>¡Registra el primero!</p>';
    let cum = 0;
    const pts = [0];
    dates.forEach(d => { cum += byDate[d]; pts.push(cum); });
    const W = 300, H = 110, pad = 8, max = Math.max(...pts) || 1;
    const xy = pts.map((v, i) => [pad + (i / (pts.length - 1)) * (W - 2 * pad), H - pad - (v / max) * (H - 2 * pad)]);
    const line = xy.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join(" ");
    const last = xy[xy.length - 1];
    const area = `${line} L${last[0].toFixed(1)} ${H - pad} L${xy[0][0].toFixed(1)} ${H - pad} Z`;
    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Ahorro acumulado">
      <defs><linearGradient id="g1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4aa3f0" stop-opacity=".35"/><stop offset="1" stop-color="#4aa3f0" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#g1)"/>
      <path d="${line}" fill="none" stroke="#4aa3f0" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#4aa3f0" stroke="#fff" stroke-width="2"/>
    </svg>`;
  }

  function donutSVG() {
    const R = 52, C = 2 * Math.PI * R;
    const items = state.items.filter(i => i.budget > 0);
    const total = items.reduce((a, i) => a + i.budget, 0);
    let acc = 0;
    const segs = total > 0 ? items.map((it, idx) => {
      const len = (it.budget / total) * C;
      const gap = items.length > 1 ? 3 : 0;
      const s = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${COLORS[state.items.indexOf(it) % COLORS.length]}" stroke-width="16" stroke-dasharray="${Math.max(len - gap, 0.1)} ${C - Math.max(len - gap, 0.1)}" stroke-dashoffset="${-acc}"/>`;
      acc += len;
      return s;
    }).join("") : "";
    return `<div class="donut-wrap"><svg viewBox="0 0 140 140" width="170" height="170" style="transform:rotate(-90deg)">
      <circle cx="70" cy="70" r="${R}" fill="none" stroke="#eceef2" stroke-width="16"/>${segs}</svg>
      <div class="donut-center"><span class="muted small">Presupuesto</span><strong>${m(total)}</strong></div></div>
      <ul class="legend">${items.slice(0, 6).map(it => `<li><span class="dot" style="background:${COLORS[state.items.indexOf(it) % COLORS.length]}"></span>${esc(it.name)}<span class="v">${m(it.budget)}</span></li>`).join("")}</ul>`;
  }

  // ---------- Vistas ----------
  function renderResumen() {
    const t = totals(), d = daysLeft(), p = people(), a = assistant();
    const recent = state.items
      .flatMap(i => i.savings.map(s => ({ ...s, item: i })))
      .sort((x, y) => y.date.localeCompare(x.date))
      .slice(0, 6);

    $("view-resumen").innerHTML = `
    <div class="grid">
      <article class="card span7">
        <div class="row between"><span class="pill-switch"><b>PEN</b> · Soles</span><span class="muted small">Meta total ${m(t.budget)}</span></div>
        <p class="muted" style="margin:16px 0 0">Ahorro acumulado</p>
        <div class="big">${m(t.saved)} <button class="eye" data-action="toggle-eye" title="Mostrar/ocultar">${state.hide ? "🙈" : "👁"}</button></div>
        <div class="bar"><div class="fill green" style="width:${t.pct}%"></div></div>
        <p class="small muted" style="margin:6px 0 0">${t.pct.toFixed(0)}% completado · te faltan ${m(t.remaining)}</p>
        <div class="stats4">
          <div class="stat"><span>Días restantes</span><strong>${d === null ? "—" : d}</strong></div>
          <div class="stat"><span>Ahorro por día</span><strong>${d && t.remaining > 0 ? m(t.remaining / d) : "—"}</strong></div>
          <div class="stat"><span>Invitados</span><strong>${p.total}</strong></div>
          <div class="stat"><span>Costo por persona</span><strong>${p.total && t.budget ? m(t.budget / p.total) : "—"}</strong></div>
        </div>
        <div class="row gap wrap">
          <button class="btn dark" data-action="open-save">Registrar ahorro</button>
          <button class="btn outline" data-action="goto" data-view="gastos">Ver gastos</button>
          <span class="spacer"></span>
          <button class="round-arrow" data-action="open-save" aria-label="Registrar ahorro">↗</button>
        </div>
      </article>

      <article class="card lime span5">
        <span class="badge-ai">✦ Tu asistente</span>
        <p class="ai-head">${esc(a.head)}</p>
        ${a.tips.length ? `<ul class="tips">${a.tips.map(x => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
        <div class="mini-tiles">
          <div class="tile"><span>👥 Invitados</span><strong>${p.total}</strong></div>
          <div class="tile"><span>🍺 Cajas de cerveza</span><strong>${calcRes().cases}</strong></div>
        </div>
      </article>

      <article class="card blue span5">
        <h3>Tu ahorro en el tiempo</h3>
        <strong style="font-size:1.6rem">${m(t.saved)}</strong>
        ${chartSVG()}
      </article>

      <article class="card span3">
        <h3>Presupuesto</h3>
        ${donutSVG()}
      </article>

      <article class="card span4">
        <h3>Movimientos</h3>
        ${recent.length ? `<ul class="tx">${recent.map(r => `
          <li><span class="ic">${r.item.icon}</span>
            <span class="t"><b>${esc(r.item.name)}</b><small>${fmtDate(r.date)}</small></span>
            <span class="amt">+${money(r.amount)}</span></li>`).join("")}</ul>`
        : '<p class="empty">Aquí aparecerán tus ahorros diarios.</p>'}
      </article>

      <article class="card span12 footer-card">
        <span class="muted small">💾 Tus datos se guardan en este navegador. Haz un respaldo cuando quieras.</span>
        <div class="row gap wrap">
          <button class="btn outline small" data-action="export">Exportar</button>
          <button class="btn outline small" data-action="import">Importar</button>
          <button class="btn danger small" data-action="reset">Borrar todo</button>
        </div>
      </article>
    </div>`;
  }

  function renderGastos() {
    const d = daysLeft();
    const cards = state.items.map((it, idx) => {
      const s = saved(it), rem = Math.max(0, it.budget - s);
      const pct = it.budget > 0 ? Math.min(100, (s / it.budget) * 100) : 0;
      const done = it.budget > 0 && s >= it.budget;
      const sug = suggestionFor(it);
      const hist = [...it.savings].sort((a, b) => b.date.localeCompare(a.date));
      return `
      <article class="item ${PASTELS[idx % PASTELS.length]}" data-id="${it.id}">
        <div class="item-top">
          <span class="item-ic">${esc(it.icon || "🎁")}</span>
          <h4>${esc(it.name)}${done ? ' <span class="ok-badge">Listo</span>' : ""}</h4>
          <button class="icon-btn" data-action="delete-item" title="Eliminar">🗑️</button>
        </div>
        <div class="nums">
          <div><span>Presupuesto S/</span><input type="number" min="0" step="0.01" value="${it.budget}" data-field="budget"></div>
          <div><span>Ahorrado</span><strong class="pos">${money(s)}</strong></div>
          <div><span>Falta</span><strong>${money(rem)}</strong></div>
        </div>
        <div class="bar"><div class="fill green" style="width:${pct}%"></div></div>
        <p class="small" style="margin:6px 0 0">${pct.toFixed(0)}%${d && rem > 0 ? ` · ${money(rem / d)} por día` : ""}</p>
        ${sug !== null && Math.abs(sug - it.budget) > 0.009 ? `<div class="hint">💡 Según tus invitados: <b>${money(sug)}</b><button class="btn dark small" data-action="apply-item" data-sug="${round2(sug)}">Aplicar</button></div>` : ""}
        <form class="save-form" data-form="item-saving">
          <input type="number" name="amount" min="0.01" step="0.01" placeholder="Ahorro S/" required>
          <input type="date" name="date" value="${todayStr()}" required>
          <button class="btn dark" type="submit">+</button>
        </form>
        ${hist.length ? `<details><summary>Historial (${hist.length})</summary><ul class="hist">${hist.map(h =>
          `<li><span>${fmtDate(h.date)}</span><span>${money(h.amount)} <button class="icon-btn" data-action="delete-saving" data-sid="${h.id}">✕</button></span></li>`).join("")}</ul></details>` : ""}
      </article>`;
    }).join("");

    $("view-gastos").innerHTML = `
      <div class="items-grid">
        ${cards}
        <article class="card darkcard">
          <h3>➕ Agrega otro gasto</h3>
          <p class="muted small" style="margin:0 0 12px">Hielo, torta, fotos, mozos… lo que necesites.</p>
          <form data-form="add-item" class="form-grid">
            <label class="full">Nombre<input type="text" name="name" placeholder="Ej: Hielo" required maxlength="40"></label>
            <label>Presupuesto S/<input type="number" name="budget" min="0" step="0.01" placeholder="0.00"></label>
            <label>Ícono
              <select name="icon">${["🎁", "🍰", "📸", "🪑", "🧊", "🎶", "🚕", "🎂", "💡", "🧹"].map(e => `<option>${e}</option>`).join("")}</select>
            </label>
            <button class="btn lime full" type="submit" style="justify-content:center">Agregar gasto</button>
          </form>
        </article>
      </div>`;
  }

  function renderInvitados() {
    const p = people(), c = state.calc, r = calcRes();
    const guestRows = state.guests.length ? state.guests.map((g, i) => `
      <div class="guest" data-gid="${g.id}">
        <span class="g-av" style="background:${["var(--lav)", "var(--mint)", "var(--cream)", "var(--blue)", "var(--peach)"][i % 5]}">${esc((g.name[0] || "?").toUpperCase())}</span>
        <div class="g-info"><b>${esc(g.name)}</b><small>${g.plus > 0 ? `+${g.plus} acompañante${g.plus > 1 ? "s" : ""}` : "Solo"}</small></div>
        <select class="status ${g.status}" data-field="gstatus">
          <option value="confirmado" ${g.status === "confirmado" ? "selected" : ""}>Confirmado</option>
          <option value="pendiente" ${g.status === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="no" ${g.status === "no" ? "selected" : ""}>No va</option>
        </select>
        <button class="icon-btn" data-action="delete-guest" title="Quitar">✕</button>
      </div>`).join("") : '<p class="empty">Aún no hay invitados.<br>Agrega el primero arriba 👆</p>';

    $("view-invitados").innerHTML = `
      <div class="stats-g">
        <div class="pastel mint"><span>Confirmados</span><strong>${p.conf}</strong></div>
        <div class="pastel cream"><span>Pendientes</span><strong>${p.pend}</strong></div>
        <div class="pastel lav"><span>No van</span><strong>${p.no}</strong></div>
        <div class="pastel lime"><span>Estimado para la fiesta</span><strong>${p.total}</strong></div>
      </div>

      <div class="grid">
        <article class="card span7">
          <h3>Lista de invitados</h3>
          <form class="add-guest" data-form="add-guest">
            <input type="text" name="name" placeholder="Nombre del invitado" required maxlength="40">
            <input type="number" name="plus" min="0" max="20" value="0" title="Acompañantes">
            <select name="status">
              <option value="confirmado">Confirmado</option>
              <option value="pendiente" selected>Pendiente</option>
              <option value="no">No va</option>
            </select>
            <button class="btn dark" type="submit">Agregar</button>
          </form>
          <p class="small muted" style="margin:-4px 0 10px">El número es la cantidad de acompañantes que trae.</p>
          ${guestRows}
        </article>

        <article class="card darkcard span5">
          <h3>🧮 Calculadora de la fiesta</h3>
          <p class="muted small" style="margin:0">Se calcula con <b style="color:#fff">${r.n} personas</b>. Ajusta los valores a tu gusto.</p>
          <label class="check"><input type="checkbox" data-calc="includePending" ${c.includePending ? "checked" : ""}> Contar también a los pendientes</label>
          <div class="form-grid" style="margin-top:12px">
            <label>% que toma alcohol<input type="number" data-calc="pctDrink" min="0" max="100" value="${c.pctDrink}"></label>
            <label>Botellas de cerveza por persona<input type="number" data-calc="beerPer" min="0" step="0.5" value="${c.beerPer}"></label>
            <label>Precio botella cerveza (S/)<input type="number" data-calc="beerPrice" min="0" step="0.1" value="${c.beerPrice}"></label>
            <label>Botellas por caja<input type="number" data-calc="beerCase" min="1" value="${c.beerCase}"></label>
            <label>Gaseosas por persona<input type="number" data-calc="sodaPer" min="0" step="0.5" value="${c.sodaPer}"></label>
            <label>Precio gaseosa vidrio (S/)<input type="number" data-calc="sodaPrice" min="0" step="0.1" value="${c.sodaPrice}"></label>
            <label class="full">Comida por persona (S/)<input type="number" data-calc="foodPer" min="0" step="0.5" value="${c.foodPer}"></label>
          </div>
          <div class="res">
            <div class="res-row"><span>🍽️ Comida<small>${r.n} porciones</small></span><b class="lm">${money(r.foodCost)}</b></div>
            <div class="res-row"><span>🍺 Cerveza<small>${r.bottles} botellas · ${r.cases} cajas · ${r.drinkers} toman</small></span><b class="lm">${money(r.beerCost)}</b></div>
            <div class="res-row"><span>🥤 Gaseosas<small>${r.sodas} botellas de vidrio</small></span><b class="lm">${money(r.sodaCost)}</b></div>
            <div class="res-row"><span><b>Total estimado</b></span><b class="lm">${money(r.total)}</b></div>
          </div>
          <button class="btn lime" data-action="apply-calc" style="margin-top:14px;width:100%;justify-content:center">Usar como presupuesto</button>
        </article>
      </div>`;
  }

  function renderHeader() {
    const name = state.name || "Cumpleañero";
    $("greetSmall").textContent = greeting() + " 👋";
    $("greetName").textContent = "Hola, " + name;
    $("avatar").textContent = state.name ? state.name[0].toUpperCase() : "🎂";
    const d = daysLeft();
    $("countdown").textContent = d === null ? "📅 Pon la fecha" : d === 0 ? "🎂 ¡Es hoy!" : `🎂 Faltan ${d} día${d > 1 ? "s" : ""}`;
    document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  }

  function render() {
    renderHeader();
    renderResumen();
    renderGastos();
    renderInvitados();
    ["resumen", "gastos", "invitados"].forEach(v => $("view-" + v).classList.toggle("active", v === view));
  }

  // ---------- Diálogos ----------
  function openProfile() {
    $("wName").value = state.name;
    $("wDate").value = state.eventDate;
    $("welcomeDialog").showModal();
  }
  function openSave(itemId) {
    const sel = $("sItem");
    sel.innerHTML = `<option value="__all">✨ Repartir entre todos</option>` +
      state.items.map(i => `<option value="${i.id}">${esc(i.icon)} ${esc(i.name)}</option>`).join("");
    if (itemId) sel.value = itemId;
    $("sAmount").value = "";
    $("sDate").value = todayStr();
    $("saveDialog").showModal();
  }

  function addSaving(it, amount, date) {
    if (amount > 0) it.savings.push({ id: uid(), date, amount: round2(amount) });
  }

  function distribute(amount, date) {
    const rems = state.items.map(i => Math.max(0, i.budget - saved(i)));
    let R = rems.reduce((a, b) => a + b, 0);
    let weights = rems;
    if (R === 0) { weights = state.items.map(() => 1); R = state.items.length; }
    let left = round2(amount);
    state.items.forEach((it, i) => {
      const part = i === state.items.length - 1 ? left : round2(amount * weights[i] / R);
      const val = Math.min(part, left);
      if (val > 0) { addSaving(it, val, date); left = round2(left - val); }
    });
  }

  // ---------- Eventos ----------
  const itemOf = el => { const c = el.closest("[data-id]"); return c ? state.items.find(i => i.id === c.dataset.id) : null; };

  document.addEventListener("click", e => {
    const t = e.target.closest("[data-action]");
    if (!t) return;
    const act = t.dataset.action;
    if (act === "goto") { view = t.dataset.view; location.hash = view; render(); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else if (act === "profile") openProfile();
    else if (act === "open-save") openSave();
    else if (act === "close") t.closest("dialog").close();
    else if (act === "toggle-eye") { state.hide = !state.hide; save(); render(); }
    else if (act === "delete-item") {
      const it = itemOf(t);
      if (it && confirm(`¿Eliminar "${it.name}" y todo su ahorro?`)) { state.items = state.items.filter(i => i.id !== it.id); save(); render(); }
    } else if (act === "delete-saving") {
      const it = itemOf(t);
      if (it) { it.savings = it.savings.filter(s => s.id !== t.dataset.sid); save(); render(); }
    } else if (act === "apply-item") {
      const it = itemOf(t);
      if (it) { it.budget = parseFloat(t.dataset.sug) || 0; save(); render(); }
    } else if (act === "delete-guest") {
      const g = t.closest("[data-gid]");
      if (g) { state.guests = state.guests.filter(x => x.id !== g.dataset.gid); save(); render(); }
    } else if (act === "apply-calc") {
      const r = calcRes();
      if (r.n === 0) { alert("Primero agrega invitados confirmados."); return; }
      const set = { comida: r.foodCost, cerveza: r.beerCost, gaseosas: r.sodaCost };
      state.items.forEach(it => { if (set[it.key] !== undefined) it.budget = round2(set[it.key]); });
      save(); view = "gastos"; location.hash = view; render();
    } else if (act === "export") {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "ahorro-cumple.json";
      a.click();
      URL.revokeObjectURL(a.href);
    } else if (act === "import") $("importFile").click();
    else if (act === "reset") {
      if (confirm("¿Borrar todos los datos y empezar de cero?")) { state = defaultState(); save(); render(); openProfile(); }
    }
  });

  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.field === "budget") {
      const it = itemOf(t);
      if (it) { it.budget = Math.max(0, parseFloat(t.value) || 0); save(); render(); }
    } else if (t.dataset.field === "gstatus") {
      const g = state.guests.find(x => x.id === t.closest("[data-gid]").dataset.gid);
      if (g) { g.status = t.value; save(); render(); }
    } else if (t.dataset.calc) {
      state.calc[t.dataset.calc] = t.type === "checkbox" ? t.checked : Math.max(0, parseFloat(t.value) || 0);
      save(); render();
    } else if (t.id === "importFile") {
      const file = t.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!Array.isArray(data.items)) throw new Error("x");
          const d = defaultState();
          state = { ...d, ...data, calc: { ...d.calc, ...(data.calc || {}) } };
          save(); render();
        } catch (err) { alert("Archivo no válido."); }
      };
      reader.readAsText(file);
      t.value = "";
    }
  });

  document.addEventListener("submit", e => {
    const f = e.target;
    if (f.id === "welcomeForm") {
      e.preventDefault();
      state.name = $("wName").value.trim();
      state.eventDate = $("wDate").value;
      save(); $("welcomeDialog").close(); render();
    } else if (f.id === "saveForm") {
      e.preventDefault();
      const amount = parseFloat($("sAmount").value), date = $("sDate").value || todayStr();
      if (!(amount > 0)) return;
      if ($("sItem").value === "__all") distribute(amount, date);
      else { const it = state.items.find(i => i.id === $("sItem").value); if (it) addSaving(it, amount, date); }
      save(); $("saveDialog").close(); render();
    } else if (f.dataset.form === "item-saving") {
      e.preventDefault();
      const it = itemOf(f), amount = parseFloat(f.amount.value);
      if (it && amount > 0) { addSaving(it, amount, f.date.value || todayStr()); save(); render(); }
    } else if (f.dataset.form === "add-item") {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) return;
      state.items.push({ id: uid(), key: "", icon: f.icon.value, name, budget: Math.max(0, parseFloat(f.budget.value) || 0), savings: [] });
      save(); render();
    } else if (f.dataset.form === "add-guest") {
      e.preventDefault();
      const name = f.name.value.trim();
      if (!name) return;
      state.guests.push({ id: uid(), name, plus: Math.max(0, parseInt(f.plus.value, 10) || 0), status: f.status.value });
      save(); render();
    }
  });

  $("welcomeDialog").addEventListener("cancel", e => { if (!state.name) e.preventDefault(); });
  window.addEventListener("hashchange", () => {
    const v = location.hash.slice(1);
    if (["resumen", "gastos", "invitados"].includes(v)) { view = v; render(); }
  });

  render();
  if (!state.name) openProfile();
})();
