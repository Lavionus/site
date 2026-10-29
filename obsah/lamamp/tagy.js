/* Lamamp – čtení tagů a technických údajů skladby (WA_TAGY).
   Formáty: MP3 (ID3v2.2–2.4, ID3v1, Xing/Info/VBRI), FLAC, OGG Vorbis/Opus, M4A/MP4, WAV.
   Čte se po kouscích přes cti(začátek, délka) → Promise<Uint8Array>, takže velké soubory se nenačítají celé.
   Bez DOM – běží i v node. */
(function () {
  'use strict';

  // ---------- pomocné ----------
  const latin1 = b => { let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]); return s; };
  const u32 = (b, i) => ((b[i] << 24) >>> 0) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3];
  const u24 = (b, i) => (b[i] << 16) + (b[i + 1] << 8) + b[i + 2];
  const u16 = (b, i) => (b[i] << 8) + b[i + 1];
  const le32 = (b, i) => b[i] + (b[i + 1] << 8) + (b[i + 2] << 16) + ((b[i + 3] << 24) >>> 0);
  const le16 = (b, i) => b[i] + (b[i + 1] << 8);
  const synch = (b, i) => (b[i] & 127) * 2097152 + (b[i + 1] & 127) * 16384 + (b[i + 2] & 127) * 128 + (b[i + 3] & 127);
  const utf8 = b => new TextDecoder('utf-8').decode(b);
  const cisti = s => s.replace(/\0+$/, '').replace(/\0/g, ' ').trim();

  // Norma říká ISO-8859-1, ale české tagy bývají ve windows-1250 nebo ISO-8859-2:
  // bajty 0x80–0x9F (v latin1 neviditelné) = windows-1250 (š ť ž Š Ť Ž); jinak š ť ž / č ř ě ů ň ď v rozsahu A0–FF = ISO-8859-2
  // (č ř ě ů ň ď mají v obou stejné kódy). Daň: francouzské/italské è ò ì ù v latin1 se přečtou jako č ň ě ů.
  const ZNAKY_8859_2 = /[\xA9\xAB\xAE\xB9\xBB\xBE\xC8\xCC\xD8\xD9\xD2\xCF\xE8\xEC\xF8\xF9\xF2\xEF]/;
  function dekodovat(kodovani, b) { try { return new TextDecoder(kodovani).decode(b); } catch (e) { return null; } }
  function jednobajtove(b) {
    if (!b.some(c => c > 127)) return latin1(b);
    try { return new TextDecoder('utf-8', { fatal: true }).decode(b); } catch (e) { /* není UTF-8 */ }
    if (b.some(c => c >= 0x80 && c <= 0x9F)) return dekodovat('windows-1250', b) || latin1(b);
    const s = latin1(b);
    if (ZNAKY_8859_2.test(s)) return dekodovat('iso-8859-2', b) || s;
    return s;
  }
  function utf16(b, be) {
    let i = 0;
    if (b[0] === 0xFF && b[1] === 0xFE) { be = false; i = 2; } else if (b[0] === 0xFE && b[1] === 0xFF) { be = true; i = 2; }
    let s = '';
    for (; i + 1 < b.length; i += 2) s += String.fromCharCode(be ? (b[i] << 8) | b[i + 1] : b[i] | (b[i + 1] << 8));
    return s;
  }
  function textId3(b, kod) {
    if (kod === 1) return cisti(utf16(b, false));
    if (kod === 2) return cisti(utf16(b, true));
    if (kod === 3) return cisti(utf8(b));
    return cisti(jednobajtove(b));
  }
  // konec řetězce ukončeného nulou (u UTF-16 dvojitou nulou na sudé pozici)
  function konecRetezce(b, od, kod) {
    if (kod === 1 || kod === 2) { for (let i = od; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return [i, i + 2]; }
    else { for (let i = od; i < b.length; i++) if (b[i] === 0) return [i, i + 1]; }
    return [b.length, b.length];
  }
  const odsynchronizuj = b => {
    const v = []; for (let i = 0; i < b.length; i++) { v.push(b[i]); if (b[i] === 0xFF && b[i + 1] === 0) i++; }
    return Uint8Array.from(v);
  };

  // ---------- ID3v2 ----------
  const ID3_POLE = { TIT2: 'titul', TT2: 'titul', TPE1: 'interpret', TP1: 'interpret', TALB: 'album', TAL: 'album',
    TYER: 'rok', TYE: 'rok', TDRC: 'rok', TRCK: 'stopa', TRK: 'stopa', TCON: 'zanr', TCO: 'zanr', TLEN: 'tlen', TLE: 'tlen' };
  function id3v2(b, vysl) {
    if (latin1(b.subarray(0, 3)) !== 'ID3') return 0;
    const ver = b[3], priznaky = b[5], velikost = synch(b, 6) + 10;
    let telo = b.subarray(10, Math.min(velikost, b.length));
    if (ver < 4 && (priznaky & 0x80)) telo = odsynchronizuj(telo);
    let i = 0;
    if (priznaky & 0x40) i = ver === 4 ? synch(telo, 0) : u32(telo, 0) + 4;
    const dId = ver === 2 ? 3 : 4, dHl = ver === 2 ? 6 : 10;
    while (i + dHl <= telo.length) {
      const id = latin1(telo.subarray(i, i + dId));
      if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
      const d = ver === 2 ? u24(telo, i + 3) : ver === 4 ? synch(telo, i + 4) : u32(telo, i + 4);
      const fp = ver === 2 ? 0 : telo[i + 9];
      let data = telo.subarray(i + dHl, i + dHl + d);
      i += dHl + d;
      if ((ver === 4 && (fp & 0x0C)) || (ver === 3 && (fp & 0xC0))) continue;   // komprimovaný / šifrovaný rámec
      if (ver === 4) { if (fp & 0x40) data = data.subarray(1); if (fp & 0x02) data = odsynchronizuj(data); if (fp & 0x01) data = data.subarray(4); }
      else if (ver === 3 && (fp & 0x20)) data = data.subarray(1);   // v2.3 seskupení
      if (!data.length) continue;
      if (ID3_POLE[id]) {
        const t = textId3(data.subarray(1), data[0]);
        if (t && !vysl[ID3_POLE[id]]) vysl[ID3_POLE[id]] = t;
      } else if ((id === 'APIC' || id === 'PIC') && !vysl.obal) {
        const kod = data[0];
        let mime, j;
        if (id === 'PIC') { mime = 'image/' + latin1(data.subarray(1, 4)).toLowerCase().replace('jpg', 'jpeg'); j = 4; }
        else { const [k, dal] = konecRetezce(data, 1, 0); mime = latin1(data.subarray(1, k)) || 'image/jpeg'; j = dal; }
        const [, zaPopisem] = konecRetezce(data, j + 1, kod);
        if (!mime.includes('/')) mime = 'image/' + mime;
        vysl.obal = { mime: mime.toLowerCase(), data: data.slice(zaPopisem) };
      }
    }
    if (vysl.zanr) vysl.zanr = vysl.zanr.replace(/^\((\d+)\)$/, (_, n) => ZANRY[n] || n);
    if (vysl.tlen && !vysl.delka) vysl.delka = Number(vysl.tlen) / 1000 || null;
    delete vysl.tlen;
    return velikost + (priznaky & 0x10 ? 10 : 0);
  }
  const ZANRY = ['Blues', 'Classic Rock', 'Country', 'Dance', 'Disco', 'Funk', 'Grunge', 'Hip-Hop', 'Jazz', 'Metal', 'New Age', 'Oldies',
    'Other', 'Pop', 'R&B', 'Rap', 'Reggae', 'Rock', 'Techno', 'Industrial', 'Alternative', 'Ska', 'Death Metal', 'Pranks', 'Soundtrack',
    'Euro-Techno', 'Ambient', 'Trip-Hop', 'Vocal', 'Jazz+Funk', 'Fusion', 'Trance', 'Classical', 'Instrumental', 'Acid', 'House', 'Game',
    'Sound Clip', 'Gospel', 'Noise', 'Alternative Rock', 'Bass', 'Soul', 'Punk', 'Space', 'Meditative', 'Instrumental Pop',
    'Instrumental Rock', 'Ethnic', 'Gothic', 'Darkwave', 'Techno-Industrial', 'Electronic', 'Pop-Folk', 'Eurodance', 'Dream',
    'Southern Rock', 'Comedy', 'Cult', 'Gangsta', 'Top 40', 'Christian Rap', 'Pop/Funk', 'Jungle', 'Native American', 'Cabaret',
    'New Wave', 'Psychedelic', 'Rave', 'Showtunes', 'Trailer', 'Lo-Fi', 'Tribal', 'Acid Punk', 'Acid Jazz', 'Polka', 'Retro',
    'Musical', 'Rock & Roll', 'Hard Rock'];

  function id3v1(b, vysl) {
    if (b.length < 128 || latin1(b.subarray(0, 3)) !== 'TAG') return false;
    const pole = (od, d) => cisti(jednobajtove(b.subarray(od, od + d)));
    vysl.titul = vysl.titul || pole(3, 30); vysl.interpret = vysl.interpret || pole(33, 30);
    vysl.album = vysl.album || pole(63, 30); vysl.rok = vysl.rok || pole(93, 4);
    if (b[125] === 0 && b[126]) vysl.stopa = vysl.stopa || String(b[126]);
    if (!vysl.zanr && ZANRY[b[127]]) vysl.zanr = ZANRY[b[127]];
    return true;
  }

  // ---------- MP3 rámce ----------
  const KBPS = {
    '1-1': [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    '1-2': [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    '1-3': [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    '2-1': [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    '2-2': [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  };
  KBPS['2-3'] = KBPS['2-2'];
  const VZORKY = { 1: [44100, 48000, 32000], 2: [22050, 24000, 16000], 2.5: [11025, 12000, 8000] };
  function hlavickaMp3(b, i) {
    if (b[i] !== 0xFF || (b[i + 1] & 0xE0) !== 0xE0) return null;
    const v = [2.5, 0, 2, 1][(b[i + 1] >> 3) & 3], vrstva = [0, 3, 2, 1][(b[i + 1] >> 1) & 3];
    const bi = b[i + 2] >> 4, si = (b[i + 2] >> 2) & 3;
    if (!v || !vrstva || bi === 0 || bi === 15 || si === 3) return null;
    const kbps = KBPS[(v === 1 ? 1 : 2) + '-' + vrstva][bi], hz = VZORKY[v][si], pad = (b[i + 2] >> 1) & 1;
    const mono = (b[i + 3] >> 6) === 3;
    const spf = vrstva === 1 ? 384 : vrstva === 2 || v === 1 ? 1152 : 576;
    const delka = vrstva === 1 ? (12 * kbps * 1000 / hz + pad) * 4 : Math.floor(spf / 8 * kbps * 1000 / hz) + pad;
    return { v, vrstva, kbps, hz, mono, spf, delka };
  }
  function mp3(b, od, zakl, konecDat, vysl) {   // zakl = posun bufferu v souboru
    let i = od, h = null;
    for (; i + 4 < b.length; i++) {
      h = hlavickaMp3(b, i);
      if (h && (i + h.delka + 2 > b.length || hlavickaMp3(b, i + h.delka))) break;
      h = null;
    }
    if (!h) return false;
    vysl.format = 'MP3'; vysl.khz = Math.round(h.hz / 1000); vysl.kanaly = h.mono ? 1 : 2;
    const xo = i + 4 + (h.v === 1 ? (h.mono ? 17 : 32) : (h.mono ? 9 : 17));
    const znacka = latin1(b.subarray(xo, xo + 4));
    let ramce = 0;
    if ((znacka === 'Xing' || znacka === 'Info') && (b[xo + 7] & 1)) ramce = u32(b, xo + 8);
    else if (latin1(b.subarray(i + 36, i + 40)) === 'VBRI') ramce = u32(b, i + 50);
    const data = konecDat - (zakl + i);
    if (ramce) {
      vysl.delka = ramce * h.spf / h.hz;
      vysl.kbps = znacka === 'Info' ? h.kbps : Math.round(data * 8 / vysl.delka / 1000);   // Info = CBR
    } else {
      vysl.kbps = h.kbps;
      if (!vysl.delka) vysl.delka = data * 8 / (h.kbps * 1000);
    }
    return true;
  }

  // ---------- Vorbis comment (FLAC, OGG) a obrázek ve formátu FLAC PICTURE ----------
  const VORBIS_POLE = { TITLE: 'titul', ARTIST: 'interpret', ALBUM: 'album', DATE: 'rok', TRACKNUMBER: 'stopa', GENRE: 'zanr' };
  function vorbisKomentar(b, i, vysl) {
    const vendor = le32(b, i); i += 4 + vendor;
    const n = le32(b, i); i += 4;
    for (let k = 0; k < n && i + 4 <= b.length; k++) {
      const d = le32(b, i), t = utf8(b.subarray(i + 4, i + 4 + d)); i += 4 + d;
      const rov = t.indexOf('='); if (rov < 0) continue;
      const klic = t.slice(0, rov).toUpperCase(), hodnota = t.slice(rov + 1);
      if (VORBIS_POLE[klic] && !vysl[VORBIS_POLE[klic]]) vysl[VORBIS_POLE[klic]] = hodnota.trim();
      else if (klic === 'METADATA_BLOCK_PICTURE' && !vysl.obal) {
        try { obrazekFlac(Uint8Array.from(atobPrenosne(hodnota), c => c.charCodeAt(0)), 0, vysl); } catch (e) { /* poškozený obrázek */ }
      }
    }
  }
  const atobPrenosne = s => typeof atob === 'function' ? atob(s) : Buffer.from(s, 'base64').toString('latin1');
  function obrazekFlac(b, i, vysl) {
    const ml = u32(b, i + 4), mime = latin1(b.subarray(i + 8, i + 8 + ml));
    let j = i + 8 + ml; j += 4 + u32(b, j); j += 16;
    const d = u32(b, j);
    vysl.obal = { mime: mime || 'image/jpeg', data: b.slice(j + 4, j + 4 + d) };
  }

  function flac(b, velikost, vysl) {
    let i = 4;
    vysl.format = 'FLAC';
    while (i + 4 <= b.length) {
      const posledni = b[i] & 0x80, typ = b[i] & 0x7F, d = u24(b, i + 1), o = i + 4;
      if (o + d > b.length && typ !== 6) { i = o + d; break; }   // blok přesahuje přečtená data → volající dočte
      if (typ === 0) {
        const hz = (b[o + 10] << 12) | (b[o + 11] << 4) | (b[o + 12] >> 4);
        const kanaly = ((b[o + 12] >> 1) & 7) + 1;
        const vzorky = (b[o + 13] & 15) * 4294967296 + u32(b, o + 14);
        vysl.khz = Math.round(hz / 1000); vysl.kanaly = kanaly;
        if (hz && vzorky) vysl.delka = vzorky / hz;
      } else if (typ === 4) vorbisKomentar(b, o, vysl);
      else if (typ === 6 && !vysl.obal && o + d <= b.length) obrazekFlac(b, o, vysl);
      i = o + d;
      if (posledni) break;
    }
    if (vysl.delka) vysl.kbps = Math.round(velikost * 8 / vysl.delka / 1000);
    return i;
  }

  // ---------- OGG: pakety z prvních stránek, délka z granule poslední stránky ----------
  function oggPakety(b, max) {
    const pakety = []; let akt = [], i = 0;
    while (i + 27 <= b.length && pakety.length < max) {
      if (latin1(b.subarray(i, i + 4)) !== 'OggS') break;
      const nseg = b[i + 26], tab = b.subarray(i + 27, i + 27 + nseg);
      let j = i + 27 + nseg;
      if (tab.length < nseg || j + tab.reduce((x, y) => x + y, 0) > b.length) break;   // stránka přesahuje načtená data
      for (const s of tab) {
        akt.push(b.subarray(j, j + s)); j += s;
        if (s < 255) { pakety.push(spoj(akt)); akt = []; }
      }
      i = j;
    }
    return pakety;
  }
  function spoj(casti) {
    const n = casti.reduce((s, c) => s + c.length, 0), v = new Uint8Array(n); let o = 0;
    for (const c of casti) { v.set(c, o); o += c.length; }
    return v;
  }
  function ogg(b, vysl) {
    const [hlav, kom] = oggPakety(b, 2);
    if (!hlav) return null;
    vysl._komentar = !!kom;   // paket komentáře se nevešel do přečteného začátku (velký obal) → dočíst
    let rychlost = 0, preskip = 0;
    if (latin1(hlav.subarray(1, 7)) === 'vorbis') {
      vysl.format = 'OGG'; vysl.kanaly = hlav[11]; rychlost = le32(hlav, 12);
      if (kom && latin1(kom.subarray(1, 7)) === 'vorbis') vorbisKomentar(kom, 7, vysl);
    } else if (latin1(hlav.subarray(0, 8)) === 'OpusHead') {
      vysl.format = 'OPUS'; vysl.kanaly = hlav[9]; rychlost = 48000; preskip = le16(hlav, 10);
      if (kom && latin1(kom.subarray(0, 8)) === 'OpusTags') vorbisKomentar(kom, 8, vysl);
    } else return null;
    vysl.khz = Math.round((vysl.format === 'OPUS' ? le32(hlav, 12) || 48000 : rychlost) / 1000);
    return { rychlost, preskip };
  }
  function oggDelka(konec, info) {
    for (let i = konec.length - 27; i >= 0; i--) {
      if (konec[i] === 0x4F && latin1(konec.subarray(i, i + 4)) === 'OggS') {
        const granule = le32(konec, i + 6) + le32(konec, i + 10) * 4294967296;
        return (granule - info.preskip) / info.rychlost;
      }
    }
    return null;
  }

  // ---------- MP4 / M4A ----------
  async function mp4(cti, velikost, vysl) {
    vysl.format = 'M4A';
    // projdi atomy nejvyšší úrovně, najdi moov (bývá i na konci souboru)
    let i = 0, moov = null;
    while (i + 8 <= velikost) {
      const h = await cti(i, 16);
      let d = u32(h, 0); const typ = latin1(h.subarray(4, 8)); let hl = 8;
      if (d === 1) { d = u32(h, 8) * 4294967296 + u32(h, 12); hl = 16; } else if (d === 0) d = velikost - i;
      if (d < 8) break;
      if (typ === 'moov') { moov = await cti(i + hl, Math.min(d - hl, 64 * 1024 * 1024)); break; }
      i += d;
    }
    if (!moov) return;
    const atomy = (b, od, do_) => {
      const v = []; let j = od;
      while (j + 8 <= do_) { const d = u32(b, j); if (d < 8 || j + d > do_) break; v.push({ typ: latin1(b.subarray(j + 4, j + 8)), od: j + 8, do_: j + d }); j += d; }
      return v;
    };
    const najdi = (b, od, do_, cesta) => {
      for (const a of atomy(b, od, do_)) if (a.typ === cesta[0]) {
        if (cesta.length === 1) return a;
        const vnitrek = a.typ === 'meta' ? a.od + 4 : a.typ === 'stsd' ? a.od + 8 : a.od;
        const r = najdi(b, vnitrek, a.do_, cesta.slice(1)); if (r) return r;
      }
      return null;
    };
    const mvhd = najdi(moov, 0, moov.length, ['mvhd']);
    if (mvhd) {
      const v1 = moov[mvhd.od] === 1;
      const meritko = u32(moov, mvhd.od + (v1 ? 20 : 12));
      const trvani = v1 ? u32(moov, mvhd.od + 24) * 4294967296 + u32(moov, mvhd.od + 28) : u32(moov, mvhd.od + 16);
      if (meritko) vysl.delka = trvani / meritko;
    }
    for (const trak of atomy(moov, 0, moov.length).filter(a => a.typ === 'trak')) {
      const mp4a = najdi(moov, trak.od, trak.do_, ['mdia', 'minf', 'stbl', 'stsd', 'mp4a']) || najdi(moov, trak.od, trak.do_, ['mdia', 'minf', 'stbl', 'stsd', 'alac']);
      if (mp4a) { vysl.kanaly = u16(moov, mp4a.od + 16); vysl.khz = Math.round(u16(moov, mp4a.od + 24) / 1000); if (mp4a.typ === 'alac') vysl.format = 'ALAC'; break; }
    }
    const ilst = najdi(moov, 0, moov.length, ['udta', 'meta', 'ilst']);
    if (ilst) {
      const POLE = { '\xa9nam': 'titul', '\xa9ART': 'interpret', '\xa9alb': 'album', '\xa9day': 'rok', '\xa9gen': 'zanr' };
      for (const a of atomy(moov, ilst.od, ilst.do_)) {
        const data = atomy(moov, a.od, a.do_).find(x => x.typ === 'data');
        if (!data) continue;
        const typ = u32(moov, data.od) & 0xFFFFFF, obsah = moov.subarray(data.od + 8, data.do_);
        if (POLE[a.typ]) vysl[POLE[a.typ]] = utf8(obsah).trim();
        else if (a.typ === 'trkn' && obsah.length >= 4) vysl.stopa = String(u16(obsah, 2));
        else if (a.typ === 'covr' && !vysl.obal) vysl.obal = { mime: typ === 14 ? 'image/png' : 'image/jpeg', data: obsah.slice() };
      }
    }
    if (vysl.delka) vysl.kbps = Math.round(velikost * 8 / vysl.delka / 1000);
  }

  // ---------- WAV ----------
  // kousky RIFF od pozice i; vrací konec dat (kde mohou následovat další kousky, např. LIST s tagy)
  function wav(b, velikost, vysl, i = 12, zakl = 0) {
    vysl.format = 'WAV';
    let bajtyZaSek = 0, dataDelka = 0, konecDat = 0;
    while (i + 8 <= b.length) {
      const id = latin1(b.subarray(i, i + 4)), d = le32(b, i + 4), o = i + 8;
      if (id === 'fmt ') { vysl.kanaly = le16(b, o + 2); vysl.khz = Math.round(le32(b, o + 4) / 1000); bajtyZaSek = le32(b, o + 8); }
      else if (id === 'data') { dataDelka = Math.min(d, velikost - zakl - o); konecDat = zakl + o + d + (d & 1); break; }
      else if (id === 'LIST' && latin1(b.subarray(o, o + 4)) === 'INFO') {
        let j = o + 4;
        const POLE = { INAM: 'titul', IART: 'interpret', IPRD: 'album', ICRD: 'rok', IGNR: 'zanr' };
        while (j + 8 <= o + d) {
          const pid = latin1(b.subarray(j, j + 4)), pd = le32(b, j + 4);
          if (POLE[pid]) vysl[POLE[pid]] = cisti(jednobajtove(b.subarray(j + 8, j + 8 + pd)));
          j += 8 + pd + (pd & 1);
        }
      } else if (id === 'id3 ' || id === 'ID3 ') id3v2(b.subarray(o, o + d), vysl);
      i = o + d + (d & 1);
    }
    if (bajtyZaSek) { vysl.delka = dataDelka / bajtyZaSek; vysl.kbps = Math.round(bajtyZaSek * 8 / 1000); }
    return konecDat;
  }

  // ---------- vstup ----------
  async function precti(cti, velikost) {
    const vysl = { titul: '', interpret: '', album: '', rok: '', stopa: '', zanr: '', obal: null, delka: null, kbps: null, khz: null, kanaly: null, format: '' };
    let zacatek = await cti(0, Math.min(velikost, 256 * 1024));
    const sig = latin1(zacatek.subarray(0, 12));
    if (sig.startsWith('fLaC')) {
      // metadata FLACu (i s velkým obrázkem) – dočíst, pokud nestačí
      if (flac(zacatek, velikost, vysl) > zacatek.length && velikost > zacatek.length) {
        zacatek = await cti(0, Math.min(velikost, 16 * 1024 * 1024));
        Object.assign(vysl, { titul: '', interpret: '', obal: null }); flac(zacatek, velikost, vysl);
      }
    } else if (sig.startsWith('OggS')) {
      let info = ogg(zacatek, vysl);
      if (info && !vysl._komentar && velikost > zacatek.length) { zacatek = await cti(0, Math.min(velikost, 16 * 1024 * 1024)); info = ogg(zacatek, vysl); }
      delete vysl._komentar;
      if (info) vysl.delka = oggDelka(await cti(Math.max(0, velikost - 65536), Math.min(velikost, 65536)), info);
      if (vysl.delka) vysl.kbps = Math.round(velikost * 8 / vysl.delka / 1000);
    } else if (sig.slice(4, 8) === 'ftyp') await mp4(cti, velikost, vysl);
    else if (sig.startsWith('RIFF') && sig.slice(8, 12) === 'WAVE') {
      const konec = wav(zacatek, velikost, vysl);
      if (konec && konec + 8 <= velikost) {   // LIST/id3 za daty
        const ocas = await cti(konec, Math.min(velikost - konec, 1024 * 1024)), info = { kanaly: vysl.kanaly, khz: vysl.khz, delka: vysl.delka, kbps: vysl.kbps };
        wav(ocas, velikost, vysl, 0, konec);
        Object.assign(vysl, info);
      }
    }
    else {
      let od = 0, zakl = 0;
      if (sig.startsWith('ID3')) {
        const potreba = synch(zacatek, 6) + 10 + 16 * 1024;
        if (potreba > zacatek.length && velikost > zacatek.length) zacatek = await cti(0, Math.min(velikost, potreba, 32 * 1024 * 1024));
        od = id3v2(zacatek, vysl);
        // některé programy dávají ID3 i před FLAC/OGG → zbytek přečíst jako vlastní formát (tagy formátu mají přednost)
        const za = await cti(od, Math.min(Math.max(0, velikost - od), 12));
        if (latin1(za.subarray(0, 4)) === 'fLaC' || latin1(za.subarray(0, 4)) === 'OggS') {
          const zbytek = await precti((o, d) => cti(od + o, d), velikost - od);
          for (const kl of Object.keys(zbytek)) if (zbytek[kl] || !vysl[kl]) vysl[kl] = zbytek[kl] || vysl[kl];
          return vysl;
        }
        if (od + 8192 > zacatek.length && velikost > od) { zacatek = await cti(od, Math.min(velikost - od, 64 * 1024)); zakl = od; od = 0; }
      }
      const konec = velikost >= 128 ? await cti(velikost - 128, 128) : new Uint8Array(0);
      const v1 = id3v1(konec, vysl);
      mp3(zacatek, od, zakl, velikost - (v1 ? 128 : 0), vysl);
    }
    for (const k of ['titul', 'interpret', 'album', 'rok', 'stopa', 'zanr']) vysl[k] = (vysl[k] || '').trim();
    if (vysl.delka !== null && !(vysl.delka > 0 && isFinite(vysl.delka))) vysl.delka = null;
    return vysl;
  }
  // čtečka nad Blob/File v prohlížeči
  const ctiBlob = blob => async (od, d) => new Uint8Array(await blob.slice(od, od + d).arrayBuffer());

  window.WA_TAGY = { precti, ctiBlob, hlavickaMp3, ZANRY };
})();
