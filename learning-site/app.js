/* DeepSeek Harness 源码学习站 — 零依赖 SPA（hash 路由） */
(function () {
  "use strict";

  var DATA = window.DSH_DATA;
  var KPS = DATA.kps;                 // 已按学习顺序排列
  var KP_BY_ID = {};
  KPS.forEach(function (k) { KP_BY_ID[k.id] = k; });
  var MODULES = DATA.modules;
  var GLOSSARY = DATA.glossary || [];
  var PROGRESS_KEY = "dsh-learn-progress";
  var THEME_KEY = "dsh-learn-theme";

  /* ---------- 状态 ---------- */
  var done = {};
  try { done = JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}"); } catch (e) { done = {}; }
  function saveDone() {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(done)); } catch (e) {}
    paintProgress();
  }
  function theme() {
    return localStorage.getItem(THEME_KEY) ||
      (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }
  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem(THEME_KEY, t); } catch (e) {}
    var b = document.getElementById("themeBtn");
    if (b) b.textContent = t === "dark" ? "☀" : "☾";
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function stripHtml(s) { return String(s).replace(/<[^>]+>/g, " "); }
  function doneCount() { return KPS.filter(function (k) { return done[k.id]; }).length; }
  function kpRoute(id) { return "#/kp/" + id; }

  function paintProgress() {
    var total = KPS.length, n = doneCount();
    var pct = total ? Math.round((n / total) * 100) : 0;
    var ring = document.getElementById("progressRing");
    if (ring) {
      var C = 2 * Math.PI * 13;
      ring.querySelector(".bar").setAttribute("stroke-dasharray", C);
      ring.querySelector(".bar").setAttribute("stroke-dashoffset", C * (1 - pct / 100));
      ring.querySelector(".num").textContent = pct + "%";
    }
  }

  /* ---------- 侧栏 ---------- */
  function buildSidebar(currentId) {
    var el = document.getElementById("sidebarNav");
    var html = '<h3>入口</h3>' +
      navItem("#/home", "", "总览首页", currentId === "__home") +
      navItem("#/path", "", "学习路径", currentId === "__path") +
      navItem("#/map", "", "知识地图", currentId === "__map") +
      navItem("#/glossary", "", "术语表", currentId === "__glossary") +
      navItem("#/changelog", "", "版本追踪", currentId === "__changelog") +
      navItem("#/refs", "", "参考资料", currentId === "__refs");
    MODULES.forEach(function (m) {
      html += "<h3>" + esc(m.title) + "</h3>";
      m.kpIds.forEach(function (id) {
        var k = KP_BY_ID[id];
        if (!k) return;
        html += '<a class="nav-item' + (id === currentId ? " active" : "") + '" href="' + kpRoute(id) + '">' +
          '<span class="lvl ' + esc(k.level) + '">' + esc(k.level) + '</span>' +
          '<span>' + esc(k.title) + '</span>' +
          (done[id] ? '<span class="done">✓</span>' : "") + "</a>";
      });
    });
    el.innerHTML = html;
  }
  function navItem(href, icon, label, active) {
    return '<a class="nav-item' + (active ? " active" : "") + '" href="' + href + '">' +
      (icon ? "<span>" + icon + "</span>" : "") + "<span>" + label + "</span></a>";
  }

  /* ---------- 搜索 ---------- */
  var searchIdx = [];
  KPS.forEach(function (k) {
    searchIdx.push({ id: k.id, title: k.title, level: k.level, kind: "知识点",
      text: (k.title + " " + (k.tags || []).join(" ") + " " + k.summary + " " + k.searchText).toLowerCase() });
  });
  (GLOSSARY || []).forEach(function (g) {
    searchIdx.push({ id: "__glossary", title: g.term, level: "", kind: "术语",
      text: (g.term + " " + g.def).toLowerCase() });
  });
  searchIdx.push({ id: "__home", title: "总览首页", kind: "页面", level: "", text: "deepseek harness 总览 目录" });
  searchIdx.push({ id: "__path", title: "学习路径", kind: "页面", level: "", text: "学习路径 路线图" });
  searchIdx.push({ id: "__map", title: "知识地图", kind: "页面", level: "", text: "知识地图 模块 依赖" });
  searchIdx.push({ id: "__changelog", title: "版本追踪日志", kind: "页面", level: "", text: "版本追踪 发布 tag changelog 更新日志 release 上游 master 增量" });
  ((DATA.changelog && DATA.changelog.entries) || []).forEach(function (e) {
    var text = e.title + " " + (e.badge || "") + " " + e.items.map(function (it) {
      return (it.label || "") + " " + stripHtml(it.html) + " " + (it.subs || []).map(stripHtml).join(" ");
    }).join(" ");
    searchIdx.push({ id: "__changelog/" + e.id, title: e.date + " · " + e.title, kind: "版本记录", level: "", text: text.toLowerCase() });
  });
  searchIdx.push({ id: "__refs", title: "参考资料", kind: "页面", level: "", text: "参考资料 论文 文档" });

  var selIdx = -1, selList = [];
  function runSearch(q) {
    var panel = document.getElementById("searchPanel");
    if (!q || q.length < 2) { panel.classList.remove("open"); document.getElementById("scrim").classList.remove("open"); return; }
    var ql = q.toLowerCase();
    var hits = searchIdx.filter(function (it) { return it.text.indexOf(ql) >= 0; })
      .sort(function (a, b) { return (b.title.toLowerCase().indexOf(ql) >= 0) - (a.title.toLowerCase().indexOf(ql) >= 0); })
      .slice(0, 24);
    selList = hits; selIdx = hits.length ? 0 : -1;
    var html = "";
    var byKind = {};
    hits.forEach(function (h) { (byKind[h.kind] = byKind[h.kind] || []).push(h); });
    Object.keys(byKind).forEach(function (kind) {
      html += '<div class="group"><div class="gt">' + esc(kind) + "</div>";
      byKind[kind].forEach(function (h) {
        var snip = "";
        var i = h.text.indexOf(ql);
        if (i >= 0) {
          var raw = (h.summary || h.def || h.title);
          var pos = Math.max(0, i - 20);
          snip = esc(raw.substr(pos, 120)).replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "<mark>$&</mark>");
        }
        html += '<a class="item' + (h === hits[0] ? " sel" : "") + '" href="' + (h.id.charAt(1) === "_" || h.id === "__home" ? "#/" + h.id.slice(2) : kpRoute(h.id)) + '">' +
          '<div class="t">' + esc(h.title) + (h.level ? '<span class="lvl">' + esc(h.level) + "</span>" : "") + "</div>" +
          (snip ? '<div class="s">' + snip + "</div>" : "") + "</a>";
      });
      html += "</div>";
    });
    panel.innerHTML = html || '<div class="group"><div class="item"><div class="s">无匹配结果</div></div></div>';
    panel.classList.add("open");
    document.getElementById("scrim").classList.add("open");
  }
  function closeSearch() {
    document.getElementById("searchPanel").classList.remove("open");
    document.getElementById("scrim").classList.remove("open");
  }
  function moveSel(d) {
    if (!selList.length) return;
    selIdx = (selIdx + d + selList.length) % selList.length;
    var items = document.querySelectorAll("#searchPanel a.item");
    items.forEach(function (el, i) { el.classList.toggle("sel", i === selIdx); });
    if (items[selIdx]) items[selIdx].scrollIntoView({ block: "nearest" });
  }

  /* ---------- 渲染页面 ---------- */
  function renderHome() {
    var html =
      '<div class="hero page-enter">' +
      '<div class="kicker">◆ 源码学习 · DEEPSEEK HARNESS</div>' +
      "<h1>深入 DeepSeek Harness（dsh）<br>一切皆插件的 Agent Harness</h1>" +
      '<p class="lead">dsh 是 DeepSeek 开源的开源 Agent 驾驭层（agent harness）：以 <b>Cordis</b> 框架为基座、以 <b>“一切皆插件”</b> 为原则，把模型适配器、工具注册表、会话日志、乃至 Agent 循环本身都做成可替换的插件。本知识库逐文件通读其源码，拆解插件基座、核心循环、会话日志、能力接缝与应用形态。</p>' +
      '<div class="cta"><a class="btn primary" href="#/path">🧭 开始学习</a><a class="btn ghost" href="#/map">🕸 查看知识地图</a><a class="btn ghost" href="#/kp/kp-002">先看它是什么 →</a></div></div>' +
      statRow() + moduleCards() +
      '<h2>为什么值得读这份源码</h2>' +
      "<ul><li><b>一个工业级 Agent Harness 的完整解剖样本</b>：turn/step 状态机、追加式会话日志、能力接缝（seam）、作用域（scope）——这些是所有 Agent 框架共有的骨架问题，dsh 给出了一组极完整的公开答案。</li>" +
      "<li><b>“一切皆插件”的极限工程</b>：没有特权内核，模型适配、工具、循环自身都可从配置替换；补丁（patch）层叠而非改源码。</li>" +
      "<li><b>可以直接上手扩展</b>：读完就能写自己的 tool / LLM adapter / 会话投影 / 命令插件。</li></ul>" +
      '<div class="callout tip"><div class="t">◆ 版本与范围</div><p>本知识库基于 <code>origin/master @ 21638c56</code>（2026-09-27，dsh 0.1.7-rc.2），由每日跟踪任务随上游更新（见「版本追踪」页）。项目处于 developer preview，API 可能快速变化；每个知识点页脚标注了对应源码路径，改动后请对照仓库。</p></div>';
    return html;
  }
  function statRow() {
    return '<div class="stat-row">' +
      stat(KPS.length, "知识点") + stat(MODULES.length, "模块") +
      stat("54 组 / 312", "插件包") + stat(doneCount() + " / " + KPS.length, "我的进度") + "</div>";
  }
  function stat(n, l) { return '<div class="stat"><div class="n">' + n + '</div><div class="l">' + esc(l) + "</div></div>"; }
  function moduleCards() {
    var html = "<h2>模块总览</h2>" + '<div class="module-grid">';
    MODULES.forEach(function (m, i) {
      html += '<a class="module-card" style="text-decoration:none;color:inherit" href="#/path#m' + i + '">' +
        '<div class="tag">MODULE ' + String(i + 1).padStart(2, "0") + "</div>" +
        "<h3>" + esc(m.title) + "</h3><p>" + esc(m.summary) + "</p>" +
        '<div class="kps">' + m.kpIds.length + " 个知识点 →</div></a>";
    });
    return html + "</div>";
  }

  function renderPath() {
    var html = '<div class="kp-head"><h1>学习路径：从零读懂一个 Agent Harness</h1>' +
      '<p class="lead" style="color:var(--ink-soft)">七段航线，总时长约 10–14 小时。每段先建立直觉，再进源码细节；带 ★ 的知识点是承重墙，优先攻克。</p></div>';
    DATA.pathSteps.forEach(function (s, i) {
      html += '<div class="path-step" id="m' + i + '"><div class="node">' + (i + 1) + "</div>" +
        '<div class="body"><h4>' + esc(s.title) + "</h4><p>" + esc(s.desc) + "</p>" +
        '<div class="kplinks">' + s.kpIds.map(function (id) {
          var k = KP_BY_ID[id];
          return k ? '<a href="' + kpRoute(id) + '">' + (k.star ? "★ " : "") + esc(k.title) + "</a>" : "";
        }).join("") + "</div></div></div>";
    });
    html += '<div class="callout tip"><div class="t">◆ 建议的节奏</div><p>每读完一个知识点，把它的「自测题」口头回答一遍再点「已完成」。第 3、4 模块（循环与会话）是源码的心脏，建议开着仓库对照读；第 6 模块之后可跳读感兴趣的接缝。</p></div>';
    return html;
  }

  function renderMap() {
    // 知识地图：模块为列，模块间依赖为线
    var W = 960, colW = 128, rowH = 34;
    var maxRows = Math.max.apply(null, MODULES.map(function (m) { return m.kpIds.length; }));
    var H = 120 + maxRows * rowH;
    var xs = [], nodes = [];
    MODULES.forEach(function (m, mi) {
      var x = 70 + mi * colW; xs.push(x);
      m.kpIds.forEach(function (id, ki) {
        var k = KP_BY_ID[id];
        if (k) nodes.push({ id: id, k: k, x: x, y: 120 + ki * rowH });
      });
    });
    var lines = "";
    MODULES.forEach(function (m, mi) {
      (m.dependsOn || []).forEach(function (depTitle) {
        var di = MODULES.findIndex(function (x) { return x.title === depTitle; });
        if (di >= 0) {
          lines += '<path d="M ' + (xs[di] + 96) + " 84 C " + (xs[di] + 112) + " 60, " + (xs[mi] - 16) + " 60, " + (xs[mi] - 8) + ' 84" fill="none" stroke="var(--accent)" stroke-width="1.6" stroke-dasharray="4 4" opacity=".7"/>';
        }
      });
    });
    var dots = nodes.map(function (n) {
      var short = n.k.title.length > 9 ? n.k.title.slice(0, 8) + "…" : n.k.title;
      return '<g style="cursor:pointer" onclick="location.hash=\'' + kpRoute(n.id).slice(1) + '\'">' +
        '<circle cx="' + n.x + '" cy="' + n.y + '" r="6" fill="' + (n.k.level === "入门" ? "var(--lv1)" : n.k.level === "核心" ? "var(--lv2)" : n.k.level === "进阶" ? "var(--lv3)" : "var(--lv4)") + '"/>' +
        '<text x="' + (n.x + 12) + '" y="' + (n.y + 4) + '" font-size="11" fill="var(--ink-soft)">' + esc(short) + "</text></g>";
    }).join("");
    var heads = MODULES.map(function (m, mi) {
      return '<text x="' + xs[mi] + '" y="92" font-size="11" font-weight="700" fill="var(--accent-deep)">' + esc(m.short || m.title) + "</text>";
    }).join("");
    return '<div class="kp-head"><h1>知识地图</h1><p style="color:var(--ink-soft)">列 = 模块，行 = 该模块内的知识点。虚线 = 建议先读的模块依赖。颜色：浅蓝=入门，品牌蓝=核心，深蓝=进阶，琥珀=前沿。点击圆点直达。</p></div>' +
      '<div class="map-wrap page-enter"><svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + " " + H + '">' + lines + heads + dots + "</svg></div>" +
      '<div class="callout tip"><div class="t">◆ 依赖主线</div><p>Cordis 基座 → Agent 循环 → 会话与上下文 → 工具与接缝 → 应用形态 → 工程实践。读透了主线，任何插件包都能顺着 seam 三角色自行看懂。</p></div>';
  }

  function renderGlossary() {
    var html = '<div class="kp-head"><h1>术语表</h1><p style="color:var(--ink-soft)">dsh 领域词汇，一条术语一个概念（对照 docs/glossary.md 及源码）。点击词条可跳转到相关知识点。</p></div>';
    (GLOSSARY || []).forEach(function (g) {
      html += '<div class="callout" style="margin:10px 0"><div class="t">◆ ' + esc(g.term) + " <code>" + esc(g.en || "") + "</code></div>" +
        "<p>" + g.html + (g.kp ? ' <a href="' + kpRoute(g.kp) + '">→ 相关知识点</a>' : "") + "</p></div>";
    });
    return html;
  }

  function renderRefs() {
    return '<div class="kp-head"><h1>参考资料</h1></div>' + DATA.refsHtml;
  }

  function kpChip(id) {
    var k = KP_BY_ID[id];
    return '<a class="cl-kp" href="' + kpRoute(id) + '">' + esc(k ? k.id + " " + k.title : id) + "</a>";
  }
  function clBullets(items) {
    var html = "<ul>", i = 0;
    while (i < items.length) {
      var it = items[i];
      if (it.kind === "kv" && !it.html && it.label) { // 仅字段名无正文的子弹 → 小标题
        html += '<li class="cl-lab-only">' + esc(it.label) + "</li>";
        i++; continue;
      }
      if (it.kind === "num") {
        html += '<li class="cl-num-item"><ol>';
        while (i < items.length && items[i].kind === "num") { html += "<li>" + items[i].html + "</li>"; i++; }
        html += "</ol></li>";
        continue;
      }
      html += "<li>" + (it.label ? '<b class="cl-lab">' + esc(it.label) + "</b>" : "") + it.html +
        (it.subs && it.subs.length ? '<ul class="cl-sub">' + it.subs.map(function (s) { return "<li>" + s + "</li>"; }).join("") + "</ul>" : "") + "</li>";
      i++;
    }
    return html + "</ul>";
  }
  function renderChangelog() {
    var cl = DATA.changelog || { introHtml: "", entries: [], appendixHtml: "" };
    var html = '<div class="kp-head"><h1>版本追踪日志</h1>' +
      '<p style="color:var(--ink-soft)">由每日跟踪任务维护：发现上游 <code>master</code> 或 <code>dsh-v*</code> 发布有更新时，分析变更、修订知识库并重建站点，同时在此追加一条时间线记录。基线见 <code>tools/last-sync.json</code>。</p></div>';
    if (cl.introHtml) html += '<div class="cl-intro">' + cl.introHtml + "</div>";
    var es = cl.entries || [];
    if (es.length) {
      var e0 = es[0];
      html += '<div class="cl-latest"><span class="lt-l">最新更新</span><span class="lt-body"><b>' + esc(e0.title) + "</b>" +
        (e0.badge ? '<span class="cl-badge">' + esc(e0.badge) + "</span>" : "") +
        '<span class="lt-date">' + esc(e0.date) + "</span></span>" +
        (e0.kpIds.length ? '<span class="cl-kps">' + e0.kpIds.map(kpChip).join("") + "</span>" : "") +
        "</div>";
    }
    html += '<div class="cl-timeline">';
    es.forEach(function (e) {
      html += '<section class="cl-entry page-enter" id="' + esc(e.id) + '"><div class="cl-marker"></div>' +
        '<div class="cl-card"><div class="cl-head"><span class="cl-date">' + esc(e.date) + "</span><h3>" + esc(e.title) + "</h3>" +
        (e.badge ? '<span class="cl-badge">' + esc(e.badge) + "</span>" : "") + "</div>" +
        (e.kpIds.length ? '<div class="cl-kps">' + e.kpIds.map(kpChip).join("") + "</div>" : "") +
        clBullets(e.items || []) + "</div></section>";
    });
    html += "</div>";
    if (cl.appendixHtml) html += "<h2>维护约定</h2>" + '<div class="cl-appendix">' + cl.appendixHtml + "</div>";
    return html;
  }

  function renderKP(k) {
    var idx = KPS.indexOf(k);
    var prev = KPS[idx - 1], next = KPS[idx + 1];
    var html = '<article class="page-enter">' +
      '<div class="kp-head"><div class="crumbs"><a href="#/home">首页</a> / ' + esc(k.module) + ' / <b>' + esc(k.id) + "</b></div>" +
      "<h1>" + (k.star ? "★ " : "") + esc(k.title) + "</h1>" +
      '<div class="meta"><span class="chip level lvl ' + esc(k.level) + '">' + esc(k.level) + "</span>" +
      (k.tags || []).map(function (t) { return '<span class="chip">' + esc(t) + "</span>"; }).join("") +
      (k.sources || []).map(function (s) { return '<span class="chip src">`' + esc(s) + "`</span>"; }).join("") + "</div></div>" +
      k.html +
      '<div class="related">' + (k.related && k.related.length ? "<h4>相关知识点</h4><div class='cards'>" +
        k.related.map(function (id) {
          var r = KP_BY_ID[id];
          return r ? '<a href="' + kpRoute(id) + '">' + esc(r.title) + "</a>" : "";
        }).join("") + "</div>" : "") + "</div>" +
      '<button class="mark-done' + (done[k.id] ? " on" : "") + '" id="markBtn">' +
      (done[k.id] ? "✓ 已完成 — 点击撤销" : "标记为已完成") + "</button>" +
      '<div class="kp-footer">' +
      (prev ? '<a href="' + kpRoute(prev.id) + '"><span class="dir">← 上一节</span><span class="ttl">' + esc(prev.title) + "</span></a>" : "<span></span>") +
      (next ? '<a style="text-align:right;margin-left:auto" href="' + kpRoute(next.id) + '"><span class="dir">下一节 →</span><span class="ttl">' + esc(next.title) + "</span></a>" : "") +
      "</div></article>";
    return html;
  }

  /* ---------- 路由 ---------- */
  var main = document.getElementById("main");
  function route() {
    var h = location.hash || "#/home";
    var body = h.slice(2);
    var hashParts = body.split("#");          // "path#m3" → ["path","m3"]
    var parts = hashParts[0].split("/");      // "changelog/e-…" → ["changelog","e-…"]
    var id = parts.length > 1 && parts[0] === "kp" ? parts[1] : parts[0] === "" ? "__home" : parts[0];
    var anchor = hashParts[1] || (id === "changelog" && parts[1] ? parts[1] : "");
    var html;
    if (id === "__home" || id === "home") { html = renderHome(); id = "__home"; }
    else if (id === "path") { html = renderPath(); id = "__path"; }
    else if (id === "map") { html = renderMap(); id = "__map"; }
    else if (id === "glossary") { html = renderGlossary(); id = "__glossary"; }
    else if (id === "changelog") { html = renderChangelog(); id = "__changelog"; }
    else if (id === "refs") { html = renderRefs(); id = "__refs"; }
    else if (KP_BY_ID[id]) { html = renderKP(KP_BY_ID[id]); }
    else { html = '<div class="kp-head"><h1>404</h1><p>页面不存在。<a href="#/home">回到首页</a></p></div>'; id = "__404"; }

    main.innerHTML = html;
    buildSidebar(id);
    window.scrollTo(0, 0);

    // 锚点直达：path 步骤（#/path#m3）与版本记录（#/changelog/e-…）
    if (anchor) {
      var target = document.getElementById(anchor);
      if (target) {
        var isEntry = target.classList.contains("cl-entry");
        setTimeout(function () {
          target.scrollIntoView({ behavior: "smooth", block: "start" });
          target.classList.add(isEntry ? "cl-flash" : "anchor-flash");
          setTimeout(function () { target.classList.remove(isEntry ? "cl-flash" : "anchor-flash"); }, 1600);
        }, 60);
      }
    }

    var btn = document.getElementById("markBtn");
    if (btn) {
      btn.addEventListener("click", function () {
        var kid = id;
        done[kid] = !done[kid];
        if (!done[kid]) delete done[kid];
        saveDone();
        btn.classList.toggle("on", !!done[kid]);
        btn.textContent = done[kid] ? "✓ 已完成 — 点击撤销" : "标记为已完成";
        buildSidebar(id);
        var sr = main.querySelector(".stat-row");
        if (sr) sr.outerHTML = statRow();
      });
    }
  }

  /* ---------- 初始化 ---------- */
  applyTheme(theme());
  document.getElementById("themeBtn").addEventListener("click", function () {
    applyTheme(theme() === "dark" ? "light" : "dark");
  });
  document.getElementById("menuBtn").addEventListener("click", function () {
    document.getElementById("sidebar").classList.toggle("open");
  });
  var input = document.getElementById("searchInput");
  input.addEventListener("input", function () { runSearch(input.value.trim()); });
  input.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown") { moveSel(1); e.preventDefault(); }
    else if (e.key === "ArrowUp") { moveSel(-1); e.preventDefault(); }
    else if (e.key === "Enter" && selList[selIdx]) { location.hash = selList[selIdx].id.charAt(1) === "_" ? "#/" + selList[selIdx].id.slice(2) : kpRoute(selList[selIdx].id); closeSearch(); }
    else if (e.key === "Escape") { closeSearch(); }
  });
  document.getElementById("scrim").addEventListener("click", closeSearch);
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== input) { input.focus(); e.preventDefault(); }
    if (e.key === "Escape") closeSearch();
  });
  window.addEventListener("hashchange", function () {
    route();
    document.getElementById("sidebar").classList.remove("open");
  });
  /* ---------- 侧栏偏好：左右位置 / 手动收起（持久化） ---------- */
  var SB_PREF_KEY = "dsh-learn-sidebar-pref";
  var sbPref = { side: "left", collapsed: false };
  try {
    var _sb = JSON.parse(localStorage.getItem(SB_PREF_KEY) || "{}");
    if (_sb.side === "left" || _sb.side === "right") sbPref.side = _sb.side;
    if (typeof _sb.collapsed === "boolean") sbPref.collapsed = _sb.collapsed;
  } catch (e) {}
  var sbAutoHidden = false;
  var shellEl = document.querySelector(".shell");

  function isMobile() {
    return window.matchMedia("(max-width: 900px)").matches;
  }
  function sbPersist() {
    try { localStorage.setItem(SB_PREF_KEY, JSON.stringify(sbPref)); } catch (e) {}
  }
  function sbChevron() { // chevron 指向侧栏将出现的方向
    var hidden = sbPref.collapsed || (sbAutoHidden && !isMobile());
    return (sbPref.side === "left") === hidden ? "›" : "‹";
  }
  function sbPaint() {
    shellEl.setAttribute("data-side", sbPref.side);
    shellEl.classList.toggle("sb-collapsed",
      !isMobile() && (sbPref.collapsed || sbAutoHidden));
    var chev = sbChevron();
    var t = document.getElementById("sideToggle");
    if (t) { t.textContent = chev; t.title = sbPref.collapsed ? "展开侧栏" : "收起侧栏"; }
    var tab = document.getElementById("sidebarTab");
    if (tab) tab.textContent = chev;
  }
  function sbSetCollapsed(v) {
    sbPref.collapsed = !!v; sbAutoHidden = false; sbPersist(); sbPaint();
  }
  function sbSetSide(s) { sbPref.side = s; sbPersist(); sbPaint(); paintTopbar(); }

  /* ---------- 顶栏滚动玻璃态 + 侧栏自动收起 ---------- */
  var topbar = document.querySelector(".topbar");
  var lastY = 0;
  function paintTopbar() {
    if (!topbar) return;
    topbar.classList.toggle("is-scrolled",
      (window.scrollY || document.documentElement.scrollTop || 0) > 8);
  }
  function onScroll() {
    paintTopbar();
    var y = window.scrollY || 0;
    if (!isMobile() && !sbPref.collapsed) {
      var dy = y - lastY, next = sbAutoHidden;
      if (y > 400 && dy > 2) next = true;        // 下滚 → 自动收起
      else if (dy < -2 || y < 80) next = false;  // 上滚 / 回顶 → 恢复
      if (next !== sbAutoHidden) { sbAutoHidden = next; sbPaint(); }
    }
    lastY = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------- 侧栏拖宽（pointer capture，200–440px，持久化） ---------- */
  var SB_W_KEY = "dsh-learn-sidebar-w", W_MIN = 200, W_MAX = 440, W_DEFAULT = 264;
  function setSidebarW(w, persist) {
    if (w == null) {
      document.documentElement.style.removeProperty("--sidebar-w");
    } else {
      w = Math.max(W_MIN, Math.min(W_MAX, Math.round(w)));
      document.documentElement.style.setProperty("--sidebar-w", w + "px");
    }
    if (persist) {
      try { w == null ? localStorage.removeItem(SB_W_KEY) : localStorage.setItem(SB_W_KEY, String(w)); } catch (e) {}
    }
  }
  (function initResizer() {
    var saved = null;
    try { saved = localStorage.getItem(SB_W_KEY); } catch (e) {}
    if (saved && !isNaN(parseInt(saved, 10))) setSidebarW(parseInt(saved, 10), false);
    var rz = document.getElementById("sidebarResizer");
    if (!rz) return;
    var startX = 0, startW = 0, dragging = false;
    function curW() {
      var raw = document.documentElement.style.getPropertyValue("--sidebar-w");
      var v = raw ? parseFloat(raw) : NaN;
      return isNaN(v) ? W_DEFAULT : v;
    }
    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      rz.classList.remove("dragging");
      document.body.classList.remove("resizing");
      try { rz.releasePointerCapture(e.pointerId); } catch (err) {}
      try { localStorage.setItem(SB_W_KEY, String(Math.round(curW()))); } catch (err) {}
    }
    rz.addEventListener("pointerdown", function (e) {
      dragging = true; startX = e.clientX; startW = curW();
      rz.classList.add("dragging");
      document.body.classList.add("resizing");
      try { rz.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    rz.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      var dir = sbPref.side === "right" ? -1 : 1; // 右侧模式：向左拖 = 变宽
      setSidebarW(startW + dir * (e.clientX - startX), false);
    });
    rz.addEventListener("pointerup", endDrag);
    rz.addEventListener("pointercancel", endDrag);
    rz.addEventListener("dblclick", function () { setSidebarW(null, true); });
    rz.addEventListener("keydown", function (e) {
      if (e.key === "ArrowLeft") { setSidebarW(curW() - 16, true); e.preventDefault(); }
      else if (e.key === "ArrowRight") { setSidebarW(curW() + 16, true); e.preventDefault(); }
      else if (e.key === "Escape") { setSidebarW(null, true); }
    });
  })();

  /* ---------- 侧栏控件：收起切换 / 左右切换 / 边缘把手 ---------- */
  var sideToggle = document.getElementById("sideToggle");
  if (sideToggle) sideToggle.addEventListener("click", function () {
    sbSetCollapsed(!sbPref.collapsed);
  });
  var sideBtn = document.getElementById("sideBtn");
  if (sideBtn) sideBtn.addEventListener("click", function () {
    sbSetSide(sbPref.side === "left" ? "right" : "left");
  });
  var sbTab = document.getElementById("sidebarTab");
  if (sbTab) sbTab.addEventListener("click", function () {
    if (sbPref.collapsed) sbSetCollapsed(false);
    else { sbAutoHidden = false; sbPaint(); }
  });
  sbPaint();

  paintProgress();
  route();
})();
