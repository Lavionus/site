/* ============================================================
   podzemi_gl.js – vykreslování Nekonečného podzemí na grafické kartě
   (WebGL 2) v plném rozlišení okna. Používá ho styl „Teplý HD pixel art“;
   ostatní styly dál kreslí procesor do 512 × 384 / 256 × 192.

   Svět: mapa x → osa x, mapa y → osa z, výška h 0 (podlaha) – 1 (strop).
   Kamera stejná jako u raycasteru: vodorovný úhel záběru 90°, poměr 4 : 3.
   Vrchol = 12 čísel: x, h, z, u, v, vrstva, pole, úbytek, typ, parametr, násobek světla, bílá.
     typ 0 stěna/podlaha/strop (pole textur), 1 dveře/mříž (parametr = zdvih křídla),
     2 sprit, 3 stín pod spritem, 4 louč na zdi (přitažená ke kameře, aby ji nezakryla zeď),
     5 záře (měkké kolo přičtené k obrazu; vrstva = barva r·65536 + g·256 + b, parametr = síla)
   Textura: alfa 0 = průhledné, 200 = běžný texel, 255 = svítí sám.
   Světlo po pixelech: hráč (pochodeň / Slunce podzemí) + louče a svítící věci, které
   na pole dosvítí (seznam až 8 světel na pole v textuře uBunky).
   ============================================================ */
