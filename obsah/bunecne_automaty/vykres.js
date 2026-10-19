/* ============================================================
   bunecne_automaty/vykres.js – vykreslení mřížky.
   WebGL: buňky jako textura LUMINANCE (1 bajt/buňka), paleta 256×1,
   posun a přiblížení řeší fragment shader (žádné kopírování po pixelech).
   Záloha Canvas 2D: ImageData W×H + drawImage bez vyhlazování.
   Rozměr plátna = CSS rozměr × devicePixelRatio.
   ============================================================ */
(function () {
'use strict';

const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }';
const FS = `precision highp float;
uniform sampler2D uBunky; uniform sampler2D uPaleta;
uniform vec2 uVel; uniform vec2 uPosun; uniform float uZoom; uniform float uVyska;
uniform vec4 uPozadi; uniform vec4 uMrizka; uniform float uMrizkaZap;
float stav(vec2 c){ return texture2D(uBunky, (floor(c) + 0.5) / uVel).r; }
void main(){
  vec2 p = vec2(gl_FragCoord.x, uVyska - gl_FragCoord.y);
  vec2 c = (p - uPosun) / uZoom;
  if (c.x < 0.0 || c.y < 0.0 || c.x >= uVel.x || c.y >= uVel.y) { gl_FragColor = uPozadi; return; }
  float s = stav(c);
  if (uZoom < 0.75) {
    // více buněk na pixel: vezmi nejvyšší stav ze 4 vzorků, ať drobné útvary nemizí
    float k = 0.5 / uZoom;
    s = max(s, stav(clamp(c + vec2(k, 0.0), vec2(0.0), uVel - 0.5)));
    s = max(s, stav(clamp(c + vec2(0.0, k), vec2(0.0), uVel - 0.5)));
    s = max(s, stav(clamp(c + vec2(k, k), vec2(0.0), uVel - 0.5)));
  }
  vec4 barva = texture2D(uPaleta, vec2((s * 255.0 + 0.5) / 256.0, 0.5));
  if (uMrizkaZap > 0.5 && uZoom >= 6.0) {
    vec2 f = fract(c) * uZoom;
    if (f.x < 1.0 || f.y < 1.0) barva = mix(barva, uMrizka, 0.55);
  }
  gl_FragColor = barva;
}`;

class Vykreslovac {
  constructor(platno, moznosti) {
    this.platno = platno;
    this.W = 0; this.H = 0; this.data = null;
    this.pohled = { ox: 0, oy: 0, zoom: 4 };
    this.mrizka = true;
    this.paleta = new Uint8Array(256 * 4);
    this.pozadi = [0, 0, 0]; this.barvaMrizky = [80, 80, 80];
    this.typ = '2d';
    if (!(moznosti && moznosti.jen2d)) {
      try { this.initGL(); } catch (e) { this.gl = null; this.duvod = e.message; }
    }
    if (!this.gl) this.init2d();
  }
  initGL() {
    const gl = this.platno.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL není k dispozici');
    const sh = (typ, zdroj) => {
      const s = gl.createShader(typ); gl.shaderSource(s, zdroj); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const tex = () => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    this.texBunky = tex(); this.texPaleta = tex();
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.u = {};
    for (const n of ['uBunky', 'uPaleta', 'uVel', 'uPosun', 'uZoom', 'uVyska', 'uPozadi', 'uMrizka', 'uMrizkaZap']) this.u[n] = gl.getUniformLocation(pr, n);
    gl.uniform1i(this.u.uBunky, 0); gl.uniform1i(this.u.uPaleta, 1);
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.gl = gl; this.typ = 'webgl';
    this.texW = 0; this.texH = 0;
  }
  init2d() {
    this.ctx = this.platno.getContext('2d');
    this.off = document.createElement('canvas');
    this.offCtx = this.off.getContext('2d');
    this.typ = '2d';
  }
  /** Lze tuto velikost mřížky vykreslit přes WebGL? */
  podporuje(W, H) { return !this.gl || (W <= this.maxTex && H <= this.maxTex); }
  nastavPaletu(barvy, pozadi, mrizka) {
    // barvy: pole [r,g,b] pro stavy 0..n-1; ostatní stavy dostanou poslední barvu
    for (let i = 0; i < 256; i++) {
      const b = barvy[Math.min(i, barvy.length - 1)];
      this.paleta.set([b[0], b[1], b[2], 255], i * 4);
    }
    this.pozadi = pozadi; this.barvaMrizky = mrizka;
    this.palU32 = new Uint32Array(this.paleta.buffer.slice(0));
    if (this.gl) {
      const gl = this.gl; gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texPaleta);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, this.paleta);
    }
    this.zmenaDat = true;
  }
  nastavData(data, W, H) {
    this.data = data;
    if (W !== this.W || H !== this.H) { this.W = W; this.H = H; this.novaVelikost = true; }
    this.zmenaDat = true;
  }
  prizpusobPlatno() {
    const dpr = window.devicePixelRatio || 1, r = this.platno.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (this.platno.width !== w || this.platno.height !== h) { this.platno.width = w; this.platno.height = h; }
    this.dpr = dpr; this.cssW = r.width; this.cssH = r.height;
  }
  kresli() {
    this.prizpusobPlatno();
    if (!this.data) return;
    if (this.gl) this.kresliGL(); else this.kresli2d();
  }
  kresliGL() {
    const gl = this.gl, { W, H, dpr } = this;
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.texBunky);
    if (this.zmenaDat) {
      if (this.novaVelikost || this.texW !== W || this.texH !== H) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, W, H, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.data);
        this.texW = W; this.texH = H; this.novaVelikost = false;
      } else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, W, H, gl.LUMINANCE, gl.UNSIGNED_BYTE, this.data);
      this.zmenaDat = false;
    }
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.texPaleta);
    gl.viewport(0, 0, this.platno.width, this.platno.height);
    const p = this.pohled, u = this.u, c = v => v / 255;
    gl.uniform2f(u.uVel, W, H);
    gl.uniform2f(u.uPosun, p.ox * dpr, p.oy * dpr);
    gl.uniform1f(u.uZoom, p.zoom * dpr);
    gl.uniform1f(u.uVyska, this.platno.height);
    gl.uniform4f(u.uPozadi, c(this.pozadi[0]), c(this.pozadi[1]), c(this.pozadi[2]), 1);
    gl.uniform4f(u.uMrizka, c(this.barvaMrizky[0]), c(this.barvaMrizky[1]), c(this.barvaMrizky[2]), 1);
    gl.uniform1f(u.uMrizkaZap, this.mrizka ? 1 : 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
  kresli2d() {
    const { W, H, dpr, ctx } = this, p = this.pohled;
    if (this.zmenaDat) {
      if (this.off.width !== W || this.off.height !== H || !this.img) {
        this.off.width = W; this.off.height = H;
        this.img = this.offCtx.createImageData(W, H);
        this.img32 = new Uint32Array(this.img.data.buffer);
      }
      const d = this.data, o = this.img32, pal = this.palU32;
      for (let i = 0; i < d.length; i++) o[i] = pal[d[i]];
      this.offCtx.putImageData(this.img, 0, 0);
      this.zmenaDat = false;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = 'rgb(' + this.pozadi.join(',') + ')';
    ctx.fillRect(0, 0, this.platno.width, this.platno.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.off, p.ox, p.oy, W * p.zoom, H * p.zoom);
    if (this.mrizka && p.zoom >= 6) {
      const x0 = Math.max(0, Math.floor(-p.ox / p.zoom)), x1 = Math.min(W, Math.ceil((this.cssW - p.ox) / p.zoom));
      const y0 = Math.max(0, Math.floor(-p.oy / p.zoom)), y1 = Math.min(H, Math.ceil((this.cssH - p.oy) / p.zoom));
      ctx.strokeStyle = 'rgba(' + this.barvaMrizky.join(',') + ',0.55)'; ctx.lineWidth = 1 / dpr;
      ctx.beginPath();
      for (let x = x0; x <= x1; x++) { const sx = p.ox + x * p.zoom; ctx.moveTo(sx, p.oy + y0 * p.zoom); ctx.lineTo(sx, p.oy + y1 * p.zoom); }
      for (let y = y0; y <= y1; y++) { const sy = p.oy + y * p.zoom; ctx.moveTo(p.ox + x0 * p.zoom, sy); ctx.lineTo(p.ox + x1 * p.zoom, sy); }
      ctx.stroke();
    }
  }
}

/** Vykreslí obraz w×h do nového canvasu (export PNG, náhledy vzorů). */
function obrazNaPlatno(data, w, h, barvy, meritko, mrizka, barvaMrizky) {
  const m = Math.max(1, meritko | 0);
  const c = document.createElement('canvas'); c.width = Math.max(1, w * m); c.height = Math.max(1, h * m);
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(c.width, c.height), o = new Uint32Array(img.data.buffer);
  const pal = new Uint32Array(256), tmp = new Uint8Array(4);
  for (let i = 0; i < 256; i++) { const b = barvy[Math.min(i, barvy.length - 1)]; tmp[0] = b[0]; tmp[1] = b[1]; tmp[2] = b[2]; tmp[3] = 255; pal[i] = new Uint32Array(tmp.buffer)[0]; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = pal[data[y * w + x]];
    for (let j = 0; j < m; j++) { const r = (y * m + j) * c.width + x * m; for (let i = 0; i < m; i++) o[r + i] = v; }
  }
  if (mrizka && m >= 4) {
    tmp.set([barvaMrizky[0], barvaMrizky[1], barvaMrizky[2], 255]); const g = new Uint32Array(tmp.buffer)[0];
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (x % m === 0 || y % m === 0) o[y * c.width + x] = g;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

window.BunecneVykres = { Vykreslovac, obrazNaPlatno };
})();
