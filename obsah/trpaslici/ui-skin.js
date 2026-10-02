/* Srdce hory – převod emoji v pevném i dynamickém GUI na lokální obrázkové ikony. */
(function () {
  'use strict';
  const RE = /(?:[\u{1F000}-\u{1FAFF}]|[\u{2300}-\u{27FF}]|[\u{2B00}-\u{2BFF}])\uFE0F?/gu;
  const podporovane = new Set([
    '📅','🕐','🧔','🌸','☀','🍂','❄','⭐','🐫','⚔','🍖','🍺','⏸','🖐','⛏','⛰','🪓','🔨','🗺','✖','🔦','⬇','🎲','⚠','🧭','🔍','📦','📜','🔥','❓','⚙','🌾','⚒','🍄','🪨','🟫','⚫','🟥','🟧','⚪','🟡','💎','✨','🪵','🛏','🍽','🪑','🗿','🔩','🟠','🥈','🥇','💠','💍','🏆','🛡','🕸','🗡','🌟','🗝','🏮','📯','🪜','🚪','🚧','🪤','⛲','🧱','🪚','🍲','♨','🌋','✴','🤝','💾','📂','♾','🔊','🎵','🆘','🩹','✅','🌲','💧','💤','💀','🦇','🕷','👺','💥','🕯','🧰','🔒','🧹','🚩','❤','😐','🙂','☹','⌨','▶','★','✂','✔','🎥','🎨','👹','😀','😠','🙁','🟣','🪦','⬆',
    '🛗','🪣','📍','🔔','🎯','👥'
  ]);
  const cista = s => s.replace(/\uFE0F/g, '');
  const soubor = s => [...cista(s)].map(c => c.codePointAt(0).toString(16)).join('-');
  function obrazek(symbol) {
    const img = document.createElement('img');
    img.className = 'gicon';
    img.src = `trpaslici/assets/ui-icons/${soubor(symbol)}.png`;
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.width = img.height = 20;
    return img;
  }
  function upravText(node) {
    if (node.parentElement && node.parentElement.closest('select')) return;
    if (!node.nodeValue || !RE.test(node.nodeValue)) { RE.lastIndex = 0; return; }
    RE.lastIndex = 0;
    const text = node.nodeValue, frag = document.createDocumentFragment();
    let od = 0, zmena = false;
    for (const m of text.matchAll(RE)) {
      const k = cista(m[0]);
      if (!podporovane.has(k)) continue;
      if (m.index > od) frag.append(text.slice(od, m.index));
      frag.append(obrazek(m[0]));
      od = m.index + m[0].length; zmena = true;
    }
    if (!zmena) return;
    if (od < text.length) frag.append(text.slice(od));
    node.replaceWith(frag);
  }
  function uprav(root) {
    if (root.nodeType === Node.TEXT_NODE) { upravText(root); return; }
    if (root.nodeType !== Node.ELEMENT_NODE && root.nodeType !== Node.DOCUMENT_NODE) return;
    // v <option> se obrázek nevykreslí – emoji tam zůstanou textem
    if (root.nodeType === Node.ELEMENT_NODE && root.matches('script,style,textarea,select,option,.gicon')) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) { return n.parentElement && !n.parentElement.closest('script,style,textarea,select,.gicon') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
    });
    const nodes = []; while (walk.nextNode()) nodes.push(walk.currentNode);
    nodes.forEach(upravText);
  }
  function start() {
    uprav(document.body);
    new MutationObserver(zmeny => zmeny.forEach(z => {
      if (z.type === 'characterData') upravText(z.target);
      else z.addedNodes.forEach(uprav);
    })).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true }); else start();
})();
