/* Generátor protokolů – rozhraní: formulář podle šablony, kontrola úplnosti, náhled v úřední podobě,
   ukládání více protokolů (localStorage), export/import JSON, modelový případ ?pripad=17. */
(function () {
  'use strict';
  const J = window.PROTOKOL_JADRO;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // modelový případ má vlastní úložiště – uživatelovy protokoly se nepřepisují
  const MP = window.ModelovyPripad && ModelovyPripad.aktivni ? window.MODELOVY_PRIPAD : null;
  const KLIC = MP ? 'webapp_protocol_gen_pripad17' : 'webapp_protocol_gen';

  let data = { protokoly: [], aktivni: null };
  function nacti() {
    try { const d = JSON.parse(localStorage.getItem(KLIC) || 'null'); if (d && Array.isArray(d.protokoly)) data = d; } catch (e) { /* poškozená data = začít znovu */ }
    // stejná normalizace jako při importu (chybějící pole, osoby, věci); poškozené položky vypadnou
    try { data.protokoly = J.importuj(JSON.stringify(data.protokoly.filter(p => p && typeof p === 'object')), []); } catch (e) { data.protokoly = []; }
    if (!data.protokoly.length) data.protokoly.push(MP ? J.zModelovehoPripadu(MP) : J.novy('ohledani'));
    if (!data.protokoly.some(p => p.id === data.aktivni)) data.aktivni = data.protokoly[0].id;
  }
  let casovac = null;
  function uloz(hned) {
    clearTimeout(casovac);
    const f = () => { try { localStorage.setItem(KLIC, JSON.stringify(data)); } catch (e) { Dialog.chyba('Protokol se nepodařilo uložit: ' + e.message); } };
    if (hned) f(); else casovac = setTimeout(f, 400);
  }
  const akt = () => data.protokoly.find(p => p.id === data.aktivni);
  function zmeneno() { akt().upraveno = new Date().toISOString(); uloz(); obnov(); }

  /* ---------- formulář ---------- */
  function parPole(klic, id) {
    const n = J.nalezitosti(klic).find(x => x.pole === id);
    return n ? `<span class="par" title="${n.povinne ? 'povinná náležitost' : 'doporučeno'}">${esc(n.par)}${n.povinne ? ' *' : ''}</span>` : '';
  }
  function htmlPole(f, p) {
    const v = p.pole[f.id];
    const par = parPole(p.sablona, f.id);
    if (f.typ === 'check') return `<label class="zaskrt${f.pouceni ? ' pouceni' : ''}" data-pole="${f.id}"><input type="checkbox" data-f="${f.id}"${v ? ' checked' : ''}><span>${esc(f.label)}${par}</span></label>`;
    const ph = f.ph ? ` placeholder="${esc(f.ph)}"` : '';
    const vstup = f.typ === 'area'
      ? `<textarea data-f="${f.id}"${ph}${f.velke ? ' class="velke"' : ''}>${esc(v)}</textarea>`
      : `<input type="${f.typ}" data-f="${f.id}" value="${esc(v)}"${ph}>`;
    return `<label class="pole" data-pole="${f.id}"><span>${esc(f.label)}${par}</span>${vstup}</label>`;
  }
  function vykresliFormular() {
    const p = akt(), s = J.SABLONY[p.sablona];
    const sp = J.SPOLECNA_POLE;
    const kratka = sp.filter(f => ['datum', 'casOd', 'casDo'].includes(f.id));
    const pouceni = s.pole.filter(f => f.pouceni), ostatni = s.pole.filter(f => !f.pouceni);
    $('formular').innerHTML = `
      <div class="card"><h2>Základní údaje <span class="par">§ 55 TŘ</span></h2>
        ${htmlPole(sp.find(f => f.id === 'organ'), p)}${htmlPole(sp.find(f => f.id === 'cj'), p)}
        <div class="radek">${kratka.map(f => htmlPole(f, p)).join('')}</div>
        ${sp.filter(f => !['organ', 'cj', 'datum', 'casOd', 'casDo'].includes(f.id)).map(f => htmlPole(f, p)).join('')}
      </div>
      <div class="card"><h2>Zúčastněné osoby ${parPole(p.sablona, 'osoby')}<button class="btn mini" data-pridej="osoby">➕ Osoba</button></h2>
        <div class="seznam" data-pole="osoby" id="osoby"></div>
        <datalist id="role">${s.role.map(r => `<option value="${esc(r)}">`).join('')}</datalist>
      </div>
      <div class="card"><h2>${esc(s.nazev)} <span class="par">${esc(s.par)}</span></h2>
        <p class="popis">${esc(s.popis)}</p>
        ${pouceni.length ? `<h2 style="margin-top:10px">Poučení</h2>${pouceni.map(f => htmlPole(f, p)).join('')}` : ''}
        ${ostatni.map(f => htmlPole(f, p)).join('')}
      </div>
      ${s.veci ? `<div class="card"><h2>${esc(s.vecLabel)} ${parPole(p.sablona, 'veci')}<button class="btn mini" data-pridej="veci">➕ Věc</button></h2>
        <div class="seznam" data-pole="veci" id="veci"></div></div>` : ''}
      <div class="card"><h2>Závěr protokolu</h2>${htmlPole(J.ZAVER, p)}</div>`;
    vykresliSeznam('osoby'); if (s.veci) vykresliSeznam('veci');
    $('sablona').value = p.sablona;
    $('nazevProt').textContent = p.nazev;
    obnov();
  }
  const SLOUPCE = {
    osoby: [['jmeno', 'Jméno a příjmení'], ['role', 'Role v úkonu'], ['narozeni', 'Datum narození', 'date'], ['adresa', 'Bydliště']],
    veci: [['c', 'Č. stopy'], ['popis', 'Popis věci'], ['obal', 'Obal / pečeť'], ['misto', 'Místo nálezu / původ']]
  };
  function vykresliSeznam(co) {
    const p = akt();
    $(co).innerHTML = p[co].length ? p[co].map((x, i) => `<div class="polozka">${SLOUPCE[co].map(([k, n, t]) =>
      `<label>${n}<input type="${t || 'text'}" data-${co}="${i}" data-k="${k}" value="${esc(x[k])}"${k === 'role' ? ' list="role"' : ''}></label>`).join('')}
      <button class="btn mini danger" data-odeber="${co}" data-i="${i}" title="Odebrat" aria-label="Odebrat">✕</button></div>`).join('')
      : `<p class="prazdno">${co === 'osoby' ? 'Zatím žádná osoba – přidej vyslýchaného, sepisujícího, přibrané osoby…' : 'Zatím žádná věc.'}</p>`;
  }

  $('formular').addEventListener('input', e => {
    const t = e.target, p = akt();
    if (t.dataset.f) p.pole[t.dataset.f] = t.type === 'checkbox' ? t.checked : t.value;
    else if (t.dataset.osoby !== undefined) p.osoby[+t.dataset.osoby][t.dataset.k] = t.value;
    else if (t.dataset.veci !== undefined) p.veci[+t.dataset.veci][t.dataset.k] = t.value;
    else return;
    zmeneno();
  });
  $('formular').addEventListener('click', e => {
    const p = akt(), a = e.target.closest('[data-pridej]'), o = e.target.closest('[data-odeber]');
    if (a) {
      const co = a.dataset.pridej;
      p[co].push(co === 'osoby' ? { jmeno: '', role: '', narozeni: '', adresa: '' } : { c: String(p.veci.length + 1), popis: '', obal: '', misto: '' });
      vykresliSeznam(co); zmeneno();
      const posl = $(co).querySelectorAll('.polozka'); posl[posl.length - 1].querySelector('input').focus();
    } else if (o) { p[o.dataset.odeber].splice(+o.dataset.i, 1); vykresliSeznam(o.dataset.odeber); zmeneno(); }
  });

  /* ---------- kontrola úplnosti ---------- */
  function obnov() {
    const p = akt(), k = J.kontrola(p);
    document.querySelectorAll('#formular [data-pole]').forEach(el => {
      el.classList.toggle('chybi-povinne', k.pole[el.dataset.pole] === 'povinne');
      el.classList.toggle('chybi-doporucene', k.pole[el.dataset.pole] === 'doporucene');
    });
    const li = (n, kl) => `<li data-skoc="${n.pole}"><span>${kl}</span><span>${esc(n.text)} <span class="par">${esc(n.par)}</span></span></li>`;
    $('kontrola').innerHTML = `<h2>Kontrola úplnosti <span class="stav">${k.chybiPovinne.length ? '❌ neúplný' : '✅ povinné náležitosti splněny'}</span></h2>
      ${k.chybiPovinne.length ? `<p class="nadpis p">Chybí povinné (${k.chybiPovinne.length}):</p><ul>${k.chybiPovinne.map(n => li(n, '✗')).join('')}</ul>` : ''}
      ${k.chybiDoporucene.length ? `<p class="nadpis d">Doporučeno doplnit (${k.chybiDoporucene.length}):</p><ul>${k.chybiDoporucene.map(n => li(n, '!')).join('')}</ul>` : ''}
      ${!k.chybiPovinne.length && !k.chybiDoporucene.length ? '<p class="nadpis ok">Vše vyplněno.</p>' : ''}
      <details><summary>Splněno (${k.splneno.length})</summary><ul>${k.splneno.map(n => `<li><span>✓</span><span>${esc(n.text)} <span class="par">${esc(n.par)}</span></span></li>`).join('')}</ul></details>`;
    const o = $('odznak');
    o.textContent = k.chybiPovinne.length || '✓';
    o.classList.toggle('ok', !k.chybiPovinne.length);
    o.title = k.chybiPovinne.length ? 'Chybí povinné náležitosti: ' + k.chybiPovinne.length : 'Povinné náležitosti splněny';
    vykresliNahled(p, k);
  }
  $('kontrola').addEventListener('click', e => {
    const l = e.target.closest('[data-skoc]'); if (!l) return;
    const el = document.querySelector(`#formular [data-pole="${l.dataset.skoc}"]`); if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    const v = el.querySelector('input,textarea'); if (v) setTimeout(() => v.focus({ preventScroll: true }), 300);
  });

  /* ---------- náhled v úřední podobě (česky) ---------- */
  const datumCz = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${+m[3]}. ${+m[2]}. ${m[1]}` : (d || ''); };
  const kratky = l => l.replace(/\s*\(.*\)\s*$/, '');
  function vykresliNahled(p, k) {
    const s = J.SABLONY[p.sablona], P = p.pole;
    const chybi = new Set(k.chybiPovinne.map(n => n.pole));
    const h = (v, id) => String(v || '').trim() ? esc(v) : (chybi.has(id) ? '<span class="chybi">doplnit</span>' : '<span class="prazdne">—</span>');
    const cas = `${h(datumCz(P.datum), 'datum')}, zahájeno v ${h(P.casOd, 'casOd')} hod.${P.casDo ? `, ukončeno v ${esc(P.casDo)} hod.` : ''}`;
    const radky = s.pole.filter(f => f.typ === 'text' || f.typ === 'date');
    const oblasti = s.pole.filter(f => f.typ === 'area');
    const zaskrt = s.pole.filter(f => f.typ === 'check' && !f.pouceni && P[f.id]);
    const pouceni = s.pole.filter(f => f.pouceni);
    const tab = (hlav, radky) => `<table class="tab"><thead><tr>${hlav.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${radky}</tbody></table>`;
    const podpisy = p.osoby.filter(o => o.jmeno).map(o => `<div>${esc(o.jmeno)}<br>${esc(o.role)}</div>`);
    podpisy.push(`<div>${P.sepsal ? esc(P.sepsal) : '…'}<br>sepsal(a)</div>`);
    $('nahled').innerHTML = `
      <div class="hlava"><span>${h(P.organ, 'organ')}</span><span>Č. j.: ${P.cj ? esc(P.cj) : '…'}</span></div>
      ${MP ? '<div class="razitko-vzor">MODELOVÝ PŘÍPAD – FIKTIVNÍ ÚDAJE</div>' : ''}
      <h3>${esc(s.titul)}</h3>
      <div class="podtitul">sepsaný podle ${esc(s.par.replace(/ TŘ$/, ''))} zákona č. 141/1961 Sb., trestní řád</div>
      <table class="udaje"><tbody>
        <tr><td>Datum a čas úkonu:</td><td>${cas}</td></tr>
        <tr><td>Místo úkonu:</td><td>${h(P.misto, 'misto')}</td></tr>
        <tr><td>Předmět úkonu:</td><td>${h(P.predmet, 'predmet')}</td></tr>
        ${radky.map(f => `<tr><td>${esc(kratky(f.label))}:</td><td>${h(P[f.id], f.id)}</td></tr>`).join('')}
        ${zaskrt.map(f => `<tr><td colspan="2">☒ ${esc(f.label)}</td></tr>`).join('')}
      </tbody></table>
      <h4>Zúčastněné osoby</h4>
      ${p.osoby.length ? tab(['Jméno a příjmení', 'Role', 'Datum nar.', 'Bydliště'], p.osoby.map(o => `<tr><td>${esc(o.jmeno)}</td><td>${esc(o.role)}</td><td>${esc(datumCz(o.narozeni))}</td><td>${esc(o.adresa)}</td></tr>`).join('')) : '<p><span class="chybi">doplnit osoby</span></p>'}
      ${pouceni.length ? `<h4>Poučení</h4><ul class="pouc">${pouceni.map(f => P[f.id] ? `<li>${esc(f.label)}</li>` : `<li><span class="chybi">${chybi.has(f.id) ? 'poučení nevyznačeno' : 'nevyznačeno'}</span> – ${esc(f.label)}</li>`).join('')}</ul>` : ''}
      ${oblasti.map(f => `<h4>${esc(kratky(f.label))}</h4><div class="text">${h(P[f.id], f.id)}</div>`).join('')}
      ${s.veci ? `<h4>${esc(s.vecLabel)}</h4>${p.veci.length ? tab(['Č.', 'Popis', 'Obal / pečeť', 'Místo / původ'], p.veci.map(v => `<tr><td>${esc(v.c)}</td><td>${h(v.popis, 'veci')}</td><td>${esc(v.obal)}</td><td>${esc(v.misto)}</td></tr>`).join('')) : `<p>${h('', 'veci')}</p>`}` : ''}
      <h4>Závěr</h4><div class="text">${h(P.zaver, 'zaver')}</div>
      <div class="podpisy">${podpisy.join('')}</div>
      <div class="pata">Vytvořeno Generátorem protokolů (organizační pomůcka, ne úřední tiskopis). Náležitosti podle trestního řádu ověřeny k datu ${J.OVERENO} – ověř aktuální znění.${k.chybiPovinne.length ? ' Kontrola úplnosti: chybí povinné náležitosti (' + k.chybiPovinne.length + ').' : ''}</div>`;
  }

  /* ---------- příkazy ---------- */
  function stahni(nazev, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    a.download = nazev; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const souborNazev = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').slice(0, 60);
  function prepni(id) { data.aktivni = id; uloz(true); vykresliFormular(); }
  function vykresliSeznamProtokolu() {
    const s = data.protokoly.slice().sort((a, b) => String(b.upraveno).localeCompare(String(a.upraveno)));
    $('seznamTelo').innerHTML = s.map(p => {
      const n = J.kontrola(p).chybiPovinne.length;
      return `<div class="prot${p.id === data.aktivni ? ' aktivni' : ''}"><div class="info"><b>${esc(p.nazev)}</b>
        <small>${esc(J.SABLONY[p.sablona].nazev)} · ${esc(datumCz(p.pole.datum) || 'bez data')} · ${n ? '❌ chybí ' + n : '✅ úplný'}</small></div>
        <button class="btn mini primary" data-otevri="${esc(p.id)}">Otevřít</button>
        <button class="btn mini danger" data-smaz="${esc(p.id)}" aria-label="Smazat" title="Smazat">🗑️</button></div>`;
    }).join('') + `<p class="prazdno">${MP ? 'Režim modelového případu – protokoly se ukládají odděleně od vašich vlastních.' : 'Uloženo v tomto prohlížeči (' + data.protokoly.length + ').'}</p>`;
  }
  async function smaz(id) {
    const p = data.protokoly.find(x => x.id === id);
    if (!p || !(await Dialog.potvrd(`Smazat protokol „${p.nazev}“?`, { ok: 'Smazat' }))) return false;
    data.protokoly = data.protokoly.filter(x => x.id !== id);
    if (!data.protokoly.length) data.protokoly.push(MP ? J.zModelovehoPripadu(MP) : J.novy('ohledani'));
    if (data.aktivni === id) data.aktivni = data.protokoly[0].id;
    uloz(true); vykresliFormular(); return true;
  }
  const PRIKAZY = {
    kontrola() { $('kontrola').scrollIntoView({ block: 'start', behavior: 'smooth' }); },
    async tisk() {
      const k = J.kontrola(akt());
      if (k.chybiPovinne.length || k.chybiDoporucene.length) {
        const t = (k.chybiPovinne.length ? 'Chybí povinné náležitosti:\n' + k.chybiPovinne.map(n => '• ' + n.text + ' (' + n.par + ')').join('\n') + '\n\n' : '') +
          (k.chybiDoporucene.length ? 'Doporučeno doplnit:\n' + k.chybiDoporucene.map(n => '• ' + n.text + ' (' + n.par + ')').join('\n') + '\n\n' : '') + 'Tisknout přesto?';
        if (!(await Dialog.potvrd(t, { ok: 'Tisknout přesto', zrus: 'Zpět k úpravám' }))) return;
      }
      window.print();
    },
    seznam() { vykresliSeznamProtokolu(); $('dlgSeznam').showModal(); },
    async prejmenuj() {
      const n = await Dialog.zeptej('Název protokolu', akt().nazev);
      if (n && n.trim()) { akt().nazev = n.trim(); $('nazevProt').textContent = akt().nazev; zmeneno(); }
    },
    duplikuj() {
      const k = JSON.parse(JSON.stringify(akt()));
      k.id = J.novy(k.sablona).id; k.nazev += ' (kopie)'; k.upraveno = new Date().toISOString();
      data.protokoly.push(k); prepni(k.id); Dialog.info('Vytvořena kopie protokolu.');
    },
    async obnovModel() {
      if (!MP || !(await Dialog.potvrd('Obnovit modelový protokol o ohledání do původní podoby? Úpravy v něm se ztratí.', { ok: 'Obnovit' }))) return;
      const m = J.zModelovehoPripadu(MP);
      data.protokoly = data.protokoly.filter(x => x.id !== m.id); data.protokoly.unshift(m); prepni(m.id);
    },
    exportJeden() { stahni('protokol_' + souborNazev(akt().nazev) + '.json', J.exportuj([akt()])); },
    exportVse() { stahni('protokoly_' + new Date().toISOString().slice(0, 10) + '.json', J.exportuj(data.protokoly)); },
    import() { $('soubor').value = ''; $('soubor').click(); },
    smaz() { return smaz(data.aktivni); },
    napoveda() { $('dlgNapoveda').showModal(); },
    sablony() {
      $('sablonyTelo').innerHTML = `<p>Zdroj: zákon č. 141/1961 Sb., trestní řád. <b>Ověřeno k datu ${J.OVERENO}, ověř aktuální znění.</b> „Praxe“ označuje zvyklost, ne zákonnou náležitost. Kde není jistota o čísle odstavce, uvádí se jen paragraf.</p>` +
        Object.entries(J.SABLONY).map(([k, s]) => `<div class="sab"><b>${esc(s.nazev)}</b> <span class="par">${esc(s.par)}</span><p>${esc(s.popis)}</p><ul>${J.nalezitosti(k).map(n =>
          `<li>${n.povinne ? '<b>povinné</b>' : 'doporučené'}${n.kdy ? ' (podmíněně)' : ''}: ${esc(n.text)} <span class="par">${esc(n.par)}</span></li>`).join('')}</ul></div>`).join('');
      $('dlgSablony').showModal();
    }
  };

  $('soubor').addEventListener('change', async () => {
    const f = $('soubor').files[0]; if (!f) return;
    try {
      const nove = J.importuj(await f.text(), data.protokoly.map(p => p.id));
      if (!nove.length) return Dialog.chyba('Soubor neobsahuje žádný platný protokol.');
      data.protokoly.push(...nove); prepni(nove[0].id);
      Dialog.info('Načteno protokolů: ' + nove.length);
    } catch (e) { Dialog.chyba('Soubor nelze načíst: ' + e.message); }
  });
  $('seznamTelo').addEventListener('click', async e => {
    const o = e.target.closest('[data-otevri]'), s = e.target.closest('[data-smaz]');
    if (o) { $('dlgSeznam').close(); prepni(o.dataset.otevri); }
    else if (s && await smaz(s.dataset.smaz)) vykresliSeznamProtokolu();
  });
  document.querySelectorAll('dialog [data-zavri]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));

  // výběr šablony: nový protokol z nabídky, změna šablony aktuálního v rozbalovacím seznamu
  $('nabNovy').innerHTML = Object.entries(J.SABLONY).map(([k, s]) => `<button class="tl" data-novy="${k}">${esc(s.nazev)}<small>${esc(s.par)}</small></button>`).join('');
  $('sablona').innerHTML = Object.entries(J.SABLONY).map(([k, s]) => `<option value="${k}">${esc(s.nazev)}</option>`).join('');
  $('sablona').addEventListener('change', () => {
    const i = data.protokoly.findIndex(p => p.id === data.aktivni);
    data.protokoly[i] = J.zmenSablonu(data.protokoly[i], $('sablona').value);
    uloz(); vykresliFormular();
  });

  /* ---------- nabídky lišty ---------- */
  function zavriNabidky() {
    document.querySelectorAll('.nabidka:not([hidden])').forEach(n => { n.hidden = true; });
    document.querySelectorAll('[data-nabidka][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  }
  document.querySelectorAll('[data-nabidka]').forEach(b => b.addEventListener('click', e => {
    e.stopPropagation();
    const n = $(b.dataset.nabidka), bylo = !n.hidden;
    zavriNabidky();
    if (bylo) return;
    n.hidden = false; b.setAttribute('aria-expanded', 'true');
    const r = b.getBoundingClientRect();
    n.style.top = (r.bottom + 4) + 'px';
    n.style.left = Math.max(6, Math.min(r.left, innerWidth - n.offsetWidth - 6)) + 'px';
  }));
  document.addEventListener('click', e => {
    const p = e.target.closest('[data-prikaz]'), nv = e.target.closest('[data-novy]');
    if (p) { zavriNabidky(); return PRIKAZY[p.dataset.prikaz](); }
    if (nv) {
      zavriNabidky();
      const n = J.novy(nv.dataset.novy);
      const pred = akt();
      if (pred) { n.pole.organ = pred.pole.organ; n.pole.sepsal = pred.pole.sepsal; n.pole.cj = pred.pole.cj; }  // stejný spis a útvar
      data.protokoly.push(n); return prepni(n.id);
    }
    if (!e.target.closest('.nabidka')) zavriNabidky();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') zavriNabidky(); });

  if (window.parent === window) document.body.classList.add('samostatne');
  if (MP) $('miObnovModel').hidden = false;
  nacti();
  vykresliFormular();
  window.PROTOKOL_APP = { data: () => data, akt, PRIKAZY, KLIC, kontrola: () => J.kontrola(akt()) };
})();
