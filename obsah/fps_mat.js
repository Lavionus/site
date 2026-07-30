/* =============================================================================
   fps_mat.js — procedurální PBR materiály pro FPS arénu
   -----------------------------------------------------------------------------
   Vše vzniká na <canvas> (žádné externí textury, web běží offline).
   Realismus stojí na NORMAL mapách počítaných Sobelovým gradientem z výškové
   mapy + vícevrstvém value-noise (fBm). Vrací MeshStandardMaterial se sadou
   map / normalMap / roughnessMap / aoMap (aoMap čte kanál "uv2").

   Použití:  const MAT = makePBRMaterials(THREE);
   POZOR:    geometrie s aoMap musí mít uv2 → geo.setAttribute('uv2', geo.attributes.uv)
   ========================================================================== */
function makePBRMaterials(THREE) {
  const NC = THREE.NoColorSpace, SRGB = THREE.SRGBColorSpace, RW = THREE.RepeatWrapping;

  /* ---- deterministický šum (value noise + fBm) ---- */
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  function makeNoise(seed){
    const rnd=mulberry32(seed), N=256, g=new Float32Array(N*N);
    for(let i=0;i<g.length;i++)g[i]=rnd();
    const at=(x,y)=>g[((y&(N-1))*N)+(x&(N-1))];
    function s(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
      const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
      const a=at(xi,yi),b=at(xi+1,yi),c=at(xi,yi+1),d=at(xi+1,yi+1);
      return a*(1-u)*(1-v)+b*u*(1-v)+c*(1-u)*v+d*u*v;}
    return function(x,y,oct,gain){oct=oct||4;gain=gain||0.5;let amp=1,f=1,sum=0,nrm=0;
      for(let o=0;o<oct;o++){sum+=amp*s(x*f,y*f);nrm+=amp;amp*=gain;f*=2;}return sum/nrm;};
  }

  const S = 512;
  function canvas(){const c=document.createElement('canvas');c.width=c.height=S;return c;}
  function tex(c, cs){const t=new THREE.CanvasTexture(c);t.colorSpace=cs;t.wrapS=t.wrapT=RW;t.anisotropy=8;return t;}

  /* Sobel: výšková (grayscale) mapa → normal mapa (bezešvě, s wrapem) */
  function heightToNormal(hCanvas, strength){
    const src=hCanvas.getContext('2d').getImageData(0,0,S,S).data;
    const out=canvas(), octx=out.getContext('2d'), img=octx.createImageData(S,S);
    const H=(x,y)=>src[(((y%S+S)%S)*S+((x%S+S)%S))*4]/255;
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){
      const tl=H(x-1,y-1),t=H(x,y-1),tr=H(x+1,y-1),l=H(x-1,y),r=H(x+1,y),bl=H(x-1,y+1),b=H(x,y+1),br=H(x+1,y+1);
      const dx=(tr+2*r+br)-(tl+2*l+bl), dy=(bl+2*b+br)-(tl+2*t+tr);
      let nx=-dx*strength, ny=-dy*strength, nz=1, len=Math.hypot(nx,ny,nz);
      const i=(y*S+x)*4;
      img.data[i]=(nx/len*.5+.5)*255; img.data[i+1]=(ny/len*.5+.5)*255; img.data[i+2]=(nz/len*.5+.5)*255; img.data[i+3]=255;
    }
    octx.putImageData(img,0,0);
    return tex(out, NC);
  }

  /* Obecný generátor sady: per-pixel callback plní albedo, výšku, roughness, AO.
     px(x,y,n) → { r,g,b, h, rough, ao }  (0..255 barvy, 0..1 h/rough/ao) */
  function build(seed, px, normalStrength){
    const n=makeNoise(seed);
    const alb=canvas(), hgt=canvas(), rgh=canvas(), aoc=canvas();
    const ai=alb.getContext('2d').createImageData(S,S);
    const hi=hgt.getContext('2d').createImageData(S,S);
    const ri=rgh.getContext('2d').createImageData(S,S);
    const oi=aoc.getContext('2d').createImageData(S,S);
    for(let y=0;y<S;y++)for(let x=0;x<S;x++){
      const o=px(x,y,n); const i=(y*S+x)*4;
      ai.data[i]=o.r; ai.data[i+1]=o.g; ai.data[i+2]=o.b; ai.data[i+3]=255;
      const hv=Math.max(0,Math.min(1,o.h))*255; hi.data[i]=hi.data[i+1]=hi.data[i+2]=hv; hi.data[i+3]=255;
      const rv=Math.max(0,Math.min(1,o.rough))*255; ri.data[i]=ri.data[i+1]=ri.data[i+2]=rv; ri.data[i+3]=255;
      const ov=Math.max(0,Math.min(1,o.ao))*255; oi.data[i]=oi.data[i+1]=oi.data[i+2]=ov; oi.data[i+3]=255;
    }
    alb.getContext('2d').putImageData(ai,0,0);
    hgt.getContext('2d').putImageData(hi,0,0);
    rgh.getContext('2d').putImageData(ri,0,0);
    aoc.getContext('2d').putImageData(oi,0,0);
    return { map: tex(alb,SRGB), normalMap: heightToNormal(hgt, normalStrength),
             roughnessMap: tex(rgh,NC), aoMap: tex(aoc,NC) };
  }
  const lerp=(a,b,t)=>a+(b-a)*t;

  /* ---------- BETON (podlaha) ---------- */
  const concrete = build(11, (x,y,n)=>{
    const u=x/S*6, v=y/S*6;
    const f=n(u,v,5,0.55), grain=n(u*14,v*14,3,0.5), spot=n(u*0.6+10,v*0.6,3,0.5);
    // tenké vlásečnicové praskliny (řídké, jemné)
    const cr=1-Math.abs(n(u*1.3+5,v*1.3+5,4,0.5)*2-1); const crack=Math.pow(cr,26);
    let base=lerp(128,162,f) + (spot-0.5)*22 + (grain-0.5)*12;
    base -= crack*38;
    return { r: base*1.0, g: base*1.0, b: base*1.03,
             h: 0.5 + (f-0.5)*0.25 + (grain-0.5)*0.15 - crack*0.35,
             rough: lerp(0.78,0.94,f) + crack*0.04, ao: 1 - crack*0.3 - (1-f)*0.1 };
  }, 0.75);

  /* ---------- KOVOVÝ PANEL (zdi) ---------- */
  const metalPanel = build(22, (x,y,n)=>{
    const u=x/S, v=y/S;
    const seamX=Math.min(u%(1/3),1/3-u%(1/3)), seamY=Math.min(v%0.5,0.5-v%0.5);
    const seam=Math.min(seamX,seamY); const groove=seam<0.012?1:0;
    // nýty v rozích panelů
    const rx=(u%(1/3))*3, ry=(v%0.5)*2;
    const rivet=(Math.hypot(rx-0.08,ry-0.12)<0.05||Math.hypot(rx-0.92,ry-0.12)<0.05)?1:0;
    const brushed=n(u*300,v*4,2,0.5); // broušené proužky
    let base=lerp(92,116,brushed*0.6+0.2) - groove*40 + rivet*30;
    return { r: base*0.94, g: base*1.0, b: base*1.12,
             h: 0.6 - groove*0.6 + rivet*0.4, rough: lerp(0.32,0.5,brushed) - rivet*0.1, ao: 1-groove*0.55 };
  }, 2.6);

  /* ---------- PŘEPRAVNÍ BEDNA (žebrovaný kov) ---------- */
  const container = build(33, (x,y,n)=>{
    const u=x/S, v=y/S;
    const rib=Math.sin(u*Math.PI*18)*0.5+0.5; // svislé žebrování
    const wear=n(u*8,v*8,4,0.5);
    const edge=(u<0.06||u>0.94||v<0.06||v>0.94)?1:0; // oděr hran
    let r=lerp(150,205,rib*0.6+wear*0.4), g=lerp(96,120,rib*0.6+wear*0.4), b=lerp(40,54,rib*0.5);
    if(edge){ r=lerp(r,150,0.6); g=lerp(g,150,0.6); b=lerp(b,155,0.6);} // odřený kov
    return { r,g,b, h: rib*0.7 - (wear<0.25?0.3:0), rough: lerp(0.45,0.7,wear)+edge*0.1, ao: 1-(1-rib)*0.2-(wear<0.2?0.2:0) };
  }, 2.0);

  /* ---------- SLOUP (beton se špínou) ---------- */
  const pillarC = build(44, (x,y,n)=>{
    const u=x/S*4, v=y/S*4;
    const f=n(u,v,5,0.55); const streak=n(x/S*3, y/S*30, 3, 0.5); // svislé zatékání
    let base=lerp(120,150,f) - (streak<0.35?18:0);
    return { r: base*1.0, g: base*1.0, b: base*1.03, h: f*0.6, rough: lerp(0.6,0.85,f), ao: 1-(streak<0.3?0.25:0)-(1-f)*0.15 };
  }, 1.8);

  /* ---------- RAMPA (diamantový plech) ---------- */
  const diamond = build(55, (x,y,n)=>{
    const u=x/S*10, v=y/S*10;
    // kosočtvercový vzor
    const a=Math.abs(((u+v)%1)-0.5), b=Math.abs(((u-v)%1)-0.5);
    const d=Math.min(a,b); const raised=d<0.16?1:0;
    const wear=n(x/S*6,y/S*6,3,0.5);
    let base=lerp(104,128,wear)+raised*14;
    return { r: base*0.96, g: base*1.0, b: base*1.08, h: raised*0.8+0.1, rough: lerp(0.35,0.5,wear)-raised*0.05, ao: 1-(raised?0:0.15) };
  }, 3.0);

  /* ---------- KOVOVÝ LEM / accent (emisní pruh) ---------- */
  const trimEmis = (()=>{ const c=canvas(), g=c.getContext('2d');
    g.fillStyle='#000'; g.fillRect(0,0,S,S);
    g.fillStyle='#2fd8ff'; g.shadowColor='#2fd8ff'; g.shadowBlur=22; g.fillRect(0,S*0.42,S,S*0.16);
    return tex(c, SRGB);
  })();

  /* ---------- sestavení materiálů ---------- */
  const floor = new THREE.MeshStandardMaterial({ ...concrete, roughness:1, metalness:0.05,
    normalScale:new THREE.Vector2(0.5,0.5), aoMapIntensity:0.8, envMapIntensity:0.5 });
  floor.map.repeat.set(8,8); floor.normalMap.repeat.set(8,8); floor.roughnessMap.repeat.set(8,8); floor.aoMap.repeat.set(8,8);

  const wall = new THREE.MeshStandardMaterial({ ...metalPanel, roughness:1, metalness:0.65,
    normalScale:new THREE.Vector2(1.1,1.1), aoMapIntensity:0.9, envMapIntensity:1.1 });
  [wall.map,wall.normalMap,wall.roughnessMap,wall.aoMap].forEach(t=>t.repeat.set(3,2));

  const crate = new THREE.MeshStandardMaterial({ ...container, roughness:1, metalness:0.5,
    normalScale:new THREE.Vector2(1,1), aoMapIntensity:1, envMapIntensity:1 });

  const pillar = new THREE.MeshStandardMaterial({ ...pillarC, roughness:1, metalness:0.15,
    normalScale:new THREE.Vector2(0.8,0.8), aoMapIntensity:1, envMapIntensity:0.8 });
  [pillar.map,pillar.normalMap,pillar.roughnessMap,pillar.aoMap].forEach(t=>t.repeat.set(1,2));

  const ramp = new THREE.MeshStandardMaterial({ ...diamond, roughness:1, metalness:0.75,
    normalScale:new THREE.Vector2(1.2,1.2), aoMapIntensity:0.8, envMapIntensity:1.2 });
  [ramp.map,ramp.normalMap,ramp.roughnessMap,ramp.aoMap].forEach(t=>t.repeat.set(2,2));

  const metalTrim = new THREE.MeshStandardMaterial({ color:0x20242c, roughness:0.45, metalness:0.7,
    emissive:0x2aa0c8, emissiveMap:trimEmis, emissiveIntensity:0.7, envMapIntensity:1.1 });
  metalTrim.emissiveMap.repeat.set(4,1);

  return { floor, wall, crate, pillar, ramp, metalTrim };
}
