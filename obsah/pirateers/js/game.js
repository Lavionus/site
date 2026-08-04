/**
 * game.js — Pirateers.
 *
 * Souřadnice jsou souřadnice MAPY (0..world.width). Na plátno se kreslí
 * s posunem `camX/camY`, který mapu vycentruje - hra tak nezávisí na tom,
 * jak je okno velké.
 */

import { buildWorld, initWorldAssets, ISLAND_NAMES, TILE_SIZE } from './world.js';
import { makePRNG } from './noise.js';

const canvas = document.getElementById('gameCanvas');
// alpha:false - plátno se nemusí míchat se stránkou pod ním, měřitelně
// levnější kompozice každého snímku.
const ctx = canvas.getContext('2d', { alpha: false });

const el = id => document.getElementById(id);

// --- Načítání obrázků -------------------------------------------------
// Obrázky stačí nakopírovat do složky pics/ pod uvedeným jménem.
// Dokud tam nejsou, hra kreslí náhradní vektorové tvary.
const SPRITE_FILES = {
    player: 'pics/player_ship.png',
    enemy: 'pics/enemy_ship.png',
    bullet: 'pics/cannonball.png'
};

const sprites = {};

for (const [name, src] of Object.entries(SPRITE_FILES)) {
    const img = new Image();
    img.onload = () => { sprites[name] = img; };
    img.onerror = () => { /* obrázek zatím není - kreslí se fallback */ };
    img.src = src;
}

// --- Rozměry plátna a kamera -----------------------------------------
let camX = 0;
let camY = 0;

function resizeCanvas() {
    canvas.width = canvas.clientWidth || window.innerWidth;
    canvas.height = canvas.clientHeight || window.innerHeight;
    ctx.imageSmoothingEnabled = false;
    centerCamera();
}

/** Mapa se vycentruje; když je okno větší, zbytek zůstane tmavý. */
function centerCamera() {
    needsDraw = true;         // změna mapy nebo okna = jedno překreslení navíc
    if (!world) { camX = 0; camY = 0; return; }
    camX = Math.round((canvas.width - world.width) / 2);
    camY = Math.round((canvas.height - world.height) / 2);
}

window.addEventListener('resize', resizeCanvas);

const keys = {};
window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();     // Space nesmí scrollovat
    if (e.code === 'Escape') openMenu();
    if (e.code === 'KeyP' && running) paused = !paused;
});
window.addEventListener('keyup', e => keys[e.code] = false);

// --- Týmy -------------------------------------------------------------
// Barva týmu se kreslí jako prstenec pod trupem - podle sprite se strany
// od sebe nepoznají, tohle je jediné spolehlivé rozlišení.
const TEAMS = {
    blue: { name: 'Modří', color: '#3498db', hull: '#f1c40f', ball: '#2c3e50' },
    red: { name: 'Rudí', color: '#e74c3c', hull: '#c0392b', ball: '#7b241c' }
};

// --- Střely -----------------------------------------------------------
const BULLET_SPEED = 7;
// Dostřel je krátký - lodě se musí k sobě přiblížit na boční salvu.
const BULLET_LIFE = 42;
const BULLET_RADIUS = 9;

// --- Vylepšení --------------------------------------------------------
// Každé vylepšení je jedna položka: co udělá s lodí a jak vypadá bedna.
const UPGRADES = [
    {
        id: 'CANNON', name: 'Těžší koule', icon: '⚫', color: '#e67e22',
        apply: s => { s.damage += 6; }
    },
    {
        id: 'RELOAD', name: 'Rychlejší nabíjení', icon: '⏱', color: '#f1c40f',
        apply: s => { s.shootDelay = Math.max(280, s.shootDelay * 0.82); }
    },
    {
        id: 'SAILS', name: 'Lepší plachty', icon: '⛵', color: '#ecf0f1',
        apply: s => { s.maxSpeed += 0.4; }
    },
    {
        id: 'RUDDER', name: 'Větší kormidlo', icon: '⚓', color: '#95a5a6',
        apply: s => { s.rotationSpeed += 0.008; }
    },
    {
        id: 'HULL', name: 'Pevnější trup', icon: '🛡', color: '#2ecc71',
        apply: s => { s.maxHp += 30; s.hp = Math.min(s.maxHp, s.hp + 45); }
    },
    {
        id: 'RANGE', name: 'Delší hlavně', icon: '🎯', color: '#9b59b6',
        apply: s => { s.bulletLife += 12; }
    },
    {
        id: 'CARPENTER', name: 'Tesařská parta', icon: '⚒', color: '#e8c39e',
        apply: s => { s.repairRate *= 1.8; s.hp = Math.min(s.maxHp, s.hp + 25); }
    }
];

/** Jak dlouho po zásahu se loď neopravuje (ms). */
const REPAIR_DELAY = 6000;

// --- Vítr --------------------------------------------------------------
// Plachetnice jede podle větru: po větru letí, na křížení se plazí a proti
// větru se nedostane vůbec. `angle` je směr, KAM vítr fouká.
const wind = { angle: 0, target: 0, speed: 1 };

/**
 * Účinnost plachet podle úhlu mezi kurzem a větrem.
 *   0° (po větru) = 1,0 · 90° (na půl větru) ≈ 0,74 · 180° (proti) = 0,18
 * Mocnina drží slušnou rychlost do zhruba 100° a pak ji rychle ubírá -
 * díky tomu se vyplatí křižovat, ne mířit napřímo proti větru.
 */
function sailEfficiency(heading) {
    const c = Math.cos(heading - wind.angle);
    return 0.18 + 0.82 * Math.pow((c + 1) / 2, 0.65);
}

function updateWind(dt, f) {
    // Vítr se pomalu stáčí ke svému cíli, ten se čas od času přehodí.
    if (gameTime > wind.nextShift) {
        wind.nextShift = gameTime + 12000 + Math.random() * 18000;
        wind.target = wind.angle + (Math.random() - 0.5) * 1.6;
    }
    wind.angle += normalizeAngle(wind.target - wind.angle) * 0.0015 * f;
}

function resetWind() {
    wind.angle = Math.random() * Math.PI * 2;
    wind.target = wind.angle;
    wind.nextShift = 8000;
    wind.speed = 1;
}

// --- Předpočítané kresby ---------------------------------------------
// Radiální gradient je drahý; výbuch si ho vyrobí jednou a pak už jen
// blituje hotový obrázek. Totéž stín koule.
const fireballSprite = (() => {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255,255,220,1)');
    grad.addColorStop(0.45, 'rgba(255,150,40,0.85)');
    grad.addColorStop(1, 'rgba(90,70,60,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    return c;
})();

