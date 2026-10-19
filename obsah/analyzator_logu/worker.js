/* analyzator_logu/worker.js – Web Worker: streamované načítání a dotazy nad záznamy.
   Veškerá data zůstávají v tomto vlákně, do stránky jdou jen statistiky a viditelné řádky. */
'use strict';
importScripts('jadro.js', 'sklad.js');
const obsluha = self.LogSklad.vytvorObsluhu(z => self.postMessage(z));
self.onmessage = e => { obsluha(e.data); };
