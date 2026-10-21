/* Laboratoř nemožných tvarů – 3D pohled (three.js 0.160, globální THREE).
   Osa z míří nahoru. Plocha se kreslí dvěma sítěmi: líc (FrontSide) a rub (BackSide)
   s vlastními barvami, aby šlo ukázat, že některé plochy mají jen jednu stranu. */
(function (N) {
  'use strict';
  const T = THREE;

  function Pohled(platno) {
    this.platno = platno;
    this.r = new T.WebGLRenderer({ canvas: platno, antialias: true, preserveDrawingBuffer: true, alpha: true });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.r.localClippingEnabled = true;
    this.scena = new T.Scene();
    this.persp = new T.PerspectiveCamera(35, 1, 0.01, 1000);
    this.orto = new T.OrthographicCamera(-1, 1, 1, -1, -1000, 1000);
    for (const k of [this.persp, this.orto]) k.up.set(0, 0, 1);
    this.ortograficka = false;
    this.az = -0.6; this.el = 0.45; this.vzd = 12; this.cil = new T.Vector3();
    this.scena.add(new T.HemisphereLight(0xffffff, 0x445566, 1.1));
    this.svetlo = new T.DirectionalLight(0xffffff, 1.6);
    this.svetlo2 = new T.DirectionalLight(0xffffff, 0.5);
    this.scena.add(this.svetlo, this.svetlo2, this.svetlo.target, this.svetlo2.target);
    this.skupina = new T.Group();
    this.scena.add(this.skupina);
    this.rez = new T.Plane(new T.Vector3(0, 0, -1), 1e9);
    this.vrstvy = {};          // pojmenované čáry a pomocné objekty
    this.anim = null;
    this.ovladani();
    this.velikost();
    new ResizeObserver(() => this.velikost()).observe(platno.parentElement);
  }
  N.Pohled = Pohled;

  Pohled.prototype.kamera = function () { return this.ortograficka ? this.orto : this.persp; };

  Pohled.prototype.velikost = function () {
    const el = this.platno.parentElement;
    const w = Math.max(1, el.clientWidth), h = Math.max(1, el.clientHeight);
    this.w = w; this.h = h;
    this.r.setSize(w, h, false);
    this.aktualizujKameru();
  };

  Pohled.prototype.aktualizujKameru = function () {
    this.el = Math.max(-1.5697, Math.min(1.5697, this.el));
    const s = new T.Vector3(Math.cos(this.el) * Math.sin(this.az), -Math.cos(this.el) * Math.cos(this.az), Math.sin(this.el));
    const pom = this.w / this.h;
    const p = this.persp;
    p.aspect = pom;
    p.near = this.vzd / 100; p.far = this.vzd * 100;
    p.position.copy(s).multiplyScalar(this.vzd).add(this.cil);
    p.lookAt(this.cil); p.updateProjectionMatrix();
    const h = this.vzd * Math.tan(p.fov * Math.PI / 360);
    const o = this.orto;
    o.left = -h * pom; o.right = h * pom; o.top = h; o.bottom = -h;
    o.near = -this.vzd * 50; o.far = this.vzd * 50;
    o.position.copy(s).multiplyScalar(this.vzd).add(this.cil);
    o.lookAt(this.cil); o.updateProjectionMatrix();
    // světla svítí od kamery (zleva shora), aby byl tvar čitelný z každého směru
    const k = this.kamera();
    const vpravo = new T.Vector3().setFromMatrixColumn(k.matrixWorld, 0);
    const nahoru = new T.Vector3().setFromMatrixColumn(k.matrixWorld, 1);
    this.svetlo.position.copy(k.position).addScaledVector(vpravo, -this.vzd * 0.6).addScaledVector(nahoru, this.vzd * 0.8);
    this.svetlo.target.position.copy(this.cil);
    this.svetlo2.position.copy(this.cil).sub(k.position).add(this.cil);
    this.svetlo2.target.position.copy(this.cil);
    this.vykresli();
  };

  Pohled.prototype.vykresli = function () {
    if (this._ceka) return;
    this._ceka = true;
    requestAnimationFrame(() => {
      this._ceka = false;
      const ted = performance.now();
      if (this.anim) this.krokAnimace(ted);
      for (const f of this.prekresleni || []) f(ted);
      this.r.render(this.scena, this.kamera());
      if (this.anim || (this.prekresleni && this.prekresleni.length)) this.vykresli();
    });
  };

  /** Funkce volaná každý snímek, dokud vrací true. */
  Pohled.prototype.prubezne = function (f) {
    this.prekresleni = this.prekresleni || [];
    const obal = t => { if (!f(t)) this.prekresleni = this.prekresleni.filter(x => x !== obal); };
    this.prekresleni.push(obal);
    this.vykresli();
  };

  /* ---------- ovládání myší a dotykem ---------- */
  Pohled.prototype.ovladani = function () {
    const c = this.platno, ukaz = new Map();
    let posledni = null, pinch = null, posunuto = 0;
    c.addEventListener('contextmenu', e => e.preventDefault());
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      ukaz.set(e.pointerId, { x: e.clientX, y: e.clientY, tl: e.button, shift: e.shiftKey });
      posunuto = 0;
      this.anim = null;
    });
    c.addEventListener('pointermove', e => {
      const p = ukaz.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      posunuto += Math.abs(dx) + Math.abs(dy);
      p.x = e.clientX; p.y = e.clientY;
      if (ukaz.size === 2) {
        const [a, b] = [...ukaz.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), sx = (a.x + b.x) / 2, sy = (a.y + b.y) / 2;
        if (pinch) {
          this.vzd *= pinch.d / Math.max(1, d);
          this.posun(sx - pinch.sx, sy - pinch.sy);
        }
        pinch = { d, sx, sy };
        this.aktualizujKameru();
        return;
      }
      if (p.tl === 2 || p.tl === 1 || p.shift) this.posun(dx, dy);
      else { this.az -= dx * 0.008; this.el += dy * 0.008; }
      this.aktualizujKameru();
    });
    const konec = e => {
      const p = ukaz.get(e.pointerId);
      ukaz.delete(e.pointerId);
      if (ukaz.size < 2) pinch = null;
      if (p && posunuto < 4 && e.type === 'pointerup' && this.naKlik) {
        const r = c.getBoundingClientRect();
        this.naKlik(this.trefa(e.clientX - r.left, e.clientY - r.top));
      }
    };
    c.addEventListener('pointerup', konec);
    c.addEventListener('pointercancel', konec);
    c.addEventListener('wheel', e => {
      e.preventDefault();
      this.anim = null;
      this.vzd *= Math.exp(e.deltaY * 0.0012);
      this.aktualizujKameru();
    }, { passive: false });
    c.addEventListener('dblclick', () => this.prizpusob(true));
  };

  Pohled.prototype.posun = function (dx, dy) {
    const k = this.kamera();
    const naPixel = 2 * this.vzd * Math.tan(this.persp.fov * Math.PI / 360) / this.h;
    const vpravo = new T.Vector3().setFromMatrixColumn(k.matrixWorld, 0);
    const nahoru = new T.Vector3().setFromMatrixColumn(k.matrixWorld, 1);
    this.cil.addScaledVector(vpravo, -dx * naPixel).addScaledVector(nahoru, dy * naPixel);
  };

  /** Index trojúhelníku (v síti objektu) pod pixelem, nebo null. */
  Pohled.prototype.trefa = function (x, y) {
    if (!this.lic) return null;
    const rc = new T.Raycaster();
    rc.setFromCamera(new T.Vector2(x / this.w * 2 - 1, -y / this.h * 2 + 1), this.kamera());
    const h = rc.intersectObjects([this.lic, this.rub], false).filter(h => !this.rezAktivni || this.rez.distanceToPoint(h.point) >= 0)[0];
    return h ? { tri: h.faceIndex, rub: h.object === this.rub, bod: h.point } : null;
  };

  /* ---------- kamera: přizpůsobení a animace ---------- */
  Pohled.prototype.prizpusob = function (animovat) {
    if (!this.obal) return;
    const cil = { cil: new T.Vector3(...this.obal.stred), vzd: this.obal.r / Math.sin(this.persp.fov * Math.PI / 360) * 1.08 * Math.max(1, this.h / this.w) };
    if (animovat) this.animujNa(cil); else { this.cil.copy(cil.cil); this.vzd = cil.vzd; this.aktualizujKameru(); }
  };

  Pohled.prototype.animujNa = function (k, ms = 900) {
    const roz = (a, b) => { let d = (b - a) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d; };
    this.anim = {
      t0: performance.now(), ms,
      z: { az: this.az, el: this.el, vzd: this.vzd, cil: this.cil.clone() },
      k: { az: k.az != null ? this.az + roz(this.az, k.az) : this.az, el: k.el != null ? k.el : this.el,
           vzd: k.vzd != null ? k.vzd : this.vzd, cil: k.cil ? k.cil.clone() : this.cil.clone() },
      hotovo: k.hotovo,
    };
    this.vykresli();
  };

  Pohled.prototype.krokAnimace = function (ted) {
    const a = this.anim;
    const t = Math.min(1, (ted - a.t0) / a.ms), s = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    this.az = a.z.az + (a.k.az - a.z.az) * s;
    this.el = a.z.el + (a.k.el - a.z.el) * s;
    this.vzd = a.z.vzd * Math.pow(a.k.vzd / a.z.vzd, s);
    this.cil.lerpVectors(a.z.cil, a.k.cil, s);
    if (t >= 1) { this.anim = null; if (a.hotovo) a.hotovo(); }
    this.aktualizujKameruBezKresleni();
  };

  Pohled.prototype.aktualizujKameruBezKresleni = function () {
    const puv = this.vykresli; this.vykresli = () => {};
    this.aktualizujKameru();
    this.vykresli = puv;
  };

  /* ---------- obsah ---------- */

  /** Zobrazí síť. Vytvoří neindexovanou geometrii (každý trojúhelník vlastní vrcholy),
      aby šlo barvit líc a rub po trojúhelnících. */
  Pohled.prototype.zobraz = function (sit, volby = {}) {
    this.vycisti();
    const { poz, tri } = sit, F = tri.length / 3;
    const P = new Float32Array(9 * F), Nn = new Float32Array(9 * F);
    for (let t = 0; t < F; t++) {
      const ia = tri[3 * t], ib = tri[3 * t + 1], ic = tri[3 * t + 2];
      const ax = poz[3 * ia], ay = poz[3 * ia + 1], az = poz[3 * ia + 2];
      const ux = poz[3 * ib] - ax, uy = poz[3 * ib + 1] - ay, uz = poz[3 * ib + 2] - az;
      const vx = poz[3 * ic] - ax, vy = poz[3 * ic + 1] - ay, vz = poz[3 * ic + 2] - az;
      let fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      const fl = Math.hypot(fx, fy, fz) || 1; fx /= fl; fy /= fl; fz /= fl;
      for (let k = 0; k < 3; k++) {
        const i = tri[3 * t + k], o = 9 * t + 3 * k;
        P[o] = poz[3 * i]; P[o + 1] = poz[3 * i + 1]; P[o + 2] = poz[3 * i + 2];
        if (sit.nor && !volby.ploche) {
          let nx = sit.nor[3 * i], ny = sit.nor[3 * i + 1], nz = sit.nor[3 * i + 2];
          // normála rohu musí souhlasit s vinutím trojúhelníku (u Möbia se na švu otáčí)
          const d = nx * fx + ny * fy + nz * fz;
          if (d < 0) { nx = -nx; ny = -ny; nz = -nz; }
          // u ostrých hran (normály rohů se liší od roviny trojúhelníku) plochá normála – jinak stínování „zubatí“
          if (Math.abs(d) < (sit.ostreHrany ? 0.97 : 0.2)) { nx = fx; ny = fy; nz = fz; }
          Nn[o] = nx; Nn[o + 1] = ny; Nn[o + 2] = nz;
        } else { Nn[o] = fx; Nn[o + 1] = fy; Nn[o + 2] = fz; }
      }
    }
    const aP = new T.BufferAttribute(P, 3), aN = new T.BufferAttribute(Nn, 3);
    this.barvaLic = new T.BufferAttribute(new Float32Array(9 * F), 3);
    this.barvaRub = new T.BufferAttribute(new Float32Array(9 * F), 3);
    const gL = new T.BufferGeometry(), gR = new T.BufferGeometry();
    gL.setAttribute('position', aP); gL.setAttribute('normal', aN); gL.setAttribute('color', this.barvaLic);
    gR.setAttribute('position', aP); gR.setAttribute('normal', aN); gR.setAttribute('color', this.barvaRub);
    const mat = side => new T.MeshStandardMaterial({
      vertexColors: true, side, roughness: 0.55, metalness: 0.05, clippingPlanes: [this.rez],
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, transparent: false,
    });
    this.lic = new T.Mesh(gL, mat(T.FrontSide));
    this.rub = new T.Mesh(gR, mat(T.BackSide));
    this.skupina.add(this.lic, this.rub);
    this.F = F;
    this.obal = N.obal(P);           // jen vrcholy, které síť skutečně používá
    this.nastavPruhlednost(volby.pruhlednost || 0);
    this.vykresli();
  };

  Pohled.prototype.vycisti = function () {
    this.zastavStul();
    this.orientace(null);
    this.stul(null);
    this.deska(null);
    for (const o of [...this.skupina.children]) {
      this.skupina.remove(o);
      o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) [].concat(x.material).forEach(m => m.dispose()); });
    }
    this.vrstvy = {};
    this.lic = this.rub = null;
  };

  /** Barvy po trojúhelnících: lic(t) a rub(t) vrací [r, g, b] 0..1, nebo po rozích rohLic(t, k). */
  Pohled.prototype.obarvi = function (lic, rub, poRozich) {
    const L = this.barvaLic.array, R = this.barvaRub.array;
    for (let t = 0; t < this.F; t++) {
      if (poRozich) {
        for (let k = 0; k < 3; k++) {
          const a = lic(t, k), b = rub(t, k), o = 9 * t + 3 * k;
          L[o] = a[0]; L[o + 1] = a[1]; L[o + 2] = a[2]; R[o] = b[0]; R[o + 1] = b[1]; R[o + 2] = b[2];
        }
      } else {
        const a = lic(t), b = rub(t);
        for (let k = 0; k < 3; k++) {
          const o = 9 * t + 3 * k;
          L[o] = a[0]; L[o + 1] = a[1]; L[o + 2] = a[2]; R[o] = b[0]; R[o + 1] = b[1]; R[o + 2] = b[2];
        }
      }
    }
    this.barvaLic.needsUpdate = this.barvaRub.needsUpdate = true;
    this.vykresli();
  };

  Pohled.prototype.nastavPruhlednost = function (a) {
    for (const m of [this.lic, this.rub]) if (m) {
      m.material.transparent = a > 0;
      m.material.opacity = 1 - a;
      m.material.depthWrite = a < 0.05;
      m.material.needsUpdate = true;
    }
    this.vykresli();
  };

  Pohled.prototype.dratovy = function (zap) {
    this.vrstva('drat', null);
    if (zap && this.lic) {
      const m = new T.Mesh(this.lic.geometry, new T.MeshBasicMaterial({ color: 0x000000, wireframe: true, transparent: true, opacity: 0.18, clippingPlanes: [this.rez] }));
      this.vrstva('drat', m);
    }
  };

  /** Řez vodorovnou rovinou: zachová se část pod výškou z (null = bez řezu). */
  Pohled.prototype.nastavRez = function (z) {
    this.rezAktivni = z != null;
    this.rez.constant = z == null ? 1e9 : z;
    this.vykresli();
  };

  /** Pojmenovaná vrstva (čáry, šipky…); obj = null vrstvu odstraní. */
  Pohled.prototype.vrstva = function (jmeno, obj) {
    const stara = this.vrstvy[jmeno];
    if (stara) {
      this.skupina.remove(stara);
      stara.traverse(x => { if (x.geometry && x.geometry !== (this.lic && this.lic.geometry)) x.geometry.dispose(); if (x.material) [].concat(x.material).forEach(m => m.dispose()); });
    }
    delete this.vrstvy[jmeno];
    if (obj) { this.vrstvy[jmeno] = obj; this.skupina.add(obj); }
    this.vykresli();
  };

  /** Úsečky (Float64Array po 6) jako čáry; průhledná kopie bez hloubkového testu je vidět i skrz plochu. */
  Pohled.prototype.cary = function (jmeno, us, barva, skrz = true) {
    if (!us || !us.length) { this.vrstva(jmeno, null); return; }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.BufferAttribute(Float32Array.from(us), 3));
    const sk = new T.Group();
    sk.add(new T.LineSegments(g, new T.LineBasicMaterial({ color: barva, clippingPlanes: [this.rez] })));
    if (skrz) {
      const m = new T.LineBasicMaterial({ color: barva, transparent: true, opacity: 0.35, depthTest: false, clippingPlanes: [this.rez] });
      const l = new T.LineSegments(g, m); l.renderOrder = 10; sk.add(l);
    }
    this.vrstva(jmeno, sk);
  };

  /** Šipky normál podél cesty (mravenec). body, normaly: pole [x,y,z]; d = délka šipky. */
  Pohled.prototype.sipky = function (jmeno, body, normaly, d, barva) {
    const sk = new T.Group();
    body.forEach((b, i) => {
      const n = normaly[i];
      const a = new T.ArrowHelper(new T.Vector3(...n), new T.Vector3(...b), d, barva, d * 0.3, d * 0.18);
      sk.add(a);
    });
    this.vrstva(jmeno, sk);
  };

  Pohled.prototype.koule = function (jmeno, b, r, barva) {
    const m = new T.Mesh(new T.SphereGeometry(r, 16, 12), new T.MeshStandardMaterial({ color: barva, roughness: 0.4 }));
    m.position.set(...b);
    this.vrstva(jmeno, m);
    return m;
  };

  /** Natočení celého objektu (kvaternion, null = výchozí). */
  Pohled.prototype.orientace = function (q) {
    if (q) this.skupina.quaternion.copy(q); else this.skupina.quaternion.identity();
    this.vykresli();
  };

  /** Vodorovný stůl ve výšce z (ve světových souřadnicích, neotáčí se s objektem); null = bez stolu. */
  Pohled.prototype.stul = function (z) {
    if (z == null) { if (this._stul) { this.scena.remove(this._stul); this._stul.geometry.dispose(); this._stul.material.dispose(); this._stul = null; } this.vykresli(); return; }
    if (!this._stul) {
      const r = (this.obal ? this.obal.r : 1) * 3;
      this._stul = new T.Mesh(new T.CircleGeometry(r, 64), new T.MeshStandardMaterial({ color: 0x8a7a66, roughness: 0.9, transparent: true, opacity: 0.55, side: T.DoubleSide }));
      this.scena.add(this._stul);
    }
    this._stul.position.set(0, 0, z);
    this.vykresli();
  };

  /** Vodorovná průhledná deska nahoře (ukázka konstantní šířky); null = bez desky. */
  Pohled.prototype.deska = function (z) {
    if (z == null) { if (this._deska) { this.scena.remove(this._deska); this._deska.geometry.dispose(); this._deska.material.dispose(); this._deska = null; } this.vykresli(); return; }
    if (!this._deska) {
      const r = (this.obal ? this.obal.r : 1) * 1.6;
      this._deska = new T.Mesh(new T.BoxGeometry(2 * r, 2 * r, r * 0.04), new T.MeshStandardMaterial({ color: 0x9fd3ff, roughness: 0.2, transparent: true, opacity: 0.35 }));
      this.scena.add(this._deska);
    }
    this._deska.position.set(0, 0, z + this._deska.geometry.parameters.depth / 2);
    this.vykresli();
  };

  /** Kvaterniony, které postupně natáčejí směry drahy[i] (v soustavě tělesa) dolů (0, 0, −1):
      každý krok je nejmenší rotace z předchozí orientace, takže se těleso neotáčí zbytečně kolem svislice. */
  N.orientaceDolu = function (drahy) {
    const dolu = new T.Vector3(0, 0, -1);
    let q = new T.Quaternion().setFromUnitVectors(new T.Vector3(...drahy[0]).normalize(), dolu);
    return drahy.map(d => {
      const w = new T.Vector3(...d).normalize().applyQuaternion(q);
      q = new T.Quaternion().setFromUnitVectors(w, dolu).multiply(q);
      return q.clone();
    });
  };

  /** Ukončí běžící animaci na stole (vrací nové číslo animace). */
  Pohled.prototype.zastavStul = function () { return (this._stulId = (this._stulId || 0) + 1); };

  /** Přehraje snímky [{q, stul, deska?}] za ms milisekund; hotovo() po skončení. */
  N.prehrajNaStole = function (pohled, snimky, ms, hotovo) {
    const t0 = performance.now(), id = pohled.zastavStul();
    pohled.prubezne(ted => {
      if (pohled._stulId !== id) return false;            // mezitím přepnuto nebo spuštěno znovu
      const s = Math.min(1, (ted - t0) / ms), i = Math.min(snimky.length - 1, Math.floor(s * (snimky.length - 1)));
      const k = snimky[i];
      pohled.orientace(k.q);
      pohled.stul(k.stul);
      if (k.deska != null) pohled.deska(k.deska);
      if (s >= 1) { if (hotovo) hotovo(); return false; }
      return true;
    });
  };

  Pohled.prototype.png = function () {
    this.r.render(this.scena, this.kamera());
    return this.platno.toDataURL('image/png');
  };
})(NEM);