// --- Entity -----------------------------------------------------------
class Ship {
    constructor(x, y, team, spriteName) {
        this.x = x;
        this.y = y;
        this.angle = Math.random() * Math.PI * 2;
        this.speed = 0;
        // Vyšší než dřív: vítr rychlost průměrně krátí zhruba na tři čtvrtiny,
        // tohle to vyrovnává, aby bitva neztratila tempo.
        this.maxSpeed = 3.5;
        // Plachetnice se neovládá přímo rychlostí, ale plachtami: throttle je
        // cílový podíl maximální rychlosti a loď se k němu teprve dopracuje.
        this.throttle = 0;
        this.trimRate = 0.02;    // jak rychle se plachty přetahují
        this.acceleration = 0.035;
        this.deceleration = 0.018;  // dojezd - zastavení trvá ~3 s
        this.rotationSpeed = 0.045;
        this.team = team;
        this.spriteName = spriteName;
        this.radius = 22;
        this.maxHp = 100;
        this.hp = this.maxHp;
        // Opravy: tesaři začnou látat trup, až když chvíli nic nelítá.
        this.repairRate = 2.2 / 60;    // HP za snímek při 60 FPS
        this.lastDamage = -99999;
        this.lastShot = -99999;   // na začátku nabito
        this.shootDelay = 1400;
        this.spread = 0;
        this.damage = 20;
        this.bulletLife = BULLET_LIFE;
        this.dead = false;
        this.isPlayer = false;
        // Srážky: loď se po nárazu chvíli „vzpamatovává"
        this.confusion = 0;
        this.touching = false;
        this.wasTouching = false;
        this.groundTimer = 0;     // prodleva mezi škrábnutími o dno
        this.escapeUntil = 0;     // dokdy se loď odlepuje od břehu
        this.escapeAngle = 0;
        this.wakeTimer = 0;
        this.upgrades = new Map();
    }

    /**
     * Poškozený trup je těžší a pomalejší - potopená loď by nedoplula.
     * Druhý činitel je vítr: proti němu se loď skoro nehne.
     */
    currentMaxSpeed() {
        const ratio = Math.max(0, this.hp / this.maxHp);
        return this.maxSpeed * (0.35 + 0.65 * ratio) * sailEfficiency(this.angle);
    }

    reloadProgress() {
        return Math.max(0, Math.min(1, (gameTime - this.lastShot) / this.shootDelay));
    }

    collect(upgrade) {
        upgrade.apply(this);
        this.upgrades.set(upgrade.id, (this.upgrades.get(upgrade.id) || 0) + 1);
    }

    draw() {
        this.drawTeamRing();

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        const sprite = sprites[this.spriteName];
        if (sprite) {
            // Sprite se předpokládá orientovaný přídí doprava (0 rad).
            // Škáluje se podle délky lodi (osa x), aby seděl dosah kolize.
            const w = this.radius * 2.8;
            const h = w * (sprite.height / sprite.width);
            ctx.drawImage(sprite, -w / 2, -h / 2, w, h);
        } else {
            ctx.fillStyle = TEAMS[this.team].hull;
            ctx.strokeStyle = 'rgba(0,0,0,0.45)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(25, 0);
            ctx.lineTo(-15, -15);
            ctx.lineTo(-9, 0);
            ctx.lineTo(-15, 15);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            ctx.fillStyle = '#5d4037';
            ctx.fillRect(-2, -9, 4, 18);
        }

        ctx.restore();
        this.drawBars();
    }

