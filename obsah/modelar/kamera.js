/* Modelář 3D – oběžná kamera (bez DOM, testovatelná v node).
   Stav: cíl (bod, kolem kterého se otáčí), azimut, elevace, vzdálenost.
   azimut 0 = pohled zepředu (kamera v −Y), 90° = zprava (kamera v +X),
   elevace 90° = shora. Perspektivní i ortografická kamera se drží
   ve shodě, takže přepnutí projekce nemění velikost obrazu v cíli. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';
  const V = THREE.Vector3;
  const MAX_EL = 89.9 * M.st;

  /** Jednotkový směr od cíle ke kameře. */
  M.smerPohledu = function (az, el) {
    const c = Math.cos(el);
    return new V(Math.sin(az) * c, -Math.cos(az) * c, Math.sin(el));
  };

  /** Opak smerPohledu: z vektoru (cíl → kamera) udělá {az, el}.
      U svislého pohledu (shora/zdola) se azimut nechá původní. */
  M.uhlyZeSmeru = function (smer, azPuvodni = 0) {
    const d = smer.clone().normalize();
    const vodor = Math.hypot(d.x, d.y);
    const el = M.omez(Math.atan2(d.z, vodor), -MAX_EL, MAX_EL);
    const az = vodor < 1e-6 ? azPuvodni : Math.atan2(d.x, -d.y);
    return { az, el };
  };

  /** Nejkratší úhlový rozdíl b − a v rozsahu (−π, π]. */
  function rozdilUhlu(a, b) {
    let d = (b - a) % (2 * Math.PI);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d <= -Math.PI) d += 2 * Math.PI;
    return d;
  }
  M.rozdilUhlu = rozdilUhlu;

  function Kamera(sirka = 800, vyska = 600) {
    this.fov = 40;                       // svislý zorný úhel perspektivy (°)
    this.persp = new THREE.PerspectiveCamera(this.fov, 1, 0.5, 50000);
    this.orto = new THREE.OrthographicCamera(-1, 1, 1, -1, -50000, 50000);
    for (const k of [this.persp, this.orto]) k.up.set(0, 0, 1);
    this.ortograficka = false;
    this.cil = new V(0, 0, 0);
    this.az = -30 * M.st;
    this.el = 30 * M.st;
    this.vzd = 400;
    this.minVzd = 5;
    this.maxVzd = 20000;
    this.anim = null;
    this.nastavVelikost(sirka, vyska);
  }
  M.Kamera = Kamera;

  Kamera.prototype.aktivni = function () { return this.ortograficka ? this.orto : this.persp; };

  Kamera.prototype.nastavVelikost = function (sirka, vyska) {
    this.sirka = Math.max(1, sirka);
    this.vyska = Math.max(1, vyska);
    this.aktualizuj();
  };

  /** Polovina výšky zorného pole ve vzdálenosti cíle (mm). */
  Kamera.prototype.pulVysky = function () {
    return this.vzd * Math.tan(this.fov * M.st / 2);
  };

  /** Přepočítá obě kamery ze stavu. Volá se po každé změně. */
  Kamera.prototype.aktualizuj = function () {
    this.el = M.omez(this.el, -MAX_EL, MAX_EL);
    this.vzd = M.omez(this.vzd, this.minVzd, this.maxVzd);
    const pom = this.sirka / this.vyska;
    const poz = M.smerPohledu(this.az, this.el).multiplyScalar(this.vzd).add(this.cil);
    const p = this.persp;
    p.aspect = pom;
    p.fov = this.fov;
    p.near = Math.max(0.1, this.vzd / 200);
    p.far = this.vzd * 60 + 5000;
    p.position.copy(poz);
    p.lookAt(this.cil);
    p.updateProjectionMatrix();
    p.updateMatrixWorld();
    const o = this.orto, h = this.pulVysky();
    o.left = -h * pom; o.right = h * pom; o.top = h; o.bottom = -h;
    // ortografická kamera stojí dál, aby ořez nezasahoval do modelu
    o.position.copy(M.smerPohledu(this.az, this.el).multiplyScalar(this.vzd + 20000).add(this.cil));
    o.near = 1; o.far = this.vzd + 40000;
    o.lookAt(this.cil);
    o.updateProjectionMatrix();
    o.updateMatrixWorld();
  };

  /** Paprsek z pixelu (px, py; počátek vlevo nahoře) do scény. */
  Kamera.prototype.paprsek = function (px, py) {
    const ndc = new THREE.Vector2(px / this.sirka * 2 - 1, -(py / this.vyska) * 2 + 1);
    const r = new THREE.Raycaster();
    r.setFromCamera(ndc, this.aktivni());
    return r.ray;
  };

  /** Průsečík paprsku z pixelu s vodorovnou rovinou z = konst (nebo null). */
  Kamera.prototype.bodNaRovine = function (px, py, z = 0) {
    const ray = this.paprsek(px, py);
    const bod = new V();
    return ray.intersectPlane(new THREE.Plane(new V(0, 0, 1), -z), bod) ? bod : null;
  };

  /** Bod pod kurzorem pro zoom a posun: deska, a když ji paprsek mine
      (pohled zdola, nad obzorem), rovina kolmá na pohled procházející cílem. */
  Kamera.prototype.bodPodKurzorem = function (px, py, vlastniBod) {
    if (vlastniBod) return vlastniBod.clone();
    const ray = this.paprsek(px, py);
    const naDesce = this.bodNaRovine(px, py, 0);
    if (naDesce && naDesce.distanceTo(ray.origin) < this.vzd * 8 && ray.direction.z < -0.05) return naDesce;
    const n = M.smerPohledu(this.az, this.el);
    const bod = new V();
    return ray.intersectPlane(new THREE.Plane().setFromNormalAndCoplanarPoint(n, this.cil), bod) ? bod : this.cil.clone();
  };

  /** Otočení kolem cíle o posun myši v pixelech. */
  Kamera.prototype.otoc = function (dx, dy) {
    this.zastavAnimaci();
    this.az -= dx * 0.008;
    this.el += dy * 0.008;
    this.aktualizuj();
  };

  /** Posun pohledu tak, aby obraz jel s myší (dx, dy v pixelech). */
  Kamera.prototype.posun = function (dx, dy) {
    this.zastavAnimaci();
    const k = this.aktivni();
    const naPixel = 2 * this.pulVysky() / this.vyska;
    const vpravo = new V().setFromMatrixColumn(k.matrixWorld, 0);
    const nahoru = new V().setFromMatrixColumn(k.matrixWorld, 1);
    this.cil.addScaledVector(vpravo, -dx * naPixel).addScaledVector(nahoru, dy * naPixel);
    this.aktualizuj();
  };

  /** Přiblížení k bodu pod kurzorem: faktor < 1 přibližuje.
      Stejnolehlost se středem v bodě drží bod na stejném pixelu. */
  Kamera.prototype.zoom = function (faktor, px, py, vlastniBod) {
    this.zastavAnimaci();
    const nova = M.omez(this.vzd * faktor, this.minVzd, this.maxVzd);
    const f = nova / this.vzd;
    if (Math.abs(f - 1) < 1e-9) return;
    const p = px == null ? this.cil.clone() : this.bodPodKurzorem(px, py, vlastniBod);
    this.cil.sub(p).multiplyScalar(f).add(p);
    this.vzd = nova;
    this.aktualizuj();
  };

  /** Vzdálenost, ze které je koule o poloměru r celá vidět. */
  Kamera.prototype.vzdalenostProKouli = function (r) {
    const pom = this.sirka / this.vyska;
    const svisle = this.fov * M.st / 2;
    const vodor = Math.atan(Math.tan(svisle) * pom);
    return r / Math.sin(Math.min(svisle, vodor));
  };

  /** Plynulý přechod na nový stav {az, el, vzd, cil}; chybějící zůstanou. */
  Kamera.prototype.animujNa = function (kam, ms = 400, ted = Date.now()) {
    const z = { az: this.az, el: this.el, vzd: this.vzd, cil: this.cil.clone() };
    const k = {
      az: kam.az != null ? z.az + rozdilUhlu(z.az, kam.az) : z.az,
      el: kam.el != null ? M.omez(kam.el, -MAX_EL, MAX_EL) : z.el,
      vzd: kam.vzd != null ? kam.vzd : z.vzd,
      cil: kam.cil ? kam.cil.clone() : z.cil,
    };
    if (ms <= 0) { this.anim = { z, k, t0: ted, ms: 1 }; this.krok(ted + 1); return; }
    this.anim = { z, k, t0: ted, ms };
  };

  /** Posune animaci; vrací true, dokud běží. */
  Kamera.prototype.krok = function (ted = Date.now()) {
    const a = this.anim;
    if (!a) return false;
    const t = M.omez((ted - a.t0) / a.ms, 0, 1);
    const s = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;   // ease-in-out
    this.az = a.z.az + (a.k.az - a.z.az) * s;
    this.el = a.z.el + (a.k.el - a.z.el) * s;
    // vzdálenost se prolíná geometricky, aby velké skoky nepůsobily trhaně
    this.vzd = a.z.vzd * Math.pow(a.k.vzd / a.z.vzd, s);
    this.cil.lerpVectors(a.z.cil, a.k.cil, s);
    if (t >= 1) this.anim = null;
    this.aktualizuj();
    return !!this.anim;
  };

  Kamera.prototype.zastavAnimaci = function () { this.anim = null; };

  /** Pohled ze směru (vektor cíl → kamera), např. z kostky pohledů. */
  Kamera.prototype.pohledZeSmeru = function (smer, ms = 400) {
    // shora/zdola: azimut na nejbližší násobek 90°, ať osy leží rovnoběžně s okrajem obrazu
    const u = M.uhlyZeSmeru(smer, Math.round(this.az / (Math.PI / 2)) * (Math.PI / 2));
    this.animujNa(u, ms);
  };

  /** Nejmenší vzdálenost, ze které jsou všechny body vidět uvnitř podílu
      obrazu `vypln` (0..1), při zadaném az/el a cíli. Hledá se půlením,
      protože v perspektivě nemá úloha jednoduchý vzorec. */
  Kamera.prototype.vzdalenostProBody = function (body, az, el, cil, vypln = 0.9) {
    const platne = (body || []).filter(b => b && isFinite(b.x) && isFinite(b.y) && isFinite(b.z));
    if (!platne.length) return this.vzd;           // není co zobrazit (prázdný výběr): vzdálenost beze změny
    body = platne;
    const puvodni = { az: this.az, el: this.el, vzd: this.vzd, cil: this.cil.clone(), anim: this.anim };
    this.az = az; this.el = el; this.cil.copy(cil);
    const vejdeSe = vzd => {
      this.vzd = vzd; this.aktualizuj();
      const k = this.aktivni(), p = new V();
      return body.every(b => {
        p.copy(b).project(k);
        return Math.abs(p.x) <= vypln && Math.abs(p.y) <= vypln && p.z < 1;
      });
    };
    let lo = this.minVzd, hi = this.vzdalenostProKouli(Math.max(...body.map(b => b.distanceTo(cil)))) * 1.5 + 1;
    for (let i = 0; i < 40 && hi < this.maxVzd && vejdeSe(hi) === false; i++) hi = Math.min(hi * 2, this.maxVzd);
    for (let i = 0; i < 40; i++) {
      const s = (lo + hi) / 2;
      if (vejdeSe(s)) hi = s; else lo = s;
    }
    Object.assign(this, { az: puvodni.az, el: puvodni.el, vzd: puvodni.vzd, anim: puvodni.anim });
    this.cil.copy(puvodni.cil);
    this.aktualizuj();
    return Math.min(hi, this.maxVzd);
  };

  /** Pohled „Domů“: šikmo zepředu zleva, body (např. rohy desky) vyplní obraz. */
  Kamera.prototype.domu = function (stred, body, ms = 400) {
    const az = -30 * M.st, el = 30 * M.st;
    const vzd = Array.isArray(body) ? this.vzdalenostProBody(body, az, el, stred)
                                    : this.vzdalenostProKouli(body) * 1.05;   // číslo = poloměr koule
    this.animujNa({ az, el, cil: stred, vzd }, ms);
  };

  /** Uložitelný stav (pro projekt a pro testy). */
  Kamera.prototype.stav = function () {
    return { az: this.az, el: this.el, vzd: this.vzd, cil: this.cil.toArray(), orto: this.ortograficka };
  };
  Kamera.prototype.obnov = function (s) {
    if (!s) return;
    // hodnoty mohou přijít ze souboru: jen konečná čísla v rozumných mezích
    const cislo = (x, v) => (typeof x === 'number' && isFinite(x)) ? x : v;
    this.az = cislo(s.az, 0); this.el = M.omez(cislo(s.el, 0), -1.55, 1.55); this.vzd = M.omez(cislo(s.vzd, 400), 1, 1e6);
    if (Array.isArray(s.cil) && s.cil.length === 3 && s.cil.every(x => typeof x === 'number' && isFinite(x) && Math.abs(x) < 1e6)) this.cil.fromArray(s.cil);
    this.ortograficka = !!s.orto;
    this.anim = null;
    this.aktualizuj();
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
