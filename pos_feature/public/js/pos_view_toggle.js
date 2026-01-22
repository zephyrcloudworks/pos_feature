(() => {
  const KEY = "pos_item_view_mode";
  const getMode = () => localStorage.getItem(KEY) || "grid";
  const setMode = (m) => localStorage.setItem(KEY, m);

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

  function detectItemsGridRoot() {
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
        if (t.querySelector("img")) score += 1;

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

  function ensureStyleForToggle() {
    if (document.getElementById("pos-toggle-style")) return;

    const style = document.createElement("style");
    style.id = "pos-toggle-style";
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

  // --------- LIST MODE ---------
  function applyListMode() {
    document.body.classList.add("pos-list-view");

    const root = detectItemsGridRoot();
    if (!root) return;

    root.setAttribute("data-pos-items-grid-root", "1");

    root.style.setProperty("display", "flex", "important");
    root.style.setProperty("flex-direction", "column", "important");
    root.style.setProperty("gap", "8px", "important");
    root.style.setProperty("grid-template-columns", "1fr", "important");
    root.style.setProperty("grid-auto-flow", "row", "important");

    Array.from(root.children).forEach((card) => {
      // mark cards we touched so we can reset later
      card.setAttribute("data-pos-card-touched", "1");

      card.style.setProperty("width", "100%", "important");
      card.style.setProperty("max-width", "100%", "important");
      card.style.setProperty("height", "auto", "important");
      card.style.setProperty("min-height", "0", "important");

      card.style.setProperty("display", "flex", "important");
      card.style.setProperty("flex-direction", "row", "important");
      card.style.setProperty("align-items", "center", "important");
      card.style.setProperty("justify-content", "flex-start", "important");
      card.style.setProperty("gap", "14px", "important");
      card.style.setProperty("padding", "10px 16px", "important");
      card.style.setProperty("overflow", "hidden", "important");

      // ✅ Hide <img> only in list mode (mark for restore)
      card.querySelectorAll("img").forEach((img) => {
        img.setAttribute("data-pos-hidden", "1");
        img.style.setProperty("display", "none", "important");
      });

      // ✅ Hide background-image thumbnails only in list mode (mark for restore)
      card.querySelectorAll("*").forEach((el) => {
        const bg = window.getComputedStyle(el).backgroundImage;
        if (bg && bg !== "none") {
          el.setAttribute("data-pos-hidden", "1");
          el.style.setProperty("background-image", "none", "important");
          el.style.setProperty("display", "none", "important");
          el.style.setProperty("width", "0", "important");
          el.style.setProperty("height", "0", "important");
          el.style.setProperty("margin", "0", "important");
          el.style.setProperty("padding", "0", "important");
        }
      });

      const last = card.lastElementChild;
      if (last) {
        last.style.setProperty("margin-left", "auto", "important");
        last.style.setProperty("padding-left", "10px", "important");
        last.style.setProperty("flex", "0 0 auto", "important");
      }

      // find info wrapper by ₹
      const children = Array.from(card.children);
      const info =
        children.find((el) => (el.innerText || "").includes("₹")) ||
        children.find((el) => el !== last && (el.innerText || "").trim().length) ||
        null;

      if (info) {
        info.style.setProperty("flex", "1 1 auto", "important");
        info.style.setProperty("min-width", "0", "important");
        info.style.setProperty("text-align", "left", "important");
        info.style.setProperty("margin-left", "0", "important");
        info.style.setProperty("margin-right", "auto", "important");
        info.style.setProperty("align-self", "flex-start", "important");

        info.style.setProperty("display", "flex", "important");
        info.style.setProperty("flex-direction", "column", "important");
        info.style.setProperty("align-items", "flex-start", "important");
        info.style.setProperty("justify-content", "center", "important");

        info.querySelectorAll("*").forEach((x) => {
          x.style.setProperty("text-align", "left", "important");
        });
      }
    });
  }

  // --------- GRID MODE (restore thumbnails/images) ---------
  function applyGridMode() {
    document.body.classList.remove("pos-list-view");

    const root = document.querySelector('[data-pos-items-grid-root="1"]');
    if (!root) return;

    root.removeAttribute("data-pos-items-grid-root");

    // remove root inline styles set by list mode
    root.style.removeProperty("display");
    root.style.removeProperty("flex-direction");
    root.style.removeProperty("gap");
    root.style.removeProperty("grid-template-columns");
    root.style.removeProperty("grid-auto-flow");

    // ✅ restore only what we hid
    root.querySelectorAll('[data-pos-hidden="1"]').forEach((el) => {
      el.removeAttribute("data-pos-hidden");
      el.style.removeProperty("display");
      el.style.removeProperty("width");
      el.style.removeProperty("height");
      el.style.removeProperty("margin");
      el.style.removeProperty("padding");
      el.style.removeProperty("background-image");
    });

    // ✅ reset only cards we touched
    root.querySelectorAll('[data-pos-card-touched="1"]').forEach((card) => {
      card.removeAttribute("data-pos-card-touched");
      card.removeAttribute("style"); // safe: only for item cards inside All Items
    });
  }

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

    ensureStyleForToggle();
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