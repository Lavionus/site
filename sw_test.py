import sys, time; sys.path.insert(0,'.')
from wd import WD
d = WD(1000,900)
try:
    d.jdi('http://localhost:8123/nodus/index.html')
    time.sleep(3.5)
    print(d.js("""
      const r = await navigator.serviceWorker.ready;
      const keys = await caches.keys();
      const c = await caches.open(keys.find(k=>k.startsWith('nodus-')));
      const font = await c.match('/nodus/fonty/playwrite-cz.woff2');
      return {stav: !!r.active, cache: keys.filter(k=>k.startsWith('nodus-')),
              fontVCache: !!font, typ: font && font.headers.get('content-type'),
              polozek: (await c.keys()).length};""").__str__() if False else d.js("""
      const cb = arguments[arguments.length-1];
      (async () => {
        const r = await navigator.serviceWorker.ready;
        const keys = await caches.keys();
        const jm = keys.filter(k=>k.startsWith('nodus-'));
        const c = await caches.open(jm[0]);
        const font = await c.match('/nodus/fonty/playwrite-cz.woff2');
        cb({aktivni: !!r.active, cache: jm, fontVCache: !!font, polozek: (await c.keys()).length});
      })();""") )
finally:
    d.konec()