    drawTeamRing() {
        ctx.strokeStyle = TEAMS[this.team].color;
        ctx.lineWidth = this.isPlayer ? 4 : 2.5;
        ctx.globalAlpha = this.isPlayer ? 0.95 : 0.6;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius + 3, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawBars() {
        const w = 44;
        const y = this.y - this.radius - 18;

        // Život
        const ratio = Math.max(0, this.hp / this.maxHp);
        if (ratio < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(this.x - w / 2, y, w, 6);
            ctx.fillStyle = ratio > 0.5 ? '#2ecc71' : (ratio > 0.25 ? '#f1c40f' : '#e74c3c');
            ctx.fillRect(this.x - w / 2, y, w * ratio, 6);

            // Probíhající oprava: světlý pruh na konci života + křížek.
            if (this.repairing()) {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillRect(this.x - w / 2 + w * ratio, y, 3, 6);
                ctx.fillStyle = '#7bed9f';
                ctx.fillRect(this.x + w / 2 + 4, y + 1, 8, 3);
                ctx.fillRect(this.x + w / 2 + 6.5, y - 1.5, 3, 8);
            }
        }

        // Nabíjení - tenká linka hned pod životem. Zobrazuje se jen dokud
        // se nabíjí, aby plátno nezaplevelovaly plné pruhy.
        const reload = this.reloadProgress();
        if (reload < 1) {
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(this.x - w / 2, y + 7, w, 3);
            ctx.fillStyle = '#5dade2';
            ctx.fillRect(this.x - w / 2, y + 7, w * reload, 3);
        }
    }

    trim(delta, f) {
        this.throttle = Math.max(0, Math.min(1, this.throttle + delta * this.trimRate * f));
    }

    /** Kolik vteřin zbývá do začátku oprav; 0 = tesaři už pracují. */
    repairCountdown() {
        return Math.max(0, (REPAIR_DELAY - (gameTime - this.lastDamage)) / 1000);
    }

    repairing() {
        return this.hp < this.maxHp && this.repairCountdown() === 0;
    }

    update(f) {
        if (this.confusion > 0) this.confusion -= f * (1000 / 60);
        if (this.groundTimer > 0) this.groundTimer -= f * (1000 / 60);

        // Opravy za jízdy: pomalu, a jen když loď chvíli nikdo netrefil.
        // Přestřelku to nerozhodne, ale mezi vlnami útoků se dá vydýchat.
        if (this.repairing()) {
            this.hp = Math.min(this.maxHp, this.hp + this.repairRate * f);
        }

        // Rychlost se k cíli plazí - couvat nelze a zastavit se nedá naráz.
        const target = this.throttle * this.currentMaxSpeed();
        if (this.speed < target) {
            this.speed = Math.min(target, this.speed + this.acceleration * f);
        } else if (this.speed > target) {
            this.speed = Math.max(target, this.speed - this.deceleration * f);
        }
        if (this.speed < 0) this.speed = 0;

        this.x += Math.cos(this.angle) * this.speed * f;
        this.y += Math.sin(this.angle) * this.speed * f;

        // Brázda se pouští po kouscích času, ne každý snímek - jinak by z ní
        // byl souvislý pruh a stovky objektů navíc.
        this.wakeTimer -= f * (1000 / 60);
        if (this.speed > 0.5 && this.wakeTimer <= 0) {
            this.wakeTimer = 120;
            effects.push(new Wake(
                this.x - Math.cos(this.angle) * this.radius,
                this.y - Math.sin(this.angle) * this.radius,
                this.speed
            ));
        }

        this.hitShore();
    }

    /**
     * Kolize s břehem. Vzdálenostní pole dává jak hloubku, tak směr do
     * volné vody, takže se loď o mělčinu zastaví a sklouzne podél pobřeží
     * místo aby se zasekla.
     */
    hitShore() {
        const d = world.depth(this.x, this.y);
        if (d >= this.radius) return;

        const n = world.normal(this.x, this.y);
        this.x += n.x * (this.radius - d);
        this.y += n.y * (this.radius - d);

        // Míří-li příď na břeh, náraz sebere rychlost a trochu i trup.
        const into = -(Math.cos(this.angle) * n.x + Math.sin(this.angle) * n.y);
        if (into <= 0) return;

        const impact = this.speed * into;
        this.speed *= 0.25;
        this.throttle *= 0.5;
        // Kurz na volnou vodu si loď zapamatuje: dokud se od břehu neodlepí,
        // řídí se jím a neřeší boj. Jinak by o mělčinu drhla dál a čekala.
        this.escapeUntil = gameTime + 1600;
        this.escapeAngle = Math.atan2(n.y, n.x);
        if (impact > 0.6 && this.groundTimer <= 0) {
            this.groundTimer = 700;
            this.hp -= impact * 3;
            this.lastDamage = gameTime;      // na mělčině se neopravuje
            effects.push(new Splash(this.x - n.x * this.radius, this.y - n.y * this.radius));
            if (this.hp <= 0) sink(this, null);
        }
        if (this.stun) this.stun();
    }

    /** Bez argumentu vypálí z obou boků, jinak jen z boku 1 / -1. */
    shoot(side = 0) {
        // Nabíjení běží na herním čase, ne na nástěnných hodinách - jinak by
        // kadence utíkala mimo dění na plátně.
        if (this.reloadProgress() < 1) return;
        this.lastShot = gameTime;

        const sides = side === 0 ? [Math.PI / 2, -Math.PI / 2] : [side * Math.PI / 2];
        for (const offset of sides) {
            // Rozptyl děl - bez něj nepřítel s výpočtem předstihu netrefitelně
            // neminul a hráč neměl šanci.
            const a = this.angle + offset + (Math.random() - 0.5) * 2 * this.spread;
            const bx = this.x + Math.cos(a) * this.radius;
            const by = this.y + Math.sin(a) * this.radius;
            bullets.push(new Bullet(bx, by, a, this));
            for (let i = 0; i < 3; i++) effects.push(new Puff(bx, by, a));
        }
    }

    /** Dostřel lodi v px - potřebuje ho AI i ukazatel v HUD. */
    range() {
        return BULLET_SPEED * this.bulletLife * 0.8;
    }
}

function normalizeAngle(a) {
    while (a < -Math.PI) a += Math.PI * 2;
    while (a > Math.PI) a -= Math.PI * 2;
    return a;
}

// Obtížnost mění posádku nepřátel: jak přesně a jak často pálí, jak čile
// manévrují a jak blízko si troufají.
const DIFFICULTIES = [
    { name: 'Nováčci', spread: 0.40, shootDelay: 2700, maxSpeed: 2.7, turn: 0.036, damage: 8, orbit: [160, 90] },
    { name: 'Ostřílení', spread: 0.26, shootDelay: 2000, maxSpeed: 3.0, turn: 0.045, damage: 10, orbit: [120, 80] },
    { name: 'Piráti z Karibiku', spread: 0.15, shootDelay: 1450, maxSpeed: 3.3, turn: 0.052, damage: 13, orbit: [105, 60] }
];

export const DIFFICULTY_NAMES = DIFFICULTIES.map(d => d.name);

/** Jak často (ms) si loď nechá přepočítat cestu kolem ostrovů. */
const PATH_INTERVAL = 900;

class AiShip extends Ship {
    constructor(x, y, team) {
        super(x, y, team, 'enemy');
        const d = DIFFICULTIES[config.difficulty] || DIFFICULTIES[1];
        this.maxSpeed = d.maxSpeed;
        this.shootDelay = d.shootDelay;
        this.spread = d.spread;
        this.damage = d.damage;
        this.rotationSpeed = d.turn;

        // Každá loď si drží vlastní oběžnou dráhu a stranu, na kterou cíl
        // obeplouvá - jinak by se všechny slily do jednoho útvaru.
        this.orbitSide = Math.random() < 0.5 ? 1 : -1;
        this.orbitRange = d.orbit[0] + Math.random() * d.orbit[1];
        this.sideTimer = 4000 + Math.random() * 6000;
        this.wobble = 1;         // směr kormidla během zmatku po srážce

        // Plavba kolem ostrovů: cesta se počítá jen občas a rozprostřeně,
        // aby všechny lodě nepřepočítávaly ve stejném snímku.
        this.path = null;
        this.pathTimer = Math.random() * PATH_INTERVAL;
        this.pathGoal = null;
        this.lastStun = -99999;
        this.sightTarget = null;
        this.sightTime = -99999;
        this.sight = false;
    }

    /** Kam loď doplachtí, než tam dorazí koule - míří se s předstihem. */
    predictTarget(target) {
        let t = 0;
        for (let i = 0; i < 2; i++) {
            const px = target.x + Math.cos(target.angle) * target.speed * t;
            const py = target.y + Math.sin(target.angle) * target.speed * t;
            t = Math.hypot(px - this.x, py - this.y) / BULLET_SPEED;
        }
        return {
            x: target.x + Math.cos(target.angle) * target.speed * t,
            y: target.y + Math.sin(target.angle) * target.speed * t
        };
    }

    /**
     * Uhýbání břehu: rozhlédne se do několika směrů a když je před přídí
     * mělčina, vybere ten nejprůchodnější. Pracuje nad stejným polem jako
     * kolize, takže AI vidí přesně to, do čeho by najela.
     */
    avoidLand(heading, f) {
        const look = 55 + this.speed * 26;
        const clearance = a => Math.min(
            world.depth(this.x + Math.cos(a) * look * 0.5, this.y + Math.sin(a) * look * 0.5),
            world.depth(this.x + Math.cos(a) * look, this.y + Math.sin(a) * look)
        );

        const safe = this.radius * 1.6;
        if (clearance(heading) > safe) return heading;

        let best = heading;
        let bestScore = -Infinity;
        for (const off of [0, 0.5, -0.5, 1.0, -1.0, 1.7, -1.7, 2.6, -2.6]) {
            const a = heading + off;
            // Mírně se drží původního záměru, aby loď nekličkovala zbytečně.
            const score = Math.min(clearance(a), safe * 3) - Math.abs(off) * 12;
            if (score > bestScore) { bestScore = score; best = a; }
        }
        // Plachty se ubírají jen tehdy, když ani nejlepší směr není volný -
        // v otevřené vodě kolem ostrova nemá loď důvod zpomalovat.
        this.trim(bestScore < safe ? -1 : 1, f);
        return best;
    }

