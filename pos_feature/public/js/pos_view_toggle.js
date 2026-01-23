(() => {
  const KEY = "pos_item_view_mode";
  const getMode = () => localStorage.getItem(KEY) || "grid";
  const setMode = (m) => localStorage.setItem(KEY, m);

  // ---------- helpers ----------
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
    for (let i = 0; i < 14 && el; i++) {
      el = el.parentElement;
      if (!el) break;
      if (el.querySelectorAll("*").length > 30) return el;
    }
    return title.parentElement || null;
  }

  function detectItemsRoot() {
    const cartPanel = findPanelFromTitle("Item Cart");
    const allItemsPanel = findPanelFromTitle("All Items");
    const scope = allItemsPanel || document.body;

    const candidates = Array.from(scope.querySelectorAll("div"))
      .filter((el) => el.children && el.children.length >= 6)
      .filter((el) => !(cartPanel && cartPanel.contains(el)));

    let best = null;
    let bestScore = 0;

    for (const el of candidates) {
      const tiles = Array.from(el.children).slice(0, 30);
      let score = 0;

      for (const t of tiles) {
        const text = (t.innerText || "").trim();
        if (!text) continue;
        if (text.includes("₹")) score += 3;
        if (t.querySelector("img")) score += 2;

        const cs = window.getComputedStyle(t);
        if (cs.cursor === "pointer") score += 1;
        if (cs.borderRadius && cs.borderRadius !== "0px") score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        best = el;
      }
    }

    return best;
  }

  function ensureToggleStyle() {
    if (document.getElementById("pos-view-toggle-style")) return;

    const style = document.createElement("style");
    style.id = "pos-view-toggle-style";
    style.textContent = `
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
    `;
    document.head.appendChild(style);
  }

  // Store & restore inline style safely
  function stashInlineStyle(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.hasAttribute("data-pos-prev-style")) return;
    el.setAttribute("data-pos-prev-style", el.getAttribute("style") || "");
  }

  function restoreInlineStyle(el) {
    if (!el || el.nodeType !== 1) return;
    if (!el.hasAttribute("data-pos-prev-style")) return;
    const prev = el.getAttribute("data-pos-prev-style") || "";
    el.removeAttribute("data-pos-prev-style");
    if (prev) el.setAttribute("style", prev);
    else el.removeAttribute("style");
  }

  // ---------- LIST MODE (hide images ONLY here) ----------
  function applyListMode() {
    document.body.classList.add("pos-list-view");

    const root = detectItemsRoot();
    if (!root) return;

    root.setAttribute("data-pos-items-root", "1");
    stashInlineStyle(root);

    root.style.setProperty("display", "flex", "important");
    root.style.setProperty("flex-direction", "column", "important");
    root.style.setProperty("gap", "8px", "important");

    Array.from(root.children).forEach((card) => {
      const text = (card.innerText || "").trim();
      if (!text) return;

      card.setAttribute("data-pos-card", "1");
      stashInlineStyle(card);

      card.style.setProperty("width", "100%", "important");
      card.style.setProperty("max-width", "100%", "important");
      card.style.setProperty("height", "auto", "important");
      card.style.setProperty("display", "flex", "important");
      card.style.setProperty("flex-direction", "row", "important");
      card.style.setProperty("align-items", "center", "important");
      card.style.setProperty("justify-content", "flex-start", "important");
      card.style.setProperty("gap", "14px", "important");
      card.style.setProperty("padding", "10px 16px", "important");
      card.style.setProperty("overflow", "hidden", "important");

      // ✅ Hide ONLY images + known thumbnail wrappers (LIST MODE ONLY)
      card.querySelectorAll("img").forEach((img) => {
        if (img.getAttribute("data-pos-hidden") === "1") return;
        img.setAttribute("data-pos-hidden", "1");
        stashInlineStyle(img);
        img.style.setProperty("display", "none", "important");
      });

      card
        .querySelectorAll(
          ".item-image, .pos-item-image, .image, .image-field, .product-image, .item-thumbnail"
        )
        .forEach((el) => {
          if (el.getAttribute("data-pos-hidden") === "1") return;
          el.setAttribute("data-pos-hidden", "1");
          stashInlineStyle(el);
          el.style.setProperty("display", "none", "important");
        });

      // keep last element right aligned (qty / add)
      const last = card.lastElementChild;
      if (last) {
        stashInlineStyle(last);
        last.style.setProperty("margin-left", "auto", "important");
        last.style.setProperty("padding-left", "10px", "important");
        last.style.setProperty("flex", "0 0 auto", "important");
      }

      // left align info block
      const children = Array.from(card.children);
      const info =
        children.find((el) => (el.innerText || "").includes("₹")) ||
        children.find((el) => el !== last && (el.innerText || "").trim().length) ||
        null;

      if (info) {
        stashInlineStyle(info);
        info.style.setProperty("flex", "1 1 auto", "important");
        info.style.setProperty("min-width", "0", "important");
        info.style.setProperty("text-align", "left", "important");
        info.style.setProperty("display", "flex", "important");
        info.style.setProperty("flex-direction", "column", "important");
        info.style.setProperty("align-items", "flex-start", "important");
        info.style.setProperty("justify-content", "center", "important");
      }
    });
  }

  // ---------- GRID MODE (restore images ONLY here) ----------
  function applyGridMode() {
    document.body.classList.remove("pos-list-view");

    const root = document.querySelector('[data-pos-items-root="1"]');
    if (!root) return;

    // ✅ Restore ONLY elements we hid in list mode
    root.querySelectorAll('[data-pos-hidden="1"]').forEach((el) => {
      el.removeAttribute("data-pos-hidden");
      restoreInlineStyle(el);
    });

    // restore cards + root
    root.querySelectorAll('[data-pos-card="1"]').forEach((card) => {
      card.removeAttribute("data-pos-card");
      restoreInlineStyle(card);
    });

    root.removeAttribute("data-pos-items-root");
    restoreInlineStyle(root);
  }

  // Keep list mode applied when DOM updates
  let obs = null;
  function startObserver() {
    if (obs) return;
    obs = new MutationObserver(() => {
      if (document.body.classList.contains("pos-list-view")) applyListMode();
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  function injectToggle() {
    if (document.querySelector(".pos-view-toggle-wrap")) return true;

    const header = findByExactText("All Items");
    if (!header) return false;

    ensureToggleStyle();
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
    const mode = getMode();

    input.checked = mode === "list";
    if (mode === "list") applyListMode();
    else applyGridMode();

    input.addEventListener("change", () => {
      const newMode = input.checked ? "list" : "grid";
      setMode(newMode);
      if (newMode === "list") applyListMode();
      else applyGridMode();
    });

    return true;
  }

  function waitAndInject() {
    if (injectToggle()) return;

    const mo = new MutationObserver(() => {
      if (injectToggle()) mo.disconnect();
    });
    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 15000);
  }

  function runIfPOS() {
    const route = (frappe.get_route && frappe.get_route()) || [];
    if (!route.length || route[0] !== "point-of-sale") return;
    waitAndInject();
  }

  $(document).ready(() => {
    $(document).on("page-change", runIfPOS);
    runIfPOS();
  });
})();
