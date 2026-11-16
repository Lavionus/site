Model pro detekci obličejů – Anonymizace fotek (obsah/anonymizace.html)
=====================================================================

ultraface-rfb-320.onnx (1,2 MB)
  Ultra-Light-Fast-Generic-Face-Detector-1MB, varianta version-RFB-320
  Vstup "input" [1,3,240,320] RGB CHW, normalizace (x − 127) / 128
  Výstupy "scores" [1,4420,2] (pozadí, obličej) a "boxes" [1,4420,4] (normované x0,y0,x1,y1)
  sha256 34cd7e60aeff28744c657de7a3dc64e872d506741de66987f3426f2b79f88017
  Zdroj: https://github.com/Linzaer/Ultra-Light-Fast-Generic-Face-Detector-1MB
         (models/onnx/version-RFB-320.onnx)
  Licence: MIT, Copyright (c) 2019 linzai

Běhové prostředí: onnxruntime-web 1.22.0 z obsah/lib/onnx/ (MIT, Microsoft) – sdílené se stránkou pozadi.html.
