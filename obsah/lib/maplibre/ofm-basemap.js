/**
 * Podkladové mapy z OpenFreeMap – vektorové dlaždice renderované z dat
 * OpenStreetMap. Jsou zdarma, bez API klíče a bez limitů provozu, na rozdíl
 * od dobrovolnicky provozovaných dlaždicových serverů (tile.openstreetmap.org),
 * které automatizovaný provoz blokují ("App is not following the tile usage
 * policy").
 *
 * Vyžaduje v tomto pořadí: leaflet.js, maplibre-gl.js, leaflet-maplibre-gl.js.
 * Bez WebGL (starý prohlížeč, vypnutá akcelerace) se vrací rastrová náhrada
 * z CARTO, ať mapa funguje vždycky.
 */
(function (global) {
  'use strict';

  var ATTRIBUTION = '&copy; <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a> ' +
    '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> ' +
    '&copy; OpenStreetMap contributors';

  // Rastrová náhrada pro případ bez WebGL – vzhledově nejbližší styl z CARTO
  var RASTER_FALLBACK = {
    liberty: 'rastertiles/voyager',
    bright: 'rastertiles/voyager',
    positron: 'light_all',
    dark: 'dark_all'
  };

  /** Jsou k dispozici obě knihovny i WebGL? */
  function glAvailable() {
    if (typeof maplibregl === 'undefined' || !global.L || typeof L.maplibreGL !== 'function') return false;
    try {
      var c = document.createElement('canvas');
      return !!(c.getContext('webgl2') || c.getContext('webgl'));
    } catch (e) {
      return false;
    }
  }

  /**
   * Podokno pro vektorový podklad pod tilePane (z-index 150 < 200), aby nad ním
   * zůstaly rastrové překryvy – radar, satelitní snímky apod.
   */
  function createGlBasePane(map) {
    if (map.getPane('glBase')) return;
    map.createPane('glBase');
    map.getPane('glBase').style.zIndex = 150;
  }

  /**
   * Vrstva s podkladem OpenFreeMap.
   * @param {string} style  název stylu: liberty, bright, positron, dark
   * @param {Object} [opts] maxZoom (výchozí 20), attribution a
   *   preserveDrawingBuffer – nutné, když se má mapa snímat do obrázku
   *   (html2canvas); jinak je WebGL plátno po vykreslení prázdné
   * @returns {L.Layer}
   */
  function openFreeMapLayer(style, opts) {
    opts = opts || {};
    var maxZoom = opts.maxZoom || 20;
    var attribution = opts.attribution || ATTRIBUTION;

    if (!glAvailable()) {
      return L.tileLayer('https://{s}.basemaps.cartocdn.com/' + (RASTER_FALLBACK[style] || RASTER_FALLBACK.liberty) +
        '/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: maxZoom
      });
    }

    return L.maplibreGL({
      style: 'https://tiles.openfreemap.org/styles/' + style,
      pane: 'glBase',   // když podokno neexistuje, plugin sám spadne na tilePane
      maxZoom: maxZoom,
      preserveDrawingBuffer: !!opts.preserveDrawingBuffer,
      attributionControl: { customAttribution: attribution }
    });
  }

  global.OFM_ATTRIBUTION = ATTRIBUTION;
  global.glBaseAvailable = glAvailable;
  global.createGlBasePane = createGlBasePane;
  global.openFreeMapLayer = openFreeMapLayer;
})(window);
