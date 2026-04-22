const storageKey = "wechat-markdown-draft-v1";
const hljsCdnVersion = "11.11.1";
const hljsLanguageBaseUrl = `https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@${hljsCdnVersion}/build/languages`;
const languageLoadPromiseMap = new Map();
let renderSequence = 0;
let markdownEditor = null;
let isSettingEditorValue = false;

const themeStyleVars = {
  classic: { text: "#283345", accent: "#2e5c9e", soft: "#edf4ff" },
  ink: { text: "#19334f", accent: "#0f4e81", soft: "#e8f2fa" },
  sunset: { text: "#503127", accent: "#d96c35", soft: "#fff2ea" },
  forest: { text: "#244232", accent: "#317951", soft: "#ebf7f0" },
  plum: { text: "#3a2642", accent: "#7a3fa0", soft: "#f7eefc" },
  ocean: { text: "#16384f", accent: "#0b79b5", soft: "#e9f7ff" },
  rose: { text: "#4a2a34", accent: "#c14f73", soft: "#feeff4" },
  amber: { text: "#4b3518", accent: "#c98622", soft: "#fff6e8" },
  slate: { text: "#2d3645", accent: "#586781", soft: "#edf1f7" },
  mint: { text: "#1e3f35", accent: "#2f9b7e", soft: "#e8f8f3" },
  cocoa: { text: "#3f2c25", accent: "#9a5f4b", soft: "#f7efe9" },
  indigo: { text: "#272f57", accent: "#4e64d8", soft: "#edf0ff" }
};

