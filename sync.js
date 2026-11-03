/* Konidas Αποθήκη → konidas.gr: «Πέρασε κινήσεις»
   Τρέχει μέσα στο admin του konidas.gr (από σελιδοδείκτη), με τη σύνδεση του διαχειριστή.
   Γράφει ΜΟΝΟ: απόθεμα ανά αποθήκη και barcode σε προϊόντα με ΚΕΝΟ barcode. Τίποτε άλλο.
   Δεν περιέχει κωδικούς ή διευθύνσεις: η διεύθυνση της βάσης έρχεται από τον σελιδοδείκτη. */
(function () {
  "use strict";
  if (window.__KSYNC) { window.__KSYNC.show(); return; }
  const VER = "1.6";
  const WHS = { KTIMA: 8, PARAGGELIA: 7, EKTHESI: 6, MAGAZI: 1, AITOLIKI: 5, NEKTARIOS: 2, FYLAXI: 3 };
  const NAMES = { MAGAZI: "Αποθ. μαγαζιού", EKTHESI: "Έκθεση", KTIMA: "Κτήμα", FYLAXI: "Φύλαξη", AITOLIKI: "Αιτωλική", NEKTARIOS: "Νεκτάριος", XALASMENA: "Χτυπημένα", PARAGGELIA: "Παραγγελία", CUS: "Πελάτης", SUP: "Προμηθευτής", ADJ: "Διόρθωση" };
  const ALLW = Object.keys(WHS).concat(["XALASMENA"]);
  const ADMINS = ["Γιάννης", "Γιώργος", "Μάνια"];
  const API = localStorage.getItem("konidas_api") || "";

  /* ---------- UI ---------- */
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:2147483647";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    *{box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}
    .bg{position:fixed;inset:0;background:#0b1f44cc;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:30px 10px}
    .box{background:#fff;border-radius:14px;max-width:980px;width:100%;padding:22px 24px;box-shadow:0 10px 40px #0006;color:#14213d}
    h1{margin:0 0 4px;font-size:22px;color:#0b1f44} .sub{color:#667;margin-bottom:14px;font-size:14px}
    .x{float:right;border:0;background:#eef;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:14px}
    table{width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 14px} th{background:#f2f4f8;text-align:left;padding:7px;font-size:13px}
    td{padding:7px;border-top:1px solid #e5e7eb;vertical-align:top} .m{color:#667;font-size:12px}
    .ok{color:#1a7f37;font-weight:bold} .bad{color:#b42318;font-weight:bold} .warn{color:#b54708;font-weight:bold}
    .btn{border:0;border-radius:10px;padding:11px 18px;font-size:15px;font-weight:bold;cursor:pointer;margin:4px 6px 4px 0}
    .go{background:#f5a623;color:#0b1f44} .gh{background:#eef1f6;color:#0b1f44} .sm{padding:6px 10px;font-size:13px}
    .msg{padding:10px 12px;border-radius:10px;margin:8px 0;font-size:14px} .mi{background:#eef4ff} .mb{background:#fdecea} .mo{background:#e8f6ec} .mw{background:#fff4e5}
    select,input{font-size:16px;padding:9px;border:1px solid #ccd;border-radius:8px;margin-right:6px}
    h2{font-size:16px;margin:16px 0 4px;color:#0b1f44} .chg{background:#fff4d6;border-radius:5px;padding:1px 5px}
    .bar{height:8px;background:#eee;border-radius:5px;overflow:hidden;margin:8px 0}.bar i{display:block;height:100%;background:#f5a623;width:0}
  </style><div class="bg"><div class="box" id="b"></div></div>`;
  const B = root.getElementById("b");
  document.body.appendChild(host);
  const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const head = (t, s) => `<button class="x" data-a="close">Κλείσιμο</button><h1>${t}</h1><div class="sub">${s || ""}</div>`;
  const A = {};
  root.addEventListener("click", e => { const el = e.target.closest("[data-a]"); if (!el || el.disabled) return; const f = A[el.dataset.a]; if (f) f(el.dataset.v, el); });
  A.close = () => { if (busy) return; host.style.display = "none"; };
  window.__KSYNC = { show: () => { host.style.display = ""; if (!busy) start(); } };
  let busy = false;

  /* ---------- βοηθητικά ---------- */
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function api(method, params, body) {
    const S = JSON.parse(sessionStorage.getItem("ksync_u") || "{}");
    if (method === "GET") return (await fetch(API + "?" + new URLSearchParams(Object.assign({ user: S.u, pin: S.p }, params)))).json();
    return (await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(Object.assign({ user: S.u, pin: S.p }, body)) })).json();
  }
  function eanOk(c) {
    c = String(c || ""); if (!/^(\d{8}|\d{12}|\d{13})$/.test(c)) return false;
    const d = c.split("").map(Number), chk = d.pop(); let s = 0;
    d.reverse().forEach((x, i) => { s += x * (i % 2 === 0 ? 3 : 1); });
    return (10 - (s % 10)) % 10 === chk;
  }
  const fetchT = async u => { const r = await fetch(u, { credentials: "include", cache: "no-store" }); if (!r.ok) throw new Error("HTTP " + r.status); return r.text(); };
  /* Διαβάζει από τη σελίδα επεξεργασίας: απόθεμα ανά αποθήκη, barcode, τίτλο */
  async function readProd(pid) {
    const h = await fetchT("/admin/products.php?action=edit&id=" + pid);
    if (h.indexOf('id="data_form"') < 0) throw new Error("login");
    const wh = {};
    for (const [k, id] of Object.entries(WHS)) {
      const m = h.match(new RegExp('id="warehouse\\|' + pid + "\\|" + id + '">([^<]*)<'));
      if (!m) throw new Error("δεν βρέθηκε η αποθήκη " + NAMES[k]);
      const t = m[1].trim(); wh[k] = /^-?\d+$/.test(t) ? Number(t) : 0;
      if (!/^-?\d+$/.test(t) && t !== "Προσθήκη" && t !== "") throw new Error("άγνωστη τιμή αποθήκης «" + t + "»");
    }
    const bm = h.match(/name="barcode" id="barcode"[^>]*value="([^"]*)"/);
    if (!bm) throw new Error("δεν βρέθηκε το πεδίο Barcode");
    return { wh, barcode: bm[1].trim(), html: h };
  }
  async function setStock(pid, k, q) {
    const r = await fetch("/admin/products.php?action=warehouse_stock_items_update", {
      method: "POST", credentials: "include", headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", "X-Requested-With": "XMLHttpRequest" },
      body: new URLSearchParams({ id: "warehouse|" + pid + "|" + WHS[k], value: String(q) })
    });
    const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch (e) { }
    if (!r.ok || !j) throw new Error("η αποθήκευση αποθέματος απέτυχε");
    return j;
  }
  /* Όλα τα πεδία της φόρμας όπως τα έχει αποθηκευμένα ο server */
  function formFields(html) {
    const d = new DOMParser().parseFromString(html, "text/html"), f = d.getElementById("data_form");
    if (!f) throw new Error("δεν βρέθηκε η φόρμα");
    return { form: f, list: [...new FormData(f).entries()].filter(e => typeof e[1] === "string") };
  }
  const fieldsKey = list => { const o = {}; list.forEach(([k, v]) => { (o[k] = o[k] || []).push(v); }); return o; };
  async function setBarcode(pid, code, beforeHtml) {
    const { form, list } = formFields(beforeHtml);
    const fd = new FormData(form);
    fd.set("barcode", code);
    fd.set("submit_button", "Αποθήκευση αλλαγών");
    const r = await fetch("/admin/products.php?action=edit&id=" + pid, { method: "POST", credentials: "include", body: fd });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const after = await readProd(pid);
    const a = fieldsKey(formFields(after.html).list), b = fieldsKey(list);
    const diff = [];
    new Set(Object.keys(a).concat(Object.keys(b))).forEach(k => {
      if (k === "barcode" || k === "submit_button") return;
      if (JSON.stringify(a[k] || []) !== JSON.stringify(b[k] || [])) diff.push(k);
    });
    return { after, diff, ok: after.barcode === code };
  }
  function backup(rec) {
    try {
      const k = "konidas_bk" + new Date().toISOString().slice(0, 10) + "_sync";
      const arr = JSON.parse(localStorage.getItem(k) || "[]"); arr.push(Object.assign({ t: Date.now() }, rec));
      localStorage.setItem(k, JSON.stringify(arr));
    } catch (e) { }
  }

  /* ---------- ροή ---------- */
  let D = null, plan = null, choice = {};
  function start() {
    if (!/konidas\.gr$/.test(location.hostname) || location.pathname.indexOf("/admin") !== 0) {
      B.innerHTML = head("Πέρασε κινήσεις") + `<div class="msg mb">Άνοιξε πρώτα το admin του konidas.gr και πάτα ξανά τον σελιδοδείκτη.</div>`; return;
    }
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(API)) {
      B.innerHTML = head("Πέρασε κινήσεις") + `<div class="msg mb">Ο σελιδοδείκτης δεν είναι σωστά στημένος. Ζήτα από τον Γιάννη να τον ξαναφτιάξει.</div>`; return;
    }
    const S = JSON.parse(sessionStorage.getItem("ksync_u") || "{}");
    if (!S.u) return login();
    load();
  }
  function login(msg) {
    B.innerHTML = head("Πέρασε κινήσεις", "Από την εφαρμογή Αποθήκη στο konidas.gr · μόνο διαχειριστές") +
      (msg ? `<div class="msg mb">${esc(msg)}</div>` : "") +
      `<select id="u">${ADMINS.map(n => `<option>${n}</option>`).join("")}</select><input id="p" type="password" inputmode="numeric" placeholder="PIN" style="width:110px"><button class="btn go" data-a="login">Συνέχεια</button>`;
    setTimeout(() => root.getElementById("p").focus(), 50);
    root.getElementById("p").addEventListener("keydown", e => { if (e.key === "Enter") A.login(); });
  }
  A.login = async () => {
    const u = root.getElementById("u").value, p = root.getElementById("p").value;
    sessionStorage.setItem("ksync_u", JSON.stringify({ u, p }));
    try { const r = await api("GET", { a: "ver" }); if (!r.ok || r.role !== "admin") { sessionStorage.removeItem("ksync_u"); return login(r.ok ? "Μόνο διαχειριστές." : "Λάθος PIN."); } }
    catch (e) { sessionStorage.removeItem("ksync_u"); return login("Δεν υπάρχει σύνδεση με τη βάση."); }
    load();
  };
  function progress(t, i, n) { B.innerHTML = head("Πέρασε κινήσεις", esc(t)) + `<div class="bar"><i style="width:${n ? Math.round(100 * i / n) : 5}%"></i></div><div class="m">${n ? i + " / " + n : ""}</div>`; }

  async function load() {
    busy = true; choice = {};
    try {
      progress("Φόρτωση κινήσεων από την εφαρμογή…");
      const r = await api("GET", { a: "state", pver: "" });
      if (!r.ok) { busy = false; sessionStorage.removeItem("ksync_u"); return login("Λάθος PIN."); }
      D = r;
      const P = {}; (r.products || []).forEach(p => { P[String(p.id)] = p; }); D.P = P;
      const pend = r.moves.filter(m => !m.syn && !m.x && m.p && m.ty !== "link");
      const by = {}; pend.forEach(m => { (by[m.p] = by[m.p] || []).push(m); });
      /* barcode που μάθαμε στην εφαρμογή για προϊόντα χωρίς barcode */
      const appEan = {}; Object.values(P).forEach(p => { if (p.ean) (appEan[p.ean] = appEan[p.ean] || []).push(String(p.id)); });
      const bc = [];
      Object.values(P).forEach(p => {
        if (p.ean || !p.x) return;
        const xs = String(p.x).split(",").filter(Boolean), valid = xs.filter(eanOk);
        if (!valid.length) return;
        bc.push({ pid: String(p.id), codes: valid });
      });
      const pids = [...new Set(Object.keys(by).concat(bc.map(b => b.pid)))];
      const live = {};
      for (let i = 0; i < pids.length; i++) {
        progress("Διαβάζω το τρέχον απόθεμα στο site…", i, pids.length);
        try { live[pids[i]] = await readProd(pids[i]); }
        catch (e) { if (e.message === "login") throw new Error("Δεν είσαι συνδεδεμένος στο admin. Κάνε login και ξαναπάτα."); live[pids[i]] = { err: e.message }; }
      }
      /* έλεγχος διπλών barcode σε ΟΛΟ το site (και ανενεργά) */
      let siteBc = null;
      if (bc.length) {
        siteBc = {};
        for (let pg = 1; pg < 60; pg++) {
          progress("Ελέγχω ότι κανένα άλλο προϊόν δεν έχει ήδη αυτά τα barcode…", pg, 17);
          const h = await fetchT("/admin/products.php?action=list&admin_items_pp=200&page=" + pg);
          const d = new DOMParser().parseFromString(h, "text/html"), cbs = [...d.querySelectorAll("input.record_checkbox")];
          if (!cbs.length) break;
          cbs.forEach(cb => { const s = cb.closest("tr").querySelector(".product_second_row"), m = s && s.textContent.match(/Barcode:\s*(\S+)/); if (m) (siteBc[m[1]] = siteBc[m[1]] || []).push(cb.value); });
          if (cbs.length < 200) break;
        }
      }
      /* σχέδιο αποθέματος */
      const stock = [];
      for (const pid of Object.keys(by)) {
        const snap = (r.site[pid] || {}), tgt = {}, ms = by[pid].sort((a, b) => a.t - b.t);
        ALLW.forEach(w => { tgt[w] = Number(snap[w] || 0); });
        ms.forEach(m => { if (tgt[m.f] !== undefined) tgt[m.f] -= Number(m.q); if (tgt[m.to] !== undefined) tgt[m.to] += Number(m.q); });
        const L = live[pid], row = { pid, ms, snap, tgt, live: L };
        if (L.err) row.st = "err", row.why = L.err;
        else if (ALLW.some(w => tgt[w] < 0)) row.st = "err", row.why = "Θα έβγαινε αρνητικό απόθεμα. Κάποια κίνηση είναι λάθος.";
        else if (Object.keys(WHS).some(w => Number(snap[w] || 0) !== L.wh[w])) row.st = "conf";
        else row.st = Object.keys(WHS).some(w => tgt[w] !== L.wh[w]) ? "ok" : "none";
        stock.push(row);
      }
      /* σχέδιο barcode */
      const bars = bc.map(b => {
        const L = live[b.pid], row = { pid: b.pid, code: b.codes[0], live: L };
        if (L.err) return Object.assign(row, { st: "err", why: L.err });
        if (b.codes.length > 1) return Object.assign(row, { st: "skip", why: "Η εφαρμογή έχει " + b.codes.length + " διαφορετικά barcode γι' αυτό: " + b.codes.join(", ") + ". Θέλει απόφαση." });
        if (L.barcode === row.code) return Object.assign(row, { st: "same" });
        if (L.barcode) return Object.assign(row, { st: "skip", why: "Το site έχει ήδη άλλο barcode (" + L.barcode + "). Δεν το αλλάζω." });
        const others = ((siteBc || {})[row.code] || []).filter(x => x !== b.pid).concat((appEan[row.code] || []).filter(x => x !== b.pid));
        if (others.length) return Object.assign(row, { st: "skip", why: "Το έχει ήδη άλλο προϊόν: #" + [...new Set(others)].join(", #") });
        return Object.assign(row, { st: "ok" });
      });
      plan = { stock, bars };
      busy = false; preview();
    } catch (e) { busy = false; B.innerHTML = head("Πέρασε κινήσεις") + `<div class="msg mb">${esc(e.message)}</div><button class="btn gh" data-a="reload">Ξανά</button>`; }
  }
  A.reload = () => load();
  A.logout = () => { sessionStorage.removeItem("ksync_u"); login(); };
  const pname = pid => { const p = D.P[pid]; return p ? p.n : "#" + pid; };
  const whCells = (from, to) => Object.keys(WHS).filter(w => from[w] !== to[w]).map(w => `${esc(NAMES[w])}: ${from[w]} → <span class="chg">${to[w]}</span>`).join("<br>") || '<span class="m">καμία αλλαγή στο site</span>';
  const mvTxt = ms => ms.map(m => `${new Date(Number(m.t)).toLocaleString("el-GR", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" })} · ${esc(m.u)} · ${m.q}× ${esc(NAMES[m.f] || m.f)} → ${esc(NAMES[m.to] || m.to)}`).join("<br>");
  function preview() {
    const S = JSON.parse(sessionStorage.getItem("ksync_u") || "{}");
    const st = plan.stock, ok = st.filter(r => r.st === "ok" || r.st === "none"), conf = st.filter(r => r.st === "conf"), err = st.filter(r => r.st === "err");
    const bOk = plan.bars.filter(b => b.st === "ok"), bSkip = plan.bars.filter(b => b.st === "skip" || b.st === "err");
    let h = head("Πέρασε κινήσεις", `${esc(S.u)} · <a href="#" data-a="logout" style="color:#667">αλλαγή χρήστη</a> · v${VER}`);
    if (!st.length && !plan.bars.length) h += `<div class="msg mo">Όλα είναι ήδη περασμένα. Δεν υπάρχει τίποτα για το site.</div>`;
    if (ok.length) h += `<h2>Απόθεμα · ${ok.length} προϊόντα</h2><table><tr><th>Συσκευή</th><th>Κινήσεις</th><th>Site τώρα → νέο</th></tr>` +
      ok.map(r => `<tr><td><b>${esc(pname(r.pid))}</b><div class="m">#${r.pid}</div></td><td class="m">${mvTxt(r.ms)}</td><td>${whCells(r.live.wh, Object.assign({}, r.live.wh, pick(r.tgt)))}</td></tr>`).join("") + `</table>`;
    if (conf.length) h += `<h2 class="warn">Θέλουν απόφαση · ${conf.length}</h2><div class="m">Το απόθεμα στο site άλλαξε από άλλον (με το χέρι) μετά την τελευταία φορά. Διάλεξε τι ισχύει:</div><table><tr><th>Συσκευή</th><th>Κινήσεις</th><th>Site τώρα / αναμενόταν</th><th>Τι κάνω</th></tr>` +
      conf.map(r => { const add = addOnLive(r); return `<tr><td><b>${esc(pname(r.pid))}</b><div class="m">#${r.pid}</div></td><td class="m">${mvTxt(r.ms)}</td><td>${Object.keys(WHS).filter(w => (r.snap[w] || 0) !== r.live.wh[w] || r.tgt[w] !== (r.snap[w] || 0)).map(w => `${esc(NAMES[w])}: <b>${r.live.wh[w]}</b> / ${r.snap[w] || 0}`).join("<br>")}</td>
        <td><button class="btn sm ${choice[r.pid] === "add" ? "go" : "gh"}" data-a="ch" data-v="${r.pid}|add">Πρόσθεσε τις κινήσεις<br><span class="m">${Object.keys(WHS).filter(w => add[w] !== r.live.wh[w]).map(w => NAMES[w] + " → " + add[w]).join(", ") || "-"}</span></button>
        <button class="btn sm ${choice[r.pid] === "keep" ? "go" : "gh"}" data-a="ch" data-v="${r.pid}|keep">Το site είναι ήδη σωστό</button>
        <button class="btn sm ${!choice[r.pid] ? "go" : "gh"}" data-a="ch" data-v="${r.pid}|">Άφησέ το για μετά</button></td></tr>`; }).join("") + `</table>`;
    if (err.length) h += `<h2 class="bad">Δεν περνάνε · ${err.length}</h2><table>` + err.map(r => `<tr><td><b>${esc(pname(r.pid))}</b><div class="m">#${r.pid}</div></td><td class="m">${mvTxt(r.ms)}</td><td class="bad">${esc(r.why)}</td></tr>`).join("") + `</table>`;
    if (bOk.length) h += `<h2>Barcode σε κενό πεδίο · ${bOk.length}</h2><table><tr><th>Συσκευή</th><th>Barcode</th></tr>` + bOk.map(b => `<tr><td><b>${esc(pname(b.pid))}</b><div class="m">#${b.pid}</div></td><td>κενό → <span class="chg">${esc(b.code)}</span></td></tr>`).join("") + `</table>`;
    if (bSkip.length) h += `<h2 class="warn">Barcode που δεν γράφονται · ${bSkip.length}</h2><table>` + bSkip.map(b => `<tr><td><b>${esc(pname(b.pid))}</b><div class="m">#${b.pid} · ${esc(b.code)}</div></td><td class="warn">${esc(b.why)}</td></tr>`).join("") + `</table>`;
    const n = ok.length + conf.filter(r => choice[r.pid]).length + bOk.length;
    h += n ? `<div class="msg mi">Θα αλλάξει <b>μόνο</b> απόθεμα ανά αποθήκη και κενά barcode. Τιμές, τίτλοι και όλα τα άλλα μένουν ως έχουν. Κρατιέται backup.</div><button class="btn go" data-a="run">Έγκριση · πέρασέ τα (${n})</button>` : "";
    h += `<button class="btn gh" data-a="reload">Ανανέωση</button><div class="msg mi" style="margin-top:14px"><b>Αυτόματο πέρασμα:</b> αφήνεις αυτή την καρτέλα ανοιχτή και κάθε 25 δευτερόλεπτα περνάει μόνο του ό,τι είναι 100% καθαρό (μόνο απόθεμα). Ό,τι δεν ταιριάζει δεν το αγγίζει.</div><button class="btn go" data-a="autostart">Ξεκίνα αυτόματο</button>`;
    B.innerHTML = h;
  }
  const pick = t => { const o = {}; Object.keys(WHS).forEach(w => { o[w] = t[w]; }); return o; };
  function addOnLive(r) { const o = {}; Object.keys(WHS).forEach(w => { o[w] = r.live.wh[w] + (r.tgt[w] - Number(r.snap[w] || 0)); }); return o; }
  A.ch = v => { const [pid, c] = v.split("|"); if (c) choice[pid] = c; else delete choice[pid]; preview(); };

  /* Περνάει ένα προϊόν: ξαναδιαβάζει, γράφει μόνο απόθεμα, επιβεβαιώνει, σημειώνει στην εφαρμογή */
  async function applyStock(r, c) {
    const L = await readProd(r.pid); /* ξαναδιαβάζω ακριβώς πριν γράψω */
    const same = Object.keys(WHS).every(w => L.wh[w] === r.live.wh[w]);
    if (!same) return ["bad", "Άλλαξε στο site μόλις τώρα. Δεν άγγιξα τίποτα."];
    const want = c === "keep" ? Object.assign({}, L.wh) : c === "add" ? addOnLive(r) : pick(r.tgt);
    if (Object.values(want).some(q => q < 0)) return ["bad", "Θα έβγαινε αρνητικό. Δεν άγγιξα τίποτα."];
    backup({ kind: "stock", pid: r.pid, before: L.wh, want, moves: r.ms.map(m => m.id) });
    for (const w of Object.keys(WHS)) if (want[w] !== L.wh[w]) await setStock(r.pid, w, want[w]);
    const V = await readProd(r.pid);
    const bad = Object.keys(WHS).filter(w => V.wh[w] !== want[w]);
    if (bad.length) return ["bad", "Μετά τον έλεγχο δεν ταιριάζει: " + bad.map(w => NAMES[w] + " " + V.wh[w] + " αντί " + want[w]).join(", ") + ". Δεν σημειώθηκε ως περασμένο."];
    const snap = Object.assign({}, V.wh, { XALASMENA: r.tgt.XALASMENA });
    const s = await api("POST", null, { ops: [{ op: "sync", oid: "s" + Date.now() + r.pid, ids: r.ms.map(m => m.id), site: { [r.pid]: snap } }] });
    if (!s.ok || !(s.applied || []).length) return ["warn", "Γράφτηκε στο site, αλλά η εφαρμογή δεν το σημείωσε. Μην το ξαναπεράσεις, πες το στον Γιάννη."];
    return ["ok", c === "keep" ? "Κράτησα το site ως έχει, οι κινήσεις σημειώθηκαν." : Object.keys(WHS).filter(w => want[w] !== L.wh[w]).map(w => NAMES[w] + " " + L.wh[w] + "→" + want[w]).join(", ") || "Καμία αλλαγή στο site, σημειώθηκε."];
  }
  /* ---------- ΑΥΤΟΜΑΤΟ: ελέγχει κάθε 25" και περνάει αμέσως ό,τι είναι 100% καθαρό ---------- */
  const AUTO = { on: false, last: 0, ver: "", pver: "", P: {}, log: [], conf: {}, n: 0, beat: 0, timer: null, err: "" };
  function autoView() {
    if (!AUTO.on) return;
    const cf = Object.values(AUTO.conf);
    B.innerHTML = head("Αυτόματο πέρασμα · ενεργό ✓", "Μην κλείσεις αυτή την καρτέλα. Κάθε 25 δευτερόλεπτα περνάει στο site τις κινήσεις της εφαρμογής. Κάθε 20' πιάνει ό,τι αλλάξατε με το χέρι στο admin και το περνάει στην εφαρμογή. Κάθε νύχτα κάνει πλήρη διασταύρωση.") +
      `<div class="msg ${AUTO.err ? "mb" : "mo"}">${AUTO.err ? esc(AUTO.err) : "Τελευταίος έλεγχος: " + (AUTO.last ? new Date(AUTO.last).toLocaleTimeString("el-GR") : "–") + " · περάστηκαν: " + AUTO.n}</div>` +
      (cf.length ? `<h2 class="warn">Θέλουν απόφαση · ${cf.length}</h2><div class="m">Δεν τα άγγιξα. Πάτα «Σταμάτα» και μετά τον σελιδοδείκτη για χειροκίνητο πέρασμα με επιλογές.</div><table>${cf.map(x => `<tr><td><b>${esc(x.n)}</b></td><td class="warn">${esc(x.why)}</td></tr>`).join("")}</table>` : "") +
      `<h2>Τελευταία</h2><table>${AUTO.log.slice(0, 15).map(x => `<tr><td class="m">${new Date(x.t).toLocaleTimeString("el-GR")}</td><td><b>${esc(x.n)}</b></td><td class="${x.k}">${esc(x.msg)}</td></tr>`).join("") || '<tr><td class="m">Καμία κίνηση ακόμα.</td></tr>'}</table>` +
      `<button class="btn gh" data-a="autostop">Σταμάτα το αυτόματο</button>`;
  }
  async function autoTick() {
    if (!AUTO.on || busy) return;
    busy = true;
    try {
      const v = await api("GET", { a: "ver" });
      if (!v.ok) throw new Error(v.err === "auth" ? "Το PIN δεν ισχύει πια." : "Σφάλμα βάσης");
      AUTO.last = Date.now(); AUTO.err = "";
      if (v.ver !== AUTO.ver || v.pver !== AUTO.pver) {
        const r = await api("GET", { a: "state", pver: AUTO.pver });
        if (r.products) { AUTO.P = {}; r.products.forEach(p => { AUTO.P[String(p.id)] = p; }); }
        AUTO.ver = r.ver; AUTO.pver = r.pver;
        const pend = r.moves.filter(m => !m.syn && !m.x && m.p && m.ty !== "link");
        const by = {}; pend.forEach(m => { (by[m.p] = by[m.p] || []).push(m); });
        AUTO.conf = {};
        /* Ασφάλεια: πολλές αλλαγές μαζί (π.χ. λάθος μέτρηση) δεν περνάνε ποτέ αυτόματα */
        const batches = {}; pend.forEach(m => { (batches[m.b || m.id] = batches[m.b || m.id] || new Set()).add(m.p); });
        const big = new Set(); Object.values(batches).forEach(st => { if (st.size > 15) st.forEach(p => big.add(p)); });
        if (big.size) AUTO.conf["_big"] = { n: big.size + " προϊόντα σε μία κίνηση", why: "Πολλές αλλαγές μαζί (π.χ. μέτρηση). Δεν περνάνε αυτόματα: θέλουν έλεγχο και χειροκίνητη έγκριση." };
        for (const pid of Object.keys(by)) {
          if (big.has(pid)) continue;
          const nm = (AUTO.P[pid] || {}).n || "#" + pid, snap = r.site[pid] || {}, tgt = {}, ms = by[pid].sort((a, b) => a.t - b.t);
          ALLW.forEach(w => { tgt[w] = Number(snap[w] || 0); });
          ms.forEach(m => { if (tgt[m.f] !== undefined) tgt[m.f] -= Number(m.q); if (tgt[m.to] !== undefined) tgt[m.to] += Number(m.q); });
          let L; try { L = await readProd(pid); } catch (e) { if (e.message === "login") throw new Error("Αποσυνδέθηκες από το admin. Κάνε login και ξαναπάτα τον σελιδοδείκτη."); AUTO.conf[pid] = { n: nm, why: e.message }; continue; }
          if (ALLW.some(w => tgt[w] < 0)) { AUTO.conf[pid] = { n: nm, why: "Θα έβγαινε αρνητικό απόθεμα." }; continue; }
          if (Object.keys(WHS).some(w => Number(snap[w] || 0) !== L.wh[w])) { AUTO.conf[pid] = { n: nm, why: "Το site άλλαξε με το χέρι από την τελευταία φορά." }; continue; }
          const x = await applyStock({ pid, ms, snap, tgt, live: L }, "set");
          if (x[0] === "ok") AUTO.n++; else AUTO.conf[pid] = { n: nm, why: x[1] };
          AUTO.log.unshift({ t: Date.now(), n: nm, k: x[0], msg: x[1] }); AUTO.log = AUTO.log.slice(0, 50);
        }
        AUTO.pend = Object.keys(AUTO.conf).length;
        if (AUTO.pend || Date.now() - AUTO.beat > 120000) await sendBeat(AUTO.pend);
      } else if (Date.now() - AUTO.beat > 120000) await sendBeat(AUTO.pend || 0);
    } catch (e) { AUTO.err = e.message; try { await sendBeat(-1, e.message); } catch (x) { } }
    busy = false; autoView();
  }
  async function sendBeat(pend, err) {
    AUTO.beat = Date.now();
    await api("POST", null, { ops: [{ op: "beat", oid: "b" + Date.now(), pend: Math.max(0, pend), conf: Object.entries(AUTO.conf).map(([p, x]) => ({ p, n: x.n, why: x.why })), err: err || "" }] });
  }
  /* ---------- Αλλαγές που έγιναν με το χέρι στο admin: τις υιοθετεί η εφαρμογή ----------
     Κάθε 20' συγκρίνει το συνολικό απόθεμα κάθε προϊόντος (λίστα admin) με την προηγούμενη φορά.
     Κάθε νύχτα (02:00–05:00) ελέγχει αναλυτικά όλες τις αποθήκες όλων των προϊόντων με απόθεμα.
     Αν ένα προϊόν δεν έχει εκκρεμή κίνηση στην εφαρμογή, η αλλαγή του admin περνάει στην εφαρμογή αυτόματα.
     Αν έχει εκκρεμή κίνηση και άλλαξε και στο admin, μπαίνει στο «Θέλει απόφασή σου». */
  const TOTK = "ksync_totals", SITEMETA = {};
  /* Ό,τι διορθώνεται στο site (τίτλος, κωδικός, barcode) περνάει αυτόματα στην εφαρμογή */
  async function syncMeta() {
    const P = AUTO.P || {}; if (!Object.keys(P).length || !Object.keys(SITEMETA).length) return;
    const ch = [], nw = [], norm = x => String(x == null ? "" : x).replace(/\s+/g, " ").trim();
    for (const id in SITEMETA) { const s = SITEMETA[id], p = P[id];
      if (!p) { if (s.n) nw.push({ id, n: s.n, code: s.code, ean: s.ean, cat: s.cat, br: s.br, tpl: s.tpl }); continue; }
      const d = {}; if (s.n && norm(s.n) !== norm(p.n)) d.n = s.n; if (norm(s.code) !== norm(p.code)) d.code = s.code; if (norm(s.ean) !== norm(p.ean)) d.ean = s.ean; ["cat", "br", "tpl"].forEach(k => { if (s[k] && norm(s[k]) !== norm(p[k])) d[k] = s[k]; });
      if (Object.keys(d).length) ch.push(Object.assign({ id }, d)); }
    for (let i = 0; i < ch.length; i += 300) await api("POST", null, { ops: [{ op: "meta", oid: "meta" + Date.now() + i, list: ch.slice(i, i + 300) }] });
    if (nw.length) await api("POST", null, { ops: nw.slice(0, 100).map((p, i) => ({ op: "addProduct", oid: "np" + Date.now() + i, p })) });
    if (ch.length || nw.length) { AUTO.log.unshift({ t: Date.now(), n: "Στοιχεία προϊόντων", k: "ok", msg: "Από το site στην εφαρμογή: " + ch.length + " αλλαγές (τίτλος/κωδικός/barcode/κατηγορία)" + (nw.length ? ", " + Math.min(nw.length, 100) + " νέα προϊόντα" : "") }); AUTO.pver = ""; }
  }
  /* Δέντρο κατηγοριών όπως στο site: id → «Γονική › Υποκατηγορία › Κατηγορία» */
  let CATPATH = {};
  async function loadCats() {
    try {
      const h = await fetchT("/admin/product_categories.php"), d = new DOMParser().parseFromString(h, "text/html"), sel = d.querySelector("#add_record_category");
      if (!sel) return; const st = [], out = {};
      for (const o of sel.querySelectorAll("option")) { if (o.value === "0") continue; const raw = o.innerHTML, dep = (raw.match(/&nbsp;&nbsp;/g) || []).length, name = o.textContent.replace(/\u00a0/g, " ").trim();
        st.length = dep; st[dep] = name; out[o.value] = st.slice(0, dep + 1).filter(Boolean).join(" › "); }
      CATPATH = out;
    } catch (e) { }
  }
  async function siteTotals() {
    const t = {}; await loadCats();
    for (let pg = 1; pg < 60; pg++) {
      const h = await fetchT("/admin/products.php?action=list&admin_items_pp=200&page=" + pg);
      const d = new DOMParser().parseFromString(h, "text/html"), cbs = [...d.querySelectorAll("input.record_checkbox")];
      if (!cbs.length) break;
      cbs.forEach(cb => { const tr = cb.closest("tr"), sr = tr.querySelector(".product_second_row"), sec = (sr || {}).textContent || "", m = sec.match(/Απόθεμα:\s*(-?\d+)/); t[cb.value] = m ? Number(m[1]) : 0;
        /* στοιχεία προϊόντος για την εφαρμογή: τίτλος, κωδικός, barcode */
        const a = tr.querySelector("a.search_highlight"); let n = ""; if (a) { const c = a.cloneNode(true); c.querySelectorAll(".product_second_row").forEach(x => x.remove()); n = c.textContent.replace(/\s+/g, " ").trim(); }
        const kc = sec.match(/Κωδ:\s*(\S+)/), bc = sec.match(/Barcode:\s*(\S+)/), sp = [...(sr ? sr.querySelectorAll("span") : [])], tx = k => { const e = sp.find(x => x.textContent.trim().startsWith(k)); return e ? (e.querySelector("strong") || e).textContent.replace(k, "").trim() : ""; };
        const ca = tr.querySelector('a[href*="action=list&cat="]'), cid = ca ? ((ca.getAttribute("href") || "").match(/cat=(\d+)/) || [])[1] : "";
        SITEMETA[cb.value] = { n, code: kc ? kc[1] : "", ean: bc ? bc[1] : "", cat: ca ? (CATPATH[cid] || ca.textContent.trim()) : "", br: tx("Κατ/στής:"), tpl: tx("Πρότυπο:") }; });
      if (cbs.length < 200) break;
    }
    return t;
  }
  async function adoptSite(ids, why) {
    const st = await api("GET", { a: "state", pver: AUTO.pver || "" });
    if (!st.ok) return;
    const pendP = new Set(st.moves.filter(m => !m.syn && !m.x && m.p && m.ty !== "link").map(m => m.p));
    for (const pid of ids) {
      const nm = (AUTO.P[pid] || {}).n || "#" + pid;
      let L; try { L = await readProd(pid); } catch (e) { continue; }
      const snap = st.site[pid] || {}, diff = Object.keys(WHS).filter(w => Number(snap[w] || 0) !== L.wh[w]);
      if (!diff.length) continue;
      if (pendP.has(pid)) { AUTO.conf[pid] = { n: nm, why: "Άλλαξε στο admin ενώ υπάρχει και κίνηση από την εφαρμογή. Διάλεξε τι ισχύει." }; continue; }
      const site = { [pid]: Object.assign({}, L.wh, { XALASMENA: Number(snap.XALASMENA || 0) }) };
      const r = await api("POST", null, { ops: [{ op: "sync", oid: "adm" + Date.now() + pid, ids: [], site }] });
      const msg = "Αλλαγή από το admin, πέρασε στην εφαρμογή: " + diff.map(w => NAMES[w] + " " + Number(snap[w] || 0) + "→" + L.wh[w]).join(", ");
      AUTO.log.unshift({ t: Date.now(), n: nm, k: r.ok ? "ok" : "bad", msg: r.ok ? msg : "Δεν ενημερώθηκε η εφαρμογή" });
    }
    AUTO.log = AUTO.log.slice(0, 50);
  }
  async function watchAdmin(full) {
    const now = new Date(), cur = await siteTotals();
    let prev = null; try { prev = JSON.parse(localStorage.getItem(TOTK) || "null"); } catch (e) { }
    localStorage.setItem(TOTK, JSON.stringify(cur));
    let ids;
    if (full) ids = Object.keys(cur).filter(id => cur[id] !== 0 || (prev && prev[id]));
    else if (!prev) return;
    else ids = Object.keys(cur).filter(id => cur[id] !== prev[id]);
    if (ids.length) await adoptSite(ids, full ? "νυχτερινός έλεγχος" : "αλλαγή συνόλου");
    try { await syncMeta(); } catch (e) { AUTO.err = "Στοιχεία προϊόντων: " + e.message; }
    AUTO.lastWatch = now.getTime(); if (full) AUTO.lastFull = now.toDateString();
  }
  async function watchTick() {
    if (!AUTO.on || busy) return;
    const h = new Date().getHours(), full = h >= 2 && h < 5 && AUTO.lastFull !== new Date().toDateString();
    if (!full && AUTO.lastWatch && Date.now() - AUTO.lastWatch < 20 * 60000) return;
    busy = true;
    try { await watchAdmin(full); } catch (e) { AUTO.err = "Έλεγχος admin: " + e.message; }
    busy = false; autoView();
  }
  A.autostart = () => { AUTO.on = true; AUTO.ver = ""; autoView(); autoTick(); AUTO.timer = setInterval(autoTick, 25000); AUTO.wtimer = setInterval(watchTick, 60000); setTimeout(watchTick, 30000); };
  A.autostop = () => { AUTO.on = false; clearInterval(AUTO.timer); clearInterval(AUTO.wtimer); load(); };
  A.run = async () => {
    if (busy) return; busy = true;
    const res = [], st = plan.stock.filter(r => r.st === "ok" || r.st === "none" || (r.st === "conf" && choice[r.pid])), bars = plan.bars.filter(b => b.st === "ok");
    const N = st.length + bars.length; let i = 0, stopBar = false;
    try {
      for (const r of st) {
        progress("Περνάω απόθεμα…", i++, N);
        const x = await applyStock(r, r.st === "conf" ? choice[r.pid] : "set");
        res.push([r.pid, x[0], x[1]]);
      }
      for (const b of bars) {
        progress("Γράφω barcode…", i++, N);
        if (stopBar) { res.push([b.pid, "warn", "Δεν δοκιμάστηκε, σταμάτησα μετά από πρόβλημα."]); continue; }
        const L = await readProd(b.pid);
        if (L.barcode) { res.push([b.pid, "warn", "Μόλις απέκτησε barcode στο site (" + L.barcode + "). Δεν το άγγιξα."]); continue; }
        backup({ kind: "barcode", pid: b.pid, code: b.code, fields: formFields(L.html).list });
        const out = await setBarcode(b.pid, b.code, L.html);
        if (!out.ok) { stopBar = true; res.push([b.pid, "bad", "Το barcode δεν αποθηκεύτηκε. Σταμάτησα τα barcode."]); continue; }
        if (out.diff.length) { stopBar = true; res.push([b.pid, "bad", "Γράφτηκε το barcode, αλλά άλλαξαν και τα πεδία: " + out.diff.join(", ") + ". Σταμάτησα. Υπάρχει backup, πες το στον Γιάννη."]); continue; }
        await api("POST", null, { ops: [{ op: "setEan", oid: "e" + Date.now() + b.pid, pid: b.pid, code: b.code }] });
        res.push([b.pid, "ok", "Barcode " + b.code + " ✓"]);
      }
    } catch (e) { res.push(["", "bad", "Διακοπή: " + e.message + ". Ό,τι έγινε μέχρι εδώ είναι σωστό και ελεγμένο. Πάτα ξανά για τα υπόλοιπα."]); }
    busy = false;
    const okN = res.filter(x => x[1] === "ok").length;
    B.innerHTML = head(okN === res.length ? "Έτοιμο ✓" : "Έγινε με εξαιρέσεις", okN + " από " + res.length + " σωστά, ελεγμένα στο site") +
      `<table>${res.map(x => `<tr><td><b>${x[0] ? esc(pname(x[0])) : ""}</b></td><td class="${x[1]}">${esc(x[2])}</td></tr>`).join("")}</table><button class="btn gh" data-a="reload">Έλεγχος ξανά</button>`;
  };
  start();
})();
