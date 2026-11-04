piper-phonemize pro WebAssembly (espeak-ng) – fonemizace pro hlasy Piper
=======================================================================

Použití: obsah/predcitac.html (worker obsah/predcitac/worker.js). Načítá se až při prvním předčítání.

Soubory (beze změny z npm balíku @diffusionstudio/piper-wasm@1.0.0, adresář build/)
- piper_phonemize.js    – zavaděč Emscripten (globální createPiperPhonemize)
- piper_phonemize.wasm  – piper-phonemize + espeak-ng
- piper_phonemize.data  – data espeak-ng (všechny jazyky, 18 MB)

Licence
- espeak-ng: GPL-3.0-or-later – zdrojový kód https://github.com/rhasspy/espeak-ng
- piper-phonemize: MIT – https://github.com/rhasspy/piper-phonemize (sestavení pro WASM:
  https://github.com/wide-video/piper-phonemize, postup https://github.com/diffusion-studio/piper-wasm)
- balík @diffusionstudio/piper-wasm: MIT

Hlasy (modely ONNX) se do webu nebalí – stránka je stahuje z https://huggingface.co/rhasspy/piper-voices
(licence podle MODEL_CARD každého hlasu). Běhové prostředí onnxruntime-web je v ../onnx/.
