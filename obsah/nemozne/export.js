/* Laboratoř nemožných tvarů – export sítě (STL, OBJ) a zesílení plochy pro 3D tisk. */
(function (N) {
  'use strict';

  /** Zesílení plochy na těleso tloušťky t: dvě vrstvy P ± (t/2)·n a stěny podél okrajů.
      Vrstvy se sešívají podle sešití původní sítě. Kde se na švu otáčí normála (Möbius, Klein),
      napojí se vrstva „+“ na vrstvu „−“, takže i neorientovatelná plocha dá uzavřené orientovatelné těleso
      (hranici svého tubulárního okolí). */
  N.zesil = function (sit, t) {
    const { poz, tri, svar } = sit, V = poz.length / 3;
    const nor = sit.nor || N.normalySten(sit);
    const P = new Float64Array(6 * V);
    for (let k = 0; k < V; k++) for (let q = 0; q < 3; q++) {
      P[3 * k + q] = poz[3 * k + q] + nor[3 * k + q] * t / 2;
      P[3 * (V + k) + q] = poz[3 * k + q] - nor[3 * k + q] * t / 2;
    }
    // sešití vrstev: zástupce k → r; při opačné normále se vrstvy prohodí
    const sv = new Int32Array(2 * V);
    for (let k = 0; k < V; k++) {
      const r = svar[k];
      const d = nor[3 * k] * nor[3 * r] + nor[3 * k + 1] * nor[3 * r + 1] + nor[3 * k + 2] * nor[3 * r + 2];
      if (d >= 0) { sv[k] = r; sv[V + k] = V + r; } else { sv[k] = V + r; sv[V + k] = r; }
    }
    // zástupci musí být kořeny (r je svým vlastním zástupcem, takže sv[r] = r) – zkontrolovat řetězení
    for (let k = 0; k < 2 * V; k++) { let x = k; for (let i = 0; i < 4 && sv[x] !== x; i++) x = sv[x]; sv[k] = x; }
    const T = [];
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c = tri[i + 2];
      T.push(a, b, c, V + a, V + c, V + b);
    }
    // stěny podél okrajů: okrajová hrana (a, b) sešité sítě, orientace podle trojúhelníku, který ji vlastní
    const top = N.topologie(sit);
    const okraj = new Set(top.okrajoveHrany);
    for (let i = 0; i < tri.length; i += 3) {
      for (let j = 0; j < 3; j++) {
        const a = tri[i + j], b = tri[i + (j + 1) % 3], sa = svar[a], sb = svar[b];
        if (sa === sb) continue;
        const klic = sa < sb ? sa * 4294967296 + sb : sb * 4294967296 + sa;
        if (!okraj.has(klic)) continue;
        // hrana a→b na vrstvě +, b→a na vrstvě −; stěna je čtyřúhelník a, V+a, V+b, b
        T.push(a, V + a, V + b, a, V + b, b);
      }
    }
    return { poz: P, tri: Uint32Array.from(T), svar: sv };
  };

  /** Trojúhelníky s konečnými souřadnicemi jako pole [ax, ay, az, bx, …] (9 čísel na trojúhelník). */
  function trojuhelniky(sit, m) {
    const { poz, tri } = sit, out = [];
    for (let i = 0; i < tri.length; i += 3) {
      const v = [];
      for (let k = 0; k < 3; k++) { const j = tri[i + k]; v.push(poz[3 * j] * m, poz[3 * j + 1] * m, poz[3 * j + 2] * m); }
      if (v.every(isFinite)) out.push(v);
    }
    return out;
  }

  N.stl = function (sit, m = 1, nazev = 'nemozne') {
    const T = trojuhelniky(sit, m);
    const buf = new ArrayBuffer(84 + 50 * T.length), dv = new DataView(buf);
    const hlava = ('Laborator nemoznych tvaru: ' + nazev).slice(0, 80);
    for (let i = 0; i < hlava.length; i++) dv.setUint8(i, hlava.charCodeAt(i) & 0x7f);
    dv.setUint32(80, T.length, true);
    let o = 84;
    for (const v of T) {
      const n = N.v.norm(N.v.cross([v[3] - v[0], v[4] - v[1], v[5] - v[2]], [v[6] - v[0], v[7] - v[1], v[8] - v[2]]));
      for (const x of n) { dv.setFloat32(o, x || 0, true); o += 4; }
      for (const x of v) { dv.setFloat32(o, x, true); o += 4; }
      o += 2;
    }
    return new Blob([buf], { type: 'model/stl' });
  };

  N.obj = function (sit, m = 1, nazev = 'nemozne') {
    // sdílené vrcholy podle sešití, aby soubor nesl i topologii
    const { poz, tri } = sit, svar = sit.svar || null;
    const idx = new Map(), radky = ['# Laboratoř nemožných tvarů – ' + nazev, 'o ' + nazev.replace(/\s+/g, '_')];
    let n = 0;
    const vrchol = j => {
      const r = svar ? svar[j] : j;
      let i = idx.get(r);
      if (i === undefined) { i = ++n; idx.set(r, i); radky.push(`v ${+(poz[3 * r] * m).toFixed(6)} ${+(poz[3 * r + 1] * m).toFixed(6)} ${+(poz[3 * r + 2] * m).toFixed(6)}`); }
      return i;
    };
    for (let i = 0; i < tri.length; i += 3) {
      const a = tri[i], b = tri[i + 1], c = tri[i + 2];
      if (![a, b, c].every(j => isFinite(poz[3 * j] + poz[3 * j + 1] + poz[3 * j + 2]))) continue;
      const va = vrchol(a), vb = vrchol(b), vc = vrchol(c);
      if (va === vb || vb === vc || va === vc) continue;
      radky.push(`f ${va} ${vb} ${vc}`);
    }
    return new Blob([radky.join('\n') + '\n'], { type: 'text/plain' });
  };

  N.stahni = function (blob, jmeno) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = jmeno;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  };
})(NEM);
