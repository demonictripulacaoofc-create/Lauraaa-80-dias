/* =====================================================================
   SERVIDOR SIMULADO
   Faz o papel do back-end para o site funcionar 100% sem banco de dados:
   contas, cargos, aulas, pagamentos, chat e arquivos ficam neste navegador
   (localStorage + IndexedDB). Nada é enviado para servidor nenhum.

   Mesmo sendo simulado, cada função confere a sessão e o cargo de quem chama,
   exatamente como um back-end de verdade faria — a tela só esconde botões,
   quem decide é aqui. Para produção, troque este arquivo por uma API real
   com as mesmas funções.

   Abra duas abas (cada aba tem a própria sessão): uma como aluno e outra
   como staff, e o chat/pedidos atualizam ao vivo entre elas.
   ===================================================================== */
(() => {
  "use strict";

  const DB_KEY = "trtpro:sim:v1";
  const TOKEN_KEY = "trtpro:sim:token";
  const SESSION_HOURS = 12;
  const DEMO = Object.freeze({
    owner: { email: "dono@trtpro.demo", pass: "Dono@2026", name: "Dono do curso" },
    staff: { email: "staff@trtpro.demo", pass: "Staff@2026", name: "Equipe TRT" }
  });

  class ApiError extends Error {}
  const fail = msg => { throw new ApiError(msg); };
  const now = () => Date.now();
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const rid = (n = 16) => [...crypto.getRandomValues(new Uint8Array(n))].map(b => b.toString(16).padStart(2, "0")).join("");
  const uuid = () => crypto.randomUUID ? crypto.randomUUID() : rid(16);
  const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)));
  const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
  const isId = v => typeof v === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(v);
  const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]{1,64}@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

  /* ---------------- hash de senha (PBKDF2-SHA256) ---------------- */
  const enc = new TextEncoder();
  async function hashPass(pass, saltHex) {
    const salt = Uint8Array.from(saltHex.match(/../g).map(x => parseInt(x, 16)));
    const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 150000 }, key, 256);
    return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  async function sha256(s) {
    const d = await crypto.subtle.digest("SHA-256", enc.encode(s));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, "0")).join("");
  }
  const sameHex = (a, b) => { if (a.length !== b.length) return false; let x = 0; for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i); return x === 0; };

  /* ---------------- armazenamento ---------------- */
  let mem = null; // reserva se o localStorage estiver bloqueado
  function read() {
    try { const s = localStorage.getItem(DB_KEY); return s ? JSON.parse(s) : null; } catch (_) { return mem && clone(mem); }
  }
  function write(db) {
    try { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
    catch (_) { mem = clone(db); }
  }
  const bc = ("BroadcastChannel" in window) ? new BroadcastChannel("trtpro-sim") : null;
  const listeners = new Set();
  function emit(topic, local = true) {
    if (local) listeners.forEach(fn => { try { fn(topic); } catch (_) {} });
    if (bc) bc.postMessage(topic);
  }
  if (bc) bc.onmessage = e => { if (typeof e.data === "string") listeners.forEach(fn => { try { fn(e.data); } catch (_) {} }); };
  window.addEventListener("storage", e => { if (e.key === DB_KEY && !bc) listeners.forEach(fn => fn("*")); });

  // toda alteração relê o estado mais novo (outra aba pode ter mudado), aplica e grava
  function tx(fn, topic = "*") {
    const db = read();
    const out = fn(db);
    write(db);
    emit(topic);
    return out;
  }

  /* arquivos (vídeos, capas, comprovantes) no IndexedDB */
  let idb = null;
  function openIdb() {
    if (idb) return idb;
    idb = new Promise((res, rej) => {
      const r = indexedDB.open("trtpro-sim-files", 1);
      r.onupgradeneeded = () => r.result.createObjectStore("files");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return idb;
  }
  async function blobPut(id, blob) {
    const d = await openIdb();
    await new Promise((res, rej) => { const t = d.transaction("files", "readwrite"); t.objectStore("files").put(blob, id); t.oncomplete = res; t.onerror = () => rej(t.error); t.onabort = () => rej(t.error || new Error("abort")); });
  }
  async function blobGet(id) {
    const d = await openIdb();
    return new Promise((res, rej) => { const r = d.transaction("files").objectStore("files").get(id); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); });
  }
  async function blobDel(id) {
    if (!id) return;
    try { const d = await openIdb(); d.transaction("files", "readwrite").objectStore("files").delete(id); } catch (_) {}
  }
  async function blobClear() {
    try { const d = await openIdb(); d.transaction("files", "readwrite").objectStore("files").clear(); } catch (_) {}
  }

  /* validação real do arquivo pelos primeiros bytes (não confia na extensão) */
  const KINDS = {
    image: { max: 5 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp"] },
    receipt: { max: 8 * 1024 * 1024, types: ["image/png", "image/jpeg", "image/webp", "application/pdf"] },
    video: { max: 1024 * 1024 * 1024, types: ["video/mp4", "video/webm", "video/quicktime"] }
  };
  async function sniff(file) {
    const b = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    const hex = [...b].map(x => x.toString(16).padStart(2, "0")).join("");
    const ascii = String.fromCharCode(...b);
    if (hex.startsWith("89504e470d0a1a0a")) return "image/png";
    if (hex.startsWith("ffd8ff")) return "image/jpeg";
    if (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP") return "image/webp";
    if (ascii.startsWith("%PDF-")) return "application/pdf";
    if (hex.startsWith("1a45dfa3")) return "video/webm";
    if (ascii.slice(4, 8) === "ftyp") return ascii.slice(8, 10) === "qt" ? "video/quicktime" : "video/mp4";
    return "";
  }
  async function checkFile(file, kind) {
    const k = KINDS[kind];
    if (!(file instanceof Blob)) fail("Arquivo inválido.");
    if (!file.size) fail("O arquivo está vazio.");
    if (file.size > k.max) fail(`Arquivo grande demais (máx. ${Math.round(k.max / 1048576)} MB).`);
    const real = await sniff(file);
    if (!k.types.includes(real)) fail(kind === "receipt" ? "Envie o comprovante em PNG, JPG, WEBP ou PDF." : kind === "video" ? "Envie o vídeo em MP4, WEBM ou MOV." : "Envie a imagem em PNG, JPG ou WEBP.");
    return real;
  }
  async function saveFile(file, kind, meta) {
    const type = await checkFile(file, kind);
    const id = "f_" + rid(12);
    await blobPut(id, new Blob([file], { type }));
    tx(db => { db.files[id] = { kind, type, size: file.size, at: now(), ...meta }; }, "files");
    return id;
  }
  function dropFile(id) {
    if (!id) return;
    tx(db => { delete db.files[id]; }, "files");
    blobDel(id);
  }

  /* ---------------- dados iniciais do simulado ---------------- */
  const SEED_CATS = ["Primeiros passos", "Iniciante", "Intermediário", "Avançado", "Motion & efeitos"];
  const SEED_LESSONS = [
    [0, "Bem-vindo|ao curso", "Comece por aqui", "Pr", 3, 6, true, true],
    [0, "Organizando|o projeto", "Pastas que salvam", "Pr", 4, 12, false, false],
    [0, "Atalhos|que voam", "Edite 2x mais rápido", "Pr", 2, 9, true, false],
    [1, "O corte|perfeito", "Ritmo e respiro", "Pr", 1, 18, false, true],
    [1, "Áudio|limpo", "Voz que soa pro", "Pr", 6, 16, false, false],
    [1, "Legendas|dinâmicas", "Estilo viral", "Pr", 5, 14, false, false],
    [2, "Cor que|vende", "A arte do grading", "Dv", 8, 24, false, true],
    [2, "Tipografia|cinética", "Letras que dançam", "Ae", 7, 22, false, false],
    [2, "Transições|invisíveis", "Corte sem costura", "Pr", 3, 15, false, false],
    [3, "3D no|After", "Profundidade real", "Ae", 4, 28, false, true],
    [3, "Rotoscopia|sem dor", "Recorte quadro a quadro", "Ae", 6, 26, false, false],
    [3, "Edição de|documentário", "Contar história", "Pr", 2, 30, false, false],
    [4, "Glitch na|prática", "Erro com estilo", "Ae", 8, 13, false, false],
    [4, "Máscaras|avançadas", "Revelações", "Ae", 1, 19, false, false],
    [4, "Motion|pra reels", "Vertical que prende", "Ae", 5, 17, false, true]
  ];
  const DESC = "Nesta aula você aprende, passo a passo, o fluxo usado por editores profissionais.\n\n• Teoria rápida e direto ao ponto\n• Projeto prático para acompanhar\n• Erros comuns e como evitar";

  async function seed() {
    const t = now();
    const mk = async (d, role) => {
      const salt = rid(16);
      return { id: uuid(), email: d.email, name: d.name, role, has_access: true, access_at: t, salt, hash: await hashPass(d.pass, salt), created_at: t };
    };
    const cats = SEED_CATS.map((name, i) => ({ id: uuid(), name, position: i + 1 }));
    const lessons = SEED_LESSONS.map(([c, title, kicker, software, palette, dur, free, feat], i) => ({
      id: uuid(), category_id: cats[c].id, title, kicker, description: DESC, software, palette,
      duration_min: dur, thumb: null, is_free: free, published: true, featured: feat, position: i + 1,
      created_at: t + i, updated_at: t + i
    }));
    const db = {
      v: 1,
      users: [await mk(DEMO.owner, "owner"), await mk(DEMO.staff, "staff")],
      sessions: {},
      fails: {},
      settings: {
        brand: "TRT PRO", hero_kicker: "Curso completo · do zero ao profissional",
        hero_title: "EDITE COMO|UM PROFISSIONAL",
        hero_text: "O fluxo completo de um editor: corte, ritmo, cor, motion e exportação. Aulas diretas, arquivos de projeto e suporte com a equipe.",
        price_cents: 9700, pix_key: "pix@trtpro.demo", pix_name: "TRT PRO CURSOS", pix_city: "SAO PAULO",
        pix_qr: null, support_hours: "Seg a sáb, 9h às 21h", updated_at: t
      },
      categories: cats, lessons, media: {}, files: {},
      orders: [], messages: [], threads: {}, progress: {}, seq: 1
    };
    write(db);
    return db;
  }

  let ready = null;
  function boot() {
    if (!ready) ready = (async () => {
      const db = read();
      if (!db || db.v !== 1) await seed();
    })();
    return ready;
  }

  /* ---------------- sessão (cada aba tem a sua) ---------------- */
  const tok = {
    get() { try { return sessionStorage.getItem(TOKEN_KEY); } catch (_) { return null; } },
    set(v) { try { v ? sessionStorage.setItem(TOKEN_KEY, v) : sessionStorage.removeItem(TOKEN_KEY); } catch (_) {} }
  };
  async function currentUser(db) {
    const t = tok.get();
    if (!t || !/^[0-9a-f]{64}$/.test(t)) return null;
    const s = db.sessions[await sha256(t)];
    if (!s || s.exp < now()) return null;
    const u = db.users.find(x => x.id === s.uid);
    return u || null;
  }
  async function need(db) { const u = await currentUser(db); if (!u) fail("Sua sessão expirou. Entre de novo."); return u; }
  const isStaff = u => !!u && (u.role === "staff" || u.role === "owner");
  const isOwner = u => !!u && u.role === "owner";
  const hasAccess = u => !!u && (u.has_access || isStaff(u));
  async function needStaff(db) { const u = await need(db); if (!isStaff(u)) fail("Somente a equipe pode fazer isso."); return u; }
  async function needOwner(db) { const u = await need(db); if (!isOwner(u)) fail("Somente o dono pode fazer isso."); return u; }
  const pub = u => u && ({ id: u.id, email: u.email, name: u.name, role: u.role, has_access: !!u.has_access, access_at: u.access_at, created_at: u.created_at });
  const pubFile = (db, id) => (id && db.files[id]) ? id : null;

  function addMsg(db, threadId, sender, body, extra = {}) {
    const m = {
      id: db.seq++, thread_id: threadId, sender_id: sender ? sender.id : null,
      sender_name: extra.kind === "system" ? "Sistema" : (sender ? (sender.name || sender.email) : ""),
      from_staff: extra.kind === "system" ? true : (isStaff(sender) && threadId !== sender.id),
      kind: extra.kind || "msg", body: str(body, 1500), file: extra.file || null,
      file_name: extra.file_name || null, file_type: extra.file_type || null, created_at: now()
    };
    db.messages.push(m);
    const th = db.threads[threadId] || (db.threads[threadId] = { last_at: 0, last_preview: "", unread_staff: 0, unread_user: 0 });
    th.last_at = m.created_at;
    th.last_preview = (m.body || ("📎 " + (m.file_name || "anexo"))).slice(0, 80);
    if (m.from_staff) th.unread_user++; else th.unread_staff++;
    return m;
  }
  const money = c => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  /* ---------------- API pública ---------------- */
  const S = {
    ApiError, DEMO,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    ready: boot,

    /* ---- contas ---- */
    async signUp(email, pass, name) {
      await boot(); await wait(250);
      email = str(email, 120).toLowerCase(); name = str(name, 60);
      if (!EMAIL_RE.test(email)) fail("Digite um e-mail válido.");
      if (name.length < 2) fail("Digite seu nome (mínimo 2 letras).");
      if (pass.length < 8 || pass.length > 128 || !/[a-zA-Z]/.test(pass) || !/\d/.test(pass)) fail("A senha precisa de 8+ caracteres, com letras e números.");
      if (read().users.some(u => u.email === email)) fail("Já existe uma conta com esse e-mail.");
      const salt = rid(16), hash = await hashPass(pass, salt);
      tx(db => {
        if (db.users.some(u => u.email === email)) fail("Já existe uma conta com esse e-mail.");
        db.users.push({ id: uuid(), email, name, role: "user", has_access: false, access_at: null, salt, hash, created_at: now() });
      }, "users");
      return S.signIn(email, pass);
    },
    async signIn(email, pass) {
      await boot(); await wait(300);
      email = str(email, 120).toLowerCase();
      const db0 = read();
      const f = db0.fails[email];
      if (f && f.until > now()) fail(`Muitas tentativas. Aguarde ${Math.ceil((f.until - now()) / 1000)}s e tente de novo.`);
      const u = db0.users.find(x => x.email === email);
      // mesmo trabalho com ou sem usuário: não entrega quais e-mails existem
      const h = await hashPass(String(pass).slice(0, 128), u ? u.salt : "00".repeat(16));
      if (!u || !sameHex(h, u.hash)) {
        tx(db => {
          const c = db.fails[email] || { n: 0, until: 0 };
          c.n++; if (c.n >= 5) { c.until = now() + Math.min(300, 15 * 2 ** (c.n - 5)) * 1000; }
          db.fails[email] = c;
        }, "auth");
        fail("E-mail ou senha incorretos.");
      }
      const t = rid(32), th = await sha256(t);
      tx(db => {
        delete db.fails[email];
        for (const [k, s] of Object.entries(db.sessions)) if (s.exp < now()) delete db.sessions[k];
        db.sessions[th] = { uid: u.id, exp: now() + SESSION_HOURS * 3600e3 };
      }, "auth");
      tok.set(t);
      return pub(u);
    },
    async signOut(all = false) {
      const t = tok.get(); tok.set(null);
      if (!t) return;
      const th = await sha256(t);
      const db = read(); const s = db.sessions[th];
      tx(d => {
        if (all && s) { for (const [k, v] of Object.entries(d.sessions)) if (v.uid === s.uid) delete d.sessions[k]; }
        else delete d.sessions[th];
      }, "auth");
    },
    async me() { await boot(); return pub(await currentUser(read())); },
    async updateName(name) {
      const u = await need(read()); name = str(name, 60);
      if (name.length < 2) fail("Nome deve ter de 2 a 60 caracteres.");
      tx(db => { db.users.find(x => x.id === u.id).name = name; }, "users");
    },
    async changePassword(oldPass, newPass) {
      const u = await need(read());
      if (!sameHex(await hashPass(oldPass, u.salt), u.hash)) fail("Senha atual incorreta.");
      if (newPass.length < 8 || !/[a-zA-Z]/.test(newPass) || !/\d/.test(newPass)) fail("A nova senha precisa de 8+ caracteres, com letras e números.");
      const salt = rid(16), hash = await hashPass(newPass, salt);
      const keep = await sha256(tok.get());
      tx(db => {
        const x = db.users.find(y => y.id === u.id); x.salt = salt; x.hash = hash;
        for (const [k, v] of Object.entries(db.sessions)) if (v.uid === u.id && k !== keep) delete db.sessions[k]; // derruba outras sessões
      }, "users");
    },

    /* ---- catálogo (público) ---- */
    async catalog() {
      await boot();
      const db = read(); const u = await currentUser(db);
      const staff = isStaff(u);
      return {
        settings: { ...clone(db.settings), pix_qr: pubFile(db, db.settings.pix_qr) },
        categories: clone(db.categories).sort((a, b) => a.position - b.position),
        lessons: clone(db.lessons.filter(l => l.published || staff)).map(l => ({ ...l, has_video: !!db.media[l.id] }))
          .sort((a, b) => a.position - b.position)
      };
    },
    /* URL temporária de um arquivo — só se quem pede tem direito de ver */
    async fileUrl(id) {
      await boot();
      if (!isId(id)) return null;
      const db = read(); const f = db.files[id]; if (!f) return null;
      const u = await currentUser(db);
      if (f.kind === "video") {
        const l = db.lessons.find(x => x.id === f.lesson);
        if (!l || !((l.is_free && l.published) || hasAccess(u))) fail("Você ainda não tem acesso a esta aula.");
      }
      if (f.kind === "receipt" && !(u && (u.id === f.thread || isStaff(u)))) fail("Sem permissão para ver este arquivo.");
      const b = await blobGet(id);
      return b ? URL.createObjectURL(b) : null;
    },
    async media(lessonId) {
      await boot();
      const db = read(); const u = await currentUser(db);
      const l = db.lessons.find(x => x.id === lessonId);
      if (!l || !(l.published || isStaff(u))) fail("Aula não encontrada.");
      if (!(l.is_free || hasAccess(u))) return { locked: true };
      return { locked: false, ...(clone(db.media[lessonId]) || {}) };
    },
    async progress() {
      const db = read(); const u = await currentUser(db);
      return u ? clone(db.progress[u.id] || {}) : {};
    },
    async saveProgress(lessonId, seconds, done) {
      const db0 = read(); const u = await currentUser(db0); if (!u || !isId(lessonId)) return;
      tx(db => {
        const p = db.progress[u.id] || (db.progress[u.id] = {});
        const cur = p[lessonId] || {};
        p[lessonId] = { seconds: Math.max(0, Math.floor(seconds) || 0), done: done == null ? !!cur.done : !!done, at: now() };
      }, "progress");
    },

    /* ---- compra ---- */
    async myOrders() {
      const db = read(); const u = await need(db);
      return clone(db.orders.filter(o => o.user_id === u.id)).sort((a, b) => b.created_at - a.created_at);
    },
    async createOrder() {
      await wait(300);
      const db0 = read(); const u = await need(db0);
      if (hasAccess(u)) fail("Você já tem acesso ao curso.");
      return tx(db => {
        const open = db.orders.filter(o => o.user_id === u.id && (o.status === "pending" || o.status === "review")).sort((a, b) => b.created_at - a.created_at)[0];
        if (open) return clone(open);
        if (db.orders.filter(o => o.user_id === u.id && o.created_at > now() - 864e5).length >= 5) fail("Muitos pedidos hoje. Fale com o suporte.");
        const o = {
          id: uuid(), user_id: u.id, code: rid(4).toUpperCase(),
          amount_cents: db.settings.price_cents, // o valor vem do "servidor", nunca da tela
          status: "pending", staff_note: "", reviewed_by: null, paid_at: null, reviewed_at: null, created_at: now()
        };
        db.orders.push(o);
        return clone(o);
      }, "orders");
    },
    async markPaid(orderId) {
      await wait(300);
      const db0 = read(); const u = await need(db0);
      return tx(db => {
        const o = db.orders.find(x => x.id === orderId && x.user_id === u.id);
        if (!o) fail("Pedido não encontrado.");
        if (o.status !== "pending" && o.status !== "review") fail("Este pedido não pode mais ser alterado.");
        const first = o.status === "pending";
        o.status = "review"; o.paid_at = o.paid_at || now();
        if (first) addMsg(db, u.id, null, `Pedido ${o.code} · ${money(o.amount_cents)}\nRecebemos seu aviso de pagamento! Envie aqui a foto ou o PDF do comprovante Pix. Assim que a equipe conferir, seu acesso é liberado.`, { kind: "system" });
        return clone(o);
      }, "orders");
    },

    /* ---- chat ---- */
    async messages(threadId, afterId = 0) {
      const db = read(); const u = await need(db);
      threadId = threadId || u.id;
      if (threadId !== u.id && !isStaff(u)) fail("Sem permissão.");
      return clone(db.messages.filter(m => m.thread_id === threadId && m.id > afterId).slice(-300));
    },
    async canChat() {
      const db = read(); const u = await need(db);
      return isStaff(u) || db.orders.some(o => o.user_id === u.id && o.status !== "pending");
    },
    async send(threadId, body, file) {
      const db0 = read(); const u = await need(db0);
      threadId = threadId || u.id;
      const staff = isStaff(u);
      if (threadId !== u.id && !staff) fail("Sem permissão.");
      if (!db0.users.some(x => x.id === threadId)) fail("Conversa não encontrada.");
      if (!staff && !db0.orders.some(o => o.user_id === u.id && o.status !== "pending")) fail("O chat abre depois que você aperta “Já paguei”.");
      body = str(body, 1500);
      if (!body && !file) fail("Escreva uma mensagem ou anexe o comprovante.");
      if (db0.messages.filter(m => m.sender_id === u.id && m.created_at > now() - 60e3).length >= 12) fail("Calma! Muitas mensagens seguidas. Aguarde um minuto.");
      let fid = null, fname = null, ftype = null;
      if (file) {
        fid = await saveFile(file, "receipt", { thread: threadId, by: u.id });
        fname = str(file.name, 120).replace(/[^\w.\- ()À-ú]/g, "_") || "comprovante";
        ftype = read().files[fid].type;
      }
      return tx(db => clone(addMsg(db, threadId, db.users.find(x => x.id === u.id), body, { file: fid, file_name: fname, file_type: ftype })), "messages");
    },
    async markRead(threadId) {
      const db0 = read(); const u = await currentUser(db0); if (!u) return;
      threadId = threadId || u.id;
      const th = db0.threads[threadId]; if (!th) return;
      if (threadId === u.id && th.unread_user) tx(db => { db.threads[threadId].unread_user = 0; }, "threads");
      else if (threadId !== u.id && isStaff(u) && th.unread_staff) tx(db => { db.threads[threadId].unread_staff = 0; }, "threads");
    },
    async badge() {
      const db = read(); const u = await currentUser(db); if (!u) return 0;
      if (isStaff(u)) return Object.values(db.threads).reduce((s, t) => s + t.unread_staff, 0) + db.orders.filter(o => o.status === "review").length;
      return (db.threads[u.id] || {}).unread_user || 0;
    },

    /* ---- equipe ---- */
    async staffThreads() {
      const db = read(); await needStaff(db);
      return Object.entries(db.threads).map(([uid, t]) => {
        const p = db.users.find(x => x.id === uid) || {};
        const o = db.orders.filter(x => x.user_id === uid).sort((a, b) => b.created_at - a.created_at)[0];
        return { user_id: uid, name: p.name, email: p.email, has_access: !!p.has_access, ...t, order_status: o ? o.status : null };
      }).sort((a, b) => (b.unread_staff > 0) - (a.unread_staff > 0) || b.last_at - a.last_at);
    },
    async orders(status) {
      const db = read(); await needStaff(db);
      return clone(db.orders.filter(o => !status || o.status === status)).sort((a, b) => b.created_at - a.created_at)
        .map(o => { const p = db.users.find(x => x.id === o.user_id) || {}; return { ...o, user: { name: p.name, email: p.email, has_access: !!p.has_access } }; });
    },
    async reviewOrder(orderId, approve, note) {
      await wait(250);
      const db0 = read(); const staff = await needStaff(db0);
      note = str(note, 300);
      return tx(db => {
        const o = db.orders.find(x => x.id === orderId); if (!o) fail("Pedido não encontrado.");
        if (o.status === "approved" && approve) fail("Este pedido já foi aprovado.");
        o.status = approve ? "approved" : "rejected"; o.staff_note = note; o.reviewed_by = staff.id; o.reviewed_at = now();
        const p = db.users.find(x => x.id === o.user_id);
        if (approve && p) { p.has_access = true; p.access_at = now(); }
        addMsg(db, o.user_id, null, approve
          ? "✅ Pagamento confirmado! Seu acesso ao curso foi liberado. Bons estudos!"
          : `❌ Não conseguimos confirmar o pagamento do pedido ${o.code}.${note ? "\nMotivo: " + note : ""}\nConfira o comprovante e envie de novo por aqui.`, { kind: "system" });
        return clone(o);
      }, "orders");
    },
    async users(q = "", limit = 60) {
      const db = read(); await needStaff(db);
      q = str(q, 60).toLowerCase();
      return db.users.filter(u => !q || u.email.includes(q) || (u.name || "").toLowerCase().includes(q))
        .sort((a, b) => b.created_at - a.created_at).slice(0, limit).map(pub);
    },
    async setAccess(userId, access) {
      const db0 = read(); await needStaff(db0);
      tx(db => { const p = db.users.find(x => x.id === userId); if (!p) fail("Aluno não encontrado."); p.has_access = !!access; p.access_at = access ? now() : null; }, "users");
    },
    async setRole(userId, role) {
      const db0 = read(); const me = await needOwner(db0);
      if (role !== "user" && role !== "staff") fail("Cargo inválido.");
      if (userId === me.id) fail("Você não pode mudar o próprio cargo.");
      tx(db => { const p = db.users.find(x => x.id === userId); if (!p) fail("Usuário não encontrado."); if (p.role === "owner") fail("Não é possível mudar o cargo do dono."); p.role = role; }, "users");
    },
    async stats() {
      const db = read(); await needStaff(db);
      return {
        students: db.users.filter(u => u.has_access && u.role === "user").length,
        users: db.users.length,
        review: db.orders.filter(o => o.status === "review").length,
        revenue: db.orders.filter(o => o.status === "approved").reduce((s, o) => s + o.amount_cents, 0),
        lessons: db.lessons.filter(l => l.published).length,
        drafts: db.lessons.filter(l => !l.published).length
      };
    },

    /* ---- dono: conteúdo ---- */
    async saveLesson(data, { thumb, removeThumb, video, videoUrl, removeVideo } = {}) {
      const db0 = read(); await needOwner(db0);
      const L = {
        title: str(data.title, 80), kicker: str(data.kicker, 40), description: str(data.description, 2000),
        category_id: db0.categories.some(c => c.id === data.category_id) ? data.category_id : null,
        software: ["", "Pr", "Ae", "Ps", "Dv", "Cc", "Ai", "Bl"].includes(data.software) ? data.software : "",
        palette: Math.min(8, Math.max(1, parseInt(data.palette, 10) || 1)),
        duration_min: Math.min(1000, Math.max(0, parseInt(data.duration_min, 10) || 0)),
        is_free: !!data.is_free, published: !!data.published, featured: !!data.featured
      };
      if (!L.title.replace(/\|/g, "").trim()) fail("Dê um título para a aula.");
      if (videoUrl != null && videoUrl !== "" && !S.parseVideoUrl(videoUrl)) fail("Link de vídeo inválido. Use um link do YouTube ou do Vimeo.");
      // valida arquivos ANTES de gravar qualquer coisa
      if (thumb) await checkFile(thumb, "image");
      if (video) await checkFile(video, "video");

      let id = isId(data.id) && db0.lessons.some(l => l.id === data.id) ? data.id : null;
      const old = id ? clone(db0.lessons.find(l => l.id === id)) : null;
      const oldMedia = id ? clone(db0.media[id] || null) : null;
      if (!id) {
        id = uuid();
        tx(db => {
          const pos = Math.max(0, ...db.lessons.map(l => l.position)) + 1;
          db.lessons.push({ id, ...L, thumb: null, position: pos, created_at: now(), updated_at: now() });
        }, "lessons");
      } else {
        tx(db => { Object.assign(db.lessons.find(l => l.id === id), L, { updated_at: now() }); }, "lessons");
      }
      if (thumb || removeThumb) {
        const fid = thumb ? await saveFile(thumb, "image", { lesson: id }) : null;
        tx(db => { db.lessons.find(l => l.id === id).thumb = fid; }, "lessons");
        if (old && old.thumb) dropFile(old.thumb);
      }
      if (video) {
        const fid = await saveFile(video, "video", { lesson: id });
        tx(db => { db.media[id] = { file: fid, name: str(video.name, 120), size: video.size, url: null }; }, "lessons");
        if (oldMedia && oldMedia.file) dropFile(oldMedia.file);
      } else if (videoUrl) {
        tx(db => { db.media[id] = { file: null, url: String(videoUrl).trim() }; }, "lessons");
        if (oldMedia && oldMedia.file) dropFile(oldMedia.file);
      } else if (removeVideo) {
        tx(db => { delete db.media[id]; }, "lessons");
        if (oldMedia && oldMedia.file) dropFile(oldMedia.file);
      }
      return id;
    },
    async deleteLesson(id) {
      const db0 = read(); await needOwner(db0);
      const l = db0.lessons.find(x => x.id === id); if (!l) return;
      const m = db0.media[id];
      tx(db => { db.lessons = db.lessons.filter(x => x.id !== id); delete db.media[id]; for (const p of Object.values(db.progress)) delete p[id]; }, "lessons");
      if (l.thumb) dropFile(l.thumb);
      if (m && m.file) dropFile(m.file);
    },
    async reorderLessons(ids) {
      const db0 = read(); await needOwner(db0);
      tx(db => {
        const pos = ids.map(id => db.lessons.find(l => l.id === id)).filter(Boolean).map(l => l.position).sort((a, b) => a - b);
        ids.forEach((id, i) => { const l = db.lessons.find(x => x.id === id); if (l) l.position = pos[i]; });
      }, "lessons");
    },
    async saveCategory(id, name) {
      const db0 = read(); await needOwner(db0);
      name = str(name, 40); if (!name) fail("Dê um nome para a categoria.");
      return tx(db => {
        if (db.categories.some(c => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) fail("Já existe uma categoria com esse nome.");
        if (id) { const c = db.categories.find(x => x.id === id); if (!c) fail("Categoria não encontrada."); c.name = name; return c.id; }
        if (db.categories.length >= 40) fail("Limite de 40 categorias.");
        const c = { id: uuid(), name, position: Math.max(0, ...db.categories.map(x => x.position)) + 1 };
        db.categories.push(c); return c.id;
      }, "categories");
    },
    async deleteCategory(id) {
      const db0 = read(); await needOwner(db0);
      tx(db => { db.categories = db.categories.filter(c => c.id !== id); db.lessons.forEach(l => { if (l.category_id === id) l.category_id = null; }); }, "categories");
    },
    async moveCategory(id, dir) {
      const db0 = read(); await needOwner(db0);
      tx(db => {
        const list = db.categories.sort((a, b) => a.position - b.position);
        const i = list.findIndex(c => c.id === id), j = i + dir;
        if (i < 0 || j < 0 || j >= list.length) return;
        [list[i], list[j]] = [list[j], list[i]];
        list.forEach((c, k) => { c.position = k + 1; });
      }, "categories");
    },
    async saveSettings(data, { qr, removeQr } = {}) {
      const db0 = read(); await needOwner(db0);
      const price = Math.round(Number(String(data.price).replace(/\./g, "").replace(",", ".")) * 100);
      if (!(price >= 100 && price <= 10000000)) fail("Preço inválido (mínimo R$ 1,00).");
      const s = {
        brand: str(data.brand, 24) || "TRT PRO", hero_kicker: str(data.hero_kicker, 80), hero_title: str(data.hero_title, 60) || "EDITE COMO|UM PROFISSIONAL",
        hero_text: str(data.hero_text, 300), price_cents: price, pix_key: str(data.pix_key, 77), pix_name: str(data.pix_name, 25),
        pix_city: str(data.pix_city, 15), support_hours: str(data.support_hours, 60)
      };
      if (qr) await checkFile(qr, "image");
      tx(db => { Object.assign(db.settings, s, { updated_at: now() }); }, "settings");
      if (qr || removeQr) {
        const old = db0.settings.pix_qr;
        const fid = qr ? await saveFile(qr, "image", { qr: true }) : null;
        tx(db => { db.settings.pix_qr = fid; }, "settings");
        if (old) dropFile(old);
      }
    },

    /* ---- utilidades ---- */
    parseVideoUrl(raw) {
      let u; try { u = new URL(String(raw).trim()); } catch (_) { return null; }
      if (u.protocol !== "https:") return null;
      const host = u.hostname.replace(/^www\.|^m\./, "");
      let m;
      if (host === "youtu.be" && (m = u.pathname.match(/^\/([\w-]{11})/))) return { type: "youtube", id: m[1] };
      if (host === "youtube.com" || host === "youtube-nocookie.com") {
        const v = u.searchParams.get("v"); if (v && /^[\w-]{11}$/.test(v)) return { type: "youtube", id: v };
        if ((m = u.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{11})/))) return { type: "youtube", id: m[1] };
      }
      if (host === "vimeo.com" && (m = u.pathname.match(/^\/(\d{5,12})(?:\/([\da-f]{6,20}))?/))) return { type: "vimeo", id: m[1], h: m[2] || u.searchParams.get("h") || "" };
      if (host === "player.vimeo.com" && (m = u.pathname.match(/^\/video\/(\d{5,12})/))) return { type: "vimeo", id: m[1], h: u.searchParams.get("h") || "" };
      return null;
    },
    async resetAll() {
      try { localStorage.removeItem(DB_KEY); } catch (_) {}
      mem = null; tok.set(null); await blobClear(); ready = null; await boot(); emit("*");
    }
  };
  Object.defineProperty(window, "Server", { value: Object.freeze(S), writable: false, configurable: false });
})();
