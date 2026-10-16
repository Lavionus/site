/* Modelář 3D – pracovní deska s mřížkou.
   Mřížku kreslí shader: čáry jsou vyhlazené podle derivací (fwidth),
   jemná mřížka plynule mizí, když by její čáry byly hustší než pár pixelů,
   takže deska nemá moaré při žádném přiblížení. Deska je odsunutá
   polygon offsetem, aby spodní stěny těles ležící v Z = 0 neblikaly. */
var MDL = globalThis.MDL = globalThis.MDL || {};
(function (M) {
  'use strict';

  const VERTEX = `
    uniform vec2 meritko;
    varying vec2 vBod;
    void main() {
      // lokální souřadnice plochy v mm (jednotkový čtverec × měřítko),
      // pro desku jsou totožné se světovými X, Y
      vBod = position.xy * meritko;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`;

  const FRAGMENT = `
    uniform vec3 cDeska, cJemna, cHlavni, cOsaX, cOsaY, cOkraj;
    uniform float krok, hlavni, alfa;
    uniform vec2 pul;
    varying vec2 vBod;
    // intenzita čáry mřížky s roztečí s v bodě p (0..1)
    float cary(vec2 p, float s, vec2 w) {
      vec2 g = abs(fract(p / s + 0.5) - 0.5) * s;
      vec2 a = 1.0 - smoothstep(w * 0.5, w * 1.5, g);
      return max(a.x, a.y);
    }
    void main() {
      vec2 w = fwidth(vBod);
      vec3 c = cDeska;
      // jemné čáry zmizí, když je jejich rozteč menší než ~5 px
      float hust = max(w.x, w.y) / krok;
      float jemna = cary(vBod, krok, w) * (1.0 - smoothstep(0.12, 0.3, hust));
      c = mix(c, cJemna, jemna);
      float hustH = max(w.x, w.y) / hlavni;
      float hl = cary(vBod, hlavni, w * 1.4) * (1.0 - smoothstep(0.2, 0.45, hustH));
      c = mix(c, cHlavni, hl);
      // osy procházející počátkem
      vec2 ao = 1.0 - smoothstep(w * 0.8, w * 2.0, abs(vBod));
      c = mix(c, cOsaX, ao.y * 0.9);
      c = mix(c, cOsaY, ao.x * 0.9);
      // okraj desky
      vec2 dk = pul - abs(vBod);
      float ok = 1.0 - smoothstep(w.x * 1.0, w.x * 3.0, min(dk.x, dk.y));
      c = mix(c, cOkraj, ok);
      gl_FragColor = vec4(c, alfa);
    }`;

  /** Barevná témata plochy (deska, mřížka, pozadí s přechodem shora dolů). svetle = světlá scéna
      (podle toho se ladí kostka pohledů, obrysy děr a odraz od země). auto = podle motivu webu. */
  M.TEMATA_DESKY = {
    auto: { nazev: 'Podle webu' },
    grafit: { nazev: 'Grafit', svetle: false, deska: '#2b3038', jemna: '#353b45', hlavni: '#4a5361', okraj: '#8995a6', pozadi: ['#1c1f25', '#121418'] },
    svetla: { nazev: 'Světlá', svetle: true, deska: '#f7f9fc', jemna: '#dfe5ee', hlavni: '#c5cedb', okraj: '#7d8a9c', pozadi: ['#eef1f5', '#dde2e9'] },
    modrotisk: { nazev: 'Modrotisk', svetle: false, deska: '#143c6e', jemna: '#1b4679', hlavni: '#33639b', okraj: '#a8cbf2', pozadi: ['#0d2747', '#071628'],
      osaX: '#ff8a7a', osaY: '#8be0a0' },
    nebe: { nazev: 'Modrobílá', svetle: true, deska: '#ffffff', jemna: '#e7eef8', hlavni: '#c3d5ed', okraj: '#4f7fc0', pozadi: ['#e6eef8', '#c9d8ea'] },
    papir: { nazev: 'Rýsovací papír', svetle: true, deska: '#fbf6e8', jemna: '#f3ead4', hlavni: '#e4d2a8', okraj: '#a2834f', pozadi: ['#efe8d8', '#d8cdb4'] },
    podlozka: { nazev: 'Řezací podložka', svetle: false, deska: '#2d6a4e', jemna: '#337257', hlavni: '#4f9370', okraj: '#e6efc0', pozadi: ['#1d2e26', '#111b16'],
      osaX: '#ff8f7f', osaY: '#f2e27a' },
    noc: { nazev: 'Půlnoc', svetle: false, deska: '#0e1014', jemna: '#171a20', hlavni: '#262c35', okraj: '#5d6876', pozadi: ['#05060a', '#000000'] },
    pisek: { nazev: 'Pískovec', svetle: true, deska: '#ece1cc', jemna: '#e3d5bb', hlavni: '#d2bd98', okraj: '#8d7350', pozadi: ['#e2d8c6', '#c6b8a0'] },
    soumrak: { nazev: 'Soumrak', svetle: false, deska: '#2c2641', jemna: '#332c4b', hlavni: '#493e6d', okraj: '#ae9fe0', pozadi: ['#231c35', '#100c1a'],
      osaX: '#ff8a8a', osaY: '#7fe0b0' },
    tyrkys: { nazev: 'Tyrkysová laguna', svetle: false, deska: '#0f4f57', jemna: '#145c65', hlavni: '#21808a', okraj: '#7ee8e4', pozadi: ['#0b3a42', '#05191d'],
      osaX: '#ff9b85', osaY: '#b8f59a' },
    les: { nazev: 'Les', svetle: false, deska: '#1f3a28', jemna: '#25452f', hlavni: '#3c6b49', okraj: '#b7d99a', pozadi: ['#16281c', '#0a130d'],
      osaX: '#ff8f6b', osaY: '#e8e27a' },
    lava: { nazev: 'Láva', svetle: false, deska: '#231d1b', jemna: '#2c2421', hlavni: '#6b3420', okraj: '#ff7a3d', pozadi: ['#1a1312', '#0a0606'],
      osaX: '#ff5a4a', osaY: '#ffd166' },
    ocean: { nazev: 'Oceán', svetle: false, deska: '#0c2a52', jemna: '#10335f', hlavni: '#1f5394', okraj: '#5fb4ff', pozadi: ['#0a2346', '#020a18'],
      osaX: '#ff7a8a', osaY: '#6ff0c8' },
    mata: { nazev: 'Máta', svetle: true, deska: '#effaf4', jemna: '#d6f0e2', hlavni: '#a8dcc0', okraj: '#3f9a6e', pozadi: ['#e3f5ec', '#c5e6d4'] },
    levandule: { nazev: 'Levandule', svetle: true, deska: '#f6f2fd', jemna: '#e6defa', hlavni: '#cbbdf2', okraj: '#7a62c8', pozadi: ['#ede6fb', '#d5c9f2'] },
    broskev: { nazev: 'Broskev', svetle: true, deska: '#fff4ec', jemna: '#fbe3d2', hlavni: '#f3c4a2', okraj: '#d0784a', pozadi: ['#fdebdf', '#f2d0b8'] },
    retro: { nazev: 'Retro monitor', svetle: false, deska: '#020a04', jemna: '#06200d', hlavni: '#0f5a24', okraj: '#39ff6a', pozadi: ['#020803', '#000000'],
      osaX: '#ff5f5f', osaY: '#39ff6a' },
    karbon: { nazev: 'Karbon', svetle: false, deska: '#1b1d20', jemna: '#222428', hlavni: '#34383e', okraj: '#9aa3ad', pozadi: ['#2a2d31', '#141517'] },
    snih: { nazev: 'Sníh', svetle: true, deska: '#ffffff', jemna: '#eef1f4', hlavni: '#cfd6de', okraj: '#5c6875', pozadi: ['#ffffff', '#e9edf1'] },
    orech: { nazev: 'Ořech', svetle: false, deska: '#3b2a1e', jemna: '#463224', hlavni: '#6c4c34', okraj: '#e0b78a', pozadi: ['#2c2017', '#140e09'],
      osaX: '#ff8c78', osaY: '#b9e08a' },
    med: { nazev: 'Měď', svetle: false, deska: '#24201f', jemna: '#2d2826', hlavni: '#7a4a32', okraj: '#e39a6a', pozadi: ['#201b1a', '#0d0b0a'],
      osaX: '#ff7d6a', osaY: '#9be0a8' },
    bauhaus: { nazev: 'Bauhaus', svetle: true, deska: '#f5efe1', jemna: '#ebe2cd', hlavni: '#d9cba9', okraj: '#222222', pozadi: ['#efe7d4', '#dccfb2'],
      osaX: '#d62828', osaY: '#1d5fbf' },
    kontrast: { nazev: 'Vysoký kontrast', svetle: false, deska: '#000000', jemna: '#3a3a3a', hlavni: '#9a9a9a', okraj: '#ffffff', pozadi: ['#000000', '#000000'],
      osaX: '#ff4040', osaY: '#ffe600' },
  };
  let tema = 'auto';
  /** Aktivní téma (auto podle motivu webu). */
  M.temaDesky = () => {
    const t = M.TEMATA_DESKY[tema];
    return t && t.deska ? t : M.TEMATA_DESKY[M.svetlyMotiv() ? 'svetla' : 'grafit'];
  };
  M.idTematuDesky = () => tema;
  M.nastavTemaDesky = id => { tema = M.TEMATA_DESKY[id] ? id : 'auto'; };
  /** Je scéna světlá (podle tématu plochy, ne podle motivu webu)? */
  M.svetlaScena = () => M.temaDesky().svetle;

  /** Barvy desky podle tématu; rovina = pracovní rovina na tělese (oranžová, světlá/tmavá podle tématu). */
  function barvy(rovina) {
    const t = M.temaDesky(), sv = t.svetle;
    const osy = { osaX: t.osaX || (sv ? '#e2675c' : '#c0554b'), osaY: t.osaY || (sv ? '#4fae6a' : '#4c9a62') };
    if (rovina) return Object.assign(sv ? {
      deska: '#fff4e6', jemna: '#f6dcbc', hlavni: '#eab37a', okraj: '#e08a2e',
    } : {
      deska: '#3a3226', jemna: '#4a3e2c', hlavni: '#7a5f36', okraj: '#f0a040',
    }, osy, { pozadi: t.pozadi[0], pozadi2: t.pozadi[1] });
    return Object.assign({ deska: t.deska, jemna: t.jemna, hlavni: t.hlavni, okraj: t.okraj, pozadi: t.pozadi[0], pozadi2: t.pozadi[1] }, osy);
  }
  M.barvyDesky = barvy;

  /** Vytvoří desku; vrací {objekt, nastav(sirka, hloubka, krok), motiv()}. */
  M.vytvorDesku = function (sirka = 200, hloubka = 200, krok = 1, rovina = false) {
    const unif = {
      meritko: { value: new THREE.Vector2(1, 1) },
      cDeska: { value: new THREE.Color() }, cJemna: { value: new THREE.Color() },
      cHlavni: { value: new THREE.Color() }, cOsaX: { value: new THREE.Color() },
      cOsaY: { value: new THREE.Color() }, cOkraj: { value: new THREE.Color() },
      krok: { value: krok }, hlavni: { value: 10 }, pul: { value: new THREE.Vector2() },
      alfa: { value: rovina ? 0.78 : 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: unif, vertexShader: VERTEX, fragmentShader: FRAGMENT,
      polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 4,
      side: THREE.DoubleSide,
      transparent: rovina, opacity: 1,
    });
    if (rovina) {
      // rovina leží na stěně tělesa: posunout před ni, ne za ni
      mat.depthWrite = false;
      mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -4;
    }
    // fwidth je ve WebGL2 vestavěné; ve WebGL1 by potřeboval rozšíření
    mat.extensions = { derivatives: true };
    const plocha = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    plocha.name = rovina ? 'rovina' : 'deska';
    plocha.renderOrder = -1;
    const d = {
      objekt: plocha, sirka, hloubka, krok,
      nastav(s, h, k) {
        d.sirka = s; d.hloubka = h; d.krok = k;
        plocha.scale.set(s, h, 1);
        plocha.updateMatrixWorld();
        unif.meritko.value.set(s, h);
        unif.pul.value.set(s / 2, h / 2);
        unif.krok.value = k;
        // hlavní čáry: 10 jemných kroků, u hrubé mřížky aspoň 10 mm
        unif.hlavni.value = k >= 5 ? k * 5 : Math.max(10, k * 10);
      },
      motiv() {
        const b = barvy(rovina);
        unif.cDeska.value.set(b.deska); unif.cJemna.value.set(b.jemna);
        unif.cHlavni.value.set(b.hlavni); unif.cOsaX.value.set(b.osaX);
        unif.cOsaY.value.set(b.osaY); unif.cOkraj.value.set(b.okraj);
        return b;
      },
      /** Pohled zespodu: deska průsvitná a kreslená až po tělesech (jinak by je zakryla a byly by vidět
          jen otisky těch, co se jí dotýkají). Shora zase neprůhledná. */
      zespodu(ano) {
        if (rovina || d.jeZespodu === ano) return;
        d.jeZespodu = ano;
        unif.alfa.value = ano ? 0.35 : 1;
        mat.transparent = ano; mat.depthWrite = !ano;
        plocha.renderOrder = ano ? 10 : -1;
        mat.needsUpdate = true;
      },
      /** Rohy desky (pro pohled „Domů“). */
      rohy() {
        const x = d.sirka / 2, y = d.hloubka / 2;
        return [[-x, -y], [x, -y], [x, y], [-x, y]].map(([a, b]) => new THREE.Vector3(a, b, 0));
      },
    };
    d.nastav(sirka, hloubka, krok);
    d.motiv();
    return d;
  };

  if (typeof module !== 'undefined') module.exports = M;
})(MDL);
