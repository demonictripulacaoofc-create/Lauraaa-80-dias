/* TRT PRO — site do curso. Toda a tela é montada com createElement/textContent
   (nunca innerHTML), então texto digitado por usuários não vira código. */
(() => {
  "use strict";

  /* ---------- proteções básicas ---------- */
  if (window.top !== window.self) { document.documentElement.textContent = ""; throw new Error("frame bloqueado"); }
  try { console.log("%cPARE!", "color:#ffe600;font:900 42px sans-serif", "\nSe alguém pediu para você colar algo aqui, é golpe: isso pode dar acesso à sua conta."); } catch (_) {}

  const API = window.Server;
  const $ = (s, r = document) => r.querySelector(s);
  const SVGNS = "http://www.w3.org/2000/svg";
  const UUID = /^[a-zA-Z0-9-]{8,64}$/;

  /* ---------- montagem segura de elementos ---------- */
  function safeUrl(v) {
    const s = String(v || "");
    if (/^(#|\.\/|[a-z0-9_-]+\.(png|html))/i.test(s) || s.startsWith("blob:") || s.startsWith("https://")) return s;
    return "#/";
  }
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
      else if (k === "href" || k === "src") el.setAttribute(k, safeUrl(v));
      else if (k === "dataset") Object.assign(el.dataset, v);
      else if (k === "value") el.value = v;
      else if (k === "checked") el.checked = !!v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, String(v));
    }
    add(el, kids);
    return el;
  }
  function add(el, kids) {
    for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : String(c)); }
    return el;
  }
  const ICONS = {
    play: "M7 4v16l13-8z", lock: "M6 11h12v10H6zM8 11V8a4 4 0 0 1 8 0v3", check: "M4 12l5 5L20 6",
    chev: "M9 6l6 6-6 6", back: "M15 6l-6 6 6 6", up: "M6 15l6-6 6 6", down: "M6 9l6 6 6-6",
    plus: "M12 5v14M5 12h14", x: "M6 6l12 12M18 6 6 18", edit: "M4 20h4L20 8l-4-4L4 16zM14 6l4 4",
    trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13", clip: "M21 11l-9 9a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8",
    send: "M4 12l16-8-6 16-3-7z", copy: "M8 8h12v12H8zM4 16V4h12", chat: "M4 5h16v11H8l-4 4z",
    user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0", file: "M6 3h8l4 4v14H6zM14 3v4h4",
    out: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10", info: "M12 8h.01M11 12h1v5h1M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
    shield: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z", film: "M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 16h4M16 8h4M16 16h4"
  };
  function ic(name) {
    const s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("class", "i"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("aria-hidden", "true");
    const p = document.createElementNS(SVGNS, "path"); p.setAttribute("d", ICONS[name] || ""); s.append(p);
    return s;
  }

  /* ---------- formatação ---------- */
  const money = c => (Number(c || 0) / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const dt = t => t ? new Date(t).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
  const hm = t => new Date(t).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const norm = s => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b}`;
  const hours = min => min >= 60 ? `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}` : `${min}min`;
  const initial = s => (String(s || "?").trim()[0] || "?").toUpperCase();
  const STATUS = { pending: "Aguardando Pix", review: "Em análise", approved: "Aprovado", rejected: "Recusado", canceled: "Cancelado" };
  const statusTag = s => h("span", { class: "status st-" + s, text: STATUS[s] || s });
  const errMsg = e => (e instanceof API.ApiError) ? e.message : "Algo deu errado. Tente de novo.";

  /* ---------- toasts / modal ---------- */
  function toast(msg, kind = "") {
    const t = h("div", { class: "toast " + kind, text: msg });
    $("#toasts").append(t);
    setTimeout(() => t.remove(), 4200);
  }
  const modal = $("#modal"), modalIn = $("#modalIn");
  function openModal(...kids) {
    modalIn.replaceChildren(...kids);
    if (!modal.open) modal.showModal();
    const f = modalIn.querySelector("input,textarea,select,button.btn-y,button.btn-c");
    if (f) setTimeout(() => f.focus(), 30);
  }
  const closeModal = () => { if (modal.open) modal.close(); modalIn.replaceChildren(); };
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  function confirmBox(title, text, okLabel = "Confirmar", danger = false) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (done) return; done = true; closeModal(); res(v); };
      modal.addEventListener("close", () => fin(false), { once: true });
      openModal(h("h3", { text: title }), h("p", { class: "mute", text }),
        h("div", { class: "modal-acts" },
          h("button", { class: "btn btn-g", type: "button", text: "Cancelar", onclick: () => fin(false) }),
          h("button", { class: "btn " + (danger ? "btn-bad" : "btn-y"), type: "button", text: okLabel, onclick: () => fin(true) })));
    });
  }
  function promptBox(title, label, { max = 300, okLabel = "Enviar", multiline = true } = {}) {
    return new Promise(res => {
      let done = false;
      const fin = v => { if (done) return; done = true; closeModal(); res(v); };
      modal.addEventListener("close", () => fin(null), { once: true });
      const inp = multiline ? h("textarea", { class: "in", maxlength: max }) : h("input", { class: "in", maxlength: max });
      openModal(h("h3", { text: title }), h("label", { class: "fl" }, h("span", { text: label }), inp),
        h("div", { class: "modal-acts" },
          h("button", { class: "btn btn-g", type: "button", text: "Cancelar", onclick: () => fin(null) }),
          h("button", { class: "btn btn-y", type: "button", text: okLabel, onclick: () => fin(inp.value) })));
    });
  }
  async function busy(btn, fn) {
    if (btn.classList.contains("is-busy")) return;
    btn.classList.add("is-busy"); btn.setAttribute("aria-busy", "true");
    try { return await fn(); }
    catch (e) { console.error(e); toast(errMsg(e), "bad"); }
    finally { btn.classList.remove("is-busy"); btn.removeAttribute("aria-busy"); }
  }
  async function copyText(t) {
    try { await navigator.clipboard.writeText(t); toast("Copiado!", "ok"); }
    catch (_) { toast("Não deu para copiar automaticamente. Selecione e copie.", "bad"); }
  }

  /* ---------- estado ---------- */
  const S = { me: null, settings: null, cats: [], lessons: [], progress: {}, urls: new Map() };
  const staff = () => !!S.me && (S.me.role === "staff" || S.me.role === "owner");
  const owner = () => !!S.me && S.me.role === "owner";
  const access = () => !!S.me && (S.me.has_access || staff());
  const canWatch = l => l.is_free || access();
  const catName = id => (S.cats.find(c => c.id === id) || {}).name || "Sem categoria";
  const lessonsOf = cid => S.lessons.filter(l => l.category_id === cid && (l.published || staff()));
  const visible = () => S.lessons.filter(l => l.published);

  async function fileUrl(id) {
    if (!id) return null;
    if (S.urls.has(id)) return S.urls.get(id);
    try { const u = await API.fileUrl(id); if (u) S.urls.set(id, u); return u; } catch (e) { return null; }
  }
  function forgetUrls() { for (const u of S.urls.values()) URL.revokeObjectURL(u); S.urls.clear(); }

  async function loadAll() {
    const [cat, me] = await Promise.all([API.catalog(), API.me()]);
    S.settings = cat.settings; S.cats = cat.categories; S.lessons = cat.lessons; S.me = me;
    S.progress = me ? await API.progress() : {};
    applyChrome();
  }

  /* ---------- cabeçalho / marca ---------- */
  function applyChrome() {
    const brand = S.settings ? S.settings.brand : "TRT PRO";
    document.querySelectorAll(".brand-txt").forEach(e => { e.textContent = brand; });
    document.title = `${brand} — Curso de Edição`;
    const av = $("#avatar");
    if (S.me) { av.textContent = initial(S.me.name || S.me.email); av.href = "#/conta"; av.classList.add("logged"); av.setAttribute("aria-label", "Minha conta"); }
    else { av.textContent = ""; av.append(ic("user")); av.href = "#/entrar"; av.classList.remove("logged"); av.setAttribute("aria-label", "Entrar"); }
    $("#navPainel").hidden = !staff();
    $("#buyTop").hidden = access();
    refreshBadge();
  }
  async function refreshBadge() {
    let n = 0; try { n = await API.badge(); } catch (_) {}
    $("#bellDot").hidden = !n;
    $("#bellBtn").href = staff() ? "#/painel/conversas" : "#/suporte";
    $("#bellBtn").setAttribute("aria-label", n ? `Mensagens (${n} novas)` : "Mensagens");
  }
  $("#year").textContent = new Date().getFullYear();

  /* ---------- busca ---------- */
  const sBox = $("#search"), sIn = $("#searchIn"), sRes = $("#searchRes");
  $("#searchBtn").addEventListener("click", () => {
    sBox.hidden = !sBox.hidden; $("#searchBtn").setAttribute("aria-expanded", String(!sBox.hidden));
    if (!sBox.hidden) { sIn.value = ""; sRes.replaceChildren(); sIn.focus(); }
  });
  sIn.addEventListener("input", () => {
    const q = norm(sIn.value).trim();
    if (!q) return sRes.replaceChildren();
    const hit = visible().filter(l => norm([l.title.replace(/\|/g, " "), l.kicker, catName(l.category_id), l.software].join(" ")).includes(q)).slice(0, 8);
    sRes.replaceChildren(...(hit.length ? hit.map(l => h("a", { href: "#/aula/" + l.id, onclick: () => { sBox.hidden = true; } },
      poster(l, { mini: true, link: false }), h("div", null, h("b", { text: l.title.replace(/\|/g, " ") }), h("br"), h("small", { class: "mute", text: catName(l.category_id) })))) :
      [h("p", { class: "mute", style: null, text: "Nada encontrado." })]));
    if (!hit.length) sRes.firstChild.classList.add("empty");
  });
  document.addEventListener("keydown", e => { if (e.key === "Escape" && !sBox.hidden) { sBox.hidden = true; } });

  /* ---------- pôster (capa da aula) ---------- */
  function titleLines(t) {
    t = String(t || "");
    if (t.includes("|")) return t.split("|").map(s => s.trim()).filter(Boolean).slice(0, 3);
    const w = t.split(/\s+/).filter(Boolean);
    if (w.length < 2) return [t];
    const m = Math.ceil(w.length / 2);
    return [w.slice(0, m).join(" "), w.slice(m).join(" ")];
  }
  function poster(l, { mini = false, link = true, num = null } = {}) {
    const p = h(link ? "a" : "div", { class: `poster pal-${l.palette || 1}${mini ? " mini" : ""}`, href: link ? "#/aula/" + l.id : null,
      "aria-label": link ? l.title.replace(/\|/g, " ") : null });
    p.append(h("div", { class: "pat" }));
    if (l.thumb) {
      const img = h("img", { class: "img", alt: "", loading: "lazy", decoding: "async" });
      fileUrl(l.thumb).then(u => { if (u) img.src = u; else img.remove(); });
      p.append(img, h("div", { class: "shade" }));
    }
    if (l.software) p.append(h("span", { class: "sw", text: l.software }));
    if (!canWatch(l)) p.append(h("span", { class: "lock", title: "Bloqueada" }, ic("lock")));
    if (l.is_free) p.append(h("span", { class: "badge free", text: "GRÁTIS" }));
    else if (!l.published) p.append(h("span", { class: "badge", text: "RASCUNHO" }));
    p.append(h("div", { class: "txt" },
      l.kicker ? h("span", { class: "k", text: l.kicker }) : null,
      h("span", { class: "t" }, titleLines(l.title).map(s => h("span", { text: s })))));
    p.append(h("span", { class: "ft", text: `${l.duration_min || 0} min · ${catName(l.category_id)}` }));
    const pr = S.progress[l.id];
    if (pr && !mini) { const bar = h("span", { class: "prog" }); bar.style.width = pr.done ? "100%" : Math.min(95, 8 + (pr.seconds / Math.max(60, (l.duration_min || 1) * 60)) * 100) + "%"; p.append(bar); }
    if (num != null) return h("a", { class: "num-card", href: "#/aula/" + l.id, "aria-label": l.title.replace(/\|/g, " ") }, h("span", { class: "num", "aria-hidden": "true", text: String(num) }), p);
    return p;
  }
  function rail(items, { nums = false } = {}) {
    const r = h("div", { class: "rail" + (nums ? " nums" : "") }, items);
    const go = d => r.scrollBy({ left: d * r.clientWidth * 0.85, behavior: "smooth" });
    return h("div", { class: "rail-w" },
      h("button", { class: "rail-btn l", type: "button", "aria-label": "Voltar", onclick: () => go(-1) }, ic("back")),
      r,
      h("button", { class: "rail-btn r", type: "button", "aria-label": "Avançar", onclick: () => go(1) }, ic("chev")));
  }
  function row(title, code, items, { id = null, more = null, nums = false } = {}) {
    return h("section", { class: "row", id, dataset: id ? { cat: id } : undefined },
      h("div", { class: "row-h" }, h("h2", { text: title }), h("span", { class: "mono", text: code }),
        more ? h("a", { class: "more", href: more, text: "Ver tudo ›" }) : null),
      rail(items, { nums }));
  }

  /* ---------- roteador ---------- */
  const view = $("#view");
  let cleanups = [];
  const onLeave = fn => cleanups.push(fn);
  function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, qs] = raw.split("?");
    return { parts: path.split("/").filter(Boolean).map(decodeURIComponent), q: new URLSearchParams(qs || "") };
  }
  const go = h2 => { if (location.hash === h2) route(); else location.hash = h2; };
  const ROUTES = {
    "": viewHome, aulas: viewAulas, aula: viewLesson, entrar: viewAuth, comprar: viewBuy,
    pagamento: viewPay, suporte: viewSupport, conta: viewAccount, painel: viewPanel
  };
  let routing = 0;
  async function route() {
    const my = ++routing;
    cleanups.forEach(f => { try { f(); } catch (_) {} }); cleanups = [];
    closeModal();
    const { parts, q } = parseHash();
    const name = parts[0] || "";
    const fn = ROUTES[name] || viewNotFound;
    document.querySelectorAll(".nav a").forEach(a => a.classList.toggle("on", a.dataset.nav === (name || "home") || (name === "aula" && a.dataset.nav === "aulas")));
    view.replaceChildren(h("div", { class: "spin", role: "progressbar", "aria-label": "Carregando" }));
    try {
      const out = await fn(parts.slice(1), q);
      if (my !== routing) return;
      view.replaceChildren(...[].concat(out || []));
      window.scrollTo(0, 0);
    } catch (e) {
      console.error(e);
      if (my === routing) view.replaceChildren(h("div", { class: "page" }, h("div", { class: "empty", text: errMsg(e) })));
    }
  }
  window.addEventListener("hashchange", route);
  function needLogin(next) { go("#/entrar?next=" + encodeURIComponent(next)); return []; }

  /* ================= INÍCIO ================= */
  async function viewHome() {
    const st = S.settings, pub = visible();
    const totalMin = pub.reduce((s, l) => s + (l.duration_min || 0), 0);
    const first = pub.find(l => l.featured) || pub[0];
    const lines = titleLines(st.hero_title).slice(0, 3);

    const hero = h("section", { class: "hero" },
      h("div", { class: "hero-bg" }),
      h("div", { class: "hero-ghost", "aria-hidden": "true", text: (lines[0] || "EDIÇÃO").split(" ")[0] }),
      h("div", { class: "hero-in" },
        h("div", null,
          h("span", { class: "kicker", text: st.hero_kicker }),
          h("h1", null, lines.map(s => h("span", { text: s }))),
          h("div", { class: "tags" },
            h("span", { class: "tag y", text: "Acesso vitalício" }),
            h("span", { class: "tag", text: plural(pub.length, "aula", "aulas") }),
            h("span", { class: "tag", text: hours(totalMin) + " de conteúdo" }),
            h("span", { class: "tag c", text: "Premiere · After · DaVinci" })),
          h("p", { class: "lead", text: st.hero_text }),
          h("div", { class: "hero-btns" },
            first ? h("a", { class: "btn btn-w btn-lg", href: "#/aula/" + first.id }, ic("play"), access() ? "Assistir" : "Aula grátis") : null,
            access() ? h("a", { class: "btn btn-g btn-lg", href: "#/aulas", text: "Minhas aulas" })
              : h("a", { class: "btn btn-y btn-lg", href: "#/comprar", text: "Comprar curso" }))),
        priceCard(pub.length, totalMin)));

    // timeline: cada categoria vira um clipe; a agulha acompanha a rolagem
    const cats = S.cats.filter(c => lessonsOf(c.id).some(l => l.published));
    const ph = h("span", { class: "playhead" });
    const tc = h("span", { class: "tc", text: "00:00:00:00" });
    const tl = h("div", { class: "tl", "aria-label": "Linha do tempo do curso" },
      h("div", { class: "tl-ruler" }),
      h("div", { class: "tl-row" },
        h("div", { class: "tl-track" },
          cats.map(c => {
            const n = lessonsOf(c.id).filter(l => l.published).length;
            const b = h("button", { class: "clip", type: "button", title: c.name, onclick: () => { const r = document.getElementById("cat-" + c.id); if (r) r.scrollIntoView({ behavior: "smooth", block: "center" }); } },
              c.name, h("em", { text: "V" + n }));
            b.style.setProperty("--n", String(Math.max(1, n)));
            return b;
          }), ph),
        tc));
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const r = max > 0 ? Math.min(1, scrollY / max) : 0;
      ph.style.left = (r * 100) + "%";
      const sec = r * totalMin * 60, fr = Math.floor((sec % 1) * 24);
      const p = n => String(Math.floor(n)).padStart(2, "0");
      tc.textContent = `${p(sec / 3600)}:${p((sec / 60) % 60)}:${p(sec % 60)}:${p(fr)}`;
    };
    addEventListener("scroll", onScroll, { passive: true }); onLeave(() => removeEventListener("scroll", onScroll));

    // filtros
    const rows = [];
    const chips = h("div", { class: "chips", role: "toolbar", "aria-label": "Filtrar por categoria" });
    const setF = id => {
      chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.id === id));
      rows.forEach(r => { r.hidden = id !== "all" && r.dataset.cat !== id; });
    };
    chips.append(h("button", { class: "chip on", type: "button", dataset: { id: "all" }, onclick: () => setF("all") }, "Tudo", h("em", { text: String(pub.length) })));
    cats.forEach(c => chips.append(h("button", { class: "chip", type: "button", dataset: { id: c.id }, onclick: () => setF(c.id) }, c.name, h("em", { text: String(lessonsOf(c.id).filter(l => l.published).length) }))));

    const out = [hero, tl, chips];
    const cont = pub.filter(l => S.progress[l.id] && !S.progress[l.id].done).sort((a, b) => S.progress[b.id].at - S.progress[a.id].at);
    if (cont.length) out.push(row("Continue de onde parou", "TRK 01", cont.map(l => poster(l))));
    const feat = pub.filter(l => l.featured);
    if (feat.length) out.push(row("Mais desejados", "TRK 02", feat.map(l => poster(l))));
    const seq = [];
    cats.forEach(c => lessonsOf(c.id).filter(l => l.published).forEach(l => seq.push(l)));
    if (seq.length >= 3) out.push(row("Comece por aqui · a trilha", "TOP 10", seq.slice(0, 10).map((l, i) => poster(l, { num: i + 1 })), { nums: true }));
    out.push(buyBanner());
    cats.forEach((c, i) => {
      const r = row(c.name, "TRK " + String(i + 3).padStart(2, "0"), lessonsOf(c.id).filter(l => l.published).map(l => poster(l)), { id: c.id, more: "#/aulas/" + c.id });
      r.id = "cat-" + c.id; rows.push(r); out.push(r);
    });
    if (!pub.length) out.push(h("div", { class: "row" }, h("div", { class: "empty", text: "Nenhuma aula publicada ainda." })));
    requestAnimationFrame(onScroll);
    return out;
  }
  function priceCard(n, min) {
    const st = S.settings;
    return h("aside", { class: "price-card", "aria-label": "Preço do curso" },
      h("div", { class: "mono" }, h("span", { class: "rec", text: "REC · VAGAS ABERTAS" }), h("span", { text: "PIX" })),
      h("h3", { text: "Curso completo de edição" }),
      h("div", { class: "big-price" }, h("small", { text: "por" }), money(st.price_cents)),
      h("div", { class: "counts" },
        h("div", null, h("b", { text: String(n) }), h("span", { text: "aulas" })),
        h("div", null, h("b", { text: hours(min) }), h("span", { text: "horas" })),
        h("div", null, h("b", { text: "∞" }), h("span", { text: "acesso" }))),
      access() ? h("a", { class: "btn btn-c btn-block", href: "#/aulas" }, ic("check"), "Você já tem acesso")
        : h("a", { class: "btn btn-y btn-block", href: "#/comprar", text: "Quero comprar" }));
  }
  function buyBanner() {
    return h("section", { class: "banner" },
      h("div", null,
        h("h2", null, "Pague no Pix,", h("br"), "comece hoje"),
        h("p", { text: "Sem cartão, sem complicação. Você paga pelo Pix, manda o comprovante no chat e a nossa equipe libera seu acesso." }),
        h("a", { class: "btn btn-y btn-lg", href: access() ? "#/aulas" : "#/comprar", text: access() ? "Ir para as aulas" : "Ver como comprar" })),
      h("div", { class: "steps" }, tutorialSteps().slice(0, 4).map(([t, d], i) =>
        h("div", { class: "step" }, h("b", { class: "n", text: String(i + 1) }), h("div", null, h("h4", { text: t }), h("p", { text: d }))))));
  }
  function tutorialSteps() {
    return [
      ["Entre na sua conta", "Crie uma conta grátis ou faça login. É nela que o curso vai aparecer."],
      ["Aperte “Comprar curso”", "Você vai para a tela de pagamento com o QR Code, a chave Pix e o valor."],
      ["Pague com Pix", "Abra o app do seu banco, escaneie o QR Code ou use o Pix copia e cola."],
      ["Aperte “Já paguei”", "Abre um chat privado com a equipe. Envie lá o print ou PDF do comprovante."],
      ["Receba o acesso", "A equipe confere o pagamento e libera o curso na sua conta. Você recebe o aviso no chat e as aulas destravam na hora."]
    ];
  }

  /* ================= TODAS AS AULAS ================= */
  async function viewAulas([cid]) {
    const pub = visible();
    const sel = cid && S.cats.some(c => c.id === cid) ? cid : "all";
    const grid = h("div", { class: "grid" });
    const chips = h("div", { class: "chips" });
    const draw = id => {
      chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c.dataset.id === id));
      const list = id === "all" ? S.cats.flatMap(c => lessonsOf(c.id).filter(l => l.published)).concat(pub.filter(l => !l.category_id)) : lessonsOf(id).filter(l => l.published);
      grid.replaceChildren(...(list.length ? list.map(l => poster(l)) : [h("div", { class: "empty", text: "Nenhuma aula nesta categoria ainda." })]));
    };
    chips.append(h("button", { class: "chip", type: "button", dataset: { id: "all" }, onclick: () => draw("all") }, "Tudo", h("em", { text: String(pub.length) })));
    S.cats.forEach(c => chips.append(h("button", { class: "chip", type: "button", dataset: { id: c.id }, onclick: () => draw(c.id) }, c.name, h("em", { text: String(lessonsOf(c.id).filter(l => l.published).length) }))));
    draw(sel);
    const n = pub.filter(l => S.progress[l.id] && S.progress[l.id].done).length;
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", null, "Todas as ", h("em", { text: "aulas" })),
        S.me && access() ? h("span", { class: "tag c", text: `${n}/${pub.length} concluídas` }) : h("a", { class: "btn btn-y btn-sm", href: "#/comprar", text: "Liberar todas" })),
      chips, grid);
  }

  /* ================= AULA ================= */
  async function viewLesson([id]) {
    const l = UUID.test(id || "") && S.lessons.find(x => x.id === id && (x.published || staff()));
    if (!l) return viewNotFound();
    const list = (l.category_id ? lessonsOf(l.category_id) : S.lessons.filter(x => !x.category_id)).filter(x => x.published || staff());
    const i = list.findIndex(x => x.id === l.id), prev = list[i - 1], next = list[i + 1];
    const player = h("div", { class: "player" });
    const doneBtn = h("button", { class: "btn btn-g btn-sm", type: "button" });
    const setDoneLbl = () => { const d = S.progress[l.id] && S.progress[l.id].done; doneBtn.replaceChildren(ic("check"), d ? "Concluída" : "Marcar como concluída"); doneBtn.classList.toggle("btn-c", !!d); };
    setDoneLbl();
    doneBtn.addEventListener("click", async () => {
      if (!S.me) return needLogin("aula/" + l.id);
      const d = !(S.progress[l.id] && S.progress[l.id].done);
      await API.saveProgress(l.id, (S.progress[l.id] || {}).seconds || 0, d);
      S.progress = await API.progress(); setDoneLbl();
    });

    if (!canWatch(l)) {
      player.append(h("div", { class: `locked pal-${l.palette}` }, h("div", { class: "pat" }),
        h("div", null, h("div", { class: "ic" }, ic("lock")), h("h3", { text: "Aula exclusiva para alunos" }),
          h("p", { class: "mute", text: "Compre o curso para liberar esta e todas as outras aulas." }),
          h("div", { class: "hero-btns center" },
            h("a", { class: "btn btn-y", href: "#/comprar", text: "Comprar curso · " + money(S.settings.price_cents) }),
            !S.me ? h("a", { class: "btn btn-g", href: "#/entrar?next=" + encodeURIComponent("aula/" + l.id), text: "Já sou aluno" }) : null))));
    } else {
      player.append(h("div", { class: "spin" }));
      mountPlayer(player, l);
    }

    const side = h("aside", { class: "card pl" },
      h("h3", { text: catName(l.category_id) }),
      h("p", { class: "mute mono small", text: plural(list.length, "aula", "aulas") }),
      list.map(x => {
        const pr = S.progress[x.id];
        return h("a", { href: "#/aula/" + x.id, class: x.id === l.id ? "on" : "", "aria-current": x.id === l.id ? "page" : null },
          poster(x, { mini: true, link: false }),
          h("div", null, h("b", { text: x.title.replace(/\|/g, " ") }),
            h("small", null, `${x.duration_min} min`, !canWatch(x) ? " · 🔒" : "", pr && pr.done ? h("span", { class: "ok", text: " · ✓ vista" }) : "")));
      }));

    return h("div", { class: "lesson" },
      h("div", null, player,
        h("div", { class: "tags lesson-tags" },
          h("span", { class: "tag c", text: catName(l.category_id) }),
          l.software ? h("span", { class: "tag", text: { Pr: "Premiere Pro", Ae: "After Effects", Ps: "Photoshop", Dv: "DaVinci Resolve", Cc: "CapCut", Ai: "Illustrator", Bl: "Blender" }[l.software] }) : null,
          h("span", { class: "tag", text: l.duration_min + " min" }),
          l.is_free ? h("span", { class: "tag y", text: "Grátis" }) : null,
          !l.published ? h("span", { class: "tag", text: "Rascunho (só a equipe vê)" }) : null),
        h("h1", { text: l.title.replace(/\|/g, " ") }),
        l.kicker ? h("p", { class: "mute", text: l.kicker }) : null,
        h("div", { class: "hero-btns lesson-btns" },
          prev ? h("a", { class: "btn btn-g btn-sm", href: "#/aula/" + prev.id }, ic("back"), "Anterior") : null,
          canWatch(l) && S.me ? doneBtn : null,
          next ? h("a", { class: "btn btn-c btn-sm", href: "#/aula/" + next.id }, "Próxima", ic("chev")) : null,
          owner() ? h("a", { class: "btn btn-o btn-sm", href: "#/painel/aulas?editar=" + l.id }, ic("edit"), "Editar") : null),
        h("p", { class: "desc", text: l.description })),
      side);
  }
  async function mountPlayer(box, l) {
    let m;
    try { m = await API.media(l.id); } catch (e) { box.replaceChildren(h("div", { class: "locked" }, h("p", { text: errMsg(e) }))); return; }
    if (m.locked) { box.replaceChildren(h("div", { class: "locked" }, h("p", { text: "Aula bloqueada." }))); return; }
    if (m.url) {
      const v = API.parseVideoUrl(m.url);
      if (!v) { box.replaceChildren(h("div", { class: "locked" }, h("p", { text: "Link de vídeo inválido." }))); return; }
      const src = v.type === "youtube" ? `https://www.youtube-nocookie.com/embed/${v.id}?rel=0&modestbranding=1`
        : `https://player.vimeo.com/video/${v.id}${v.h ? "?h=" + encodeURIComponent(v.h) : ""}`;
      box.replaceChildren(h("iframe", { src, title: l.title.replace(/\|/g, " "), allow: "autoplay; fullscreen; picture-in-picture; encrypted-media",
        allowfullscreen: true, referrerpolicy: "strict-origin-when-cross-origin", sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups" }));
      return;
    }
    if (!m.file) {
      box.replaceChildren(h("div", { class: `locked pal-${l.palette}` }, h("div", { class: "pat" }),
        h("div", null, h("div", { class: "ic" }, ic("film")), h("h3", { text: "Vídeo em produção" }),
          h("p", { class: "mute", text: owner() ? "Envie o vídeo desta aula pelo Painel > Aulas > Editar." : "Esta aula ainda está sendo finalizada. Volte em breve!" }))));
      return;
    }
    const url = await fileUrl(m.file);
    if (!url) { box.replaceChildren(h("div", { class: "locked" }, h("p", { text: "Não foi possível carregar o vídeo." }))); return; }
    const vid = h("video", { controls: true, playsinline: true, preload: "metadata", controlslist: "nodownload", disablepictureinpicture: true });
    vid.src = url;
    vid.addEventListener("contextmenu", e => e.preventDefault());
    const pr = S.progress[l.id];
    vid.addEventListener("loadedmetadata", () => { if (pr && pr.seconds && pr.seconds < vid.duration - 5) vid.currentTime = pr.seconds; }, { once: true });
    let last = 0;
    const save = (done = null) => { if (S.me) API.saveProgress(l.id, vid.currentTime, done).then(async () => { S.progress = await API.progress(); }); };
    vid.addEventListener("timeupdate", () => { if (Math.abs(vid.currentTime - last) > 10) { last = vid.currentTime; save(); } });
    vid.addEventListener("pause", () => save());
    vid.addEventListener("ended", () => save(true));
    onLeave(() => { try { if (!vid.paused) save(); vid.pause(); vid.removeAttribute("src"); vid.load(); } catch (_) {} });
    box.replaceChildren(vid);
  }

  /* ================= ENTRAR / CRIAR CONTA ================= */
  async function viewAuth(_, q) {
    const next = (q.get("next") || "").replace(/[^a-z0-9/_?=-]/gi, "");
    const dest = "#/" + (next || "");
    if (S.me) { go(dest); return []; }
    let mode = q.get("modo") === "criar" ? "up" : "in";
    const err = h("p", { class: "err", role: "alert" });
    const email = h("input", { class: "in", type: "email", autocomplete: "email", maxlength: 120, required: true, inputmode: "email" });
    const pass = h("input", { class: "in", type: "password", autocomplete: "current-password", maxlength: 128, required: true, minlength: 8 });
    const name = h("input", { class: "in", type: "text", autocomplete: "name", maxlength: 60 });
    const hp = h("input", { class: "hp", type: "text", tabindex: "-1", autocomplete: "off", "aria-hidden": "true", name: "website" });
    const nameRow = h("label", { class: "fl" }, h("span", { text: "Seu nome" }), name);
    const passHint = h("small", { text: "Mínimo 8 caracteres, com letras e números." });
    const sub = h("button", { class: "btn btn-y btn-block btn-lg", type: "submit" });
    const tIn = h("button", { type: "button", text: "Entrar", onclick: () => setMode("in") });
    const tUp = h("button", { type: "button", text: "Criar conta", onclick: () => setMode("up") });
    const showPass = h("button", { class: "btn btn-g btn-xs", type: "button", text: "mostrar", onclick: () => { pass.type = pass.type === "password" ? "text" : "password"; showPass.textContent = pass.type === "password" ? "mostrar" : "ocultar"; } });
    function setMode(m) {
      mode = m; err.textContent = "";
      tIn.classList.toggle("on", m === "in"); tUp.classList.toggle("on", m === "up");
      nameRow.hidden = m !== "up"; passHint.hidden = m !== "up";
      pass.autocomplete = m === "up" ? "new-password" : "current-password";
      sub.textContent = m === "up" ? "Criar minha conta" : "Entrar";
    }
    setMode(mode);
    const form = h("form", { class: "f", novalidate: true, onsubmit: e => {
      e.preventDefault(); err.textContent = "";
      if (hp.value) return; // robô
      busy(sub, async () => {
        try {
          S.me = mode === "up" ? await API.signUp(email.value, pass.value, name.value) : await API.signIn(email.value, pass.value);
          pass.value = "";
          await loadAll();
          toast(mode === "up" ? "Conta criada! Bem-vindo(a) 🎬" : "Que bom te ver de novo!", "ok");
          go(dest);
        } catch (e2) { err.textContent = errMsg(e2); }
      });
    } },
      h("div", { class: "tabs", role: "tablist" }, tIn, tUp),
      nameRow,
      h("label", { class: "fl" }, h("span", { text: "E-mail" }), email),
      h("label", { class: "fl" }, h("span", { class: "row-sp" }, "Senha", showPass), pass, passHint),
      hp, err, sub);
    const demo = h("div", { class: "note y demo-acc" },
      h("b", { text: "Contas de teste do simulado" }),
      h("p", null, "Dono: ", h("code", { text: API.DEMO.owner.email }), " / ", h("code", { text: API.DEMO.owner.pass })),
      h("p", null, "Staff: ", h("code", { text: API.DEMO.staff.email }), " / ", h("code", { text: API.DEMO.staff.pass })),
      h("p", { class: "mute", text: "Ou crie uma conta de aluno para testar a compra." }));
    return h("div", { class: "auth" },
      h("div", { class: "auth-art" }, h("span", { class: "mono", text: "REC ● 00:00:00:01" }), h("h2", null, "Seu", h("br"), "próximo", h("br"), "corte")),
      h("div", { class: "auth-box" }, h("div", { class: "card" },
        h("h3", { text: next.startsWith("pagamento") || next.startsWith("comprar") ? "Entre para comprar o curso" : "Acesse sua conta" }), form, demo)));
  }

  /* ================= COMPRAR ================= */
  async function viewBuy() {
    const st = S.settings, pub = visible();
    const totalMin = pub.reduce((s, l) => s + (l.duration_min || 0), 0);
    let orders = [];
    if (S.me && !access()) { try { orders = await API.myOrders(); } catch (_) {} }
    const open = orders.find(o => o.status === "pending" || o.status === "review");
    let cta;
    if (access()) cta = h("a", { class: "btn btn-c btn-lg btn-block", href: "#/aulas" }, ic("check"), "Você já tem acesso — ver aulas");
    else if (!S.me) cta = h("a", { class: "btn btn-y btn-lg btn-block", href: "#/entrar?next=pagamento&modo=criar", text: "Entrar e comprar" });
    else if (open && open.status === "review") cta = h("a", { class: "btn btn-c btn-lg btn-block", href: "#/suporte" }, ic("chat"), "Pagamento em análise — abrir chat");
    else cta = h("button", { class: "btn btn-y btn-lg btn-block", type: "button", text: "Comprar curso", onclick: e => busy(e.currentTarget, async () => { await API.createOrder(); go("#/pagamento"); }) });

    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", null, "Comprar o ", h("em", { text: "curso" }))),
      h("div", { class: "pay" },
        h("div", { class: "card offer" },
          h("span", { class: "kicker", text: "Acesso completo · vitalício" }),
          h("h3", { class: "offer-t", text: "Curso de edição profissional" }),
          h("div", { class: "amount", text: money(st.price_cents) }),
          h("p", { class: "mute", text: "Pagamento único via Pix. Sem mensalidade." }),
          h("ul", { class: "incl" },
            [`${plural(pub.length, "aula", "aulas")} em ${plural(S.cats.length, "categoria", "categorias")}`, `${hours(totalMin)} de conteúdo direto ao ponto`,
              "Premiere, After Effects e DaVinci", "Chat privado com a equipe", "Novas aulas sem pagar nada a mais"].map(t => h("li", null, ic("check"), t))),
          cta,
          open && open.status === "review" ? h("p", { class: "note y", text: `Seu pedido ${open.code} está em análise. A equipe vai conferir o comprovante e liberar seu acesso.` }) : null),
        h("div", { class: "card" },
          h("h3", { text: "Como você vai receber o curso" }),
          h("ol", { class: "tut" }, tutorialSteps().map(([t, d]) => h("li", null, h("div", null, h("b", { text: t }), h("span", { text: d }))))),
          h("p", { class: "note", text: `Atendimento: ${st.support_hours}. A liberação é feita manualmente pela equipe, normalmente em poucos minutos dentro desse horário.` }))));
  }

  /* ================= PAGAMENTO (QR + chave + valor) ================= */
  async function viewPay() {
    if (!S.me) return needLogin("pagamento");
    if (access()) { go("#/aulas"); return []; }
    const order = await API.createOrder(); // reaproveita o pedido aberto
    if (order.status === "review") { go("#/suporte"); return []; }
    const st = S.settings;
    const payload = st.pix_key ? pixPayload({ key: st.pix_key, name: st.pix_name || st.brand, city: st.pix_city || "BRASIL", amount: order.amount_cents, txid: order.code }) : "";
    const qrBox = h("div", { class: "qr-box" });
    if (st.pix_qr) { const img = h("img", { alt: "QR Code Pix" }); fileUrl(st.pix_qr).then(u => { if (u) img.src = u; }); qrBox.append(img); }
    else if (payload) qrBox.append(qrCanvas(payload));
    else qrBox.append(h("p", { class: "qr-miss", text: "QR Code ainda não configurado" }));

    const paidBtn = h("button", { class: "btn btn-y btn-lg btn-block", type: "button" }, ic("check"), "Já paguei");
    paidBtn.addEventListener("click", async () => {
      const ok = await confirmBox("Você já fez o Pix?", `Confirme apenas se já pagou ${money(order.amount_cents)}. Vamos abrir um chat privado com a equipe para você enviar o comprovante.`, "Sim, já paguei");
      if (!ok) return;
      busy(paidBtn, async () => { await API.markPaid(order.id); toast("Chat aberto! Envie o comprovante.", "ok"); go("#/suporte"); });
    });

    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", null, "Pagamento ", h("em", { text: "Pix" })), h("span", { class: "tag", text: "Pedido " + order.code })),
      h("div", { class: "pay" },
        h("div", { class: "card center" },
          h("p", { class: "mute", text: "Valor a pagar" }),
          h("div", { class: "amount", text: money(order.amount_cents) }),
          qrBox,
          h("p", { class: "mute small", text: "Escaneie com o app do seu banco" }),
          st.pix_key ? h("div", { class: "fl left" }, h("span", { text: "Chave Pix" }),
            h("div", { class: "copy" }, h("code", { text: st.pix_key }), h("button", { class: "btn btn-c btn-sm", type: "button", onclick: () => copyText(st.pix_key) }, ic("copy"), "Copiar"))) : null,
          payload ? h("div", { class: "fl left" }, h("span", { text: "Pix copia e cola" }),
            h("div", { class: "copy" }, h("code", { text: payload }), h("button", { class: "btn btn-c btn-sm", type: "button", onclick: () => copyText(payload) }, ic("copy"), "Copiar"))) : null,
          st.pix_name ? h("p", { class: "mute small", text: `Favorecido: ${st.pix_name}` }) : null,
          !st.pix_key ? h("p", { class: "note y", text: "O dono do curso ainda não cadastrou a chave Pix. Fale com o suporte." }) : null),
        h("div", { class: "card" },
          h("h3", { text: "Mini tutorial" }),
          h("ol", { class: "tut" },
            h("li", null, h("div", null, h("b", { text: "Abra o app do seu banco" }), h("span", { text: "Vá na área Pix e escolha “Pagar com QR Code” ou “Pix copia e cola”." }))),
            h("li", null, h("div", null, h("b", { text: "Escaneie ou cole o código" }), h("span", { text: `Confira se o valor é ${money(order.amount_cents)} e o favorecido é ${st.pix_name || "o do curso"}.` }))),
            h("li", null, h("div", null, h("b", { text: "Conclua e salve o comprovante" }), h("span", { text: "Tire um print ou baixe o PDF do comprovante." }))),
            h("li", null, h("div", null, h("b", { text: "Aperte “Já paguei”" }), h("span", { text: "Abre um chat privado com a equipe. Envie o comprovante lá." }))),
            h("li", null, h("div", null, h("b", { text: "Pronto: acesso liberado" }), h("span", { text: "Depois que a equipe conferir, as aulas destravam na sua conta e você recebe o aviso no chat." })))),
          paidBtn,
          h("p", { class: "mute small", text: "Não aperte antes de pagar: a equipe confere cada comprovante manualmente." }))));
  }

  /* Pix copia e cola (padrão BR Code / EMV do Banco Central) */
  function pixPayload({ key, name, city, amount, txid }) {
    const clean = (s, n) => norm(s).toUpperCase().replace(/[^A-Z0-9 ]/g, "").trim().slice(0, n) || "NA";
    let k = String(key).trim();
    if (/^[\d.\-/\s]+$/.test(k)) k = k.replace(/\D/g, "");
    else if (/^\+[\d\s()-]+$/.test(k)) k = "+" + k.replace(/\D/g, "");
    else if (k.includes("@")) k = k.toLowerCase();
    const f = (id, v) => id + String(v.length).padStart(2, "0") + v;
    const mai = f("00", "br.gov.bcb.pix") + f("01", k);
    let p = f("00", "01") + f("26", mai) + f("52", "0000") + f("53", "986") + f("54", (amount / 100).toFixed(2)) +
      f("58", "BR") + f("59", clean(name, 25)) + f("60", clean(city, 15)) + f("62", f("05", String(txid).replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***")) + "6304";
    let c = 0xFFFF;
    for (const b of new TextEncoder().encode(p)) { c ^= b << 8; for (let i = 0; i < 8; i++) c = (c & 0x8000) ? ((c << 1) ^ 0x1021) & 0xFFFF : (c << 1) & 0xFFFF; }
    return p + c.toString(16).toUpperCase().padStart(4, "0");
  }
  function qrCanvas(text) {
    const qr = window.qrcode(0, "M"); qr.addData(text); qr.make();
    const n = qr.getModuleCount(), sc = 8, m = 2, size = (n + m * 2) * sc;
    const cv = h("canvas", { width: size, height: size, role: "img", "aria-label": "QR Code Pix" });
    const g = cv.getContext("2d");
    g.fillStyle = "#fff"; g.fillRect(0, 0, size, size); g.fillStyle = "#000";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) g.fillRect((c + m) * sc, (r + m) * sc, sc, sc);
    return cv;
  }

  /* ================= CHAT ================= */
  function chatBox({ threadId, title, subtitle, asStaff, canSend = true, onSent }) {
    const msgs = h("div", { class: "msgs", "aria-live": "polite" });
    const ta = h("textarea", { class: "in", rows: 1, maxlength: 1500, placeholder: canSend ? "Escreva uma mensagem…" : "O chat abre depois que você aperta “Já paguei”", disabled: !canSend, "aria-label": "Mensagem" });
    const fileIn = h("input", { type: "file", accept: "image/png,image/jpeg,image/webp,application/pdf", hidden: true });
    const pill = h("div", { class: "file-pill", hidden: true });
    let file = null, lastId = 0;
    const seen = new Set();
    const attach = h("button", { class: "icon-btn", type: "button", "aria-label": "Anexar comprovante", title: "Anexar comprovante (imagem ou PDF)", disabled: !canSend, onclick: () => fileIn.click() }, ic("clip"));
    const sendB = h("button", { class: "btn btn-y", type: "button", "aria-label": "Enviar", disabled: !canSend }, ic("send"));
    fileIn.addEventListener("change", () => {
      file = fileIn.files[0] || null; fileIn.value = "";
      if (file && file.size > 8 * 1024 * 1024) { toast("Arquivo grande demais (máx. 8 MB).", "bad"); file = null; }
      pill.hidden = !file;
      pill.replaceChildren(...(file ? [ic("file"), file.name.slice(0, 40), h("button", { type: "button", "aria-label": "Remover anexo", onclick: () => { file = null; pill.hidden = true; } }, ic("x"))] : []));
    });
    const send = () => busy(sendB, async () => {
      const body = ta.value;
      if (!body.trim() && !file) return;
      try { await API.send(threadId, body, file); }
      catch (e) { if (file) { file = null; pill.hidden = true; } throw e; }
      ta.value = ""; file = null; pill.hidden = true; ta.style.height = "";
      await pull(); if (onSent) onSent();
    });
    sendB.addEventListener("click", send);
    ta.addEventListener("keydown", e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    ta.addEventListener("input", () => { ta.style.height = "auto"; ta.style.height = Math.min(140, ta.scrollHeight) + "px"; });

    function bubble(m) {
      const mine = asStaff ? (m.from_staff && m.kind !== "system") : (!m.from_staff);
      const b = h("div", { class: "msg " + (m.kind === "system" ? "sys" : mine ? "me" : "them") });
      if (m.kind !== "system" && !mine) b.append(h("span", { class: "who", text: m.from_staff ? (m.sender_name || "Equipe") + " · equipe" : (m.sender_name || "Aluno") }));
      if (m.body) b.append(document.createTextNode(m.body));
      if (m.file) {
        const a = h("a", { class: "att" + (m.file_type === "application/pdf" ? " file" : ""), href: "#", target: "_blank", rel: "noopener noreferrer" });
        if (m.file_type === "application/pdf") a.append(ic("file"), m.file_name || "comprovante.pdf");
        else a.append(h("img", { alt: "Comprovante enviado" }));
        fileUrl(m.file).then(u => { if (!u) { a.replaceChildren("Arquivo indisponível"); return; } a.href = u; const im = a.querySelector("img"); if (im) im.src = u; });
        b.append(a);
      }
      b.append(h("time", { text: hm(m.created_at) }));
      return b;
    }
    async function pull() {
      let list = [];
      try { list = await API.messages(threadId, lastId); } catch (e) { return; }
      const atBottom = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 80;
      let added = false;
      for (const m of list) { if (seen.has(m.id)) continue; seen.add(m.id); lastId = Math.max(lastId, m.id); msgs.append(bubble(m)); added = true; }
      if (!msgs.childNodes.length) msgs.append(h("p", { class: "mute center small chat-empty", text: "Nenhuma mensagem ainda." }));
      else { const e = msgs.querySelector(".chat-empty"); if (e && seen.size) e.remove(); }
      if (added) { if (atBottom || list.length === seen.size) msgs.scrollTop = msgs.scrollHeight; API.markRead(threadId).then(refreshBadge); }
    }
    pull();
    const off = API.on(t => { if (t === "messages" || t === "*" || t === "orders") pull(); });
    const iv = setInterval(pull, 5000); // reserva, caso o aviso entre abas falhe
    onLeave(() => { off(); clearInterval(iv); });
    return h("div", { class: "chat" },
      h("div", { class: "chat-h" }, h("div", { class: "av", text: initial(title) }), h("div", null, h("b", { text: title }), h("small", null, h("span", { class: "online" }), subtitle))),
      msgs,
      h("div", { class: "compose-w" }, pill, h("div", { class: "compose" }, attach, fileIn, ta, sendB)));
  }

  async function viewSupport() {
    if (!S.me) return needLogin("suporte");
    if (staff()) { go("#/painel/conversas"); return []; }
    const [orders, can] = await Promise.all([API.myOrders(), API.canChat()]);
    const last = orders[0];
    const head = h("div", { class: "page-h" }, h("h1", null, "Chat com a ", h("em", { text: "equipe" })), last ? statusTag(last.status) : null);
    const info = [];
    if (access()) info.push(h("p", { class: "note", text: "Seu acesso está liberado! Use este chat se precisar de ajuda." }));
    else if (!can) info.push(h("div", { class: "note y" }, "O chat privado abre depois que você faz o Pix e aperta “Já paguei”. ", h("a", { class: "link", href: "#/pagamento", text: "Ir para o pagamento ›" })));
    else if (last && last.status === "review") info.push(h("p", { class: "note y", text: "📎 Envie o comprovante (print ou PDF) usando o clipe ao lado da caixa de mensagem. A equipe confere e libera seu acesso." }));
    else if (last && last.status === "rejected") info.push(h("div", { class: "note y" }, "A equipe não conseguiu confirmar o pagamento. Envie o comprovante de novo por aqui ou ", h("a", { class: "link", href: "#/pagamento", text: "gere um novo pedido ›" })));
    return h("div", { class: "page" }, head, info,
      chatBox({ threadId: S.me.id, title: "Equipe " + S.settings.brand, subtitle: "Atendimento: " + S.settings.support_hours, asStaff: false, canSend: can }));
  }

  /* ================= MINHA CONTA ================= */
  async function viewAccount() {
    if (!S.me) return needLogin("conta");
    const orders = await API.myOrders();
    const name = h("input", { class: "in", value: S.me.name, maxlength: 60, autocomplete: "name" });
    const oldP = h("input", { class: "in", type: "password", autocomplete: "current-password", maxlength: 128 });
    const newP = h("input", { class: "in", type: "password", autocomplete: "new-password", maxlength: 128 });
    const roleTxt = { owner: "Dono", staff: "Equipe", user: "Aluno" }[S.me.role];
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", null, "Minha ", h("em", { text: "conta" })),
        access() ? h("span", { class: "status st-approved", text: "Acesso liberado" }) : h("span", { class: "status st-pending", text: "Sem acesso" })),
      h("div", { class: "cols" },
        h("div", { class: "card f" },
          h("h3", { text: "Perfil" }),
          h("p", { class: "mute" }, S.me.email, " · ", roleTxt),
          h("label", { class: "fl" }, h("span", { text: "Nome" }), name),
          h("button", { class: "btn btn-c", type: "button", text: "Salvar nome", onclick: e => busy(e.currentTarget, async () => { await API.updateName(name.value); S.me = await API.me(); applyChrome(); toast("Nome atualizado.", "ok"); }) }),
          h("h3", { class: "mt", text: "Trocar senha" }),
          h("label", { class: "fl" }, h("span", { text: "Senha atual" }), oldP),
          h("label", { class: "fl" }, h("span", { text: "Nova senha" }), newP, h("small", { text: "8+ caracteres, letras e números. Suas outras sessões serão encerradas." })),
          h("button", { class: "btn btn-g", type: "button", text: "Trocar senha", onclick: e => busy(e.currentTarget, async () => { await API.changePassword(oldP.value, newP.value); oldP.value = newP.value = ""; toast("Senha alterada.", "ok"); }) })),
        h("div", { class: "card" },
          h("h3", { text: "Meus pedidos" }),
          orders.length ? h("div", { class: "tbl-w" }, h("table", { class: "tbl" },
            h("thead", null, h("tr", null, ["Pedido", "Valor", "Status", "Data"].map(t => h("th", { text: t })))),
            h("tbody", null, orders.map(o => h("tr", null, h("td", { class: "mono", text: o.code }), h("td", { text: money(o.amount_cents) }), h("td", null, statusTag(o.status)), h("td", { text: dt(o.created_at) })))))) :
            h("p", { class: "mute", text: "Nenhum pedido ainda." }),
          h("div", { class: "hero-btns mt" },
            !access() ? h("a", { class: "btn btn-y btn-sm", href: "#/comprar", text: "Comprar curso" }) : h("a", { class: "btn btn-c btn-sm", href: "#/aulas", text: "Ver aulas" }),
            h("a", { class: "btn btn-g btn-sm", href: staff() ? "#/painel" : "#/suporte" }, ic("chat"), staff() ? "Painel" : "Suporte")),
          h("h3", { class: "mt", text: "Sessão" }),
          h("div", { class: "hero-btns" },
            h("button", { class: "btn btn-bad btn-sm", type: "button", onclick: () => logout(false) }, ic("out"), "Sair"),
            h("button", { class: "btn btn-g btn-sm", type: "button", text: "Sair de todos os dispositivos", onclick: () => logout(true) })))));
  }
  async function logout(all) {
    await API.signOut(all); S.me = null; S.progress = {}; forgetUrls();
    await loadAll(); toast("Você saiu da conta."); go("#/");
  }

  /* ================= PAINEL ================= */
  async function viewPanel([tab], q) {
    if (!S.me) return needLogin("painel");
    if (!staff()) return viewNotFound();
    const tabs = [["geral", "Visão geral"], ...(owner() ? [["aulas", "Aulas"], ["categorias", "Categorias"]] : []),
      ["pagamentos", "Pagamentos"], ["conversas", "Conversas"], ["alunos", "Alunos"], ...(owner() ? [["config", "Configurações"]] : [])];
    tab = tabs.some(t => t[0] === tab) ? tab : "geral";
    const st = await API.stats();
    const nav = h("nav", { class: "tabs", "aria-label": "Seções do painel" }, tabs.map(([k, label]) =>
      h("a", { href: "#/painel/" + k, class: k === tab ? "on" : "" }, label,
        k === "pagamentos" && st.review ? h("span", { class: "cnt", text: String(st.review) }) : null)));
    const body = await ({ geral: pGeral, aulas: pAulas, categorias: pCats, pagamentos: pPay, conversas: pChats, alunos: pUsers, config: pConfig })[tab](q, st);
    const offR = API.on(t => { if (t === "orders") refreshBadge(); });
    onLeave(offR);
    return h("div", { class: "page" },
      h("div", { class: "page-h" }, h("h1", null, "Painel ", h("em", { text: owner() ? "do dono" : "da equipe" }))), nav, body);
  }
  function pGeral(_, st) {
    return [
      h("div", { class: "stats" },
        h("div", { class: "stat" }, h("b", { text: String(st.students) }), h("span", { text: "alunos com acesso" })),
        h("div", { class: "stat" }, h("b", { text: String(st.review) }), h("span", { text: "pagamentos em análise" })),
        h("div", { class: "stat" }, h("b", { text: money(st.revenue) }), h("span", { text: "recebido (aprovado)" })),
        h("div", { class: "stat" }, h("b", { text: String(st.lessons) }), h("span", { text: `aulas publicadas · ${st.drafts} rascunhos` }))),
      h("div", { class: "cols" },
        h("div", { class: "card" }, h("h3", { text: "Atalhos" }), h("div", { class: "hero-btns" },
          st.review ? h("a", { class: "btn btn-y btn-sm", href: "#/painel/pagamentos", text: `Conferir ${plural(st.review, "pagamento", "pagamentos")}` }) : null,
          h("a", { class: "btn btn-c btn-sm", href: "#/painel/conversas", text: "Conversas" }),
          owner() ? h("a", { class: "btn btn-g btn-sm", href: "#/painel/aulas?nova=1" }, ic("plus"), "Nova aula") : null,
          owner() ? h("a", { class: "btn btn-g btn-sm", href: "#/painel/config", text: "Pix e preço" }) : null)),
        h("div", { class: "card" }, h("h3", { text: "Como liberar um aluno" }), h("ol", { class: "tut" },
          h("li", null, h("div", null, h("b", { text: "Aluno aperta “Já paguei”" }), h("span", { text: "O pedido aparece em Pagamentos como “Em análise” e abre uma conversa." }))),
          h("li", null, h("div", null, h("b", { text: "Confira o comprovante" }), h("span", { text: "Veja o arquivo no chat e confirme no extrato do banco." }))),
          h("li", null, h("div", null, h("b", { text: "Aprove" }), h("span", { text: "O acesso é liberado na hora e o aluno recebe o aviso." })))))),
      owner() ? h("div", { class: "card mt" }, h("h3", { text: "Simulado" }),
        h("p", { class: "mute", text: "Tudo fica salvo só neste navegador. Você pode zerar e voltar aos dados de exemplo." }),
        h("button", { class: "btn btn-bad btn-sm mt", type: "button", text: "Zerar simulado", onclick: async () => {
          if (!await confirmBox("Zerar o simulado?", "Apaga contas, pedidos, mensagens e aulas enviadas neste navegador e volta aos dados de exemplo.", "Zerar tudo", true)) return;
          await API.resetAll(); S.me = null; forgetUrls(); await loadAll(); toast("Simulado zerado."); go("#/entrar");
        } })) : null];
  }

  /* ----- aulas ----- */
  async function pAulas(q) {
    const box = h("div");
    const filter = h("select", { class: "in", "aria-label": "Filtrar por categoria" },
      h("option", { value: "all", text: "Todas as categorias" }), S.cats.map(c => h("option", { value: c.id, text: c.name })), h("option", { value: "none", text: "Sem categoria" }));
    const search = h("input", { class: "in", type: "search", placeholder: "Buscar aula…", maxlength: 60 });
    const draw = () => {
      const f = filter.value, s = norm(search.value);
      const list = S.lessons.filter(l => (f === "all" || (f === "none" ? !l.category_id : l.category_id === f)) && (!s || norm(l.title).includes(s)))
        .sort((a, b) => a.position - b.position);
      box.replaceChildren(...(list.length ? list.map((l, i) => h("div", { class: "adm-l" },
        poster(l, { mini: true, link: false }),
        h("div", { class: "grow" }, h("b", { text: l.title.replace(/\|/g, " ") }),
          h("small", null, catName(l.category_id), " · ", l.duration_min + " min", " · ", l.has_video ? "🎬 com vídeo" : "⚠️ sem vídeo"),
          h("div", { class: "tags tight" }, h("span", { class: "status " + (l.published ? "st-approved" : "st-pending"), text: l.published ? "Publicada" : "Rascunho" }),
            l.is_free ? h("span", { class: "status st-review", text: "Grátis" }) : null, l.featured ? h("span", { class: "status st-review", text: "Destaque" }) : null)),
        h("div", { class: "acts" },
          h("button", { class: "icon-btn", type: "button", "aria-label": "Subir", disabled: i === 0, onclick: () => move(list, i, -1) }, ic("up")),
          h("button", { class: "icon-btn", type: "button", "aria-label": "Descer", disabled: i === list.length - 1, onclick: () => move(list, i, 1) }, ic("down")),
          h("a", { class: "icon-btn", href: "#/aula/" + l.id, "aria-label": "Ver" }, ic("play")),
          h("button", { class: "icon-btn", type: "button", "aria-label": "Editar", onclick: () => lessonEditor(l) }, ic("edit")),
          h("button", { class: "icon-btn danger", type: "button", "aria-label": "Excluir", onclick: async () => {
            if (!await confirmBox("Excluir aula?", `“${l.title.replace(/\|/g, " ")}” e o vídeo dela serão apagados. Isso não pode ser desfeito.`, "Excluir", true)) return;
            try { await API.deleteLesson(l.id); await loadAll(); draw(); toast("Aula excluída."); } catch (e) { toast(errMsg(e), "bad"); }
          } }, ic("trash"))))) : [h("div", { class: "empty", text: "Nenhuma aula aqui." })]));
    };
    async function move(list, i, d) {
      const ids = list.map(l => l.id); [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
      try { await API.reorderLessons(ids); await loadAll(); draw(); } catch (e) { toast(errMsg(e), "bad"); }
    }
    filter.addEventListener("change", draw); search.addEventListener("input", draw);
    draw();
    const lessonEditor = l => openLessonEditor(l, async () => { await loadAll(); draw(); });
    const ed = q.get("editar"), nv = q.get("nova");
    if (ed) { const l = S.lessons.find(x => x.id === ed); if (l) setTimeout(() => lessonEditor(l), 50); }
    if (nv) setTimeout(() => lessonEditor(null), 50);
    return h("div", { class: "card" },
      h("div", { class: "toolbar" }, h("button", { class: "btn btn-y", type: "button", onclick: () => lessonEditor(null) }, ic("plus"), "Nova aula"), filter, search),
      box);
  }
  function openLessonEditor(l, onSaved) {
    const isNew = !l;
    l = l || { title: "", kicker: "", description: "", category_id: (S.cats[0] || {}).id || null, software: "Pr", palette: 1, duration_min: 10, is_free: false, published: true, featured: false };
    const f = {
      title: h("input", { class: "in", value: l.title, maxlength: 80, required: true }),
      kicker: h("input", { class: "in", value: l.kicker, maxlength: 40 }),
      description: h("textarea", { class: "in", maxlength: 2000, value: l.description }),
      category_id: h("select", { class: "in" }, h("option", { value: "", text: "Sem categoria" }), S.cats.map(c => h("option", { value: c.id, text: c.name }))),
      software: h("select", { class: "in" }, [["", "Nenhum"], ["Pr", "Premiere Pro"], ["Ae", "After Effects"], ["Dv", "DaVinci Resolve"], ["Ps", "Photoshop"], ["Cc", "CapCut"], ["Ai", "Illustrator"], ["Bl", "Blender"]].map(([v, t]) => h("option", { value: v, text: t }))),
      duration_min: h("input", { class: "in", type: "number", min: 0, max: 1000, value: l.duration_min }),
      is_free: h("input", { type: "checkbox", checked: l.is_free }),
      published: h("input", { type: "checkbox", checked: l.published }),
      featured: h("input", { type: "checkbox", checked: l.featured })
    };
    f.category_id.value = l.category_id || ""; f.software.value = l.software || "";
    const pals = h("div", { class: "pal-pick", role: "radiogroup", "aria-label": "Cor da capa" });
    for (let i = 1; i <= 8; i++) pals.append(h("label", { class: "pal-" + i, title: "Estilo " + i }, h("input", { type: "radio", name: "pal", value: i, checked: Number(l.palette) === i }), h("span", { class: "pat" })));
    const prevBox = h("div", { class: "ed-prev" });
    const thumbIn = h("input", { class: "in", type: "file", accept: "image/png,image/jpeg,image/webp" });
    const rmThumb = h("input", { type: "checkbox" });
    const vMode = h("select", { class: "in" }, h("option", { value: "keep", text: isNew ? "Sem vídeo por enquanto" : "Manter como está" }), h("option", { value: "file", text: "Enviar arquivo de vídeo" }), h("option", { value: "url", text: "Link do YouTube / Vimeo" }), !isNew ? h("option", { value: "remove", text: "Remover vídeo" }) : null);
    const vFile = h("input", { class: "in", type: "file", accept: "video/mp4,video/webm,video/quicktime" });
    const vUrl = h("input", { class: "in", type: "url", maxlength: 500, placeholder: "https://youtu.be/…  ou  https://vimeo.com/…" });
    const vFileRow = h("label", { class: "fl", hidden: true }, h("span", { text: "Arquivo (MP4, WEBM ou MOV)" }), vFile, h("small", { text: "No simulado o vídeo fica guardado neste navegador." }));
    const vUrlRow = h("label", { class: "fl", hidden: true }, h("span", { text: "Link" }), vUrl, h("small", { text: "Dica: use vídeo “não listado” no YouTube ou privado com link no Vimeo." }));
    vMode.addEventListener("change", () => { vFileRow.hidden = vMode.value !== "file"; vUrlRow.hidden = vMode.value !== "url"; });
    const cur = S.lessons.find(x => x.id === l.id);
    const err = h("p", { class: "err", role: "alert" });
    const save = h("button", { class: "btn btn-y", type: "button", text: isNew ? "Criar aula" : "Salvar" });
    const collect = () => ({ id: l.id, title: f.title.value, kicker: f.kicker.value, description: f.description.value, category_id: f.category_id.value || null,
      software: f.software.value, duration_min: f.duration_min.value, is_free: f.is_free.checked, published: f.published.checked, featured: f.featured.checked,
      palette: (pals.querySelector("input:checked") || {}).value || 1 });
    const redraw = () => { const d = collect(); prevBox.replaceChildren(poster({ ...d, palette: Number(d.palette), duration_min: Number(d.duration_min) || 0, thumb: rmThumb.checked ? null : (cur && cur.thumb) }, { link: false })); };
    [f.title, f.kicker, f.duration_min].forEach(x => x.addEventListener("input", redraw));
    [f.category_id, f.software, f.is_free, f.published, rmThumb].forEach(x => x.addEventListener("change", redraw));
    pals.addEventListener("change", redraw);
    redraw();
    save.addEventListener("click", () => {
      err.textContent = "";
      busy(save, async () => {
        try {
          if (vMode.value === "file" && !vFile.files[0]) throw new API.ApiError("Escolha o arquivo de vídeo.");
          if (vMode.value === "url" && !vUrl.value.trim()) throw new API.ApiError("Cole o link do vídeo.");
          save.textContent = vMode.value === "file" ? "Enviando vídeo…" : "Salvando…";
          await API.saveLesson(collect(), {
            thumb: thumbIn.files[0] || null, removeThumb: rmThumb.checked,
            video: vMode.value === "file" ? vFile.files[0] : null, videoUrl: vMode.value === "url" ? vUrl.value : null, removeVideo: vMode.value === "remove"
          });
          closeModal(); toast(isNew ? "Aula criada!" : "Aula salva!", "ok"); forgetUrls(); await onSaved();
        } catch (e) { err.textContent = errMsg(e); save.textContent = isNew ? "Criar aula" : "Salvar"; }
      });
    });
    openModal(h("h3", { text: isNew ? "Nova aula" : "Editar aula" }),
      h("div", { class: "ed" },
        h("div", { class: "f" },
          h("label", { class: "fl" }, h("span", { text: "Título" }), f.title, h("small", { text: "Use | para quebrar a linha na capa. Ex.: Cor que|vende" })),
          h("label", { class: "fl" }, h("span", { text: "Frase pequena da capa" }), f.kicker),
          h("div", { class: "cols tight" },
            h("label", { class: "fl" }, h("span", { text: "Categoria" }), f.category_id),
            h("label", { class: "fl" }, h("span", { text: "Programa" }), f.software)),
          h("div", { class: "cols tight" },
            h("label", { class: "fl" }, h("span", { text: "Duração (min)" }), f.duration_min),
            h("div", { class: "fl" }, h("span", { text: "Opções" }),
              h("label", { class: "chk" }, f.published, "Publicada"),
              h("label", { class: "chk" }, f.is_free, "Grátis (prévia)"),
              h("label", { class: "chk" }, f.featured, "Destaque"))),
          h("label", { class: "fl" }, h("span", { text: "Descrição" }), f.description),
          h("div", { class: "fl" }, h("span", { text: "Estilo da capa" }), pals),
          h("label", { class: "fl" }, h("span", { text: "Imagem de capa (opcional)" }), thumbIn),
          cur && cur.thumb ? h("label", { class: "chk" }, rmThumb, "Remover imagem atual") : null,
          h("label", { class: "fl" }, h("span", { text: "Vídeo da aula" + (cur ? (cur.has_video ? " (tem vídeo)" : " (sem vídeo)") : "") }), vMode),
          vFileRow, vUrlRow),
        prevBox),
      err,
      h("div", { class: "modal-acts" }, h("button", { class: "btn btn-g", type: "button", text: "Cancelar", onclick: closeModal }), save));
  }

  /* ----- categorias ----- */
  async function pCats() {
    const box = h("div");
    const draw = () => box.replaceChildren(...S.cats.map((c, i) => {
      const inp = h("input", { class: "in", value: c.name, maxlength: 40, "aria-label": "Nome da categoria" });
      const n = S.lessons.filter(l => l.category_id === c.id).length;
      return h("div", { class: "adm-l" },
        h("span", { class: "mono cat-n", text: String(i + 1).padStart(2, "0") }),
        h("div", { class: "grow" }, inp, h("small", { text: plural(n, "aula", "aulas") })),
        h("div", { class: "acts" },
          h("button", { class: "btn btn-c btn-xs", type: "button", text: "Salvar", onclick: e => busy(e.currentTarget, async () => { await API.saveCategory(c.id, inp.value); await loadAll(); draw(); toast("Categoria salva.", "ok"); }) }),
          h("button", { class: "icon-btn", type: "button", "aria-label": "Subir", disabled: i === 0, onclick: async () => { await API.moveCategory(c.id, -1); await loadAll(); draw(); } }, ic("up")),
          h("button", { class: "icon-btn", type: "button", "aria-label": "Descer", disabled: i === S.cats.length - 1, onclick: async () => { await API.moveCategory(c.id, 1); await loadAll(); draw(); } }, ic("down")),
          h("button", { class: "icon-btn danger", type: "button", "aria-label": "Remover", onclick: async () => {
            if (!await confirmBox("Remover categoria?", n ? `As ${plural(n, "aula", "aulas")} dela ficarão “Sem categoria” (não são apagadas).` : "A categoria está vazia.", "Remover", true)) return;
            try { await API.deleteCategory(c.id); await loadAll(); draw(); toast("Categoria removida."); } catch (e) { toast(errMsg(e), "bad"); }
          } }, ic("trash"))));
    }));
    draw();
    const nm = h("input", { class: "in", maxlength: 40, placeholder: "Nome da nova categoria" });
    const addB = h("button", { class: "btn btn-y", type: "button" }, ic("plus"), "Adicionar");
    const addCat = () => busy(addB, async () => { await API.saveCategory(null, nm.value); nm.value = ""; await loadAll(); draw(); toast("Categoria criada!", "ok"); });
    addB.addEventListener("click", addCat);
    nm.addEventListener("keydown", e => { if (e.key === "Enter") addCat(); });
    return h("div", { class: "card" }, h("div", { class: "toolbar" }, nm, addB), box);
  }

  /* ----- pagamentos ----- */
  async function pPay(q) {
    let filter = ["review", "pending", "approved", "rejected", ""].includes(q.get("s")) ? q.get("s") : "review";
    const box = h("div", { class: "tbl-w" });
    const ft = h("div", { class: "tabs sub" });
    const F = [["review", "Em análise"], ["pending", "Aguardando Pix"], ["approved", "Aprovados"], ["rejected", "Recusados"], ["", "Todos"]];
    const draw = async () => {
      ft.replaceChildren(...F.map(([k, t]) => h("button", { type: "button", class: k === filter ? "on" : "", text: t, onclick: () => { filter = k; draw(); } })));
      const list = await API.orders(filter);
      box.replaceChildren(list.length ? h("table", { class: "tbl" },
        h("thead", null, h("tr", null, ["Pedido", "Aluno", "Valor", "Data", "Status", ""].map(t => h("th", { text: t })))),
        h("tbody", null, list.map(o => h("tr", null,
          h("td", { class: "mono", text: o.code }),
          h("td", null, h("b", { text: o.user.name || "—" }), h("br"), h("small", { class: "mute", text: o.user.email })),
          h("td", { text: money(o.amount_cents) }),
          h("td", { text: dt(o.paid_at || o.created_at) }),
          h("td", null, statusTag(o.status), o.staff_note ? h("small", { class: "mute block", text: o.staff_note }) : null),
          h("td", null, h("div", { class: "acts" },
            o.status !== "approved" ? h("button", { class: "btn btn-y btn-xs", type: "button", text: "Aprovar", onclick: async e => {
              const b = e.currentTarget;
              if (!await confirmBox("Aprovar pagamento?", `Confirme que ${money(o.amount_cents)} do pedido ${o.code} caiu na conta. O acesso de ${o.user.name || o.user.email} será liberado.`, "Aprovar e liberar")) return;
              busy(b, async () => { await API.reviewOrder(o.id, true); toast("Acesso liberado!", "ok"); draw(); });
            } }) : null,
            o.status === "review" || o.status === "pending" ? h("button", { class: "btn btn-bad btn-xs", type: "button", text: "Recusar", onclick: async e => {
              const b = e.currentTarget;
              const note = await promptBox("Recusar pagamento", "Motivo (o aluno verá no chat)", { max: 300, okLabel: "Recusar" });
              if (note == null) return;
              busy(b, async () => { await API.reviewOrder(o.id, false, note); toast("Pagamento recusado."); draw(); });
            } }) : null,
            h("a", { class: "btn btn-g btn-xs", href: "#/painel/conversas?u=" + o.user_id }, ic("chat"), "Chat"))))))) :
        h("div", { class: "empty", text: "Nenhum pedido aqui." }));
    };
    await draw();
    const off = API.on(t => { if (t === "orders" || t === "*") draw(); });
    onLeave(off);
    return h("div", { class: "card" }, ft, box);
  }

  /* ----- conversas ----- */
  async function pChats(q) {
    let sel = UUID.test(q.get("u") || "") ? q.get("u") : null;
    const list = h("div", { class: "threads", role: "list" });
    const pane = h("div");
    let chatClean = null;
    const drawList = async () => {
      const th = await API.staffThreads();
      if (!sel && th[0]) sel = th[0].user_id;
      list.replaceChildren(...(th.length ? th.map(t => h("button", { type: "button", class: t.user_id === sel ? "on" : "", onclick: () => { sel = t.user_id; drawList(); openThread(); } },
        h("span", { class: "av", text: initial(t.name || t.email) }),
        h("span", { class: "grow" }, h("b", { text: t.name || t.email }), h("small", { text: t.last_preview }),
          h("small", null, t.order_status ? statusTag(t.order_status) : null, " ", dt(t.last_at))),
        t.unread_staff ? h("span", { class: "u", text: String(t.unread_staff) }) : null)) :
        [h("p", { class: "empty", text: "Nenhuma conversa ainda. Elas aparecem quando um aluno aperta “Já paguei”." })]));
    };
    const openThread = async () => {
      if (chatClean) { chatClean(); chatClean = null; }
      if (!sel) { pane.replaceChildren(h("div", { class: "empty", text: "Escolha uma conversa." })); return; }
      const users = await API.users("", 500);
      const u = users.find(x => x.id === sel);
      if (!u) { pane.replaceChildren(h("div", { class: "empty", text: "Aluno não encontrado." })); return; }
      const orders = (await API.orders("")).filter(o => o.user_id === sel);
      const o = orders[0];
      const before = cleanups.length;
      const chat = chatBox({ threadId: sel, title: u.name || u.email, subtitle: u.email + (u.has_access ? " · com acesso" : " · sem acesso"), asStaff: true, onSent: drawList });
      const mine = cleanups.splice(before); chatClean = () => mine.forEach(f => f());
      const bar = h("div", { class: "order-bar" },
        o ? h("span", null, "Pedido ", h("b", { class: "mono", text: o.code }), " · ", money(o.amount_cents), " ", statusTag(o.status)) : h("span", { class: "mute", text: "Sem pedido" }),
        h("span", { class: "grow" }),
        o && o.status !== "approved" ? h("button", { class: "btn btn-y btn-xs", type: "button", text: "Aprovar e liberar", onclick: async e => {
          const b = e.currentTarget;
          if (!await confirmBox("Aprovar pagamento?", `Libera o acesso de ${u.name || u.email}.`, "Aprovar")) return;
          busy(b, async () => { await API.reviewOrder(o.id, true); toast("Acesso liberado!", "ok"); openThread(); drawList(); });
        } }) : null,
        o && (o.status === "review" || o.status === "pending") ? h("button", { class: "btn btn-bad btn-xs", type: "button", text: "Recusar", onclick: async e => {
          const b = e.currentTarget;
          const note = await promptBox("Recusar pagamento", "Motivo (o aluno verá no chat)", { okLabel: "Recusar" });
          if (note == null) return;
          busy(b, async () => { await API.reviewOrder(o.id, false, note); openThread(); drawList(); });
        } }) : null,
        !o || o.status === "approved" ? h("button", { class: "btn btn-g btn-xs", type: "button", text: u.has_access ? "Remover acesso" : "Liberar acesso", onclick: e => busy(e.currentTarget, async () => { await API.setAccess(u.id, !u.has_access); openThread(); }) }) : null);
      pane.replaceChildren(bar, chat);
    };
    await drawList(); await openThread();
    let t = null;
    const off = API.on(k => { if (k === "messages" || k === "threads" || k === "orders" || k === "*") { clearTimeout(t); t = setTimeout(drawList, 150); } });
    onLeave(() => { off(); clearTimeout(t); if (chatClean) chatClean(); });
    return h("div", { class: "inbox" }, list, pane);
  }

  /* ----- alunos ----- */
  async function pUsers() {
    const qIn = h("input", { class: "in", type: "search", placeholder: "Buscar por nome ou e-mail…", maxlength: 60 });
    const box = h("div", { class: "tbl-w" });
    const ROLE = { owner: "Dono", staff: "Equipe", user: "Aluno" };
    const draw = async () => {
      const us = await API.users(qIn.value, 200);
      box.replaceChildren(us.length ? h("table", { class: "tbl" },
        h("thead", null, h("tr", null, ["Nome", "E-mail", "Cargo", "Desde", "Acesso", ""].map(t => h("th", { text: t })))),
        h("tbody", null, us.map(u => {
          let role;
          if (owner() && u.role !== "owner" && u.id !== S.me.id) {
            role = h("select", { class: "in in-sm", "aria-label": "Cargo" }, h("option", { value: "user", text: "Aluno" }), h("option", { value: "staff", text: "Equipe" }));
            role.value = u.role;
            role.addEventListener("change", async () => { try { await API.setRole(u.id, role.value); toast("Cargo alterado.", "ok"); } catch (e) { toast(errMsg(e), "bad"); role.value = u.role; } });
          } else role = h("span", { text: ROLE[u.role] });
          return h("tr", null, h("td", null, h("b", { text: u.name || "—" })), h("td", { text: u.email }), h("td", null, role), h("td", { text: dt(u.created_at) }),
            h("td", null, u.role !== "user" ? h("span", { class: "status st-approved", text: "Equipe" }) : h("span", { class: "status " + (u.has_access ? "st-approved" : "st-pending"), text: u.has_access ? "Liberado" : "Sem acesso" })),
            h("td", null, h("div", { class: "acts" },
              u.role === "user" ? h("button", { class: "btn btn-xs " + (u.has_access ? "btn-bad" : "btn-y"), type: "button", text: u.has_access ? "Remover acesso" : "Liberar acesso", onclick: async e => {
                const b = e.currentTarget;
                if (u.has_access && !await confirmBox("Remover acesso?", `${u.name || u.email} perde o acesso às aulas pagas.`, "Remover", true)) return;
                busy(b, async () => { await API.setAccess(u.id, !u.has_access); toast(u.has_access ? "Acesso removido." : "Acesso liberado!", "ok"); draw(); });
              } }) : null,
              u.role === "user" ? h("a", { class: "btn btn-g btn-xs", href: "#/painel/conversas?u=" + u.id }, ic("chat")) : null)));
        }))) : h("div", { class: "empty", text: "Ninguém encontrado." }));
    };
    let t = null; qIn.addEventListener("input", () => { clearTimeout(t); t = setTimeout(draw, 200); });
    await draw();
    return h("div", { class: "card" }, h("div", { class: "toolbar" }, qIn), box);
  }

  /* ----- configurações ----- */
  async function pConfig() {
    const st = S.settings;
    const inp = (k, max, p = {}) => h("input", { class: "in", value: st[k], maxlength: max, ...p });
    const f = {
      brand: inp("brand", 24), hero_kicker: inp("hero_kicker", 80), hero_title: inp("hero_title", 60),
      hero_text: h("textarea", { class: "in", maxlength: 300, value: st.hero_text }),
      price: h("input", { class: "in", value: (st.price_cents / 100).toFixed(2).replace(".", ","), inputmode: "decimal", maxlength: 12 }),
      pix_key: inp("pix_key", 77), pix_name: inp("pix_name", 25), pix_city: inp("pix_city", 15), support_hours: inp("support_hours", 60)
    };
    const qrIn = h("input", { class: "in", type: "file", accept: "image/png,image/jpeg,image/webp" });
    const rmQr = h("input", { type: "checkbox" });
    const prev = h("div", { class: "qr-box sm" });
    const code = h("code");
    const redraw = () => {
      const cents = Math.round(Number(f.price.value.replace(/\./g, "").replace(",", ".")) * 100) || 0;
      if (!f.pix_key.value.trim()) { prev.replaceChildren(h("p", { class: "qr-miss", text: "Digite a chave Pix" })); code.textContent = "—"; return; }
      const p = pixPayload({ key: f.pix_key.value, name: f.pix_name.value || f.brand.value, city: f.pix_city.value || "BRASIL", amount: cents, txid: "PREVIEW" });
      code.textContent = p; prev.replaceChildren(qrCanvas(p));
    };
    [f.price, f.pix_key, f.pix_name, f.pix_city].forEach(x => x.addEventListener("input", redraw));
    redraw();
    const save = h("button", { class: "btn btn-y btn-lg", type: "button", text: "Salvar configurações" });
    save.addEventListener("click", () => busy(save, async () => {
      const data = {}; for (const k in f) data[k] = f[k].value;
      await API.saveSettings(data, { qr: qrIn.files[0] || null, removeQr: rmQr.checked });
      forgetUrls(); await loadAll(); toast("Configurações salvas!", "ok"); route();
    }));
    const L = (label, el, small) => h("label", { class: "fl" }, h("span", { text: label }), el, small ? h("small", { text: small }) : null);
    return h("div", { class: "cols" },
      h("div", { class: "card f" }, h("h3", { text: "Site" }),
        L("Nome da marca", f.brand), L("Frase de cima (hero)", f.hero_kicker), L("Título grande", f.hero_title, "Use | para quebrar linha. Ex.: EDITE COMO|UM PROFISSIONAL"),
        L("Texto do hero", f.hero_text), L("Horário de atendimento", f.support_hours)),
      h("div", { class: "card f" }, h("h3", { text: "Pagamento Pix" }),
        L("Preço do curso (R$)", f.price), L("Chave Pix", f.pix_key, "E-mail, CPF/CNPJ, telefone com +55 ou chave aleatória."),
        L("Nome do favorecido", f.pix_name, "Até 25 letras, como aparece no banco."), L("Cidade", f.pix_city),
        L("QR Code próprio (opcional)", qrIn, "Se enviar, ele aparece no lugar do QR gerado automaticamente."),
        st.pix_qr ? h("label", { class: "chk" }, rmQr, "Remover QR Code enviado") : null,
        h("div", { class: "prev-sm" }, prev, h("div", { class: "fl grow" }, h("span", { text: "Prévia do Pix copia e cola" }), code))),
      h("div", { class: "span2" }, save));
  }

  function viewNotFound() {
    return h("div", { class: "page center" }, h("h1", { class: "big404", text: "404" }), h("p", { class: "mute", text: "Esse corte não existe." }), h("a", { class: "btn btn-y mt", href: "#/", text: "Voltar ao início" }));
  }

  /* ---------- aviso do simulado ---------- */
  $("#demoInfo").addEventListener("click", () => openModal(
    h("h3", { text: "Como testar o simulado" }),
    h("ol", { class: "tut" },
      h("li", null, h("div", null, h("b", { text: "Aba 1 — aluno" }), h("span", { text: "Crie uma conta, aperte Comprar, depois “Já paguei” e mande um print qualquer como comprovante no chat." }))),
      h("li", null, h("div", null, h("b", { text: "Aba 2 — equipe" }), h("span", null, "Abra o site em outra aba e entre com ", h("code", { text: API.DEMO.staff.email }), " / ", h("code", { text: API.DEMO.staff.pass }), ". Vá em Painel > Pagamentos ou Conversas e aprove."))),
      h("li", null, h("div", null, h("b", { text: "Dono" }), h("span", null, "Entre com ", h("code", { text: API.DEMO.owner.email }), " / ", h("code", { text: API.DEMO.owner.pass }), " para criar aulas, enviar vídeos, mexer nas categorias e configurar o Pix.")))),
    h("p", { class: "note y", text: "Cada aba tem a sua própria sessão. Tudo fica salvo só neste navegador; nada é enviado para nenhum servidor ou banco de dados." }),
    h("div", { class: "modal-acts" }, h("button", { class: "btn btn-y", type: "button", text: "Entendi", onclick: closeModal }))));

  /* ---------- início ---------- */
  API.on(t => { if (t === "threads" || t === "messages" || t === "orders" || t === "*") refreshBadge(); });
  // mudanças feitas por outra aba (ex.: dono editou aulas) atualizam o catálogo
  let syncT = null;
  API.on(t => {
    if (!["lessons", "categories", "settings", "users", "orders", "auth", "*"].includes(t)) return;
    clearTimeout(syncT);
    syncT = setTimeout(async () => {
      const wasAccess = access(), before = JSON.stringify([S.me && S.me.id, S.me && S.me.has_access, S.me && S.me.role]);
      const cat = JSON.stringify([S.settings, S.cats, S.lessons.map(l => [l.id, l.updated_at, l.has_video])]);
      await loadAll();
      const changed = before !== JSON.stringify([S.me && S.me.id, S.me && S.me.has_access, S.me && S.me.role]);
      if (!wasAccess && access() && S.me && S.me.role === "user") toast("🎉 Pagamento aprovado! Seu acesso foi liberado.", "ok");
      const name = parseHash().parts[0] || "";
      const catChanged = cat !== JSON.stringify([S.settings, S.cats, S.lessons.map(l => [l.id, l.updated_at, l.has_video])]);
      if (modal.open) return;
      if (changed && name !== "painel") route();
      else if (catChanged && (name === "" || name === "aulas")) route();
    }, 300);
  });
  (async () => {
    try { await API.ready(); await loadAll(); }
    catch (e) { console.error(e); view.replaceChildren(h("div", { class: "page" }, h("div", { class: "empty", text: "Seu navegador bloqueou o armazenamento local. Saia da aba anônima ou libere os cookies/dados do site." }))); return; }
    route();
  })();
})();
