onnxruntime-web 1.22.0 (jen WebAssembly backend) + model u2netp
================================================================

Použití: obsah/pozadi.html (Odstranění pozadí). Načítá se až po kliknutí na „Odstranit pozadí (AI)“.

Soubory
- ort.wasm.min.js               – onnxruntime-web 1.22.0, dist/ort.wasm.min.js (globální `ort`, jen wasm EP)
- ort-wasm-simd-threaded.mjs    – zavaděč wasm (dist/)
- ort-wasm-simd-threaded.wasm   – běhové prostředí (dist/, 11,2 MB)
  Zdroj: npm pack onnxruntime-web@1.22.0
  Licence: MIT, (c) Microsoft Corporation – https://github.com/microsoft/onnxruntime/blob/main/LICENSE

- u2netp.onnx                   – U²-Net, malá varianta (4,6 MB), vstup [1,3,320,320], normalizace ImageNet
  sha256 309c8469258dda742793dce0ebea8e6dd393174f89934733ecc8b14c76f4ddd8
  Zdroj souboru: https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2netp.onnx
    (rembg – MIT, (c) 2020 Daniel Gatis; ONNX export původních vah)
  Model a váhy: U-2-Net, Xuebin Qin a kol., https://github.com/xuebinqin/U-2-Net – Apache License 2.0
  Článek: Qin et al., „U2-Net: Going Deeper with Nested U-Structure for Salient Object Detection“, Pattern Recognition 2020.

Pozn.: modely BRIA RMBG záměrně nepoužity (nekomerční licence).
