(() => {
  const KEY = "pos_item_view_mode";

  // ---------- Safe Storage ----------
  const SafeStorage = (() => {
    let memory = {};
    function canUse(storage) {
      try {
        if (!storage) return false;
        const k = "__pos_test__";
        storage.setItem(k, "1");
        storage.removeItem(k);
        return true;
      } catch (e) {
        return false;
      }
    }
    const lsOk = canUse(window.localStorage);
    const ssOk = canUse(window.sessionStorage);

    return {
      get(key) {
        try { if (lsOk) return localStorage.getItem(key); } catch (e) {}
        try { if (ssOk) return sessionStorage.getItem(key); } catch (e) {}
        return key in memory ? memory[key] : null;
      },
      set(key, val) {
        const v = String(val);
        try { if (lsOk) return localStorage.setItem(key, v); } catch (e) {}
        try { if (ssOk) return sessionStorage.setItem(key, v); } catch (e) {}
        memory[key] = v;
      }
    };
  })();

  const getMode = () => SafeStorage.get(KEY) || "grid";
  const setMode = (m) => SafeStorage.set(KEY, m);

  // ---------- Helpers ----------
  function findByExactText(txt) {
    const nodes = Array.from(
      document.querySelectorAll("h1,h2,h3,h4,h5,h6,div,span,strong,b")
    );
    return nodes.find((el) => (el.innerText || "").trim() === txt);
  }

  function findPanelFromTitle(titleText) {
    const title = findByExactText(titleText);
    if (!title) return null;

    let el = title;
    for (let i = 0; i < 16 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      const hasInputs = el.querySelector("input,select,.form-control");
      if (hasInputs && el.querySelectorAll("*").length > 30) return el;
    }
    return title.parentElement || null;
  }

  // cleanup from older versions
  function cleanupLegacyInlineStyles() {
    const markers = [
      '[data-pos-items-grid-root="1"]',
      '[data-pos-items-root="1"]',
      '[data-pos-card-touched="1"]',
      '[data-pos-hidden="1"]',
      '[data-pos-thumb="1"]'
    ];

    document.querySelectorAll(markers.join(",")).forEach((el) => {
      el.removeAttribute("data-pos-items-grid-root");
      el.removeAttribute("data-pos-items-root");
      el.removeAttribute("data-pos-card-touched");
      el.removeAttribute("data-pos-hidden");
      el.removeAttribute("data-pos-thumb");
      // only remove known problematic props
      [
        "display","flex-direction","gap","grid-template-columns","grid-auto-flow",
        "width","max-width","height","min-height","padding","overflow",
        "margin-left","padding-left","flex","background-image"
      ].forEach((p) => el.style.removeProperty(p));
    });

    document.querySelectorAll("img").forEach((img) => {
      if (img.style && img.style.display === "none") img.style.removeProperty("display");
    });
  }

  // ---------- Root finder (scoped to "All Items" panel to avoid Cart) ----------
  function findItemsRoot() {
    const existing = document.querySelector('[data-pos-items-root="1"]');
    if (existing && document.body.contains(existing)) return existing;

    const allItemsPanel = findPanelFromTitle("All Items");
    const cartPanel = findPanelFromTitle("Item Cart");
    const scope = allItemsPanel || document.body;

    const divs = Array.from(scope.querySelectorAll("div"));
    const candidates = divs
      .filter((el) => el.children && el.children.length >= 8)
      .filter((el) => !(cartPanel && cartPanel.contains(el)));

    let best = null;
    let bestScore = 0;

    for (const el of candidates) {
      const kids = Array.from(el.children).slice(0, 40);
      let score = 0;
      for (const k of kids) {
        const t = (k.innerText || "").trim();
        if (!t) continue;
        if (t.includes("₹")) score += 3;
        if (k.querySelector("img")) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    if (best) best.setAttribute("data-pos-items-root", "1");
    return best;
  }

  // ---------- THE FIX: detect thumbnail block by geometry and hide it ----------
  function markThumbsByGeometry(root) {
    if (!root) return;

    const cards = Array.from(root.children).filter((x) => x && x.getBoundingClientRect);
    for (const card of cards) {
      // clear previous marks inside this card
      card.querySelectorAll('[data-pos-thumb="1"]').forEach((x) => x.removeAttribute("data-pos-thumb"));

      const cardRect = card.getBoundingClientRect();
      if (!cardRect.width || !cardRect.height) continue;

      // Find best "thumb" candidate
      // Criteria: left side, narrow, tall-ish, short text
      const nodes = Array.from(card.querySelectorAll("div,span"))
        .filter((n) => n && n.getBoundingClientRect);

      let best = null;
      let bestScore = -1;

      for (const n of nodes) {
        const r = n.getBoundingClientRect();
        if (r.width < 20 || r.height < 20) continue;

        // Must be inside card
        if (r.left < cardRect.left - 1 || r.right > cardRect.right + 1) continue;
        if (r.top < cardRect.top - 1 || r.bottom > cardRect.bottom + 1) continue;

        // Thumb-like geometry
        const isLeft = (r.left - cardRect.left) <= 40;      // near left edge
        const isNarrow = r.width <= 140;                    // thumb column
        const isTall = r.height >= Math.min(80, cardRect.height * 0.6);

        if (!isLeft || !isNarrow || !isTall) continue;

        const text = (n.innerText || "").trim();
        const shortText = text.length > 0 && text.length <= 4; // "F", "SS", "B1"
        const cs = window.getComputedStyle(n);
        const hasBg = cs.backgroundColor !== "rgba(0, 0, 0, 0)" || (cs.backgroundImage && cs.backgroundImage !== "none");
        const looksLikeThumb = shortText || hasBg;

        if (!looksLikeThumb) continue;

        // Score: prefer closer to left, taller, narrower
        const leftScore = Math.max(0, 40 - (r.left - cardRect.left));
        const tallScore = Math.min(100, (r.height / cardRect.height) * 100);
        const narrowScore = Math.max(0, 140 - r.width);

        const score = leftScore + tallScore + narrowScore + (shortText ? 50 : 0);
        if (score > bestScore) {
          bestScore = score;
          best = n;
        }
      }

      if (best) best.setAttribute("data-pos-thumb", "1");
    }
  }

  // ---------- CSS ----------
  function ensureStyle() {
    if (document.getElementById("pos-view-style")) return;

    const style = document.createElement("style");
    style.id = "pos-view-style";
    style.textContent = `
      /* Toggle UI */
      .pos-view-toggle-wrap {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        margin-left: 12px;
        vertical-align: middle;
        user-select: none;
      }
      .pos-view-toggle-label { font-size: 12px; opacity: .8; }
      .pos-view-switch { position: relative; width: 42px; height: 22px; display: inline-block; }
      .pos-view-switch input { opacity: 0; width: 0; height: 0; }
      .pos-view-slider {
        position: absolute; cursor: pointer; inset: 0;
        background-color: #cbd5e1; transition: .2s; border-radius: 999px;
      }
      .pos-view-slider:before {
        content: ""; position: absolute; height: 18px; width: 18px; left: 2px; top: 2px;
        background: #fff; transition: .2s; border-radius: 50%;
        box-shadow: 0 1px 2px rgba(0,0,0,.2);
      }
      .pos-view-switch input:checked + .pos-view-slider { background-color: var(--primary); }
      .pos-view-switch input:checked + .pos-view-slider:before { transform: translateX(20px); }

      /* LIST VIEW container */
      body.pos-list-view [data-pos-items-root="1"]{
        display: flex !important;
        flex-direction: column !important;
        gap: 10px !important;
      }

      /* LIST VIEW card layout */
      body.pos-list-view [data-pos-items-root="1"] > *{
        width: 100% !important;
        max-width: 100% !important;
        height: auto !important;

        display: flex !important;
        flex-direction: row !important;
        align-items: center !important;
        justify-content: space-between !important;
        gap: 12px !important;

        padding: 10px 14px !important;
      }

      /* ✅ OPTION 2: hide the thumbnail/letter block we detected */
      body.pos-list-view [data-pos-items-root="1"] [data-pos-thumb="1"]{
        display: none !important;
      }

      /* Also hide img tags if any */
      body.pos-list-view [data-pos-items-root="1"] img{ display:none !important; }
    `;
    document.head.appendChild(style);
  }

  // ---------- Mode apply ----------
  function applyMode(mode) {
    const root = findItemsRoot();

    if (mode === "list") {
      document.body.classList.add("pos-list-view");
      // IMPORTANT: after DOM paints, mark thumbs by geometry
      requestAnimationFrame(() => {
        const r = findItemsRoot();
        markThumbsByGeometry(r);
      });
    } else {
      document.body.classList.remove("pos-list-view");
      cleanupLegacyInlineStyles();
      if (root) root.removeAttribute("data-pos-items-root");
    }
  }

  // ---------- Observer (Cloud rerender safe) ----------
  let obs = null;
  let raf = 0;
  function startObserver() {
    if (obs) return;

    obs = new MutationObserver(() => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (document.body.classList.contains("pos-list-view")) {
          const root = findItemsRoot();
          markThumbsByGeometry(root);
        }
      });
    });

    obs.observe(document.body, { childList: true, subtree: true });
  }

  function injectToggle() {
    if (document.querySelector(".pos-view-toggle-wrap")) return true;

    const header = findByExactText("All Items");
    if (!header) return false;

    ensureStyle();
    startObserver();

    const wrap = document.createElement("span");
    wrap.className = "pos-view-toggle-wrap";
    wrap.innerHTML = `
      <span class="pos-view-toggle-label">Grid</span>
      <label class="pos-view-switch" title="Toggle Grid/List view">
        <input type="checkbox" class="pos-view-toggle-input" />
        <span class="pos-view-slider"></span>
      </label>
      <span class="pos-view-toggle-label">List</span>
    `;
    header.appendChild(wrap);

    const input = wrap.querySelector(".pos-view-toggle-input");

    cleanupLegacyInlineStyles();

    const mode = getMode();
    input.checked = mode === "list";
    applyMode(mode);

    input.addEventListener("change", () => {
      const newMode = input.checked ? "list" : "grid";
      setMode(newMode);
      applyMode(newMode);
    });

    return true;
  }

  function waitAndInject() {
    if (injectToggle()) return;

    const mo = new MutationObserver(() => {
      if (injectToggle()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 20000);
  }

  function runIfPOS() {
    if (!window.frappe) return;
    const route = (frappe.get_route && frappe.get_route()) || [];
    if (!route.length || route[0] !== "point-of-sale") return;
    waitAndInject();
  }

  $(document).ready(() => {
    $(document).on("page-change", runIfPOS);
    runIfPOS();
  });
})();