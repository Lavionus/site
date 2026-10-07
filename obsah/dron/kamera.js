// Nad krajinou — kamery: FPV, za dronem, gimbal, pilot na zemi (LOS), volná (pro snímky a přehrávání).
(function (D) {
  'use strict';
  const REZIMY = ['fpv', 'chase', 'gimbal', 'los'];
  const qD = new THREE.Quaternion(), qN = new THREE.Quaternion(), v = new THREE.Vector3(), cil = new THREE.Vector3(), X = new THREE.Vector3(1, 0, 0);

  D.modul('kamera', {
    poradi: 90,
    init(ctx) {
      const k = ctx.kamera;
      ctx.kam = { rezim: D.param.kamera || (ctx.dron.typ === 'kamera' ? 'chase' : 'fpv'), fpvNaklon: 25, gimbalNaklon: -20,
        fovFPV: 100, fovBezny: 65, los: null };
      const pohled = D.paramCisla('pohled');               // x,y,z,yaw°,pitch° — pevný pohled pro snímky
      if (pohled) {
        ctx.kam.rezim = 'volna';
        const y = D.param.nad ? ctx.teren.vyska(pohled[0], pohled[2]) + pohled[1] : pohled[1];
        k.position.set(pohled[0], y, pohled[2]);
        k.rotation.set(D.radiany(pohled[4] || 0), D.radiany(pohled[3] || 0), 0, 'YXZ');
      }
      const s = ctx.teren.start;                             // pilot stojí kousek za startovní plochou
      ctx.kam.los = new THREE.Vector3(s.x + Math.sin(s.smer) * 6, 0, s.z + Math.cos(s.smer) * 6);
      ctx.kam.los.y = ctx.teren.vyska(ctx.kam.los.x, ctx.kam.los.z) + 1.7;
      this.chase = null;
      D.na('kamera', () => { if (ctx.kam.rezim === 'volna') return; ctx.kam.rezim = REZIMY[(REZIMY.indexOf(ctx.kam.rezim) + 1) % REZIMY.length]; this.chase = null; });
    },
    update(ctx, dt) {
      const k = ctx.kamera, d = ctx.dron, kam = ctx.kam, m = ctx.dronModel;
      if (ctx.vstup && ctx.vstup.gimbal && !ctx.pauza) kam.gimbalNaklon = D.clamp(kam.gimbalNaklon + ctx.vstup.gimbal * 60 * dt, -90, 20);
      if (kam.rezim === 'volna') return;
      qD.set(d.q[0], d.q[1], d.q[2], d.q[3]);
      const p = v.set(d.p[0], d.p[1], d.p[2]);
      let fov = kam.fovBezny;
      if (kam.rezim === 'fpv') {
        k.position.copy(m.kameraFPV).applyQuaternion(qD).add(p);
        qN.setFromAxisAngle(X, D.radiany(kam.fpvNaklon));
        k.quaternion.copy(qD).multiply(qN);
        fov = kam.fovFPV;
      } else if (kam.rezim === 'chase') {
        const yaw = D.yawZQ(d.q);
        cil.set(p.x + Math.sin(yaw) * 4.5, p.y + 1.6, p.z + Math.cos(yaw) * 4.5);   // za dronem (dopředu je −Z)
        const zem = ctx.teren.vyska(cil.x, cil.z) + 0.5; if (cil.y < zem) cil.y = zem;
        if (!this.chase) this.chase = cil.clone(); else this.chase.lerp(cil, 1 - Math.exp(-dt * 5));
        k.position.copy(this.chase); k.lookAt(p.x, p.y + 0.4, p.z);
      } else if (kam.rezim === 'gimbal') {
        const yaw = D.yawZQ(d.q);
        k.position.set(p.x, p.y - 0.08, p.z);
        k.rotation.set(D.radiany(kam.gimbalNaklon), yaw, 0, 'YXZ');
        fov = 70;
      } else if (kam.rezim === 'los') {
        k.position.copy(kam.los); k.lookAt(p);
        const dist = kam.los.distanceTo(p); fov = D.clamp(2400 / Math.max(dist, 1), 12, 60);
      }
      if (Math.abs(k.fov - fov) > 0.01) { k.fov = fov; k.updateProjectionMatrix(); }
    },
  });
})(globalThis.DRON = globalThis.DRON || {});