const el = {
  input: document.getElementById("markdownInput"),
  preview: document.getElementById("preview"),
  status: document.getElementById("statusText"),
  copyHtmlBtn: document.getElementById("copyHtmlBtn"),
  copyRichBtn: document.getElementById("copyRichBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  clearBtn: document.getElementById("clearBtn"),
  sampleBtn: document.getElementById("sampleBtn"),
  fileInput: document.getElementById("fileInput"),
  themeSelect: document.getElementById("themeSelect")
};

const sampleMarkdown = `# 这是一篇公众号示例文章

欢迎使用 **Markdown 转公众号排版工具**。

> 支持实时预览、代码高亮、表格、引用块和主题切换。

## 二级标题示例

排版建议：

- 每个段落控制在 2-4 行
- 适当使用小标题增强节奏
- 重点信息可用加粗强调

### 代码示例

\`\`\`js
const message = "Hello WeChat";
console.log(message);
\`\`\`

### 表格示例

| 能力 | 支持情况 |
| --- | --- |
| 标题 | ✅ |
| 列表 | ✅ |
| 代码高亮 | ✅ |

![配图示例](https://images.unsplash.com/photo-1519389950473-47ba0277781c?q=80&w=1200&auto=format&fit=crop)

祝你排版顺利。`;

const hljsInlineStyleMap = {
  "hljs-keyword": "color:#cf222e;font-weight:600;",
  "hljs-selector-tag": "color:#cf222e;font-weight:600;",
  "hljs-literal": "color:#0550ae;",
  "hljs-symbol": "color:#0550ae;",
  "hljs-number": "color:#0550ae;",
  "hljs-link": "color:#0550ae;text-decoration:underline;",
  "hljs-regexp": "color:#0a7f45;",
  "hljs-string": "color:#0a7f45;",
  "hljs-char": "color:#0a7f45;",
  "hljs-built_in": "color:#8250df;",
  "hljs-title": "color:#8250df;",
  "hljs-type": "color:#953800;",
  "hljs-class": "color:#953800;",
  "hljs-function": "color:#8250df;",
  "hljs-params": "color:#24292f;",
  "hljs-comment": "color:#6e7781;font-style:italic;",
  "hljs-quote": "color:#6e7781;font-style:italic;",
  "hljs-meta": "color:#953800;",
  "hljs-section": "color:#8250df;font-weight:600;",
  "hljs-name": "color:#953800;",
  "hljs-attr": "color:#953800;",
  "hljs-attribute": "color:#953800;",
  "hljs-variable": "color:#953800;",
  "hljs-template-variable": "color:#953800;",
  "hljs-subst": "color:#24292f;",
  "hljs-deletion": "color:#cf222e;background:#ffebe9;",
  "hljs-addition": "color:#116329;background:#dafbe1;"
};

marked.setOptions({
  gfm: true,
  breaks: true
});

function nowText() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function setStatus(text) {
  el.status.textContent = `${text} · ${nowText()}`;
}

function parseMarkdown(mdText) {
  const rawHtml = marked.parse(mdText || "");
  return DOMPurify.sanitize(rawHtml, {
    ALLOWED_ATTR: ["href", "src", "alt", "title", "class"],
    ALLOWED_TAGS: [
      "a", "p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code", "em", "strong", "ul", "ol", "li", "img", "table", "thead", "tbody", "tr", "th", "td", "hr", "br"
    ]
  });
}

function setupMarkdownEditor() {
  if (!window.CodeMirror || !el.input) {
    return;
  }
  markdownEditor = window.CodeMirror.fromTextArea(el.input, {
    mode: "gfm",
    theme: "default",
    lineNumbers: true,
    lineWrapping: true
  });
  markdownEditor.on("change", () => {
    if (isSettingEditorValue) {
      return;
    }
    render();
  });
}

function getMarkdownValue() {
  if (markdownEditor) {
    return markdownEditor.getValue();
  }
  return el.input.value || "";
}

function setMarkdownValue(value) {
  const safeValue = String(value || "");
  if (markdownEditor) {
    isSettingEditorValue = true;
    markdownEditor.setValue(safeValue);
    isSettingEditorValue = false;
    return;
  }
  el.input.value = safeValue;
}

function getCodeBlockLanguage(block) {
  const classes = Array.from(block.classList);
  const prefixed = classes.find((name) => /^language-/i.test(name) || /^lang-/i.test(name));
  if (prefixed) {
    return prefixed.replace(/^language-|^lang-/i, "").toLowerCase();
  }

  const knownToken = classes.find((name) => /^[\w-]+$/i.test(name) && hljs.getLanguage(name.toLowerCase()));
  if (knownToken) {
    return knownToken.toLowerCase();
  }

  return "";
}

function normalizeLanguageAlias(language) {
  const aliasMap = {
    shell: "bash",
    sh: "bash",
    zsh: "bash",
    console: "bash",
    ps1: "powershell",
    pwsh: "powershell",
    yml: "yaml",
    md: "markdown",
    ts: "typescript",
    js: "javascript",
    py: "python"
  };
  return aliasMap[language] || language;
}

function getLanguageLoadCandidates(language) {
  const normalized = normalizeLanguageAlias(String(language || "").trim().toLowerCase());
  if (!normalized) {
    return [];
  }

  const specialMap = {
    "c++": ["cpp"],
    "cpp": ["cpp"],
    "c#": ["csharp"],
    "f#": ["fsharp"],
    "objective-c": ["objectivec"],
    "objectivec": ["objectivec"],
    "obj-c": ["objectivec"],
    "text": ["plaintext"],
    "plain": ["plaintext"]
  };

  const mapped = specialMap[normalized] || [normalized];
  const collapsed = normalized.replace(/[^\w]/g, "");
  if (collapsed && !mapped.includes(collapsed)) {
    mapped.push(collapsed);
  }
  return mapped;
}

function loadScriptOnce(url) {
  if (languageLoadPromiseMap.has(url)) {
    return languageLoadPromiseMap.get(url);
  }

  const promise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error(`load failed: ${url}`));
    document.head.appendChild(script);
  });

  languageLoadPromiseMap.set(url, promise);
  return promise;
}

async function ensureLanguageAvailable(language) {
  const candidates = getLanguageLoadCandidates(language);
  if (!candidates.length) {
    return "";
  }

  const ready = candidates.find((name) => hljs.getLanguage(name));
  if (ready) {
    return ready;
  }

  for (const name of candidates) {
    try {
      await loadScriptOnce(`${hljsLanguageBaseUrl}/${name}.min.js`);
    } catch {
      continue;
    }
    const loaded = candidates.find((candidate) => hljs.getLanguage(candidate));
    if (loaded) {
      return loaded;
    }
  }

  return "";
}

