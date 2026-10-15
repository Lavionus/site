/* Převod AVI → MP4 pro stránku video_sekce.html.
   Běží jako klasický Web Worker nad ffmpeg-core (ffmpeg.wasm, GPL-2.0-or-later).
   Vstup se nekopíruje do paměti WebAssembly – připojí se přes WORKERFS a čte
   se přímo ze souboru; v paměti se drží jen výsledné MP4.

   Zprávy dovnitř:  { typ: 'preved', soubor: File, coreURL, wasmURL }
   Zprávy ven:      { typ: 'stav', text }            – co se právě děje
                    { typ: 'prubeh', podil, cas }    – 0…1 a zpracovaný čas v s
                    { typ: 'hotovo', data, video, zvuk } – data = ArrayBuffer MP4
                    { typ: 'chyba', text }
*/
'use strict';

let core = null;
let log = [];

function nactiCore(coreURL, wasmURL) {
  if (core) return Promise.resolve(core);
  importScripts(coreURL);
  // ffmpeg-core si adresu .wasm čte z „hashe“ za adresou skriptu.
  return self.createFFmpegCore({
    mainScriptUrlOrBlob: coreURL + '#' + btoa(JSON.stringify({ wasmURL, workerURL: '' })),
  }).then(c => {
    core = c;
    core.setLogger(z => { if (z && typeof z.message === 'string') { log.push(z.message); if (log.length > 400) log.shift(); } });
    return core;
  });
}

function spust(args) {
  log = [];
  core.setTimeout(-1);
  core.exec(...args);
  const ret = core.ret;
  core.reset();
  return ret;
}

// Z výpisu „ffmpeg -i“ vytáhne kodek první video a první zvukové stopy a délku.
function rozbor(radky) {
  let video = null, zvuk = null, delka = 0;
  for (const r of radky) {
    let m = r.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (m) delka = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
    m = r.match(/Stream #\d+:\d+.*?: Video: (\w+)/);
    if (m && !video) video = m[1];
    m = r.match(/Stream #\d+:\d+.*?: Audio: (\w+)/);
    if (m && !zvuk) zvuk = m[1];
  }
  return { video, zvuk, delka };
}

self.onmessage = async ({ data }) => {
  if (data.typ !== 'preved') return;
  const { soubor } = data;
  try {
    self.postMessage({ typ: 'stav', text: 'Načítám ffmpeg (poprvé se stahuje asi 32 MB)…' });
    await nactiCore(data.coreURL, data.wasmURL);

    const FS = core.FS;
    try { FS.mkdir('/vstup'); } catch (e) {}
    try { FS.unmount('/vstup'); } catch (e) {}
    // Jméno souboru ve WORKERFS musí být bez lomítek; obsah se čte přímo z File.
    const jmeno = 'vstup.avi';
    const f = new File([soubor], jmeno);
    FS.mount(FS.filesystems.WORKERFS, { files: [f] }, '/vstup');
    const cesta = '/vstup/' + jmeno;

    self.postMessage({ typ: 'stav', text: 'Zjišťuji kodeky…' });
    spust(['-hide_banner', '-i', cesta]);
    const info = rozbor(log);
    if (!info.video) throw new Error('V souboru se nenašla video stopa (není poškozený?).');

    // AVI neukládá časy zobrazení snímků – čas snímku je jen jeho pořadí × délka
    // snímku. Odhady ffmpeg tu nejsou spolehlivé (při přebalení H.264 s B-snímky
    // posun o snímek a chybné pořadí, dekodér MPEG-4 ve verzi 5.1 vynechá krok
    // u 2. snímku a cfr ho pak zdvojí). Obraz se proto vždy překóduje a časy se
    // nastaví přímo z pořadí snímku (N / snímková frekvence).
    const args = ['-hide_banner', '-i', cesta, '-map', '0:v:0', '-map', '0:a:0?',
      '-vf', 'setpts=N/FRAME_RATE/TB', '-fps_mode', 'cfr',
      '-c:v', 'libx264', '-preset', 'superfast', '-crf', '17', '-pix_fmt', 'yuv420p'];
    if (info.zvuk) args.push('-af', 'asetpts=PTS-STARTPTS', '-c:a', 'aac', '-b:a', '192k');
    else args.push('-an');
    args.push('-movflags', '+faststart', '/vystup.mp4');

    self.postMessage({ typ: 'stav', text: `Převádím ${info.video}${info.zvuk ? ' + ' + info.zvuk : ''} do MP4 (H.264)…` });
    core.setProgress(({ progress, time }) => {
      // time je v mikrosekundách; progress od ffmpeg.wasm bývá u AVI nespolehlivý.
      const cas = time / 1e6;
      const podil = info.delka > 0 ? Math.min(1, cas / info.delka) : Math.max(0, Math.min(1, progress));
      self.postMessage({ typ: 'prubeh', podil, cas });
    });
    const ret = spust(args);
    core.setProgress(() => {});
    try { FS.unmount('/vstup'); } catch (e) {}
    if (ret !== 0) {
      const posledni = log.filter(r => /error|invalid|failed|cannot/i.test(r)).slice(-3).join(' · ');
      try { FS.unlink('/vystup.mp4'); } catch (e) {}
      throw new Error('ffmpeg skončil chybou ' + ret + (posledni ? ': ' + posledni : ''));
    }
    const vystup = FS.readFile('/vystup.mp4');
    FS.unlink('/vystup.mp4');
    // readFile vrací samostatnou kopii (ne pohled do paměti WASM), jde tedy rovnou předat.
    const buf = vystup.buffer;
    self.postMessage({ typ: 'hotovo', data: buf, video: info.video, zvuk: info.zvuk }, [buf]);
  } catch (e) {
    self.postMessage({ typ: 'chyba', text: String(e && e.message || e) });
  }
};