    aiUpdate(target, f) {
        // Po srážce chvíli trvá, než se kormidelník rozhodne, kudy dál -
        // loď mezitím jen dojíždí a nedrží kurz.
        if (this.confusion > 0) {
            // Plachty se jen přiberou, nespouští úplně - loď bez rychlosti
            // neposlouchá kormidlo a od břehu by se nedostala vůbec.
            this.trim(this.throttle > 0.5 ? -1 : 1, f);
            this.angle += this.wobble * this.rotationSpeed * 0.4 * f;
            return;
        }

        // Odlepení od břehu má přednost před vším ostatním.
        if (gameTime < this.escapeUntil) {
            this.trim(1, f);
            this.steer(this.escapeAngle, f);
            this.path = null;
            if (world.depth(this.x, this.y) > this.radius * 2.5) this.escapeUntil = 0;
            return;
        }

        // Bedna s vylepšením poblíž má přednost - je to zadarmo.
        const loot = nearestPickup(this, 240);
        if (loot) {
            this.sailTo(loot.x, loot.y, f);
            if (target) this.tryFire(target);
            return;
        }

        if (!target) {
            this.trim(-1, f);
            return;
        }

        // Když mezi lodí a cílem leží pevnina, boj se odkládá - nejdřív se
        // musí obeplout ostrov. Bez toho by loď zamířila napřímo, zaryla se
        // do břehu a čekala tam, dokud cíl sám nepřipluje.
        if (!this.hasSightTo(target)) {
            this.sailTo(target.x, target.y, f);
            return;
        }
        this.path = null;

        const dist = Math.hypot(target.x - this.x, target.y - this.y);
        const bearing = Math.atan2(target.y - this.y, target.x - this.x);

        // Občas přehodit stranu obletu, ať se z manévru nestane rutina.
        this.sideTimer -= f * (1000 / 60);
        if (this.sideTimer <= 0) {
            this.orbitSide *= -1;
            this.sideTimer = 5000 + Math.random() * 7000;
        }

        let heading;
        if (dist > this.orbitRange + 110) {
            heading = bearing;                       // daleko - stáhnout vzdálenost
            this.trim(1, f);
        } else if (dist < this.orbitRange - 60) {
            heading = bearing + Math.PI;             // moc blízko - odplout
            this.trim(1, f);
        } else {
            // Bojová dráha: kurz kolmo na cíl, tedy bokem k němu. Odchylka
            // od kolmice drží loď na zvolené vzdálenosti - dál stáčí dovnitř,
            // blíž ven. Couvat neumí, takže se vzdálenost řeší jen kormidlem.
            const err = Math.max(-0.7, Math.min(0.7, (dist - this.orbitRange) / this.orbitRange * 2));
            heading = bearing + this.orbitSide * (Math.PI / 2 - err);
            this.trim(this.throttle > 0.65 ? -1 : 1, f);
        }

        this.steer(this.avoidLand(this.tack(heading), f), f);
        this.tryFire(target);
    }

    /**
     * Je na cíl přímý výhled po vodě? Podle toho se bojuje, nebo pluje.
     * Výsledek chvíli vydrží - na dálku je to nejdražší dotaz v celé AI a
     * za desetinu vteřiny se pobřeží nikam nepřesune.
     */
    hasSightTo(target) {
        if (this.sightTarget === target && gameTime - this.sightTime < 150) return this.sight;
        this.sightTarget = target;
        this.sightTime = gameTime;
        this.sight = world.lineOfSight(this.x, this.y, target.x, target.y, this.radius + 6);
        return this.sight;
    }

    /**
     * Plavba k místu kolem pevniny. Dokud je vidět napřímo, jede se rovnou;
     * jinak se hledá cesta přes splavnou mřížku a jede se od bodu k bodu.
     * Cesta se přepočítá, až když vyprší čas nebo se cíl znatelně pohne -
     * hledání je sice levné, ale ne zadarmo.
     */
    sailTo(tx, ty, f) {
        this.trim(1, f);
        this.pathTimer -= f * (1000 / 60);

        if (world.lineOfSight(this.x, this.y, tx, ty, this.radius + 6)) {
            this.path = null;
            this.steer(this.avoidLand(this.tack(Math.atan2(ty - this.y, tx - this.x)), f), f);
            return;
        }

        const moved = this.pathGoal
            ? Math.hypot(this.pathGoal.x - tx, this.pathGoal.y - ty) : Infinity;
        if (!this.path || !this.path.length || this.pathTimer <= 0 || moved > 120) {
            this.pathTimer = PATH_INTERVAL;
            this.pathGoal = { x: tx, y: ty };
            this.path = world.findPath(this.x, this.y, tx, ty);
        }

        if (!this.path || !this.path.length) {
            // Cesta neexistuje (nemělo by nastat, voda je souvislá) - aspoň
            // se zkusí přiblížit napřímo a nezůstat stát.
            this.steer(this.avoidLand(this.tack(Math.atan2(ty - this.y, tx - this.x)), f), f);
            return;
        }

        // Průběžné zkracování: co je vidět, to se dá přeskočit.
        while (this.path.length > 1 &&
            world.lineOfSight(this.x, this.y, this.path[1].x, this.path[1].y, this.radius + 6)) {
            this.path.shift();
        }
        const wp = this.path[0];
        if (Math.hypot(wp.x - this.x, wp.y - this.y) < 40 && this.path.length > 1) {
            this.path.shift();
        }
        this.steer(this.avoidLand(this.tack(Math.atan2(wp.y - this.y, wp.x - this.x)), f), f);
    }

    /**
     * Křižování: napřímo proti větru se plout nedá, tak se kurz odkloní na
     * nejostřejší úhel, na kterém plachty ještě táhnou. Strana se vybere
     * podle toho, kam loď stejně chtěla - z toho vznikne přirozený zig-zag.
     */
    tack(heading) {
        if (sailEfficiency(heading) > 0.42) return heading;
        const off = normalizeAngle(heading - wind.angle);
        return wind.angle + (off >= 0 ? 1 : -1) * 2.15;
    }

    steer(heading, f) {
        const turn = this.rotationSpeed * f;
        const diff = normalizeAngle(heading - this.angle);
        if (diff > 0.03) this.angle += Math.min(turn, diff);
        else if (diff < -0.03) this.angle += Math.max(-turn, diff);
    }

    /**
     * Salva letí kolmo z boků, takže se pálí, až když předpokládaná poloha
     * cíle leží na traverzu - a jen na dostřel. Tolerance se odvozuje z toho,
     * jak široký cíl na dané vzdálenosti je: zblízka stačí zamířit hrubě,
     * na dálku musí být bok srovnaný přesně.
     */
    tryFire(target) {
        if (this.reloadProgress() < 1) return;
        const aim = this.predictTarget(target);
        const aimDist = Math.hypot(aim.x - this.x, aim.y - this.y);
        if (aimDist > this.range()) return;

        const rel = normalizeAngle(Math.atan2(aim.y - this.y, aim.x - this.x) - this.angle);
        const abeam = Math.abs(rel) - Math.PI / 2;
        const tolerance = Math.atan2(target.radius + BULLET_RADIUS, Math.max(aimDist, 1));
        if (Math.abs(abeam) > tolerance) return;

        // Do vlastního ostrova se nestřílí - koule by jen zmizela v písku.
        const a = this.angle + Math.sign(rel) * Math.PI / 2;
        if (!world.lineOfSight(this.x, this.y,
            this.x + Math.cos(a) * aimDist, this.y + Math.sin(a) * aimDist, 0)) return;

        this.shoot(Math.sign(rel));   // pálí jen bok obrácený k cíli
    }

