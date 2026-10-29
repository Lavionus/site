PDF.js (pdfjs-dist 4.10.38, https://mozilla.github.io/pdf.js/) – Apache License 2.0 (LICENSE).
Legacy build (širší podpora prohlížečů): pdf.min.mjs + pdf.worker.min.mjs, beze změny; cmaps/ a standard_fonts/ z balíčku.
Je to ES modul: import * as pdfjsLib from './lib/pdfjs/pdf.min.mjs';
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('./lib/pdfjs/pdf.worker.min.mjs', location.href).href;
  getDocument({data, cMapUrl: 'lib/pdfjs/cmaps/', cMapPacked: true, standardFontDataUrl: 'lib/pdfjs/standard_fonts/'})
