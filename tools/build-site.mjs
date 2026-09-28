#!/usr/bin/env node
/**
 * 一次性生成器：把 knowledge-base/ 的 Markdown 编译成 learning-site/data.js
 * 零运行时依赖（只用 Node 内置模块）；站点本体保持纯静态。
 * 用法：node tools/build-site.mjs
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = join(ROOT, "knowledge-base");
const SITE = join(ROOT, "learning-site");

/* ---------------- 极简 Markdown → HTML ---------------- */
function inline(s) {
  // 转义由各调用方保证顺序：先转义，再放回代码占位
  s = s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push(c); return `\x00C${codes.length - 1}\x00`; });
  s = s
    .replace(/\*\*\*([^*]+)\*\*\*/g, "<b><i>$1</i></b>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[^*\w])\*([^*\n]+)\*/g, "$1<i>$2</i>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, t, href) => {
      if (href.startsWith("kp:")) return `<a href="#/kp/${href.slice(3)}">${t}</a>`;
      if (href.startsWith("#")) return `<a href="${href}">${t}</a>`;
      return `<a href="${href}" target="_blank" rel="noopener">${t}</a>`;
    });
  return s.replace(/\x00C(\d+)\x00/g, (_, i) => `<code>${codes[+i]}</code>`);
}

function highlight(code, lang) {
  let out = code.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const kw = /^(ts|typescript|js|javascript|yaml|yml|sh|shell|bash|json|python|py)$/.test(lang || "");
  if (kw) {
    out = out
      .replace(/(#.*|\/\/.*)$/gm, m => `\x01C${m}\x01`)                    // 注释占位
      .replace(/("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/g, m => `\x01S${m}\x01`) // 字符串
      .replace(/\b(const|let|var|function|class|extends|new|return|await|async|export|import|from|interface|type|declare|if|else|for|of|in|this|super|static|private|public|readonly|implements|yield|try|catch|finally|throw|null|undefined|true|false|void|as)\b/g, `\x01K$1\x01`)
      .replace(/\b(\d+(?:\.\d+)?)\b/g, `\x01N$1\x01`);
  }
  return out
    .replace(/\x01C([\s\S]*?)\x01/g, '<span class="tok-com">$1</span>')
    .replace(/\x01S([\s\S]*?)\x01/g, '<span class="tok-str">$1</span>')
    .replace(/\x01K(\w+)\x01/g, '<span class="tok-key">$1</span>')
    .replace(/\x01N(\d+(?:\.\d+)?)\x01/g, '<span class="tok-num">$1</span>');
}

function mdToHtml(md) {
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  const out = [];
  let i = 0, para = [], listStack = [];

  const flushPara = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
  const closeLists = () => {
    flushPara();
    while (listStack.length) out.push(listStack.pop() === "ol" ? "</ol>" : "</ul>");
  };

  while (i < lines.length) {
    const line = lines[i];

    if (/^```/.test(line)) {
      closeLists();
      const lang = line.slice(3).trim();
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      out.push(`<pre><span class="lang">${lang || "code"}</span><code>${highlight(buf.join("\n"), lang)}</code></pre>`);
      continue;
    }

    if (/^###\s/.test(line)) { closeLists(); out.push("<h4>" + inline(line.slice(4)) + "</h4>"); i++; continue; }
    if (/^##\s/.test(line)) { closeLists(); out.push("<h3>" + inline(line.slice(3)) + "</h3>"); i++; continue; }
    if (/^#\s/.test(line)) { closeLists(); out.push("<h2>" + inline(line.slice(2)) + "</h2>"); i++; continue; }

    if (/^>\s?/.test(line)) {
      closeLists();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>\s?/, "")); i++; }
      out.push("<blockquote>" + mdToHtml(buf.join("\n")).replace(/^\s*<p>|<\/p>\s*$/g, "") + "</blockquote>");
      continue;
    }

    if (/^:::/.test(line)) { // ::: tip 标题 ... :::
      closeLists();
      const m = line.match(/^:::\s*(tip|warn|danger)\s*(.*)$/);
      const buf = [];
      i++;
      while (i < lines.length && !/^:::/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++;
      const cls = m ? m[1] : "tip";
      const title = m && m[2] ? m[2] : { tip: "提示", warn: "注意", danger: "危险" }[cls];
      out.push(`<div class="callout ${cls}"><div class="t">◆ ${inline(title)}</div>` + mdToHtml(buf.join("\n")) + "</div>");
      continue;
    }

    if (/^\s*(\||\+-)/.test(line) && line.includes("|")) { // GFM 表格
      closeLists();
      const rows = [];
      while (i < lines.length && lines[i].includes("|")) { rows.push(lines[i]); i++; }
      const cells = r => r.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      if (rows.length >= 2 && /^[\s|:-]+$/.test(rows[1])) {
        let html = "<table><thead><tr>" + cells(rows[0]).map(c => `<th>${inline(c)}</th>`).join("") + "</tr></thead><tbody>";
        for (let r = 2; r < rows.length; r++) html += "<tr>" + cells(rows[r]).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>";
        out.push(html + "</tbody></table>");
      } else if (rows.length) {
        out.push("<table><tbody>" + rows.map(r => "<tr>" + cells(r).map(c => `<td>${inline(c)}</td>`).join("") + "</tr>").join("") + "</tbody></table>");
      }
      continue;
    }

    const ul = line.match(/^(\s*)[-*]\s+(.*)$/);
    const ol = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flushPara();
      const indent = (ul || ol)[1].length;
      const type = ul ? "ul" : "ol";
      const want = Math.floor(indent / 2) + 1;
      while (listStack.length < want) { out.push(type === "ul" ? "<ul>" : "<ol>"); listStack.push(type); }
      while (listStack.length > want) { out.push(listStack.pop() === "ol" ? "</ol>" : "</ul>"); }
      out.push("<li>" + inline((ul || ol)[2]) + "</li>");
      i++; continue;
    }

    if (/^\s*---+\s*$/.test(line)) { closeLists(); out.push("<hr>"); i++; continue; }
    if (/^\s*$/.test(line)) { flushPara(); closeListsSilent(listStack, out); i++; continue; }

    para.push(line.trim());
    i++;
  }
  function closeListsSilent(stack, out2) {
    if (!para.length && stack.length) { /* 列表项之间的空行不闭合列表 */ }
  }
  flushPara();
  while (listStack.length) out.push(listStack.pop() === "ol" ? "</ol>" : "</ul>");
  return out.join("\n");
}

/* ---------------- frontmatter ---------------- */
function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: md };
  const meta = {};
  m[1].split("\n").forEach(l => {
    const kv = l.match(/^(\w[\w-]*):\s*(.*)$/);
    if (!kv) return;
    let v = kv[2].trim();
    if (v.startsWith("[") && v.endsWith("]")) {
      v = v.slice(1, -1).split(",").map(x => x.trim().replace(/^['"]|['"]$/g, "")).filter(Boolean);
    } else if (v.startsWith("[") && !v.endsWith("]")) {
      return; // 多行数组，跳过（我们不用）
    } else { v = v.replace(/^['"]|['"]$/g, ""); }
    meta[kv[1]] = v;
  });
  return { meta, body: m[2] };
}

/* ---------------- 收集知识点 ---------------- */
const MODULE_DIRS = [
  ["01-总览与定位", "总览与定位", "坐标"],
  ["02-Cordis基座", "Cordis 基座", "基座"],
  ["03-Agent核心循环", "Agent 核心循环", "循环"],
  ["04-会话与上下文", "会话与上下文", "会话"],
  ["05-工具与能力接缝", "工具与能力接缝", "接缝"],
  ["06-应用与扩展", "应用与扩展", "生态"],
  ["07-工程实践", "工程实践", "工程"],
];

const kps = [], modules = [];
for (const [dir, title, short] of MODULE_DIRS) {
  const dirPath = join(KB, dir);
  if (!existsSync(dirPath)) continue;
  const files = readdirSync(dirPath).filter(f => f.endsWith(".md") && f.startsWith("kp-")).sort();
  const ids = [];
  for (const f of files) {
    const raw = readFileSync(join(dirPath, f), "utf8");
    const { meta, body } = parseFrontmatter(raw);
    const id = meta.id || f.replace(/\.md$/, "");
    const summaryMatch = body.match(/^一句话定义[：:]\s*(.+)$/m) || body.match(/^(.+)$/m);
    kps.push({
      id, title: meta.title || f, module: meta.module || title, level: meta.level || "核心",
      prerequisites: meta.prerequisites || [], related: meta.related || [], tags: meta.tags || [],
      sources: meta.sources || [], star: meta.star === "true", file: `knowledge-base/${dir}/${f}`,
      summary: (summaryMatch ? summaryMatch[1] : "").replace(/[*`]/g, "").slice(0, 120),
      html: mdToHtml(body),
      searchText: body.replace(/```[\s\S]*?```/g, " ").replace(/[#*`>|\-]/g, " ").slice(0, 4000).toLowerCase(),
    });
    ids.push(id);
  }
  modules.push({ title, short, dir, kpIds: ids, summary: meta_summary(dir, title), dependsOn: deps(dir) });
}

function meta_summary(dir, fallback) {
  const map = {
    "01-总览与定位": "dsh 是什么、解决什么问题、有几种运行形态、背后的编程范式。",
    "02-Cordis基座": "一切皆插件的框架基础：Context、Service、事件、effect 与补丁组装。",
    "03-Agent核心循环": "源码的心脏：Agent 接口、turn/step 状态机、水瀑事件、重试与取消。",
    "04-会话与上下文": "追加式会话日志即上下文真相源：文件格式、投影、系统提示与压缩。",
    "05-工具与能力接缝": "工具注册与执行管线、作用域机制，以及一处换供应商全产品换血的能力接缝。",
    "06-应用与扩展": "Web/Desktop/SDK 应用形态与多智能体扩展机制。",
    "07-工程实践": "支撑 60+ 插件包的工程纪律，以及如何动手扩展。",
  };
  return map[dir] || fallback;
}
function deps(dir) {
  const map = {
    "02-Cordis基座": ["总览与定位"],
    "03-Agent核心循环": ["Cordis 基座"],
    "04-会话与上下文": ["Agent 核心循环"],
    "05-工具与能力接缝": ["会话与上下文"],
    "06-应用与扩展": ["工具与能力接缝"],
    "07-工程实践": ["应用与扩展"],
  };
  return map[dir] || [];
}

/* ---------------- 术语表 / 路径 / 参考 ---------------- */
function parseGlossary() {
  const p = join(KB, "99-术语表.md");
  if (!existsSync(p)) return [];
  const raw = readFileSync(p, "utf8") + "\n### __EOF__";
  const items = [];
  const re = /^###\s+(.+?)（(.+?)）\n([\s\S]*?)(?=^### )/gm;
  let m;
  while ((m = re.exec(raw))) {
    if (m[1].trim() === "__EOF__") break;
    const body = m[3].trim();
    const kpMatch = body.match(/kp:\s*(kp-\d+)/);
    items.push({ term: m[1].trim(), en: m[2].trim(), html: mdToHtml(body.replace(/^kp:\s*kp-\d+\s*$/m, "")), kp: kpMatch ? kpMatch[1] : null, def: body.replace(/[*`]/g, "").slice(0, 200) });
  }
  return items;
}

function parsePath() {
  const p = join(KB, "00-learning-path.md");
  const steps = [];
  if (!existsSync(p)) return steps;
  const raw = readFileSync(p, "utf8") + "\n### __EOF__";
  const re = /^###\s+第\s*(\d+)\s*段[：:]\s*(.+?)\n([\s\S]*?)(?=^### )/gm;
  let m;
  while ((m = re.exec(raw))) {
    if (m[2].trim() === "__EOF__") break;
    const kpIds = [...m[3].matchAll(/kp:(kp-\d+)/g)].map(x => x[1]);
    const descLine = m[3].split("\n").find(l => l && !l.startsWith("-") && !l.startsWith("#")) || "";
    steps.push({ title: m[2].trim(), desc: descLine.replace(/[*`]/g, "").trim().slice(0, 200), kpIds });
  }
  return steps;
}

/* ---------------- 版本追踪（结构化时间线） ---------------- */
// 裸 kp-015 / kp:kp-015 → 知识点内链
const autolinkKp = t => t.replace(/(?:kp:)?\b(kp-\d{3})\b/g, (_, id) => `[${id}](kp:${id})`);

function parseChangelog() {
  const p = join(KB, "09-版本追踪.md");
  const out = { introHtml: "", entries: [], appendixHtml: "" };
  if (!existsSync(p)) return out;
  const raw = readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const sections = []; // {title, body}
  let cur = { title: null, body: [] };
  for (const l of raw.split("\n")) {
    const hm = l.match(/^##\s+(.*)$/);
    if (hm) { sections.push(cur); cur = { title: hm[1].trim(), body: [] }; }
    else cur.body.push(l);
  }
  sections.push(cur);
  const introLines = (sections[0].body || []).filter(l => !/^#\s/.test(l));
  out.introHtml = mdToHtml(introLines.join("\n").trim());

  const dateRe = /^\d{4}-\d{2}-\d{2}/;
  const appendix = [];
  for (const s of sections.slice(1)) {
    const dm = s.title.match(/^(\d{4}-\d{2}-\d{2})\s*·\s*(.+)$/);
    if (!dm) { appendix.push(s); continue; }
    const date = dm[1];
    let title = dm[2].trim();
    let badge = null;
    const bm = title.match(/（([^）]+)）\s*$/);
    if (bm && /提交|tag|发布|更新/.test(bm[1])) { badge = bm[1].trim(); title = title.slice(0, bm.index).trim(); }
    const items = [];
    let last = null; // 当前子弹，承接续行与子列表
    for (const l of s.body) {
      if (!l.trim()) continue;
      const sub = l.match(/^\s+-\s+(.*)$/);
      const num = l.match(/^\s+(\d+)[.)]\s+(.*)$/);
      const kv = l.match(/^-\s+\*\*(.+?)\*\*[：:]\s*(.*)$/);
      const plain = l.match(/^-\s+(.*)$/);
      if (sub && last) { last.subs.push(inline(autolinkKp(sub[1]))); continue; }
      if (num) { items.push(last = { kind: "num", label: null, html: inline(autolinkKp(num[2])), subs: [] }); continue; }
      if (kv) { items.push(last = { kind: "kv", label: kv[1], html: inline(autolinkKp(kv[2])), subs: [] }); continue; }
      if (plain) { items.push(last = { kind: "plain", label: null, html: inline(autolinkKp(plain[1])), subs: [] }); continue; }
      if (last) last.html += " " + inline(autolinkKp(l.trim())); // 续行并入上一条
    }
    const kpIds = [...new Set(s.body.join("\n").match(/kp-\d{3}/g) || [])].sort();
    out.entries.push({ id: "e-" + date, date, title, badge, items, kpIds });
  }
  if (appendix.length) {
    out.appendixHtml = appendix.map(a => mdToHtml("## " + a.title + "\n" + a.body.join("\n"))).join("\n");
  }
  return out;
}

/* ---------------- 写 data.js ---------------- */
const data = `window.DSH_DATA = ${JSON.stringify({
  kps, modules, glossary: parseGlossary(), pathSteps: parsePath(),
  refsHtml: mdToHtml(existsSync(join(KB, "99-参考资料.md")) ? readFileSync(join(KB, "99-参考资料.md"), "utf8").replace(/^#\s+参考资料\s*\n/, "") : "<p>暂无</p>"),
  changelog: parseChangelog(),
}, null, 0)};`;
writeFileSync(join(SITE, "data.js"), data, "utf8");
const _cl = parseChangelog();
console.log(`OK: ${kps.length} KPs, ${modules.length} modules, ${parseGlossary().length} glossary terms, ${_cl.entries.length} changelog entries -> learning-site/data.js (${(data.length / 1024).toFixed(0)} KB)`);
