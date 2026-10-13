/* ============================================================
   cpu8/lekce.js – komentované ukázky a úlohy s automatickou kontrolou
   UKAZKY: [{ id, nazev, uroven, popis (HTML), kod, spustit? (rychlost pro tlačítko „▶ Spustit“) }]
   ULOHY:  [{ id, nazev, zadani (HTML), sablona, napoveda, reseni, testy() → [{ vstup:{adr:hodnota}, ocekavej:{adr:hodnota}, popis }] ,
              kontrola?(cpu, test) → null | text chyby }]
   ============================================================ */
(function (root) {
  'use strict';

  const UKAZKY = [
    {
      id: 'prvni', nazev: '1. První program: registry a paměť', uroven: 'začátečník',
      popis: 'Načtení hodnot do registrů, uložení do paměti a první pixely na displeji. Krokujte klávesou F10 a sledujte panel registrů.',
      kod: `; === První program ===
; Procesor 6502 má tři 8bitové registry: A (akumulátor), X a Y.
; LDA/LDX/LDY načítají, STA/STX/STY ukládají do paměti.
; Displej 32×32 začíná na adrese $0200, každý bajt je jeden pixel.

        *= $0600        ; program začíná na adrese $0600

        lda #$01        ; A ← 1 (bílá barva)
        sta $0200       ; levý horní pixel
        lda #$05        ; A ← 5 (zelená)
        sta $0201       ; vedlejší pixel
        lda #$08        ; A ← 8 (oranžová)
        sta $0202

        ldx #$02        ; X ← 2 (červená)
        stx $0220       ; $0220 = začátek druhého řádku (32 = $20 bajtů na řádek)
        ldy #$0E        ; Y ← 14 (světle modrá)
        sty $05FF       ; pravý dolní pixel

        brk             ; konec programu
`,
    },
    {
      id: 'scitani', nazev: '2. Sčítání a příznaky', uroven: 'začátečník',
      popis: 'ADC sčítá s přenosem C, proto se před sčítáním dává CLC. Všimněte si příznaků C (přenos bez znaménka) a V (přetečení se znaménkem). Zapněte výuku a krokujte.',
      kod: `; === Sčítání a příznaky ===
; ADC počítá A ← A + M + C. Před prvním sčítáním vždy CLC!
; C = přenos (výsledek > 255), V = přetečení se znaménkem (výsledek mimo −128…+127)

        *= $0600
        clc
        lda #10
        adc #20         ; 10 + 20 = 30, C=0, V=0
        sta $10         ; výsledek do paměti na $0010

        clc
        lda #200
        adc #100        ; 200 + 100 = 300 → A = 44 a C=1 (přenos)
        sta $11

        clc
        lda #100
        adc #50         ; 100 + 50 = 150: bez znaménka v pořádku,
        sta $12         ; ale jako číslo se znaménkem přeteklo (+150 > +127) → V=1

        sec             ; odčítání: nejdřív SEC (žádná výpůjčka)
        lda #5
        sbc #7          ; 5 − 7 = −2 → A = $FE, C=0 (výpůjčka), N=1
        sta $13

        ; výsledky do konzole ($F002 vypíše bajt desítkově)
        lda $10
        sta $F002
        lda #' '
        sta $F001
        lda $11
        sta $F002
        brk
`,
    },
    {
      id: 'smycky', nazev: '3. Smyčky: čára na displeji', uroven: 'začátečník',
      popis: 'Smyčka s počítadlem v registru X, větvení BNE a indexované adresování $0200,X. Vykreslí barevnou čáru a úhlopříčku.',
      kod: `; === Smyčky ===
; INX zvýší X o 1, CPX porovná a BNE skočí, dokud se X nerovná zadané hodnotě.

        *= $0600
        ldx #0
radek:  txa             ; barva = číslo sloupce (spodní 4 bity)
        sta $0200,x     ; první řádek displeje
        inx
        cpx #32         ; 32 pixelů na řádek
        bne radek

; úhlopříčka: adresa = $0200 + y*32 + y = $0200 + y*33
        ldy #0
        lda #<$0200     ; ukazatel do nulové stránky ($00/$01)
        sta $00
        lda #>$0200
        sta $01
diag:   lda #1          ; bílá
        ; (ukazatel),Y: adresa = obsah $00/$01 + Y
        sta ($00),y
        clc             ; posun ukazatele o 32 bajtů (o řádek)
        lda $00
        adc #32
        sta $00
        bcc .bezPrenosu
        inc $01         ; přenos do vyššího bajtu
.bezPrenosu:
        iny
        cpy #32
        bne diag
        brk
`,
    },
    {
      id: 'pole', nazev: '4. Práce s polem: součet a maximum', uroven: 'mírně pokročilý',
      popis: 'Data v paměti (.byte), indexované čtení, 16bitový součet s přenosem a hledání maxima pomocí CMP a BCC/BCS.',
      kod: `; === Práce s polem ===
DELKA   = 8
SOUCET  = $10           ; 16bitový součet ($10 nižší, $11 vyšší bajt)
MAX     = $12

        *= $0600
        lda #0
        sta SOUCET
        sta SOUCET+1
        sta MAX
        ldx #0
smycka: lda data,x
        ; --- součet: přičti k 16bitovému číslu ---
        clc
        adc SOUCET
        sta SOUCET
        bcc .bezPrenosu
        inc SOUCET+1
.bezPrenosu:
        ; --- maximum: je data[x] > MAX? ---
        lda data,x
        cmp MAX         ; C=1, když A ≥ MAX
        bcc .mensi
        sta MAX
.mensi: inx
        cpx #DELKA
        bne smycka

        ; výpis do konzole
        lda SOUCET+1
        sta $F003       ; šestnáctkově
        lda SOUCET
        sta $F003
        brk

data:   .byte 12, 200, 7, 99, 255, 31, 64, 128
`,
    },
    {
      id: 'podprogramy', nazev: '5. Podprogramy a zásobník', uroven: 'mírně pokročilý',
      popis: 'JSR uloží návratovou adresu do zásobníku ($0100–$01FF), RTS ji vyzvedne. PHA/PLA ukládají registry. Sledujte panel Zásobník a vyzkoušejte „Krok přes“ (F10) a „Krok ven“ (Shift+F11).',
      kod: `; === Podprogramy a zásobník ===
; Vypíše do konzole text pomocí podprogramu, který si uschová registry.
KONZOLE = $F001
UKAZ    = $00           ; ukazatel na text (2 bajty v nulové stránce)

        *= $0600
        lda #<text1
        ldx #>text1
        jsr vypis       ; JSR uloží do zásobníku adresu návratu
        lda #<text2
        ldx #>text2
        jsr vypis
        lda #42
        jsr cislo       ; vypíše 42
        brk

; vypis: A = nižší, X = vyšší bajt adresy textu zakončeného nulou
vypis:  sta UKAZ
        stx UKAZ+1
        pha             ; uschová A a Y do zásobníku
        tya
        pha
        ldy #0
.dalsi: lda (UKAZ),y
        beq .konec      ; nula = konec textu
        sta KONZOLE
        iny
        bne .dalsi
.konec: pla             ; obnov v opačném pořadí
        tay
        pla
        rts             ; návrat za JSR

; cislo: vypíše A desítkově a odřádkuje
cislo:  sta $F002
        lda #10
        sta KONZOLE
        rts

text1:  .asciiz "Ahoj, 6502!\\n"
text2:  .asciiz "Odpověď je: "
`,
    },
    {
      id: 'aritm16', nazev: '6. 16bitová aritmetika', uroven: 'mírně pokročilý',
      popis: '8bitový procesor sčítá větší čísla po bajtech: nejdřív nižší bajty, přenos C se pak přičte k vyšším. Odčítání stejně s výpůjčkou.',
      kod: `; === 16bitová aritmetika ===
; čísla jsou uložena „little endian“: nižší bajt na nižší adrese
A16     = $10           ; 2 bajty
B16     = $12
SOUCET  = $14
ROZDIL  = $16

        *= $0600
        lda #<1234      ; A16 = 1234
        sta A16
        lda #>1234
        sta A16+1
        lda #<5678      ; B16 = 5678
        sta B16
        lda #>5678
        sta B16+1

        ; SOUCET = A16 + B16 = 6912 ($1B00)
        clc
        lda A16
        adc B16
        sta SOUCET
        lda A16+1
        adc B16+1       ; přičte i přenos z nižších bajtů
        sta SOUCET+1

        ; ROZDIL = B16 − A16 = 4444 ($115C)
        sec
        lda B16
        sbc A16
        sta ROZDIL
        lda B16+1
        sbc A16+1       ; odečte i výpůjčku
        sta ROZDIL+1

        lda SOUCET+1
        sta $F003
        lda SOUCET
        sta $F003
        lda #' '
        sta $F001
        lda ROZDIL+1
        sta $F003
        lda ROZDIL
        sta $F003
        brk
`,
    },
    {
      id: 'nasobeni', nazev: '7. Násobení posuvem', uroven: 'pokročilý',
      popis: '6502 neumí násobit. Násobení 8×8 → 16 bitů se dělá jako písemné násobení ve dvojkové soustavě: posuv a sčítání (8 kroků).',
      kod: `; === Násobení posuvem a sčítáním ===
; VYSLEDEK (16 bit) = CINITEL1 × CINITEL2
CINITEL1 = $10
CINITEL2 = $11
VYSLEDEK = $12          ; $12 nižší, $13 vyšší bajt

        *= $0600
        lda #123
        sta CINITEL1
        lda #45
        sta CINITEL2
        jsr nasob       ; 123 × 45 = 5535 = $159F
        lda VYSLEDEK+1
        sta $F003
        lda VYSLEDEK
        sta $F003
        brk

nasob:  lda CINITEL1
        sta VYSLEDEK    ; dolní bajt výsledku slouží zároveň jako posuvný registr 1. činitele
        lda #0          ; vyšší bajt výsledku se počítá v A
        ldx #8          ; 8 bitů
        lsr VYSLEDEK    ; nejnižší bit činitele do C
.krok:  bcc .nepricitej
        clc
        adc CINITEL2    ; bit byl 1 → přičti druhý činitel
.nepricitej:
        ror a           ; posuň 16bitový mezivýsledek A:VYSLEDEK doprava,
        ror VYSLEDEK    ; tím se zároveň vysune další bit činitele do C
        dex
        bne .krok
        sta VYSLEDEK+1
        rts
`,
    },
    {
      id: 'bcd', nazev: '8. Dekadický režim (BCD)', uroven: 'pokročilý',
      popis: 'Po SED počítají ADC a SBC v BCD: každá půlka bajtu je jedna desítková číslice. $19 + $01 = $20. Hodí se pro skóre a hodiny – výpis šestnáctkově pak ukazuje rovnou desítková čísla.',
      kod: `; === BCD – dekadický režim ===
; Počítadlo 0–99 v jednom bajtu; výpis šestnáctkově ukáže desítkové číslice.
POCIT   = $10

        *= $0600
        lda #$95        ; začneme na 95
        sta POCIT
        ldx #8          ; osmkrát přičteme 1
.znovu: sed             ; zapnout dekadický režim
        clc
        lda POCIT
        adc #$01        ; $95 + 1 = $96 …, $99 + 1 = $00 a C=1
        sta POCIT
        cld             ; vypnout (důležité před dalším binárním počítáním!)
        sta $F003       ; vypiš dvě číslice
        lda #' '
        sta $F001
        dex
        bne .znovu

        ; odečítání v BCD: 42 − 17 = 25
        sed
        sec
        lda #$42
        sbc #$17
        cld
        sta $11
        lda #10
        sta $F001
        lda $11
        sta $F003       ; vypíše 25
        brk
`,
    },
    {
      id: 'konzole', nazev: '9. Konzole: ahoj světe a čísla', uroven: 'začátečník',
      popis: 'Textová konzole na adrese $F001 (znak), $F002 (číslo desítkově), $F003 (šestnáctkově). Program vypíše malou násobilku.',
      kod: `; === Konzole ===
ZNAK    = $F001
DESITK  = $F002

        *= $0600
        ldx #0
.text:  lda pozdrav,x
        beq .nasobilka
        sta ZNAK
        inx
        bne .text

.nasobilka:
        ldy #1          ; Y = řádek 1 až 10
.radek: tya
        sta DESITK      ; vypiš Y
        lda #'x'
        sta ZNAK
        lda #'7'
        sta ZNAK
        lda #'='
        sta ZNAK
        ; A = Y × 7 = Y × 8 − Y
        tya
        asl a
        asl a
        asl a
        sty $10
        sec
        sbc $10
        sta DESITK
        lda #10         ; nový řádek
        sta ZNAK
        iny
        cpy #11
        bne .radek
        brk

pozdrav: .byte "Ahoj světe!", 10, "Násobilka sedmi:", 10, 0
`,
    },
    {
      id: 'kresleni', spustit: '1M', nazev: '10. Kreslení: barevné pruhy a obdélník', uroven: 'mírně pokročilý',
      popis: 'Vyplnění celé obrazovky přes 16bitový ukazatel (4 stránky po 256 bajtech) a podprogram pro bod na souřadnicích x, y.',
      kod: `; === Kreslení na displej ===
UKAZ    = $00           ; 2 bajty – ukazatel do obrazovky
X0      = $02
Y0      = $03
BARVA   = $04

        *= $0600
; 1) vyplň obrazovku svislými pruhy: barva = (adresa / 2) & 15
        lda #<$0200
        sta UKAZ
        lda #>$0200
        sta UKAZ+1
        ldy #0
.vypln: tya
        lsr a
        and #$0F
        sta (UKAZ),y
        iny
        bne .vypln
        inc UKAZ+1      ; další stránka (256 bajtů = 8 řádků)
        lda UKAZ+1
        cmp #$06        ; konec obrazovky na $0600
        bne .vypln

; 2) bílý obdélník 12×8 od bodu (10, 12)
        lda #1
        sta BARVA
        lda #12
        sta Y0
.radek: lda #10
        sta X0
.sloup: jsr bod
        inc X0
        lda X0
        cmp #22
        bne .sloup
        inc Y0
        lda Y0
        cmp #20
        bne .radek
        brk

; bod: nakreslí pixel BARVA na (X0, Y0); adresa = $0200 + Y0*32 + X0
bod:    lda Y0
        and #7          ; dolní 3 bity Y × 32 = nižší bajt
        asl a
        asl a
        asl a
        asl a
        asl a
        ora X0
        sta UKAZ
        lda Y0
        lsr a           ; horní bity Y / 8 = číslo stránky
        lsr a
        lsr a
        clc
        adc #>$0200
        sta UKAZ+1
        ldy #0
        lda BARVA
        sta (UKAZ),y
        rts
`,
    },
    {
      id: 'klavesnice', spustit: '1M', nazev: '11. Klávesnice: pohyb bodu', uroven: 'mírně pokročilý',
      popis: 'Klepněte na displej a ovládejte bod klávesami W A S D (nebo šipkami). Poslední stisknutá klávesa je na adrese $FF. Program běží v nekonečné smyčce – zastavte ho tlačítkem Pauza.',
      kod: `; === Klávesnice ===
; $FF obsahuje ASCII kód poslední stisknuté klávesy (šipky = w a s d).
KLAVESA = $FF
XP      = $10
YP      = $11
UKAZ    = $12

        *= $0600
        lda #16
        sta XP
        sta YP
        lda #0
        sta KLAVESA
hlavni: jsr kresli      ; bílý bod na pozici
        lda KLAVESA
        beq hlavni      ; nic nestisknuto
        ldx #0
        stx KLAVESA     ; „spotřebuj“ klávesu
        pha
        lda #0          ; smaž starý bod
        jsr bod
        pla
        cmp #'w'
        bne .ne_w
        dec YP
.ne_w:  cmp #'s'
        bne .ne_s
        inc YP
.ne_s:  cmp #'a'
        bne .ne_a
        dec XP
.ne_a:  cmp #'d'
        bne .ne_d
        inc XP
.ne_d:  lda XP          ; omez na 0–31
        and #31
        sta XP
        lda YP
        and #31
        sta YP
        jmp hlavni

kresli: lda #1
; bod: barva v A na (XP, YP)
bod:    pha
        lda YP
        asl a
        asl a
        asl a
        asl a
        asl a
        ora XP
        sta UKAZ
        lda YP
        lsr a
        lsr a
        lsr a
        clc
        adc #2
        sta UKAZ+1
        pla
        ldy #0
        sta (UKAZ),y
        rts
`,
    },
    {
      id: 'nahoda', spustit: '1M', nazev: '12. Náhodné pixely', uroven: 'začátečník',
      popis: 'Čtení z adresy $FE dává pokaždé jiné náhodné číslo. Program kreslí náhodné body náhodnou barvou – nechte ho běžet plnou rychlostí.',
      kod: `; === Náhodné pixely (klasika z easy6502) ===
NAHODA  = $FE

        *= $0600
smycka: lda NAHODA      ; náhodný nižší bajt adresy
        sta $00
        lda NAHODA
        and #3          ; stránka 0–3
        clc
        adc #2          ; → $02–$05
        sta $01
        lda NAHODA      ; náhodná barva
        ldy #0
        sta ($00),y
        jmp smycka
`,
    },
    {
      id: 'preruseni', spustit: '1M', nazev: '13. Časovač a přerušení IRQ', uroven: 'pokročilý',
      popis: 'Časovač na $F010–$F013 vyvolává přerušení IRQ. Vektor IRQ je na $FFFE. Obsluha musí uschovat registry, potvrdit přerušení čtením $F013 a skončit RTI. Hlavní program mezitím počítá vlastní smyčku.',
      kod: `; === Časovač a přerušení ===
CAS_LO  = $F010         ; perioda v jednotkách 100 cyklů
CAS_HI  = $F011
CAS_RIZ = $F012         ; bit 0 = běží, bit 1 = IRQ
CAS_STAV = $F013        ; čtení potvrdí přerušení
TIKY    = $10

        *= $0600
        sei             ; během nastavování přerušení zakázat
        lda #0
        sta TIKY
        lda #<2000      ; 2000 × 100 cyklů = 0,2 s při 1 MHz
        sta CAS_LO
        lda #>2000
        sta CAS_HI
        lda #%11        ; spustit časovač s IRQ
        sta CAS_RIZ
        cli             ; povolit přerušení
hlavni: inc $0200+15*32+16   ; hlavní program „pracuje“ – bliká pixel uprostřed
        jmp hlavni

; obsluha přerušení
irq:    pha
        txa
        pha
        lda CAS_STAV    ; potvrzení (vynuluje požadavek)
        inc TIKY
        ldx TIKY
        txa
        and #31
        tax
        lda TIKY
        lsr a
        lsr a
        lsr a
        lsr a
        lsr a
        clc
        adc #2
        sta $0200,x     ; každý tik obarví další pixel horního řádku
        lda #'*'
        sta $F001
        pla
        tax
        pla
        rti

        .org $FFFE      ; vektor IRQ/BRK
        .word irq
`,
    },
    {
      id: 'razeni', nazev: '14. Řazení bublinkou', uroven: 'pokročilý',
      popis: 'Bublinkové řazení 16 bajtů na adrese $20. Sledujte paměť v nulové stránce – změněné bajty se zvýrazní.',
      kod: `; === Bublinkové řazení ===
POLE    = $20
N       = 16
ZMENA   = $10

        *= $0600
        ldx #N-1        ; nakopíruj data do nulové stránky
.kopie: lda data,x
        sta POLE,x
        dex
        bpl .kopie

pruchod:
        lda #0
        sta ZMENA
        ldx #0
.porov: lda POLE,x
        cmp POLE+1,x    ; POLE[x] ≤ POLE[x+1]?
        bcc .dobre
        beq .dobre
        ldy POLE+1,x    ; prohoď
        sta POLE+1,x
        sty POLE,x
        lda #1
        sta ZMENA
.dobre: inx
        cpx #N-1
        bne .porov
        lda ZMENA
        bne pruchod     ; opakuj, dokud se něco měnilo

        ldx #0          ; výpis
.vypis: lda POLE,x
        sta $F002
        lda #' '
        sta $F001
        inx
        cpx #N
        bne .vypis
        brk

data:   .byte 42, 7, 99, 3, 250, 18, 64, 1, 77, 128, 5, 200, 33, 0, 255, 16
`,
    },
    {
      id: 'had', spustit: '1M', nazev: '15. Hra: had', uroven: 'pokročilý',
      popis: 'Klepněte na displej, spusťte program plnou rychlostí (1 MHz) a ovládejte hada klávesami W A S D nebo šipkami. Had roste po snědení jablka, náraz do zdi nebo do sebe hru ukončí. Tělo je kruhová fronta adres v paměti $1000/$1100.',
      kod: `; === Had ===
; ovládání: W A S D nebo šipky (nejdřív klepněte na displej)
KLAVESA = $FF
NAHODA  = $FE
ZNAK    = $F001
HEX     = $F003
BARVA_HAD   = 5         ; zelená
BARVA_HLAVA = 13        ; světle zelená
BARVA_JABLKO = 10       ; světle červená
RYCHLOST = 70           ; zpoždění (vyšší = pomalejší)
TELO_LO = $1000         ; kruhová fronta: nižší bajty adres článků
TELO_HI = $1100         ;                 vyšší bajty

; proměnné v nulové stránce
XH      = $00           ; souřadnice hlavy
YH      = $01
SMER    = $02           ; 0 nahoru, 1 vpravo, 2 dolů, 3 vlevo
HLAVA   = $03           ; index hlavy ve frontě
OCAS    = $04           ; index ocasu
RUST    = $05           ; kolik článků ještě přidat
UKAZ    = $06           ; ukazatel na pixel (2 bajty)
SKORE   = $08           ; BCD
UKAZ2   = $0A

        *= $0600
start:  ldx #0          ; smaž obrazovku
        txa
.cls:   sta $0200,x
        sta $0300,x
        sta $0400,x
        sta $0500,x
        inx
        bne .cls
        lda #12
        sta ZNAK        ; smaž konzoli
        lda #16
        sta XH
        sta YH
        lda #1
        sta SMER
        lda #'d'
        sta KLAVESA
        lda #0
        sta HLAVA
        sta OCAS
        sta SKORE
        lda #4
        sta RUST
        jsr adresa      ; první článek
        ldx #0
        lda UKAZ
        sta TELO_LO,x
        lda UKAZ+1
        sta TELO_HI,x
        ldy #0
        lda #BARVA_HLAVA
        sta (UKAZ),y
        jsr jablko

smycka: jsr klavesy
        jsr pohyb       ; nová poloha hlavy (při nárazu do zdi konec)
        ; ocas: buď roste, nebo se smaže poslední článek
        lda RUST
        beq .smazOcas
        dec RUST
        jmp .hlava
.smazOcas:
        ldx OCAS
        lda TELO_LO,x
        sta UKAZ2
        lda TELO_HI,x
        sta UKAZ2+1
        ldy #0
        tya
        sta (UKAZ2),y
        inc OCAS
.hlava: jsr adresa
        ldy #0
        lda (UKAZ),y    ; co je na novém místě?
        beq .volno
        cmp #BARVA_JABLKO
        beq .snezeno
        jmp konec       ; narazil do sebe
.snezeno:
        sed             ; skóre v BCD
        clc
        lda SKORE
        adc #1
        sta SKORE
        cld
        lda RUST
        clc
        adc #3
        sta RUST
        jsr kresliHlavu
        jsr jablko
        jmp .cekej
.volno: jsr kresliHlavu
.cekej: jsr zpozdeni
        jmp smycka

; přebarví starou hlavu na tělo a nakreslí novou
kresliHlavu:
        ldx HLAVA
        lda TELO_LO,x
        sta UKAZ2
        lda TELO_HI,x
        sta UKAZ2+1
        ldy #0
        lda #BARVA_HAD
        sta (UKAZ2),y
        inc HLAVA
        ldx HLAVA
        lda UKAZ
        sta TELO_LO,x
        lda UKAZ+1
        sta TELO_HI,x
        lda #BARVA_HLAVA
        sta (UKAZ),y
        rts

; klávesy W A S D, otočení o 180° se ignoruje
klavesy:
        lda KLAVESA
        ora #$20        ; velká písmena → malá
        ldx #3
.hledej: cmp klavSmer,x
        beq .nasel
        dex
        bpl .hledej
        rts
.nasel: txa
        eor #2          ; opačný směr?
        cmp SMER
        beq .zpet
        stx SMER
.zpet:  rts
klavSmer: .byte 'w', 'd', 's', 'a'

; posune hlavu podle směru, při nárazu do zdi skončí
pohyb:  lda SMER
        beq .nahoru
        cmp #1
        beq .vpravo
        cmp #2
        beq .dolu
        dec XH          ; vlevo
        bmi .naraz
        rts
.nahoru: dec YH
        bmi .naraz
        rts
.vpravo: inc XH
        lda XH
        cmp #32
        beq .naraz
        rts
.dolu:  inc YH
        lda YH
        cmp #32
        beq .naraz
        rts
.naraz: pla             ; zahodit návratovou adresu z JSR
        pla
        jmp konec

; UKAZ = $0200 + YH*32 + XH
adresa: lda YH
        asl a
        asl a
        asl a
        asl a
        asl a
        ora XH
        sta UKAZ
        lda YH
        lsr a
        lsr a
        lsr a
        clc
        adc #2
        sta UKAZ+1
        rts

; jablko na náhodné volné místo
jablko: lda NAHODA
        sta UKAZ2
        lda NAHODA
        and #3
        clc
        adc #2
        sta UKAZ2+1
        ldy #0
        lda (UKAZ2),y
        bne jablko      ; obsazeno – zkus jinde
        lda #BARVA_JABLKO
        sta (UKAZ2),y
        rts

zpozdeni:
        ldy #RYCHLOST
.vnejsi: ldx #0
.vnitrni: dex
        bne .vnitrni
        dey
        bne .vnejsi
        rts

konec:  ldx #0
.text:  lda zprava,x
        beq .skore
        sta ZNAK
        inx
        bne .text
.skore: lda SKORE
        sta HEX         ; BCD se šestnáctkově vypíše jako desítkové číslo
        lda #10
        sta ZNAK
        brk

zprava: .byte "Konec hry! Skóre: ", 0
`,
    },
  ];

  // ---------- úlohy ----------
  const nah = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const h2 = v => '$' + (v & 0xFF).toString(16).toUpperCase().padStart(2, '0');

  const ULOHY = [
    {
      id: 'u_ulozeni', nazev: 'Ulož číslo', uroven: 1,
      zadani: 'Uložte číslo <b>42</b> na adresu <code>$10</code> a hodnotu <b>$FF</b> na adresu <code>$0300</code>. Program ukončete instrukcí <code>BRK</code>.',
      sablona: `; Úloha: $10 ← 42, $0300 ← $FF\n        *= $0600\n\n        brk\n`,
      napoveda: 'LDA #42 načte číslo do A, STA $10 ho uloží.',
      testy: () => [{ vstup: {}, ocekavej: { 0x10: 42, 0x0300: 0xFF }, popis: '' }],
    },
    {
      id: 'u_soucet', nazev: 'Součet dvou čísel', uroven: 1,
      zadani: 'Sečtěte bajty na adresách <code>$10</code> a <code>$11</code> a výsledek uložte na <code>$12</code> (stačí dolních 8 bitů). Kontrola program spustí s několika různými vstupy.',
      sablona: `; Úloha: $12 ← $10 + $11\n        *= $0600\n\n        brk\n`,
      napoveda: 'Nezapomeňte CLC před ADC – kontrola spouští program s C=1, takže bez CLC vyjde o 1 víc.',
      testy: () => {
        const t = [[1, 2], [100, 27], [200, 100], [0, 0], [255, 255], [0, 255]];
        for (let i = 0; i < 4; i++) t.push([nah(0, 255), nah(0, 255)]);
        return t.map(([a, b]) => ({ vstup: { 0x10: a, 0x11: b }, ocekavej: { 0x12: (a + b) & 0xFF }, popis: a + ' + ' + b, nastav: { P: 0x25 } }));
      },
    },
    {
      id: 'u_max', nazev: 'Maximum z pole', uroven: 2,
      zadani: 'Na adresách <code>$20</code>–<code>$27</code> je 8 čísel bez znaménka. Najděte největší a uložte ho na <code>$30</code>.',
      sablona: `; Úloha: $30 ← max($20…$27)\n        *= $0600\n\n        brk\n`,
      napoveda: 'Projděte pole s indexem X (LDA $20,X). CMP nastaví C=1, když je A ≥ operand.',
      testy: () => {
        const sady = [[1, 2, 3, 4, 5, 6, 7, 8], [255, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0], [5, 5, 200, 5, 5, 128, 129, 5]];
        for (let i = 0; i < 4; i++) sady.push(Array.from({ length: 8 }, () => nah(0, 255)));
        return sady.map(s => {
          const vstup = {}; s.forEach((v, i) => { vstup[0x20 + i] = v; });
          return { vstup, ocekavej: { 0x30: Math.max(...s) }, popis: '[' + s.join(', ') + ']' };
        });
      },
    },
    {
      id: 'u_soucet16', nazev: '16bitový součet', uroven: 2,
      zadani: 'Sečtěte dvě 16bitová čísla: první je na <code>$10</code>/<code>$11</code>, druhé na <code>$12</code>/<code>$13</code> (nižší bajt vždy první). Výsledek uložte na <code>$14</code>/<code>$15</code> (dolních 16 bitů).',
      sablona: `; Úloha: ($14,$15) ← ($10,$11) + ($12,$13)\n        *= $0600\n\n        brk\n`,
      napoveda: 'CLC, sečíst nižší bajty, uložit; pak sečíst vyšší bajty (ADC přičte přenos).',
      testy: () => {
        const t = [[1, 2], [255, 1], [0x1234, 0x4321], [0xFFFF, 1], [40000, 30000]];
        for (let i = 0; i < 3; i++) t.push([nah(0, 65535), nah(0, 65535)]);
        return t.map(([a, b]) => {
          const s = (a + b) & 0xFFFF;
          return { vstup: { 0x10: a & 255, 0x11: a >> 8, 0x12: b & 255, 0x13: b >> 8 }, ocekavej: { 0x14: s & 255, 0x15: s >> 8 }, popis: a + ' + ' + b, nastav: { P: 0x25 } };
        });
      },
    },
    {
      id: 'u_obrat', nazev: 'Obrať pole', uroven: 2,
      zadani: 'Obraťte pořadí 8 bajtů na adresách <code>$20</code>–<code>$27</code> (na místě, tj. výsledek bude opět na $20–$27).',
      sablona: `; Úloha: obrátit $20…$27\n        *= $0600\n\n        brk\n`,
      napoveda: 'Prohazujte dvojice: X jde od začátku, Y od konce, dokud se nepotkají. Nebo použijte zásobník: 8× PHA a pak 8× PLA.',
      testy: () => {
        const sady = [[1, 2, 3, 4, 5, 6, 7, 8]];
        for (let i = 0; i < 3; i++) sady.push(Array.from({ length: 8 }, () => nah(0, 255)));
        return sady.map(s => {
          const vstup = {}, ocek = {};
          s.forEach((v, i) => { vstup[0x20 + i] = v; ocek[0x27 - i] = v; });
          return { vstup, ocekavej: ocek, popis: '[' + s.join(', ') + ']' };
        });
      },
    },
    {
      id: 'u_bity', nazev: 'Spočítej jedničky', uroven: 2,
      zadani: 'Spočítejte, kolik bitů je nastaveno na 1 v bajtu na adrese <code>$10</code>, a počet uložte na <code>$11</code>.',
      sablona: `; Úloha: $11 ← počet jedniček v $10\n        *= $0600\n\n        brk\n`,
      napoveda: 'LSR posune nejnižší bit do C; BCC přeskočí přičtení. Opakujte 8× nebo dokud A není nula.',
      testy: () => [0, 1, 0x80, 0xFF, 0x55, 0xAA, nah(0, 255), nah(0, 255)].map(v => ({
        vstup: { 0x10: v }, ocekavej: { 0x11: v.toString(2).split('').filter(x => x === '1').length }, popis: h2(v),
      })),
    },
    {
      id: 'u_nasob', nazev: 'Násobení 8 × 8 bitů', uroven: 3,
      zadani: 'Vynásobte bajty na <code>$10</code> a <code>$11</code> (bez znaménka) a 16bitový výsledek uložte na <code>$12</code> (nižší) a <code>$13</code> (vyšší bajt). Program musí skončit do 100 000 cyklů.',
      sablona: `; Úloha: ($12,$13) ← $10 × $11\n        *= $0600\n\n        brk\n`,
      napoveda: 'Inspirujte se ukázkou 7 „Násobení posuvem“. Opakované sčítání (255× přičíst) je pomalé, ale v limitu se vejde.',
      testy: () => {
        const t = [[0, 0], [1, 1], [255, 255], [12, 10], [200, 3], [3, 200]];
        for (let i = 0; i < 4; i++) t.push([nah(0, 255), nah(0, 255)]);
        return t.map(([a, b]) => ({ vstup: { 0x10: a, 0x11: b }, ocekavej: { 0x12: (a * b) & 255, 0x13: (a * b) >> 8 }, popis: a + ' × ' + b, nastav: { P: 0x25 } }));
      },
    },
    {
      id: 'u_retezec', nazev: 'Délka řetězce', uroven: 3,
      zadani: 'Na adrese <code>$0300</code> začíná text zakončený bajtem 0 (nejvýš 255 znaků). Jeho délku (bez nuly) uložte na <code>$10</code>.',
      sablona: `; Úloha: $10 ← délka textu na $0300\n        *= $0600\n\n        brk\n`,
      napoveda: 'LDY #0, pak ve smyčce LDA $0300,Y; BEQ konec; INY.',
      testy: () => ['Ahoj', '', 'Procesor 6502', 'x'.repeat(200), 'A', 'y'.repeat(255)].map(s => {
        const vstup = {};
        for (let i = 0; i < s.length; i++) vstup[0x300 + i] = s.charCodeAt(i);
        vstup[0x300 + s.length] = 0;
        return { vstup, ocekavej: { 0x10: s.length }, popis: '„' + (s.length > 20 ? s.slice(0, 17) + '…' : s) + '“' };
      }),
    },
    {
      id: 'u_bcd', nazev: 'Sčítání v BCD', uroven: 3,
      zadani: 'Na <code>$10</code> a <code>$11</code> jsou dvě dvoumístná čísla v BCD (např. $47 = 47). Sečtěte je v BCD a výsledek uložte na <code>$12</code>; pokud součet přesáhne 99, uložte na <code>$13</code> hodnotu 1, jinak 0.',
      sablona: `; Úloha: $12 ← $10 + $11 (BCD), $13 ← přenos\n        *= $0600\n\n        brk\n`,
      napoveda: 'SED zapne dekadický režim, CLC vynuluje přenos (kontrola začíná s C=1 a D=1). Přenos C po ADC říká, jestli součet přetekl přes 99. Na konci CLD.',
      testy: () => {
        const bcd = v => ((Math.floor(v / 10) << 4) | (v % 10));
        const t = [[1, 1], [9, 1], [47, 38], [99, 1], [50, 50], [0, 0], [99, 99]];
        for (let i = 0; i < 3; i++) t.push([nah(0, 99), nah(0, 99)]);
        // na vstupu C=1 a D=1 – řešení musí samo nastavit CLC/SED a na konci vypnout dekadický režim
        return t.map(([a, b]) => ({
          vstup: { 0x10: bcd(a), 0x11: bcd(b) }, ocekavej: { 0x12: bcd((a + b) % 100), 0x13: a + b > 99 ? 1 : 0 }, popis: a + ' + ' + b, nastav: { P: 0x2D },
        }));
      },
      kontrola(cpu) { return (cpu.P & 0x08) ? 'Na konci zůstal zapnutý dekadický režim (D=1) – chybí CLD.' : null; },
    },
    {
      id: 'u_displej', nazev: 'Rámeček na displeji', uroven: 3,
      zadani: 'Nakreslete na displej bílý (barva 1) rámeček kolem celé obrazovky: horní a dolní řádek a levý a pravý sloupec. Vnitřek musí zůstat černý (0).',
      sablona: `; Úloha: bílý rámeček 32×32\n        *= $0600\n\n        brk\n`,
      napoveda: 'Horní řádek $0200–$021F, dolní $05E0–$05FF. Sloupce: ukazatel (zp),Y posouvaný po 32 bajtech.',
      testy: () => [{ vstup: {}, ocekavej: {}, popis: 'displej' }],
      kontrola(cpu) {
        for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
          const v = cpu.mem[0x200 + y * 32 + x] & 15;
          const okraj = x === 0 || y === 0 || x === 31 || y === 31;
          if (okraj && v !== 1) return 'Pixel (' + x + ', ' + y + ') na rámečku má barvu ' + v + ', čekám 1 (bílá).';
          if (!okraj && v !== 0) return 'Pixel (' + x + ', ' + y + ') uvnitř má barvu ' + v + ', má být 0.';
        }
        return null;
      },
    },
  ];

  /**
   * Ověří úlohu: přeložený program (výsledek ASM.assemble) spustí pro každý test v čistém procesoru.
   * Vrací { ok, vysledky: [{ ok, popis, chyba }] }.
   */
  function over(uloha, preklad, knihovny, volby) {
    const { CPU8, PER } = knihovny; volby = volby || {};
    const limit = uloha.limit || 100000;
    const vysledky = [];
    for (const t of uloha.testy()) {
      const cpu = new CPU8.CPU({ brkStops: true, illegal: !!volby.illegal });
      cpu.mem.set(preklad.mem);
      PER.pripoj(cpu, { seed: 12345 });
      for (const k in t.vstup) cpu.mem[+k] = t.vstup[k];
      cpu.reset(true, preklad.start);
      if (t.nastav) Object.assign(cpu, t.nastav);
      while (!cpu.halted && cpu.cycles < limit) cpu.run(Math.min(10000, limit - cpu.cycles + 1));
      let chyba = null;
      // výsledek nesmí být „předvyplněný“ v obrazu programu (.byte / .org na výsledné adrese)
      const predem = Object.keys(t.ocekavej).map(Number).find(a => preklad.used && preklad.used[a]);
      if (predem !== undefined) chyba = 'Výsledek na $' + predem.toString(16).toUpperCase().padStart(4, '0') + ' je přímo v obrazu programu (.byte/.org) – program ho musí spočítat a zapsat sám.';
      else if (!cpu.halted) chyba = 'Program neskončil instrukcí BRK do ' + limit.toLocaleString('cs-CZ') + ' cyklů (nekonečná smyčka?).';
      else if (!/^BRK/.test(cpu.haltReason)) chyba = cpu.haltReason + '.';
      if (!chyba) {
        for (const k in t.ocekavej) {
          const a = +k, mam = cpu.mem[a], chci = t.ocekavej[k];
          if (mam !== chci) {
            chyba = 'Na adrese $' + a.toString(16).toUpperCase().padStart(4, '0') + ' je ' + h2(mam) + ' (' + mam + '), čekám ' + h2(chci) + ' (' + chci + ').';
            break;
          }
        }
      }
      if (!chyba && uloha.kontrola) chyba = uloha.kontrola(cpu, t);
      vysledky.push({ ok: !chyba, popis: t.popis, chyba, cykly: cpu.cycles });
    }
    return { ok: vysledky.every(v => v.ok), vysledky };
  }

  const LEKCE = { UKAZKY, ULOHY, over };
  if (typeof module !== 'undefined' && module.exports) module.exports = LEKCE;
  else root.CPU8LEKCE = LEKCE;
})(typeof self !== 'undefined' ? self : this);
