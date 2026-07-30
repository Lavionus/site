/* =============================================================================
   fps_props.js — detailní geometrie props pro arénu (instancing + kolize)
   -----------------------------------------------------------------------------
   Bez addonů: vlastní mergeGeometries (není BufferGeometryUtils) a ensureUV2
   (aoMap čte "uv2"). Vrací { group, colliders }, kde colliders jsou AABB
   { min, max } pro tělesa, o která hráč zakopne.

   const { group, colliders } = buildProps(THREE, MAT); scene.add(group);
   ========================================================================== */
function buildProps(THREE, MAT){
  const group = new THREE.Group();
  const colliders = [];
  const V = (x,y,z)=>new THREE.Vector3(x,y,z);

  function addCollider(cx,cy,cz,sx,sy,sz){
    colliders.push({ min: V(cx-sx/2,cy-sy/2,cz-sz/2), max: V(cx+sx/2,cy+sy/2,cz+sz/2) });
  }
  function ensureUV2(geo){ if(geo.attributes.uv && !geo.attributes.uv2) geo.setAttribute('uv2', geo.attributes.uv); return geo; }

  /* sloučení geometrií (po zapečení jejich transformací) do jedné BufferGeometry */
  function mergeGeometries(geos){
    const ni = geos.map(g => g.index ? g.toNonIndexed() : g);
    let vc = 0; ni.forEach(g => vc += g.attributes.position.count);
    const pos=new Float32Array(vc*3), nor=new Float32Array(vc*3), uv=new Float32Array(vc*2);
    let po=0,no=0,uo=0;
    ni.forEach(g=>{
      pos.set(g.attributes.position.array, po); po+=g.attributes.position.array.length;
      if(g.attributes.normal){ nor.set(g.attributes.normal.array, no); } no+=g.attributes.position.count*3;
      if(g.attributes.uv){ uv.set(g.attributes.uv.array, uo); } uo+=g.attributes.position.count*2;
    });
    const m=new THREE.BufferGeometry();
    m.setAttribute('position', new THREE.BufferAttribute(pos,3));
    m.setAttribute('normal',   new THREE.BufferAttribute(nor,3));
    m.setAttribute('uv',       new THREE.BufferAttribute(uv,2));
    return m;
  }

  function instanced(geo, mat, mats, shadow){
    ensureUV2(geo);
    const im = new THREE.InstancedMesh(geo, mat, mats.length);
    mats.forEach((m,i)=>im.setMatrixAt(i,m));
    im.castShadow = shadow!==false; im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    group.add(im);
    return im;
  }
  const mat4 = (x,y,z, rx,ry,rz, s)=>{
    const m=new THREE.Matrix4();
    const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(rx||0,ry||0,rz||0));
    m.compose(V(x,y,z), q, typeof s==='number'?V(s,s,s):(s||V(1,1,1)));
    return m;
  };

  /* ---------- 1) PŘEPRAVNÍ BEDNY (instanced) + kolize ---------- */
  const crates = [
    [-14,1.5,-8, 3, 0.2], [-10.6,1.5,-8, 3, -0.1], [-12.3,4.4,-8, 2.6, 0.5],
    [16,1.5,12, 3, 0.0], [12.4,1.5,13.6, 3, 0.3], [14.2,4.4,12.8, 2.4, -0.2],
    [0,1.5,21, 3, 0.15], [4,1.5,23, 2.6, -0.25],
    [-21,1.5,18, 3, 0.1], [22,1.5,-18, 3, -0.15], [-24,1.5,-14, 2.6, 0.4],
    [8,1.5,-21, 3, 0.0], [-6,1.5,-23, 2.8, 0.2],
  ];
  {
    const geo = new THREE.BoxGeometry(1,1,1);
    const cornerParts=[];
    const mats = crates.map(([x,y,z,s,r])=>{ addCollider(x,y,z,s,s,s); return mat4(x,y,z,0,r,0,s); });
    instanced(geo, MAT.crate, mats);
    // kovové rohy hero-beden (první 6) — sloučeno do 1 geometrie, 1 draw call
    for(let k=0;k<6;k++){
      const [x,y,z,s,r]=crates[k]; const h=s*0.5, t=s*0.12;
      const signs=[-1,1];
      for(const sx of signs)for(const sy of signs)for(const sz of signs){
        const g=new THREE.BoxGeometry(t,t,t);
        g.translate(sx*(h-t/2), sy*(h-t/2), sz*(h-t/2));
        g.rotateY(r); g.translate(x,y,z);
        cornerParts.push(g);
      }
    }
    if(cornerParts.length){
      const cg=mergeGeometries(cornerParts); ensureUV2(cg);
      const cm=new THREE.Mesh(cg, MAT.metalTrim); cm.castShadow=true; group.add(cm);
    }
  }

  /* ---------- 2) KOVOVÉ BARELY (merged geo, instanced) ---------- */
  {
    const parts=[];
    const body=new THREE.CylinderGeometry(0.55,0.55,1.5,16); body.translate(0,0.75,0); parts.push(body);
    const lid=new THREE.CylinderGeometry(0.57,0.57,0.08,16); lid.translate(0,1.5,0); parts.push(lid);
    for(const yy of [0.35,0.75,1.15]){ const ring=new THREE.CylinderGeometry(0.58,0.58,0.06,16); ring.translate(0,yy,0); parts.push(ring); }
    const barrel=mergeGeometries(parts);
    const spots=[[-18,0,-4],[19,0,6],[6,0,16],[-8,0,10],[24,0,-10],[-26,0,2]];
    const mats=spots.map(([x,,z])=>{ addCollider(x,0.75,z,1.2,1.5,1.2); return mat4(x,0,z,0,Math.random()*3,0,1); });
    instanced(barrel, MAT.metalTrim, mats);
  }

  /* ---------- 3) SLOUPY s patkou a hlavicí (merged, instanced) ---------- */
  {
    const H=6, parts=[];
    const shaft=new THREE.CylinderGeometry(0.7,0.75,H,14); shaft.translate(0,H/2,0); parts.push(shaft);
    const base=new THREE.BoxGeometry(2,0.5,2); base.translate(0,0.25,0); parts.push(base);
    const cap=new THREE.BoxGeometry(2,0.5,2); cap.translate(0,H-0.25,0); parts.push(cap);
    const pillar=mergeGeometries(parts);
    const spots=[[-26,26],[26,26],[26,-26],[-26,-26],[0,0]];
    const mats=spots.map(([x,z])=>{ addCollider(x,H/2,z,2,H,2); return mat4(x,0,z,0,0,0,1); });
    instanced(pillar, MAT.pillar, mats);
  }

  /* ---------- 4) SCI-FI STĚNOVÉ PANELY po obvodu (instanced, dekorace) ---------- */
  {
    const parts=[];
    const p=new THREE.BoxGeometry(3.4,4,0.4); parts.push(p);
    for(const rx of [-1.1,0,1.1]){ const rib=new THREE.BoxGeometry(0.25,3.6,0.15); rib.translate(rx,0,0.28); parts.push(rib); }
    const panel=mergeGeometries(parts);
    const mats=[]; const A=42;
    for(let i=-5;i<=5;i++){ mats.push(mat4(i*3.6, 2, -A+0.6, 0,0,0,1)); mats.push(mat4(i*3.6, 2, A-0.6, 0,Math.PI,0,1)); }
    for(let i=-5;i<=5;i++){ mats.push(mat4(-A+0.6, 2, i*3.6, 0,Math.PI/2,0,1)); mats.push(mat4(A-0.6, 2, i*3.6, 0,-Math.PI/2,0,1)); }
    instanced(panel, MAT.wall, mats, false);
  }

  /* ---------- 5) BETONOVÉ BARIÉRY (jersey, ExtrudeGeometry, instanced) + kolize ---------- */
  {
    const shape=new THREE.Shape();
    shape.moveTo(-0.5,0); shape.lineTo(0.5,0); shape.lineTo(0.28,0.35);
    shape.lineTo(0.16,1.0); shape.lineTo(-0.16,1.0); shape.lineTo(-0.28,0.35); shape.lineTo(-0.5,0);
    const geo=new THREE.ExtrudeGeometry(shape, { depth:3, bevelEnabled:false });
    geo.translate(0,0,-1.5); geo.computeVertexNormals();
    const spots=[[-6,0,6, 0],[10,0,-6, Math.PI/2],[-16,0,-16, 0.6],[18,0,20, -0.4]];
    const mats=spots.map(([x,y,z,r])=>{ addCollider(x,0.5,z,3,1,1.2); return mat4(x,y,z,0,r,0,1); });
    instanced(geo, MAT.pillar, mats);
  }

  /* ---------- 6) POTRUBÍ podél zdí (dekorace, bez kolize) ---------- */
  {
    const parts=[];
    function pipe(x1,z1,x2,z2,y){
      const dx=x2-x1, dz=z2-z1, len=Math.hypot(dx,dz);
      const g=new THREE.CylinderGeometry(0.18,0.18,len,10);
      g.rotateZ(Math.PI/2); g.rotateY(-Math.atan2(dz,dx));
      g.translate((x1+x2)/2, y, (z1+z2)/2); parts.push(g);
    }
    pipe(-41,-20,-41,20, 5.2); pipe(41,-18,41,22, 4.6); pipe(-20,-41,20,-41, 5.6);
    const pg=mergeGeometries(parts); ensureUV2(pg);
    const pm=new THREE.Mesh(pg, MAT.metalTrim); pm.castShadow=true; group.add(pm);
  }

  /* ---------- 7) TROSKY (drobné instanced boxy, dekorace) ---------- */
  {
    const geo=new THREE.BoxGeometry(0.5,0.35,0.5);
    const mats=[];
    for(let i=0;i<24;i++){
      const a=Math.random()*Math.PI*2, r=6+Math.random()*30;
      mats.push(mat4(Math.cos(a)*r, 0.17, Math.sin(a)*r, Math.random(),Math.random()*3,Math.random(), 0.6+Math.random()*0.8));
    }
    instanced(geo, MAT.crate, mats);
  }

  /* ---------- 8) RAMPA + vyvýšená plošina (+ kolizní schody) ---------- */
  {
    const len=13, w=6, rise=3.4, x=0, z=34, zStart=z-len/2-6;
    const mesh=new THREE.Mesh(ensureUV2(new THREE.BoxGeometry(w,0.6,len+2)), MAT.ramp);
    const angle=Math.atan2(rise,len);
    mesh.position.set(x, rise/2, zStart+ (len)/2 - 3); mesh.rotation.x = -angle;
    mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh);
    const steps=7;
    for(let i=0;i<steps;i++){ const t=(i+0.5)/steps, yy=t*rise, pz=zStart-3+ t*len; addCollider(x, yy/2, pz, w, yy+0.4, len/steps+0.5); }
    // plošina
    const plat=new THREE.Mesh(ensureUV2(new THREE.BoxGeometry(14,1,14)), MAT.wall);
    plat.position.set(x, rise, z); plat.castShadow=true; plat.receiveShadow=true; group.add(plat);
    addCollider(x, rise, z, 14, 1, 14);
    // zábradlí plošiny (dekorace)
    const railParts=[];
    for(const sx of [-7,7]){ const g=new THREE.BoxGeometry(0.2,1,14); g.translate(x+sx, rise+1, z); railParts.push(g); }
    const rg=mergeGeometries(railParts); ensureUV2(rg);
    const rmz=new THREE.Mesh(rg, MAT.metalTrim); rmz.castShadow=true; group.add(rmz);
  }

  return { group, colliders };
}