function guessCommandLanguage(codeText) {
  const text = codeText.trim();
  if (!text) {
    return "";
  }
  if (/(^|\n)\s*(iwr|invoke-webrequest)\b/i.test(text) || /\|\s*iex\b/i.test(text)) {
    return "powershell";
  }
  if (/(^|\n)\s*(curl|wget|chmod|export|source|sudo|apt|yum|dnf|brew|bash|sh)\b/i.test(text)) {
    return "bash";
  }
  return "";
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fallbackHighlightCli(text, language) {
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*#/.test(line)) {
        return `<span class="hljs-comment">${escapeHtml(line)}</span>`;
      }

      const tokens = line.match(/\s+|[^\s]+/g) || [];
      let commandColored = false;

      return tokens
        .map((token) => {
          if (/^\s+$/.test(token)) {
            return token;
          }
          const safe = escapeHtml(token);
          if (/^https?:\/\//i.test(token)) {
            return `<span class="hljs-link">${safe}</span>`;
          }
          if (/^['"`].*['"`]$/.test(token)) {
            return `<span class="hljs-string">${safe}</span>`;
          }
          if (/^-{1,2}[a-z0-9-]+$/i.test(token)) {
            return `<span class="hljs-attr">${safe}</span>`;
          }
          if (language === "powershell" && /^\$[a-z_][\w-]*$/i.test(token)) {
            return `<span class="hljs-variable">${safe}</span>`;
          }
          if (!commandColored && !/^[|&;()]+$/.test(token)) {
            commandColored = true;
            return `<span class="hljs-built_in">${safe}</span>`;
          }
          return safe;
        })
        .join("");
    })
    .join("\n");
}

function clearCodeLanguageClass(block) {
  Array.from(block.classList)
    .filter((name) => /^language-/i.test(name) || /^lang-/i.test(name))
    .forEach((name) => block.classList.remove(name));
}

async function highlightCodeBlock(block) {
  const text = block.textContent || "";
  const explicitLanguage = normalizeLanguageAlias(getCodeBlockLanguage(block));
  const guessedCliLanguage = guessCommandLanguage(text);
  const explicitReadyLanguage = explicitLanguage ? await ensureLanguageAvailable(explicitLanguage) : "";
  const guessedReadyLanguage = !explicitReadyLanguage && guessedCliLanguage ? await ensureLanguageAvailable(guessedCliLanguage) : "";
  const resolvedLanguage = explicitReadyLanguage || guessedReadyLanguage;

  let html = "";
  let finalLanguage = "";

  if (resolvedLanguage && hljs.getLanguage(resolvedLanguage)) {
    finalLanguage = resolvedLanguage;
    html = hljs.highlight(text, { language: resolvedLanguage, ignoreIllegals: true }).value;
  } else {
    const auto = hljs.highlightAuto(text);
    html = auto.value;
    finalLanguage = auto.language || "";
  }

  clearCodeLanguageClass(block);
  if (finalLanguage) {
    block.classList.add(`language-${finalLanguage}`);
  }
  block.classList.add("hljs");
  block.innerHTML = html || escapeHtml(text);

  if ((resolvedLanguage === "bash" || resolvedLanguage === "powershell") && !block.querySelector("span")) {
    block.innerHTML = fallbackHighlightCli(text, resolvedLanguage);
  }

  return {
    explicitLanguage,
    explicitMatched: !explicitLanguage || Boolean(explicitReadyLanguage)
  };
}

