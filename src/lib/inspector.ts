import type { FileMap } from "@/agent/types";

/**
 * Inspector injected INTO the Sandpack preview iframe. It runs inside the generated app and talks
 * to Hivey Code over postMessage:
 *   parent → iframe : { source:"hivey-cmd", mode:"select"|"zone"|"off" }
 *   iframe → parent : { source:"hivey-inspector", type:"pick"|"zone"|"cancel", payload }
 *
 * "select" highlights the element under the cursor and reports it on click; "zone" lets the user
 * drag a rectangle and reports the elements inside it. Esc cancels. We inject this into a COPY of
 * index.html fed to Sandpack only — the user's real project files are never touched.
 */
export const INSPECTOR_JS = String.raw`
(function () {
  if (window.__hiveyInspector) return;
  window.__hiveyInspector = true;
  var mode = "off";

  var box = document.createElement("div");
  box.style.cssText = "position:fixed;pointer-events:none;z-index:2147483646;border:2px solid #8b5cf6;background:rgba(139,92,246,0.14);border-radius:4px;display:none";
  var tag = document.createElement("div");
  tag.style.cssText = "position:fixed;z-index:2147483647;background:#8b5cf6;color:#fff;font:11px/1.4 system-ui;padding:2px 6px;border-radius:4px;pointer-events:none;display:none;white-space:nowrap";
  function mount() { var r = document.documentElement; r.appendChild(box); r.appendChild(tag); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  function post(type, payload) { try { parent.postMessage({ source: "hivey-inspector", type: type, payload: payload }, "*"); } catch (e) {} }

  function cssPath(el) {
    if (!el || el.nodeType !== 1) return "";
    var parts = [];
    while (el && el.nodeType === 1 && parts.length < 6) {
      if (el.id) { parts.unshift("#" + el.id); break; }
      var sel = el.tagName.toLowerCase();
      var p = el.parentElement;
      if (p) {
        var same = Array.prototype.filter.call(p.children, function (c) { return c.tagName === el.tagName; });
        if (same.length > 1) sel += ":nth-of-type(" + (same.indexOf(el) + 1) + ")";
      }
      parts.unshift(sel);
      el = el.parentElement;
    }
    return parts.join(" > ");
  }

  function describe(el) {
    if (!el) return null;
    var r = el.getBoundingClientRect();
    return {
      tag: el.tagName.toLowerCase(),
      id: el.id || "",
      classes: (el.className && el.className.toString ? el.className.toString() : "").slice(0, 160),
      selector: cssPath(el),
      text: (el.innerText || "").trim().slice(0, 120),
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
    };
  }

  function highlight(el) {
    if (!el) { box.style.display = "none"; tag.style.display = "none"; return; }
    var r = el.getBoundingClientRect();
    box.style.display = "block";
    box.style.left = r.left + "px"; box.style.top = r.top + "px";
    box.style.width = r.width + "px"; box.style.height = r.height + "px";
    tag.style.display = "block";
    tag.textContent = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "");
    tag.style.left = r.left + "px";
    tag.style.top = Math.max(0, r.top - 20) + "px";
  }

  // ── select mode ──
  function onMove(e) { highlight(document.elementFromPoint(e.clientX, e.clientY)); }
  function onClick(e) {
    e.preventDefault(); e.stopPropagation();
    post("pick", describe(document.elementFromPoint(e.clientX, e.clientY)));
    setMode("off");
  }

  // ── zone mode (drag a rectangle) ──
  var start = null;
  function onDown(e) { start = { x: e.clientX, y: e.clientY }; }
  function onZoneMove(e) {
    if (!start) return;
    var x = Math.min(start.x, e.clientX), y = Math.min(start.y, e.clientY);
    var w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y);
    box.style.display = "block";
    box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = w + "px"; box.style.height = h + "px";
    tag.style.display = "none";
  }
  function onUp(e) {
    if (!start) return;
    var x = Math.min(start.x, e.clientX), y = Math.min(start.y, e.clientY);
    var w = Math.abs(e.clientX - start.x), h = Math.abs(e.clientY - start.y);
    var rect = { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) };
    var hits = [];
    Array.prototype.forEach.call(document.body.querySelectorAll("*"), function (el) {
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return;
      if (r.left >= x - 2 && r.top >= y - 2 && r.right <= x + w + 2 && r.bottom <= y + h + 2) hits.push(el);
    });
    // keep the outermost few (avoid every nested node)
    var outer = hits.filter(function (el) { return !hits.some(function (o) { return o !== el && o.contains(el); }); }).slice(0, 8);
    post("zone", { rect: rect, elements: outer.map(describe) });
    start = null;
    setMode("off");
  }

  function setMode(m) {
    document.removeEventListener("mousemove", onMove, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("mousedown", onDown, true);
    document.removeEventListener("mousemove", onZoneMove, true);
    document.removeEventListener("mouseup", onUp, true);
    box.style.display = "none"; tag.style.display = "none";
    document.body && (document.body.style.cursor = "");
    mode = m;
    if (m === "select") {
      document.addEventListener("mousemove", onMove, true);
      document.addEventListener("click", onClick, true);
      document.body && (document.body.style.cursor = "crosshair");
    } else if (m === "zone") {
      document.addEventListener("mousedown", onDown, true);
      document.addEventListener("mousemove", onZoneMove, true);
      document.addEventListener("mouseup", onUp, true);
      document.body && (document.body.style.cursor = "crosshair");
    }
  }

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (d && d.source === "hivey-cmd") setMode(d.mode);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && mode !== "off") { setMode("off"); post("cancel", {}); }
  }, true);
})();
`;

// Inject the inspector into a COPY of index.html (Sandpack-only). Real project files stay untouched.
export function injectInspector(files: FileMap): FileMap {
  const out: FileMap = { ...files };
  const key = Object.keys(out).find((k) => /(^|\/)index\.html$/.test(k));
  if (!key) return out; // no html entry → nothing to inject into
  const tagBlock = `<script>${INSPECTOR_JS}</script>`;
  if (out[key].includes("__hiveyInspector")) return out;
  out[key] = out[key].includes("</body>")
    ? out[key].replace("</body>", `${tagBlock}\n</body>`)
    : out[key] + tagBlock;
  return out;
}
