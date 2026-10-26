import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "style",
  "div", "span", "main", "section", "article", "header", "footer", "nav", "aside",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr",
  "strong", "b", "em", "i", "u", "s", "small", "mark", "sub", "sup", "code", "pre",
  "blockquote", "q", "cite", "abbr", "time",
  "ul", "ol", "li", "dl", "dt", "dd",
  "figure", "figcaption", "img",
  "table", "caption", "colgroup", "col", "thead", "tbody", "tfoot", "tr", "th", "td",
  "details", "summary",
  "a",
];

const GLOBAL_ATTRIBUTES = [
  "class", "id", "style", "dir", "lang", "title", "role",
  /^aria-[a-z0-9_-]+$/i,
];

function safeEmbeddedImage(value) {
  if (typeof value !== "string" || value.length > 1024 * 1024) return "";
  if (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/i.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : "";
  } catch {
    return "";
  }
}

export function sanitizeJahizHtml(value) {
  if (typeof value !== "string" || !value) return "";
  return sanitizeHtml(value, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      "*": GLOBAL_ATTRIBUTES,
      img: [...GLOBAL_ATTRIBUTES, "src", "alt", "width", "height", "loading", "decoding"],
      table: [...GLOBAL_ATTRIBUTES, "summary"],
      col: [...GLOBAL_ATTRIBUTES, "span", "width"],
      th: [...GLOBAL_ATTRIBUTES, "colspan", "rowspan", "scope", "headers"],
      td: [...GLOBAL_ATTRIBUTES, "colspan", "rowspan", "headers"],
      ol: [...GLOBAL_ATTRIBUTES, "start", "reversed", "type"],
      li: [...GLOBAL_ATTRIBUTES, "value"],
      time: [...GLOBAL_ATTRIBUTES, "datetime"],
    },
    allowedSchemes: ["https", "data"],
    allowProtocolRelative: false,
    allowVulnerableTags: true,
    parseStyleAttributes: false,
    nestingLimit: 40,
    nonTextTags: ["script", "textarea", "option", "xmp", "noscript", "template"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: Object.fromEntries(
          Object.entries(attribs).filter(([name]) => !["href", "target", "ping", "download"].includes(name))
        ),
      }),
      img: (tagName, attribs) => {
        const src = safeEmbeddedImage(attribs.src);
        if (!src) return { tagName: "span", attribs: {} };
        return { tagName, attribs: { ...attribs, src } };
      },
    },
  });
}

export function jahizPageResponse(customHtml) {
  const content = sanitizeJahizHtml(customHtml);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>html,body{margin:0;min-height:100%;overflow-wrap:anywhere}*{box-sizing:border-box}img{max-width:100%;height:auto}</style>
</head>
<body><div class="jahiz-custom-page">${content}</div></body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "sandbox; default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src https: data:; connect-src 'none'; font-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'self'",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store, max-age=0",
      "Pragma": "no-cache",
      "X-Frame-Options": "SAMEORIGIN",
    },
  });
}