async function render() {
  const currentSequence = ++renderSequence;
  const md = getMarkdownValue();
  el.preview.innerHTML = parseMarkdown(md);
  const codeBlocks = Array.from(el.preview.querySelectorAll("pre code"));
  const missingExplicitLanguages = new Set();
  for (const block of codeBlocks) {
    if (currentSequence !== renderSequence) {
      return;
    }
    const result = await highlightCodeBlock(block);
    if (result.explicitLanguage && !result.explicitMatched) {
      missingExplicitLanguages.add(result.explicitLanguage);
    }
  }
  localStorage.setItem(storageKey, md);
  if (missingExplicitLanguages.size > 0) {
    setStatus(`已渲染（未命中语言：${Array.from(missingExplicitLanguages).join(", ")}）`);
    return;
  }
  addTrafficLights(el.preview);
  setStatus("已渲染");
}

function addTrafficLights(root) {
  root.querySelectorAll("pre").forEach((node) => {
    const codeEl = node.querySelector("code");
    if (codeEl && !codeEl.querySelector(".traffic-lights")) {
      const lights = document.createElement("span");
      lights.className = "traffic-lights";
      lights.style.cssText = "display:block;margin-bottom:12px;line-height:1;font-size:16px;";
      lights.innerHTML = '<span style="color:#ff5f56;display:inline-block;margin-right:8px;">●</span><span style="color:#ffbd2e;display:inline-block;margin-right:8px;">●</span><span style="color:#27c93f;display:inline-block;">●</span>';
      codeEl.insertBefore(lights, codeEl.firstChild);
    }
  });
}

function applyInlineStyles(root, theme) {
  const palette = themeStyleVars[theme] || themeStyleVars.classic;
  const systemSans = "-apple-system,BlinkMacSystemFont,'SF Pro Text','SF Pro Display','Segoe UI',Roboto,'Helvetica Neue','Hiragino Sans GB','Microsoft YaHei','Noto Sans CJK SC',sans-serif";
  const systemMono = "ui-monospace,'SF Mono',Menlo,Monaco,Consolas,'Liberation Mono','Courier New',monospace";
  root.style.cssText = `font-family:${systemSans};font-size:16px;line-height:1.85;color:${palette.text};word-break:break-word;letter-spacing:0.015em;`;

  root.querySelectorAll("p").forEach((node) => {
    node.style.cssText = "margin:0 0 1.1em;";
  });

  root.querySelectorAll("h1").forEach((node) => {
    node.style.cssText = `margin:1.45em 0 .7em;font-size:1.8em;line-height:1.4;color:${palette.accent};font-weight:700;letter-spacing:0.01em;text-align:center;`;
  });

  root.querySelectorAll("h2").forEach((node) => {
    node.style.cssText = `margin:1.35em 0 .65em;font-size:1.45em;line-height:1.45;color:${palette.accent};font-weight:700;letter-spacing:0.01em;`;
  });

  root.querySelectorAll("h3,h4,h5,h6").forEach((node) => {
    node.style.cssText = `margin:1.2em 0 .6em;font-size:1.2em;line-height:1.5;color:${palette.accent};font-weight:700;letter-spacing:0.01em;`;
  });

  root.querySelectorAll("a").forEach((node) => {
    node.style.cssText = `color:${palette.accent};text-decoration:underline;`;
  });

  root.querySelectorAll("blockquote").forEach((node) => {
    node.style.cssText = `margin:1em 0;padding:.65em .9em;background:${palette.soft};border-radius:4px;`;
    node.querySelectorAll("p").forEach((p) => {
      p.style.cssText = "margin:0 !important;padding:4px 0;";
    });
  });

  root.querySelectorAll("ul,ol").forEach((node) => {
    node.style.cssText = "margin:.6em 0 1em 2em;padding:0;list-style-position:outside;";
  });

  root.querySelectorAll("li").forEach((node) => {
    node.style.cssText = "margin:.35em 0;";
  });

  root.querySelectorAll("pre").forEach((node) => {
    node.style.cssText = "margin:1em 0;padding:14px;overflow:auto;background:#f5f7fb;border:1px solid #d9e1ee;border-radius:8px;line-height:1.65;";
  });
  addTrafficLights(root);

  root.querySelectorAll("code").forEach((node) => {
    if (node.closest("pre")) {
      node.style.cssText = `font-family:${systemMono};font-size:14px;white-space:pre;text-align:left;word-break:keep-all;overflow-wrap:normal;`;
      return;
    }
    node.style.cssText = `font-family:${systemMono};padding:.1em .3em;border-radius:4px;background:${palette.soft};font-size:.92em;display:inline;white-space:nowrap;`;
  });

  root.querySelectorAll("img").forEach((node) => {
    node.style.cssText = "display:block;max-width:100%;height:auto;margin:1em auto;border-radius:8px;";
  });

  root.querySelectorAll("table").forEach((node) => {
    node.style.cssText = "width:100%;margin:1em 0;border-collapse:collapse;";
  });

  root.querySelectorAll("th,td").forEach((node) => {
    node.style.cssText = "border:1px solid #d7dde8;padding:.45em .65em;text-align:left;";
  });

  root.querySelectorAll("hr").forEach((node) => {
    node.style.cssText = "border:none;border-top:1px solid #d7dde8;margin:1.2em 0;";
  });
}