const PodzemiGL = (function () {
  'use strict';
  const MAXL = 128, VRCHOL = 12;

  const VS = `#version 300 es
  precision highp float;
  in vec3 aPos; in vec2 aUV; in float aLayer; in float aCell; in vec4 aF; in float aBila;
  uniform vec3 uEye; uniform vec2 uDir, uPl; uniform float uAspect;
  out vec3 vW; out vec2 vUV; flat out float vLayer; flat out int vCell; flat out vec4 vF; flat out float vBila;
  void main() {
    vec3 p = aPos;
    vec3 r = p - uEye;
    float zc = r.x * uDir.x + r.z * uDir.y;
    if (aF.y > 3.5) { float k = max(0.05, 1.0 - 0.25 / max(zc, 0.1)); r *= k; zc *= k; }   // louč: blíž ke kameře, stejný paprsek
    float xc = r.x * uPl.x + r.z * uPl.y;
    const float n = 0.04, f = 40.0;
    gl_Position = vec4(xc, r.y / uAspect, zc * (f + n) / (f - n) - 2.0 * f * n / (f - n), zc);
    vW = aPos; vUV = aUV; vLayer = aLayer; vCell = int(aCell + 0.5); vF = aF; vBila = aBila;
  }`;

  const FS = `#version 300 es
  precision highp float; precision highp int;
  precision highp sampler2DArray; precision highp usampler2D;
  in vec3 vW; in vec2 vUV; flat in float vLayer; flat in int vCell; flat in vec4 vF; flat in float vBila;
  uniform sampler2DArray uTex, uSpr; uniform usampler2D uBunky;
  uniform vec4 uL[${MAXL}];
  uniform vec2 uKam; uniform float uSvHrace, uDosvit, uVyskaLouce, uUrovni; uniform vec3 uTon; uniform int uMapW;
  uniform vec2 uRozmer; uniform float uTeple;
  uniform vec3 uDyn; uniform float uCas, uAnim;          // světlo letícího kouzla (x, z, síla); čas; 1 láva, 2 voda
  out vec4 frag;
  float svetlo(vec3 w, int cell) {
    vec2 h = w.xz - uKam;
    float s = uSvHrace / (1.0 + uDosvit * dot(h, h));
    if (cell >= 0) {
      ivec2 b = ivec2((cell % uMapW) * 2, cell / uMapW);
      uvec4 a = texelFetch(uBunky, b, 0), c = texelFetch(uBunky, b + ivec2(1, 0), 0);
      uint id[8] = uint[8](a.x, a.y, a.z, a.w, c.x, c.y, c.z, c.w);
      float v = 0.5 - w.y;
      for (int i = 0; i < 8; i++) {
        if (id[i] == 0u) break;
        vec4 l = uL[int(id[i]) - 1];
        vec2 d = w.xz - l.xy; float dv = v - uVyskaLouce;
        s += l.z * 1.15 / (1.0 + 0.55 * (dot(d, d) + dv * dv));
      }
    }
    if (uDyn.z > 0.0) { vec2 dd = w.xz - uDyn.xy; float dv = w.y - 0.42; s += uDyn.z / (1.0 + 1.1 * (dot(dd, dd) + dv * dv)); }
    return s;
  }
  void main() {
    float typ = vF.y;
    if (typ > 2.5 && typ < 3.5) {                          // stín pod potvorou: tmavá elipsa na podlaze
      float d = length(vUV * 2.0 - 1.0);
      if (d > 1.0) discard;
      frag = vec4(0.0, 0.0, 0.0, 0.55 * vF.w * (1.0 - d * d));
      return;
    }
    if (typ > 4.5) {                                       // záře kolem ohně a svítících věcí (sčítá se)
      float d = length(vUV * 2.0 - 1.0);
      if (d > 1.0) discard;
      float L = vLayer;
      vec3 bar = vec3(floor(L / 65536.0), mod(floor(L / 256.0), 256.0), mod(L, 256.0)) / 255.0;
      float a = vF.z * pow(1.0 - d, 2.4);
      frag = vec4(bar * a, 1.0);
      return;
    }
    vec2 uv = vUV;
    if (typ > 0.5 && typ < 1.5 && vF.z > 0.0) {            // dveře: křídlo vyjíždí do stropu, zárubeň zůstává
      bool zarubne = uv.x < 3.0 / 32.0 || uv.x > 28.0 / 32.0 || uv.y < 0.06;
      if (!zarubne) { uv.y += vF.z * 0.9; if (uv.y >= 1.0) discard; }
    }
    vec4 t = (typ > 1.5) ? texture(uSpr, vec3(uv, vLayer)) : texture(uTex, vec3(uv, vLayer));
    if (t.a < 0.3) discard;
    if (vBila > 0.5) { frag = vec4(1.0); return; }
    vec3 c;
    if (t.a > 0.9) {                                       // svítí samo (plamen, oči, runy); láva pulzuje
      c = t.rgb * 1.08;
      if (uAnim > 0.5 && uAnim < 1.5 && typ < 0.5) c *= 0.82 + 0.3 * sin(uCas * 1.7 + vW.x * 2.3 + vW.z * 1.9 + sin(uCas * 0.7 + vW.x));
    }
    else {
      float s = svetlo(vW, vCell) * vF.w;
      float k = clamp(s - vF.x / (uUrovni - 1.0), 0.0, 1.0);
      c = min(t.rgb * k * uTon, vec3(1.0));
      if (uAnim > 1.5 && typ < 0.5 && vW.y < 0.01) {      // zatopené jeskyně: na podlaze se třpytí odlesky vody
        float v = sin(vW.x * 9.0 + uCas * 1.3) * sin(vW.z * 8.0 - uCas * 1.1) + sin((vW.x + vW.z) * 5.0 + uCas * 0.8);
        c *= 1.0 + 0.09 * v * k;
      }
    }
    if (uTeple > 0.5) {                                    // teplý styl: měkká křivka, hnědé stíny, viněta
      c = pow(c, vec3(1.2)) * 1.02;
      float jas = dot(c, vec3(0.3, 0.59, 0.11)), stin = 1.0 - jas;
      c += vec3(9.0, 3.0, -6.0) / 255.0 * stin;
      vec2 p = gl_FragCoord.xy / uRozmer * 2.0 - 1.0;
      c *= max(0.25, 1.0 - 0.42 * pow(dot(p, p) / 2.0, 1.2));
    }
    frag = vec4(clamp(c, 0.0, 1.0), 1.0);
  }`;

  function vytvor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: true, alpha: false, depth: true });
    if (!gl) return null;
    const sh = (typ, zdroj) => {
      const s = gl.createShader(typ); gl.shaderSource(s, zdroj); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    let prog;
    try {
      prog = gl.createProgram();
      gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    } catch (e) { console.warn('PodzemiGL:', e.message); return null; }
    gl.useProgram(prog);
    const U = n => gl.getUniformLocation(prog, n);
    const u = {}; for (const n of ['uEye', 'uDir', 'uPl', 'uAspect', 'uTex', 'uSpr', 'uBunky', 'uL', 'uKam', 'uSvHrace', 'uDosvit', 'uVyskaLouce', 'uUrovni', 'uTon', 'uMapW', 'uRozmer', 'uTeple', 'uDyn', 'uCas', 'uAnim']) u[n] = U(n);
    gl.uniform1i(u.uTex, 0); gl.uniform1i(u.uSpr, 1); gl.uniform1i(u.uBunky, 2);

    // dvě sady vrcholů: statická (patro) a dynamická (potvory, dveře, louče) – stejný formát
    const vao = (buf) => {
      const v = gl.createVertexArray(); gl.bindVertexArray(v); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      const st = VRCHOL * 4, a = (jm, n, off) => { const l = gl.getAttribLocation(prog, jm); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, n, gl.FLOAT, false, st, off * 4); };
      a('aPos', 3, 0); a('aUV', 2, 3); a('aLayer', 1, 5); a('aCell', 1, 6); a('aF', 4, 7); a('aBila', 1, 11);
      gl.bindVertexArray(null);
      return v;
    };
    const bufS = gl.createBuffer(), bufD = gl.createBuffer(), vaoS = vao(bufS), vaoD = vao(bufD);
    let nS = 0;

    // pole textur: plochy (TS × TS) a sprity (256 × 256, menší se zvětší bez vyhlazení)
    const texT = gl.createTexture(), texS = gl.createTexture(), texB = gl.createTexture();
    const SPR = 256, MAXS = 160;
    let vrstvyT = new Map(), vrstvyS = new Map(), TSg = 0;
    const nastavFiltr = (cil) => {
      gl.texParameteri(cil, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(cil, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(cil, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(cil, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    // t = { c: [[r,g,b]|null], svit, n? } → RGBA8 n × n (případně zvětšené na cil)
    function rgba(t, n, cil) {
      const d = new Uint8Array(cil * cil * 4), k = n / cil;
      for (let y = 0; y < cil; y++) for (let x = 0; x < cil; x++) {
        const i = ((y * k) | 0) * n + ((x * k) | 0), c = t.c[i], j = (y * cil + x) * 4;
        if (!c) continue;
        d[j] = c[0]; d[j + 1] = c[1]; d[j + 2] = c[2]; d[j + 3] = t.svit[i] ? 255 : 200;
      }
      return d;
    }
    function nastavTextury(seznam, TS) {            // seznam: [[klic, t], …]
      TSg = TS; vrstvyT = new Map();
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texT);
      gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, TS, TS, seznam.length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      seznam.forEach(([k, t], i) => {
        gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, TS, TS, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba(t, t.n || TS, TS));
        vrstvyT.set(k, i);
      });
      nastavFiltr(gl.TEXTURE_2D_ARRAY);
      // zdálky mipmapy (jemná textura by se jinak třpytila), zblízka ostré pixely
      gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
      gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
    }
    let sprPripraven = false;
    function vrstvaSpritu(klic, t) {
      let i = vrstvyS.get(klic);
      if (i !== undefined) return i;
      if (!sprPripraven) {
        gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texS);
        gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, SPR, SPR, MAXS, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        nastavFiltr(gl.TEXTURE_2D_ARRAY); sprPripraven = true;
      }
      i = vrstvyS.size;
      if (i >= MAXS) return 0;
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texS);
      const px = t.gl && t.glN === SPR ? t.gl : rgba(t, t.n || Math.round(Math.sqrt(t.c.length)), SPR);   // hotové pixely 256 px, nebo zvětšit
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, SPR, SPR, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      vrstvyS.set(klic, i);
      return i;
    }
    function nastavPatro(vrcholy) {
      gl.bindBuffer(gl.ARRAY_BUFFER, bufS); gl.bufferData(gl.ARRAY_BUFFER, vrcholy, gl.STATIC_DRAW);
      nS = vrcholy.length / VRCHOL;
    }
    // světla: lights [[x, z, síla]], bunky = pole seznamů indexů světel (SV.bunky), w × h
    function nastavSvetla(svetla, bunky, w, h) {
      const d = new Uint8Array(w * 2 * h * 4);
      for (let i = 0; i < w * h; i++) {
        const s = bunky[i]; if (!s) continue;
        const x = i % w, y = (i / w) | 0;
        for (let k = 0; k < Math.min(8, s.length); k++) if (s[k] < 255 && s[k] < MAXL) d[(y * w * 2 + x * 2 + (k >> 2)) * 4 + (k & 3)] = s[k] + 1;
      }
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texB);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8UI, w * 2, h, 0, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE, d);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.uniform1i(u.uMapW, w);
      aktualizujSvetla(svetla);
    }
    const Lbuf = new Float32Array(MAXL * 4);
    function aktualizujSvetla(svetla) {
      Lbuf.fill(0);
      for (let i = 0; i < Math.min(MAXL, svetla.length); i++) { Lbuf[i * 4] = svetla[i][0]; Lbuf[i * 4 + 1] = svetla[i][1]; Lbuf[i * 4 + 2] = svetla[i][2]; }
      gl.uniform4fv(u.uL, Lbuf);
    }
    // jeden snímek: kamera, světlo hráče, dynamické vrcholy (neprůhledné) a stíny (průhledné)
    function kresli(o, dyn, stiny, zare) {
      const W = canvas.width, H = canvas.height;
      gl.viewport(0, 0, W, H);
      gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE); gl.disable(gl.BLEND); gl.depthMask(true);
      gl.useProgram(prog);
      gl.uniform3f(u.uEye, o.x, o.h, o.z); gl.uniform2f(u.uDir, o.dirX, o.dirY); gl.uniform2f(u.uPl, o.plX, o.plY);
      gl.uniform1f(u.uAspect, 0.75); gl.uniform2f(u.uKam, o.x, o.z);
      gl.uniform1f(u.uSvHrace, o.svHrace); gl.uniform1f(u.uDosvit, o.dosvit); gl.uniform1f(u.uVyskaLouce, o.vyskaLouce);
      gl.uniform1f(u.uUrovni, o.urovni); gl.uniform3f(u.uTon, o.ton[0], o.ton[1], o.ton[2]);
      gl.uniform2f(u.uRozmer, W, H); gl.uniform1f(u.uTeple, o.teple ? 1 : 0);
      gl.uniform3f(u.uDyn, o.dynSvetlo ? o.dynSvetlo[0] : 0, o.dynSvetlo ? o.dynSvetlo[1] : 0, o.dynSvetlo ? o.dynSvetlo[2] : 0);
      gl.uniform1f(u.uCas, (o.cas || 0) % 1000); gl.uniform1f(u.uAnim, o.anim || 0);
      if (o.svetla) aktualizujSvetla(o.svetla);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texT);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D_ARRAY, texS);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, texB);
      if (nS) { gl.bindVertexArray(vaoS); gl.drawArrays(gl.TRIANGLES, 0, nS); }
      if (dyn && dyn.length) {
        gl.bindVertexArray(vaoD); gl.bindBuffer(gl.ARRAY_BUFFER, bufD); gl.bufferData(gl.ARRAY_BUFFER, dyn, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, dyn.length / VRCHOL);
      }
      if (stiny && stiny.length) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
        gl.bindVertexArray(vaoD); gl.bindBuffer(gl.ARRAY_BUFFER, bufD); gl.bufferData(gl.ARRAY_BUFFER, stiny, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, stiny.length / VRCHOL);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      if (zare && zare.length) {
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.depthMask(false);
        gl.bindVertexArray(vaoD); gl.bindBuffer(gl.ARRAY_BUFFER, bufD); gl.bufferData(gl.ARRAY_BUFFER, zare, gl.DYNAMIC_DRAW);
        gl.drawArrays(gl.TRIANGLES, 0, zare.length / VRCHOL);
        gl.depthMask(true); gl.disable(gl.BLEND);
      }
      gl.bindVertexArray(null);
    }
    return { gl, nastavTextury, vrstvaT: k => vrstvyT.get(k), vrstvaSpritu, nastavPatro, nastavSvetla, kresli, VRCHOL, cekej: () => gl.finish() };
  }

  // pomůcka: zapíše čtyřúhelník (dva trojúhelníky) z rohů a,b,c,d (proti směru, a = levý horní)
  function ctyruhelnik(out, a, b, c, d, layer, cell, ubytek, typ, param, mul, bila, flipU) {
    const uv = flipU ? [[1, 0], [0, 0], [0, 1], [1, 1]] : [[0, 0], [1, 0], [1, 1], [0, 1]];
    const P = [a, b, c, d];
    for (const i of [0, 1, 2, 0, 2, 3]) out.push(P[i][0], P[i][1], P[i][2], uv[i][0], uv[i][1], layer, cell, ubytek, typ, param, mul, bila);
  }
  return { vytvor, ctyruhelnik, VRCHOL };
})();
