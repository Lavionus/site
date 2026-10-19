/* bunecne_automaty/worker.js – výpočet automatu mimo hlavní vlákno.
   Veškerá logika je v jadro.js (třída Motor); zde jen přenos zpráv. */
'use strict';
importScripts('jadro.js');
const motor = new self.BunecneAutomaty.Motor((zprava, prenos) => self.postMessage(zprava, prenos || []));
self.onmessage = e => motor.zprava(e.data);