function inlineCodeHighlightStyles(root) {
  root.querySelectorAll("pre code").forEach((node) => {
    node.style.cssText += "display:block;color:#24292f;background:transparent;";
  });

  root.querySelectorAll("pre code span").forEach((node) => {
    const style = Array.from(node.classList)
      .map((className) => hljsInlineStyleMap[className])
      .filter(Boolean)
      .join("");
    if (style) {
      node.style.cssText += style;
    }
  });
}

function buildWechatHtml() {
  const container = document.createElement("section");
  container.innerHTML = el.preview.innerHTML;
  applyInlineStyles(container, el.themeSelect.value);
  inlineCodeHighlightStyles(container);
  return container.outerHTML;
}

async function copyHtml() {
  try {
    await navigator.clipboard.writeText(buildWechatHtml());
    setStatus("内联 HTML 已复制");
  } catch {
    setStatus("复制失败：浏览器权限不足");
  }
}

async function copyRichText() {
  const html = buildWechatHtml();
  const text = el.preview.innerText;
  try {
    if (window.ClipboardItem) {
      const item = new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" })
      });
      await navigator.clipboard.write([item]);
      setStatus("富文本已复制，可直接粘贴到公众号");
      return;
    }
    await navigator.clipboard.writeText(text);
    setStatus("当前浏览器不支持富文本复制，已复制纯文本");
  } catch {
    setStatus("复制失败：浏览器权限不足");
  }
}

function downloadHtml() {
  const body = buildWechatHtml();
  const doc = `<!doctype html><html><head><meta charset="utf-8"><title>wechat-article</title></head><body>${body}</body></html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `wechat-${Date.now()}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus("HTML 文件已下载");
}

function applyTheme(theme) {
  el.preview.className = `wechat-body theme-${theme}`;
  setStatus(`主题已切换：${el.themeSelect.options[el.themeSelect.selectedIndex].text}`);
}

function clearContent() {
  setMarkdownValue("");
  render();
}

function loadSample() {
  setMarkdownValue(sampleMarkdown);
  render();
}

function handleFileInput(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    setMarkdownValue(String(reader.result || ""));
    render();
    setStatus(`已导入：${file.name}`);
  };
  reader.onerror = () => {
    setStatus("导入失败，请重试");
  };
  reader.readAsText(file, "utf-8");
}

function init() {
  setupMarkdownEditor();
  const draft = localStorage.getItem(storageKey);
  setMarkdownValue(draft || sampleMarkdown);

  if (!markdownEditor) {
    el.input.addEventListener("input", render);
  }
  el.copyHtmlBtn.addEventListener("click", copyHtml);
  el.copyRichBtn.addEventListener("click", copyRichText);
  el.downloadBtn.addEventListener("click", downloadHtml);
  el.clearBtn.addEventListener("click", clearContent);
  el.sampleBtn.addEventListener("click", loadSample);
  el.fileInput.addEventListener("change", handleFileInput);
  el.themeSelect.addEventListener("change", (event) => applyTheme(event.target.value));

  applyTheme(el.themeSelect.value);
  render();
}

init();