    /**
     * Zmatek po nárazu: nové rozhodnutí, kudy objíždět.
     *
     * Prodleva mezi zmatky je zásadní - bez ní se loď opřená o břeh nebo
     * uvízlá v hloučku „rozmýšlí" pořád dokola, a protože během zmatku
     * neřídí, nemá jak se odtamtud dostat.
     */
    stun() {
        if (this.confusion > 0 || gameTime - this.lastStun < 3000) return;
        this.lastStun = gameTime;
        this.confusion = 600 + Math.random() * 900;
        this.wobble = Math.random() < 0.5 ? 1 : -1;
        this.orbitSide = Math.random() < 0.5 ? 1 : -1;
        this.sideTimer = 5000 + Math.random() * 7000;
    }
}

class Bullet {
    constructor(x, y, angle, owner) {
        this.x = x;
        this.y = y;
        this.dx = Math.cos(angle) * BULLET_SPEED;
        this.dy = Math.sin(angle) * BULLET_SPEED;
        this.radius = BULLET_RADIUS;
        this.team = owner.team;
        this.owner = owner;
        this.damage = owner.damage;
        this.life = owner.bulletLife;
        this.dead = false;
    }

    draw() {
        // Stín pod koulí - bez něj tmavá koule na vodě zaniká.
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.beginPath();
        ctx.arc(this.x + 2, this.y + 3, this.radius, 0, Math.PI * 2);
        ctx.fill();

        const sprite = sprites.bullet;
        if (sprite) {
            const d = this.radius * 2.4;
            ctx.drawImage(sprite, this.x - d / 2, this.y - d / 2, d, d);
        } else {
            ctx.fillStyle = TEAMS[this.team].ball;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    update(f) {
        this.x += this.dx * f;
        this.y += this.dy * f;
        this.life -= f;
        if (this.life <= 0) { this.dead = true; return; }
        // Ostrov střelu zastaví - za skálou je kryt.
        if (world.depth(this.x, this.y) <= 0) {
            this.dead = true;
            effects.push(new Explosion(this.x, this.y, 0.7));
        }
    }
}

class Splash {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = 4;
        this.life = 20;
        this.dead = false;
    }
    update(f) {
        this.r += 1.4 * f;
        this.life -= f;
        if (this.life <= 0) this.dead = true;
    }
    draw() {
        ctx.strokeStyle = `rgba(255,255,255,${this.life / 20})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.stroke();
    }
}

/** Brázda za lodí. Bez ní není poznat, jestli se loď hýbe, nebo stojí. */
class Wake {
    constructor(x, y, speed) {
        this.x = x;
        this.y = y;
        this.r = 3 + speed;
        this.max = 42;
        this.life = this.max;
        this.dead = false;
    }
    update(f) {
        this.r += 0.28 * f;
        this.life -= f;
        if (this.life <= 0) this.dead = true;
    }
    draw() {
        ctx.fillStyle = `rgba(255,255,255,${0.28 * this.life / this.max})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Kouř z děl - odnáší ho vítr, takže je vidět, odkud se pálilo. */
class Puff {
    constructor(x, y, angle) {
        this.x = x;
        this.y = y;
        this.vx = Math.cos(angle) * 0.9 + Math.cos(wind.angle) * 0.5;
        this.vy = Math.sin(angle) * 0.9 + Math.sin(wind.angle) * 0.5;
        this.r = 4 + Math.random() * 4;
        this.max = 34;
        this.life = this.max;
        this.dead = false;
    }
    update(f) {
        this.x += this.vx * f;
        this.y += this.vy * f;
        this.vx *= Math.pow(0.94, f);
        this.vy *= Math.pow(0.94, f);
        this.r += 0.35 * f;
        this.life -= f;
        if (this.life <= 0) this.dead = true;
    }
    draw() {
        ctx.fillStyle = `rgba(225,225,215,${0.5 * this.life / this.max})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
        ctx.fill();
    }
}

/** Potápějící se vrak - loď nemizí lusknutím, ale klesá a bledne. */
class Wreck {
    constructor(ship) {
        this.x = ship.x;
        this.y = ship.y;
        this.angle = ship.angle;
        this.spin = (Math.random() - 0.5) * 0.01;
        this.radius = ship.radius;
        this.sprite = sprites[ship.spriteName];
        this.hull = TEAMS[ship.team].hull;
        this.max = 90;
        this.life = this.max;
        this.dead = false;
    }
    update(f) {
        this.angle += this.spin * f;
        this.life -= f;
        if (this.life <= 0) this.dead = true;
    }
    draw() {
        const t = this.life / this.max;
        ctx.save();
        ctx.globalAlpha = t * 0.85;
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);
        ctx.scale(0.4 + t * 0.6, 0.4 + t * 0.6);   // klesá pod hladinu
        const w = this.radius * 2.8;
        if (this.sprite) {
            ctx.drawImage(this.sprite, -w / 2, -w / 2 * (this.sprite.height / this.sprite.width),
                w, w * (this.sprite.height / this.sprite.width));
        } else {
            ctx.fillStyle = this.hull;
            ctx.fillRect(-w / 2, -8, w, 16);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }
}

/** Výbuch při zásahu - rázová vlna, ohnivé jádro a odletující jiskry. */
class Explosion {
    constructor(x, y, scale = 1) {
        this.x = x;
        this.y = y;
        this.scale = scale;
        this.maxLife = 26 * scale;
        this.life = this.maxLife;
        this.dead = false;
        this.particles = [];
        const count = Math.round(8 * scale);
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const v = (1.2 + Math.random() * 2.6) * scale;
            this.particles.push({
                x: 0, y: 0,
                vx: Math.cos(a) * v,
                vy: Math.sin(a) * v,
                r: (2 + Math.random() * 3) * scale
            });
        }
    }

    update(f) {
        this.life -= f;
        for (const p of this.particles) {
            p.x += p.vx * f;
            p.y += p.vy * f;
            p.vx *= Math.pow(0.92, f);   // odpor vzduchu, ať jiskry doletí
            p.vy *= Math.pow(0.92, f);
        }
        if (this.life <= 0) this.dead = true;
    }

    draw() {
        const t = Math.max(0, this.life / this.maxLife);   // 1 → 0

        // Rázová vlna
        ctx.strokeStyle = `rgba(255,220,150,${t * 0.8})`;
        ctx.lineWidth = 2 * this.scale;
        ctx.beginPath();
        ctx.arc(this.x, this.y, (1 - t) * 34 * this.scale + 4, 0, Math.PI * 2);
        ctx.stroke();

        // Jádro - hotový obrázek místo počítání gradientu každý snímek
        const core = 32 * this.scale * (0.4 + t * 0.9);
        ctx.globalAlpha = t;
        ctx.drawImage(fireballSprite, this.x - core / 2, this.y - core / 2, core, core);
        ctx.globalAlpha = 1;

        // Jiskry - čtverečky, ne kruhy: stejný dojem, zlomek ceny
        ctx.fillStyle = `rgba(255,${Math.round(120 + 120 * t)},60,${t})`;
        for (const p of this.particles) {
            const r = p.r * t;
            ctx.fillRect(this.x + p.x - r, this.y + p.y - r, r * 2, r * 2);
        }
    }
}

/** Bedna s vylepšením - vypadne z potopené lodi a chvíli plave. */
class Pickup {
    constructor(x, y, upgrade) {
        this.x = x;
        this.y = y;
        this.upgrade = upgrade;
        this.radius = 16;
        this.life = 22000;      // ms, pak se potopí
        this.dead = false;
        this.phase = Math.random() * Math.PI * 2;
    }

    update(f, dt) {
        this.life -= dt;
        this.phase += 0.05 * f;
        if (this.life <= 0) this.dead = true;
    }

    draw() {
        // Poslední tři vteřiny bliká, ať je vidět, že mizí.
        if (this.life < 3000 && Math.floor(this.life / 200) % 2 === 0) return;

        const bob = Math.sin(this.phase) * 3;
        const y = this.y + bob;

        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 10, 14, 5, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#8d6e3a';
        ctx.fillRect(this.x - 13, y - 13, 26, 26);
        ctx.strokeStyle = this.upgrade.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(this.x - 13, y - 13, 26, 26);

        ctx.font = '15px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.upgrade.icon, this.x, y + 1);
    }
}

// --- Stav hry ---------------------------------------------------------
let world = null;
let player = null;
let ships = [];
let bullets = [];
let effects = [];
let pickups = [];
let messages = [];       // hlášky v dolní části obrazovky
let alive = [];          // živé lodě, přepočítané jednou za snímek
let paused = false;
let score = 0;
let gameOver = false;
let gameTime = 0;
let running = false;
let config = {
    mode: 'ffa', opponents: 3, teamSize: 3, spectate: false,
    islands: 2, seed: 1, randomMap: true, difficulty: 1
};

function nearestPickup(ship, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const p of pickups) {
        const d = Math.hypot(p.x - ship.x, p.y - ship.y);
        if (d < bestDist) { bestDist = d; best = p; }
    }
    return best;
}

/** Rozmístí lodě na splavná místa; v týmovém režimu každý tým na svou stranu. */
function spawnRoster() {
    ships = [];
    player = null;
    const rnd = makePRNG(config.seed + 31);

    const addAi = (pt, team) => {
        const s = new AiShip(pt.x, pt.y, team);
        ships.push(s);
        return s;
    };

    if (config.mode === 'ffa') {
        const pts = world.spawnPoints(config.opponents + 1, 46, rnd);
        player = new Ship(pts[0].x, pts[0].y, 'blue', 'player');
        player.isPlayer = true;
        ships.push(player);
        for (let i = 0; i < config.opponents; i++) {
            addAi(pts[(i + 1) % pts.length], 'red');
        }
        return;
    }

    const n = config.teamSize;
    const left = world.spawnPoints(n, 46, rnd, p => p.x);
    const right = world.spawnPoints(n, 46, rnd, p => -p.x);

    for (let i = 0; i < n; i++) {
        const pt = left[i % left.length];
        if (i === 0 && !config.spectate) {
            player = new Ship(pt.x, pt.y, 'blue', 'player');
            player.isPlayer = true;
            player.angle = 0;
            ships.push(player);
        } else {
            addAi(pt, 'blue').angle = 0;
        }
        addAi(right[i % right.length], 'red').angle = Math.PI;
    }
}

function startGame() {
    // Nová bitva = nová mapa, pokud si hráč nezamkl konkrétní seed.
    // Vylosovaný seed se propíše do menu, aby šla mapa zopakovat.
    if (config.randomMap) {
        config.seed = Math.floor(Math.random() * 100000);
        el('seed').value = String(config.seed);
    }

    bullets = [];
    effects = [];
    pickups = [];
    messages = [];
    score = 0;
    gameOver = false;
    paused = false;
    gameTime = 0;
    resetWind();

    // Zaokrouhluje se nahoru, aby mapa plátno vždy přesáhla - jinak by po
    // stranách zůstávaly tmavé pruhy.
    const cols = Math.max(14, Math.min(40, Math.ceil(canvas.width / TILE_SIZE)));
    const rows = Math.max(10, Math.min(26, Math.ceil(canvas.height / TILE_SIZE)));
    world = buildWorld({ seed: config.seed, cols, rows, islands: config.islands });
    centerCamera();

    spawnRoster();
    alive = ships.slice();
    running = true;
    el('menu').classList.add('hidden');
    el('game-over').classList.add('hidden');
    el('ui').classList.remove('hidden');
    el('ui').classList.toggle('spectating', !player);
    updateHud(true);
}

function openMenu() {
    running = false;
    el('menu').classList.remove('hidden');
    el('game-over').classList.add('hidden');
    el('ui').classList.add('hidden');      // v menu nemá HUD co ukazovat
}

// --- HUD --------------------------------------------------------------
// Zápis do DOM je proti kreslení na plátno drahý. HUD se proto obnovuje
// desetkrát za vteřinu a jen ta pole, kterým se opravdu změnil text.
const hudCache = {};
let hudTimer = 0;

function setText(id, value) {
    if (hudCache[id] === value) return;
    hudCache[id] = value;
    el(id).innerText = value;
}

function updateHud(force = false) {
    if (!force && (hudTimer -= 1) > 0) return;
    hudTimer = 6;

    if (player) {
        const wait = player.repairCountdown();
        const repair = player.hp >= player.maxHp ? ''
            : (wait === 0 ? '  ⚒ opravy' : `  ⚒ za ${Math.ceil(wait)} s`);
        setText('hp-value', `${Math.max(0, Math.round(player.hp))} / ${player.maxHp}${repair}`);
        const set = Math.round(player.throttle * 5);
        setText('sails-value', '▮'.repeat(set) + '▯'.repeat(5 - set));
        const r = Math.round(player.reloadProgress() * 10);
        setText('reload-value', r >= 10 ? 'nabito' : '▮'.repeat(r) + '▯'.repeat(10 - r));
        const ups = [...player.upgrades].map(([id, n]) => {
            const u = UPGRADES.find(x => x.id === id);
            return `${u.icon}×${n}`;
        }).join('  ');
        setText('upgrades-value', ups || '—');
    }
    setText('score-value', String(score));
    setText('alive-blue', String(alive.reduce((n, s) => n + (s.team === 'blue'), 0)));
    setText('alive-red', String(alive.reduce((n, s) => n + (s.team === 'red'), 0)));
}

// --- Kolize -----------------------------------------------------------
function hits(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const r = a.radius + b.radius;
    return dx * dx + dy * dy < r * r;
}

/** Nejbližší živá loď z jiného týmu. */
function findTarget(ship) {
    let best = null;
    let bestDist = Infinity;
    for (const other of alive) {
        if (other.team === ship.team) continue;
        const dx = other.x - ship.x;
        const dy = other.y - ship.y;
        const d = dx * dx + dy * dy;
        if (d < bestDist) { bestDist = d; best = other; }
    }
    return best;
}

// Lodě se nesmí prolínat: při překryvu se odtlačí po spojnici středů a
// náraz je zbrzdí. Trupů je pár, takže stačí porovnat každý s každým.
const COLLISION_PASSES = 4;

function resolveShipCollisions() {
    for (const s of alive) s.touching = false;

    // Rozstrkání jedné dvojice může nasunout jinou, u shluku lodí proto
    // několik průchodů - výsledek se tím dorovná pod desetinu pixelu.
    for (let pass = 0; pass < COLLISION_PASSES; pass++) {
        let touched = false;

        for (let i = 0; i < alive.length; i++) {
            for (let j = i + 1; j < alive.length; j++) {
                const a = alive[i];
                const b = alive[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                const minDist = a.radius + b.radius;
                if (dx * dx + dy * dy >= minDist * minDist) continue;
                let dist = Math.hypot(dx, dy);

                touched = true;
                a.touching = true;
                b.touching = true;
                if (dist < 0.001) {          // přesně na sobě - rozstrčit náhodně
                    const rnd = Math.random() * Math.PI * 2;
                    dx = Math.cos(rnd);
                    dy = Math.sin(rnd);
                    dist = 1;
                }
                const nx = dx / dist;
                const ny = dy / dist;
                const push = (minDist - dist) / 2;

                a.x -= nx * push;
                a.y -= ny * push;
                b.x += nx * push;
                b.y += ny * push;

                // Náraz sebere rychlost jen té lodi, která do druhé najíždí.
                if (pass === 0) {
                    if (Math.cos(a.angle) * nx + Math.sin(a.angle) * ny > 0) a.speed *= 0.5;
                    if (Math.cos(b.angle) * nx + Math.sin(b.angle) * ny < 0) b.speed *= 0.5;
                }
            }
        }

        if (!touched) break;
    }

    // Zmatek se spouští jen na náběžné hraně dotyku - jinak by se loď
    // uvízlá v hloučku „rozmýšlela" donekonečna a zůstala stát.
    for (const s of alive) {
        if (s.touching && !s.wasTouching && s.stun) s.stun();
        s.wasTouching = s.touching;
        // Odstrčení mohlo loď nasunout na mělčinu - břeh má poslední slovo.
        s.hitShore();
    }
}

/**
 * Hláška na obrazovce. Drží se jen pár posledních - dole na plátně není
 * místo na kroniku celé bitvy.
 */
function say(text, color = '#ecf0f1') {
    messages.push({ text, color, life: 3200 });
    if (messages.length > 4) messages.shift();
}

function damage(ship, amount, x, y, attacker) {
    ship.hp -= amount;
    ship.lastDamage = gameTime;     // zásah zastaví opravy
    effects.push(new Explosion(x, y, 1));
    if (ship.hp <= 0) sink(ship, attacker);
}

/** Potopení: výbuch, klesající vrak a možná bedna s vylepšením. */
function sink(ship, attacker) {
    if (ship.dead) return;
    ship.hp = 0;
    ship.dead = true;
    effects.push(new Explosion(ship.x, ship.y, 2.4));
    effects.push(new Wreck(ship));

    if (ship === player) {
        say('Potopili tě!', '#e74c3c');
    } else if (attacker === player) {
        score += 100;
        say('Potopena nepřátelská loď  +100', '#f1c40f');
    } else if (attacker && attacker.team === (player ? player.team : 'blue')) {
        say(`${TEAMS[attacker.team].name}: loď potopena`, TEAMS[attacker.team].color);
    } else if (!attacker) {
        say(`${TEAMS[ship.team].name}: loď najela na mělčinu`, '#95a5a6');
    }

    // Kořist padá jen tam, kde se dá sebrat - na břehu by byla k ničemu.
    if (Math.random() < 0.7 && world.depth(ship.x, ship.y) > 20) {
        const up = UPGRADES[Math.floor(Math.random() * UPGRADES.length)];
        pickups.push(new Pickup(ship.x, ship.y, up));
    }
}

function checkEnd() {
    if (gameOver) return;

    const blue = alive.some(s => s.team === 'blue');
    const red = alive.some(s => s.team === 'red');

    let title = null;
    if (player && player.dead) title = 'Tvoje loď byla potopena!';
    else if (!red) title = 'Vítězí ' + TEAMS.blue.name + '!';
    else if (!blue) title = 'Vítězí ' + TEAMS.red.name + '!';
    if (!title) return;

    gameOver = true;
    running = false;
    updateHud(true);          // ať v HUD nezůstane stav o pár snímků starší
    el('go-title').innerText = title;
    el('final-score').innerText = String(score);
    el('game-over').classList.remove('hidden');
}

// --- Herní krok -------------------------------------------------------
function update(dt) {
    if (!running || gameOver || paused) return;

    gameTime += dt;
    // Krok normovaný na 60 FPS, aby chování neviselo na snímkové frekvenci.
    const f = dt / (1000 / 60);
    updateWind(dt, f);

    for (const m of messages) m.life -= dt;
    if (messages.length && messages[0].life <= 0) messages.shift();

    if (player && !player.dead) {
        // Plachty se povolují a zatahují, couvat loď neumí.
        if (keys['ArrowUp'] || keys['KeyW']) player.trim(1, f);
        if (keys['ArrowDown'] || keys['KeyS']) player.trim(-1, f);
        if (keys['ArrowLeft'] || keys['KeyA']) player.angle -= player.rotationSpeed * f;
        if (keys['ArrowRight'] || keys['KeyD']) player.angle += player.rotationSpeed * f;
        if (keys['Space']) player.shoot();
    }

    for (const ship of alive) {
        if (ship.aiUpdate) ship.aiUpdate(findTarget(ship), f);
        ship.update(f);
    }

    resolveShipCollisions();

    for (const bullet of bullets) {
        bullet.update(f);
        if (bullet.dead) continue;

        for (const ship of alive) {
            // `alive` se pročišťuje až na konci kroku, takže se tu ještě
            // můžou vyskytnout lodě potopené o pár řádků výš.
            if (ship.dead || ship.team === bullet.team || !hits(bullet, ship)) continue;
            bullet.dead = true;
            damage(ship, bullet.damage, bullet.x, bullet.y, bullet.owner);
            break;
        }
    }

    for (const p of pickups) {
        p.update(f, dt);
        if (p.dead) continue;
        for (const ship of alive) {
            // Bez téhle podmínky by si bednu sebral vrak, ze kterého vypadla.
            if (ship.dead || !hits(p, ship)) continue;
            p.dead = true;
            ship.collect(p.upgrade);
            effects.push(new Splash(p.x, p.y));
            if (ship === player) {
                score += 25;
                say(`${p.upgrade.icon} ${p.upgrade.name}`, p.upgrade.color);
            }
            break;
        }
    }

    for (const fx of effects) fx.update(f);

    // Úklid až po dokončení iterací - žádné splice uprostřed smyčky
    if (bullets.some(b => b.dead)) bullets = bullets.filter(b => !b.dead);
    if (effects.some(e => e.dead)) effects = effects.filter(e => !e.dead);
    if (pickups.some(p => p.dead)) pickups = pickups.filter(p => !p.dead);
    if (alive.some(s => s.dead)) alive = alive.filter(s => !s.dead);

    updateHud();
    checkEnd();
}

function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#14212b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (!world) return;

    // Terén je hotový obrázek - celé pozadí stojí jeden drawImage.
    ctx.setTransform(1, 0, 0, 1, camX, camY);
    ctx.drawImage(world.offscreen, 0, 0);

    // Brázdy patří pod lodě, ostatní efekty (výbuchy, kouř, vraky) nad ně.
    for (const fx of effects) if (fx instanceof Wake) fx.draw();
    for (const p of pickups) p.draw();
    for (const bullet of bullets) bullet.draw();
    for (const ship of alive) ship.draw();
    for (const fx of effects) if (!(fx instanceof Wake)) fx.draw();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawWindRose();
    drawMessages();
    if (paused) drawPaused();
}

/** Větrná růžice v rohu: odkud kam fouká a jak lodi zrovna táhnou plachty. */
function drawWindRose() {
    if (!running && !paused) return;
    const cx = canvas.width - 70;
    const cy = 70;

    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath();
    ctx.arc(cx, cy, 40, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wind.angle);
    ctx.fillStyle = '#ecf0f1';
    ctx.beginPath();                 // šipka ukazuje, KAM vítr žene lodě
    ctx.moveTo(26, 0);
    ctx.lineTo(2, -11);
    ctx.lineTo(6, 0);
    ctx.lineTo(2, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(236,240,241,0.55)';
    ctx.fillRect(-26, -3, 26, 6);
    ctx.restore();

    ctx.font = '11px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText('vítr', cx, cy + 30);

    // Kroužek kolem růžice ukazuje, jak dobře stojí hráčova loď k větru.
    if (player && !player.dead) {
        const eff = sailEfficiency(player.angle);
        ctx.strokeStyle = eff > 0.7 ? '#2ecc71' : (eff > 0.45 ? '#f1c40f' : '#e74c3c');
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * eff);
        ctx.stroke();
    }
}

function drawMessages() {
    if (!messages.length) return;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let y = canvas.height - 90;
    for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i];
        ctx.globalAlpha = Math.min(1, m.life / 700);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(0,0,0,0.75)';
        ctx.strokeText(m.text, canvas.width / 2, y);
        ctx.fillStyle = m.color;
        ctx.fillText(m.text, canvas.width / 2, y);
        y -= 26;
    }
    ctx.globalAlpha = 1;
}

function drawPaused() {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 48px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ecf0f1';
    ctx.fillText('PAUZA', canvas.width / 2, canvas.height / 2);
    ctx.font = '18px Arial';
    ctx.fillText('P – pokračovat', canvas.width / 2, canvas.height / 2 + 40);
}

let lastTime = performance.now();
let needsDraw = true;

function loop(now) {
    const dt = Math.min(now - lastTime, 100);
    lastTime = now;
    // V menu ani po konci bitvy se nic nehýbe - nemá smysl překreslovat
    // stejný obraz šedesátkrát za vteřinu.
    if (running) {
        update(dt);
        draw();
    } else if (needsDraw) {
        needsDraw = false;
        draw();
    }
    requestAnimationFrame(loop);
}

// --- Menu -------------------------------------------------------------
function readConfig() {
    config.mode = el('mode-teams').checked ? 'teams' : 'ffa';
    config.randomMap = el('random-map').checked;
    config.opponents = Number(el('opponents').value);
    config.teamSize = Number(el('team-size').value);
    config.spectate = el('spectate').checked;
    config.islands = Number(el('islands').value);
    config.difficulty = Number(el('difficulty').value);
    config.seed = (Number(el('seed').value) || 1) >>> 0;
}

function syncMenu() {
    const teams = el('mode-teams').checked;
    el('row-opponents').classList.toggle('hidden', teams);
    el('row-team-size').classList.toggle('hidden', !teams);
    el('row-spectate').classList.toggle('hidden', !teams);
    el('opponents-value').innerText = el('opponents').value;
    el('team-size-value').innerText = el('team-size').value;
    el('islands-value').innerText = ISLAND_NAMES[Number(el('islands').value)];
    el('difficulty-value').innerText = DIFFICULTY_NAMES[Number(el('difficulty').value)];
}

for (const id of ['mode-ffa', 'mode-teams', 'opponents', 'team-size', 'islands', 'difficulty']) {
    el(id).addEventListener('input', syncMenu);
}
/** Ukázka mapy za menu. Přegenerovává se až po puštění posuvníku. */
function updatePreview() {
    if (running) return;
    readConfig();
    world = buildWorld({ seed: config.seed, cols: 20, rows: 12, islands: config.islands });
    centerCamera();
}

el('dice').addEventListener('click', () => {
    el('seed').value = String(Math.floor(Math.random() * 100000));
    updatePreview();
});
el('islands').addEventListener('change', updatePreview);
el('seed').addEventListener('change', updatePreview);
el('start-btn').addEventListener('click', () => { readConfig(); startGame(); });
el('restart-btn').addEventListener('click', () => startGame());
el('menu-btn').addEventListener('click', openMenu);

// Legenda vylepšení v menu - jeden zdroj pravdy je pole UPGRADES.
el('upgrade-list').innerHTML = UPGRADES
    .map(u => `<span><b style="color:${u.color}">${u.icon}</b> ${u.name}</span>`)
    .join('');

// --- Start ------------------------------------------------------------
/**
 * Parametry v URL - hlavně pro ověřování bez klikání:
 *   ?auto=1&mode=teams&size=4&opponents=5&islands=3&seed=42&spectate=1
 */
function applyUrlParams() {
    const q = new URLSearchParams(location.search);
    // Zadaný seed znamená „přesně tuhle mapu" - losování se vypne, jinak by
    // se ověřování ani opakované hraní stejné mapy nedalo zařídit.
    if (q.has('seed')) {
        el('seed').value = q.get('seed');
        el('random-map').checked = false;
    }
    if (q.has('islands')) el('islands').value = q.get('islands');
    if (q.has('difficulty')) el('difficulty').value = q.get('difficulty');
    if (q.has('opponents')) el('opponents').value = q.get('opponents');
    if (q.has('size')) el('team-size').value = q.get('size');
    if (q.get('mode') === 'teams') el('mode-teams').checked = true;
    if (q.get('spectate') === '1') el('spectate').checked = true;
    return q.get('auto') === '1';
}

(async function init() {
    resizeCanvas();
    await initWorldAssets();
    const auto = applyUrlParams();
    syncMenu();
    if (auto) {
        readConfig();
        startGame();
    } else {
        // Za menu se rovnou generuje ukázka mapy - prázdné tmavé plátno
        // nic neříká o tom, co se z posuvníků vlastně vybírá.
        readConfig();
        world = buildWorld({ seed: config.seed, cols: 20, rows: 12, islands: config.islands });
        centerCamera();
    }
    requestAnimationFrame(loop);
    window.__game = { sailEfficiency, say, get wind() { return wind; },
        get paused() { return paused; },
        get ships() { return ships; }, get alive() { return alive; },
        get pickups() { return pickups; }, get world() { return world; },
        get player() { return player; }, get gameOver() { return gameOver; },
        update, draw };
})();
