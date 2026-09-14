/* Native 1024 × 1536 geometry; paths describe visible surfaces only. */
window.ANATOMY_MODULES = [
  {
    "id": "organy",
    "title": "Vnitřní orgány",
    "image": "Prirodopis/organy-atlas-predek-v4.png",
    "viewBox": "0 0 1024 1536",
    "organs": [
      {
        "id": "mozek",
        "name": "Mozek",
        "system": "nervova",
        "latin": "Encephalon",
        "lead": "Řídicí centrum pro vnímání, myšlení i pohyb.",
        "location": "V lebce, která ho chrání spolu s mozkovými obaly a mozkomíšním mokem.",
        "function": "Zpracovává smyslové informace, umožňuje paměť a učení a koordinuje činnost těla.",
        "connection": "S míchou tvoří centrální nervovou soustavu. Nervy přenášejí signály mezi ní a ostatními částmi těla.",
        "remember": "Mozek pracuje i ve spánku. Mnoho dějů řídí bez našeho vědomého rozhodování.",
        "anchor": [
          461,
          85
        ],
        "label": [
          55,
          90
        ],
        "paths": [
          "M510 37 C491 17 451 36 436 57 C419 76 410 109 421 125 C433 140 460 143 478 141 C490 151 505 146 511 134 C517 153 532 145 549 141 C570 146 593 135 600 119 C608 94 592 60 576 47 C553 31 525 22 513 37 Z"
        ]
      },
      {
        "id": "prudusnice",
        "name": "Průdušnice",
        "system": "dychaci",
        "latin": "Trachea",
        "lead": "Pevná a pružná cesta pro vzduch do plic.",
        "location": "V krku a horní části hrudníku, před jícnem.",
        "function": "Vede vzduch z hrtanu k hlavním průduškám. Chrupavčité prstence pomáhají udržovat její průsvit otevřený.",
        "connection": "Dělí se na pravou a levou hlavní průdušku, které vstupují do plic.",
        "remember": "Průdušnice patří vzduchu. Potrava putuje do žaludku jícnem.",
        "anchor": [
          510,
          436
        ],
        "label": [
          65,
          340
        ],
        "paths": [
          "M491 374 Q510 385 527 374 L527 496 Q529 511 542 524 L533 539 L511 518 L494 543 L480 532 Q496 510 495 494 Z"
        ]
      },
      {
        "id": "plice",
        "name": "Plíce",
        "system": "dychaci",
        "latin": "Pulmones",
        "lead": "Místo, kde si vzduch a krev vyměňují plyny.",
        "location": "V hrudníku po obou stranách srdce, nad bránicí.",
        "function": "V plicních sklípcích přechází kyslík do krve a oxid uhličitý opačným směrem.",
        "connection": "Krev mezi srdcem a plícemi proudí malým neboli plicním oběhem.",
        "remember": "Levá plíce je menší a má dva laloky. Pravá má tři; část místa vlevo zabírá srdce.",
        "anchor": [
          394,
          568
        ],
        "label": [
          50,
          560
        ],
        "paths": [
          "M445 430 Q463 425 466 451 C472 494 489 543 486 590 L478 662 Q477 688 458 694 C389 706 343 716 314 779 Q302 788 303 754 C298 677 313 596 342 533 C367 484 410 440 445 430 Z",
          "M565 431 C593 426 643 478 668 523 C699 580 719 680 719 754 Q720 798 707 771 Q684 733 634 713 C627 695 632 651 622 613 Q610 578 585 556 C565 523 548 471 559 439 Z"
        ]
      },
      {
        "id": "srdce",
        "name": "Srdce",
        "system": "obehova",
        "latin": "Cor",
        "lead": "Svalová pumpa, která udržuje krev v pohybu.",
        "location": "Mezi plícemi za hrudní kostí, větší částí vlevo od střední čáry těla.",
        "function": "Pravá polovina pumpuje krev do plic, levá do zbytku těla.",
        "connection": "S cévami tvoří oběhovou soustavu. Krev přináší tkáním kyslík a živiny.",
        "remember": "Na obrázku vidíš srdce více vpravo, protože se na člověka díváš zepředu.",
        "anchor": [
          566,
          650
        ],
        "label": [
          770,
          610
        ],
        "paths": [
          "M514 575 Q529 570 540 591 Q554 582 578 594 C602 599 620 632 625 676 Q628 712 604 710 C558 708 520 688 502 657 C483 636 481 603 494 586 Z M522 584 C516 565 520 541 539 530 L541 498 L551 497 L555 524 Q575 535 578 549 C551 545 548 566 547 589 Z"
        ]
      },
      {
        "id": "jatra",
        "name": "Játra",
        "system": "travici",
        "latin": "Hepar",
        "lead": "Zpracovávají živiny a tvoří žluč.",
        "location": "Převážně v pravém podžebří, pod bránicí. Na obrázku vlevo.",
        "function": "Přeměňují a ukládají živiny, zpracovávají řadu látek a vytvářejí žluč potřebnou při trávení tuků.",
        "connection": "Přijímají krev bohatou na vstřebané živiny ze střeva. Žluč odtéká žlučovými cestami.",
        "remember": "Játra žluč vyrábějí. Žlučník ji pouze skladuje a zahušťuje.",
        "anchor": [
          396,
          765
        ],
        "label": [
          50,
          735
        ],
        "paths": [
          "M336 752 C355 721 403 700 452 702 C490 708 542 707 570 720 Q580 727 565 740 C528 756 516 799 466 803 Q455 810 444 813 C396 814 363 845 340 878 Q328 883 327 854 C323 819 320 780 336 752 Z"
        ]
      },
      {
        "id": "zlucnik",
        "name": "Žlučník",
        "system": "travici",
        "latin": "Vesica biliaris",
        "lead": "Malý zásobník žluči pod játry.",
        "location": "Na spodní ploše jater; viditelný jako malý zelený váček.",
        "function": "Uchovává a zahušťuje žluč a při trávení ji uvolňuje do dvanáctníku.",
        "connection": "Žluč přitéká z jater. Pomáhá rozptýlit tuky na drobné kapénky.",
        "remember": "Žlučníkem neprochází potrava. Do střeva z něj přichází žluč.",
        "anchor": [
          404,
          837
        ],
        "label": [
          50,
          845
        ],
        "paths": [
          "M417 819 Q437 817 431 832 C423 846 403 859 387 851 Q373 841 391 828 Z"
        ]
      },
      {
        "id": "zaludek",
        "name": "Žaludek",
        "system": "travici",
        "latin": "Gaster",
        "lead": "Svalový vak, který promíchává potravu.",
        "location": "V horní části břicha, převážně vlevo pod bránicí. Na obrázku vpravo.",
        "function": "Mísí potravu se žaludeční šťávou a začíná trávit bílkoviny.",
        "connection": "Navazuje na jícen a vyprazdňuje se do dvanáctníku, první části tenkého střeva.",
        "remember": "Většina živin se vstřebá až v tenkém střevě.",
        "anchor": [
          631,
          791
        ],
        "label": [
          770,
          795
        ],
        "paths": [
          "M564 706 L580 710 Q587 738 602 738 C635 712 666 728 681 752 C702 790 676 837 648 862 C618 888 579 896 545 887 C517 882 498 867 497 849 Q478 848 480 882 L458 880 C451 858 460 832 480 825 Q503 814 532 822 C559 822 578 801 582 780 Q580 751 570 737 Z"
        ]
      },
      {
        "id": "tenke_strevo",
        "name": "Tenké střevo",
        "system": "travici",
        "latin": "Intestinum tenue",
        "lead": "Hlavní místo trávení a vstřebávání živin.",
        "location": "Kličky vyplňují velkou část břišní dutiny uvnitř rámce tlustého střeva.",
        "function": "Dokončuje trávení a vstřebává většinu živin do krve nebo mízy.",
        "connection": "Konečný úsek, kyčelník, ústí přes ileocekální chlopeň do slepého střeva v pravém podbřišku.",
        "remember": "Klky a mikroklky zvětšují plochu pro vstřebávání.",
        "anchor": [
          505,
          1025
        ],
        "label": [
          745,
          1020
        ],
        "paths": [
          "M380 922 C408 917 434 946 470 943 Q538 959 603 935 Q637 927 650 962 L651 1029 C654 1069 646 1108 620 1135 L578 1141 C554 1112 512 1118 486 1152 C443 1174 417 1142 402 1124 C381 1098 379 1066 381 1037 C371 1006 372 958 380 922 Z",
          "M359 1003 C380 1017 405 1013 415 995 L435 1006 C422 1044 384 1046 356 1027 Z"
        ]
      },
      {
        "id": "tluste_strevo",
        "name": "Tlusté střevo",
        "system": "travici",
        "latin": "Intestinum crassum",
        "lead": "Vstřebává vodu a podílí se na tvorbě stolice.",
        "location": "Obklopuje kličky tenkého střeva a končí konečníkem.",
        "function": "Vstřebává část vody a minerálních látek. Zahušťuje střevní obsah a posouvá ho k vyloučení.",
        "connection": "Začíná slepým střevem v pravém podbřišku, do jehož vnitřní stěny ústí kyčelník. Pokračuje tračníkem a konečníkem.",
        "remember": "Tenké střevo ústí do slepého střeva. Červovitý přívěsek (apendix) je samostatný úzký výběžek jeho stěny.",
        "anchor": [
          348,
          1025
        ],
        "label": [
          35,
          1100
        ],
        "paths": [
          "M343 872 C363 848 393 864 420 879 C493 906 552 902 609 880 C640 869 664 846 681 856 Q701 869 692 900 C703 937 699 980 704 1017 C708 1071 690 1129 665 1160 C638 1198 602 1205 581 1190 L579 1152 L556 1136 C588 1156 619 1157 641 1128 C661 1093 660 1047 655 1008 L656 922 C609 947 552 958 499 948 C452 945 404 926 367 910 C358 951 357 1000 357 1042 Q358 1087 385 1106 C399 1121 398 1141 406 1151 L401 1158 Q390 1140 389 1123 C362 1124 341 1125 330 1108 C311 1088 313 1044 320 1019 L327 940 Q322 901 343 872 Z"
        ]
      },
      {
        "id": "mocovy_mechyr",
        "name": "Močový měchýř",
        "latin": "Vesica urinaria",
        "system": "mocova",
        "lead": "Pružný svalový zásobník moči.",
        "location": "V přední části malé pánve, za stydkou sponou a před konečníkem. Kličky střev leží převážně výše.",
        "function": "Shromažďuje moč, než ji při močení vypudí do močové trubice.",
        "connection": "Moč přitéká dvěma močovody. Vyprazdňování koordinuje nervová soustava.",
        "remember": "Močový měchýř leží vpředu v pánvi. V tomto atlasu ho najdeš v předním pohledu; zadní pohled ho nezobrazuje.",
        "anchor": [
          510,
          1191
        ],
        "label": [
          730,
          1220
        ],
        "paths": [
          "M445 1162 C459 1144 487 1140 510 1143 C543 1141 569 1152 580 1168 C592 1195 574 1218 541 1234 Q523 1243 522 1286 L501 1286 Q502 1251 486 1239 C454 1223 432 1190 445 1162 Z"
        ]
      }
    ],
    "viewName": "pohled zepředu",
    "caption": "Pravá strana těla je na obrázku vlevo. Močový měchýř leží vpředu v malé pánvi, za stydkou sponou a před konečníkem; na ilustraci překrývá jeho dolní část. Jde o zjednodušený výukový průhled."
  },
  {
    "id": "organy-zada",
    "title": "Vnitřní orgány zezadu",
    "viewName": "pohled zezadu",
    "image": "Prirodopis/organy-atlas-zada-v3.png",
    "viewBox": "0 0 1024 1536",
    "caption": "Pohled zezadu: pravá strana těla je vpravo. Páteř a ledviny překrývají hlouběji uložené části orgánů; srdce anatomicky leží před páteří. Střeva jsou odkryta průhledem a konečník okénkem v křížové kosti. Močový měchýř zůstává v předním pohledu.",
    "organs": [
      {
        "id": "mozek",
        "name": "Mozek",
        "system": "nervova",
        "latin": "Encephalon",
        "lead": "Řídicí centrum pro vnímání, myšlení i pohyb.",
        "location": "V lebce. Zezadu jsou dobře patrné mozkové hemisféry a pod nimi mozeček.",
        "function": "Zpracovává smyslové informace, umožňuje paměť a učení a koordinuje činnost těla.",
        "connection": "S míchou tvoří centrální nervovou soustavu. Nervy přenášejí signály mezi ní a ostatními částmi těla.",
        "remember": "Mozeček pomáhá koordinovat pohyby a udržovat rovnováhu. Je součástí mozku.",
        "anchor": [
          461,
          96
        ],
        "label": [
          50,
          90
        ],
        "paths": [
          "M509 37 C480 15 440 43 425 71 C411 95 411 130 428 151 Q429 177 449 194 C472 211 494 205 502 179 L513 171 Q520 200 548 203 C569 201 591 180 589 157 C604 143 606 111 595 84 C583 52 545 18 512 36 Z"
        ]
      },
      {
        "id": "micha",
        "name": "Mícha",
        "latin": "Medulla spinalis",
        "system": "nervova",
        "lead": "Spojení mezi mozkem a tělem, centrum řady reflexů.",
        "location": "V páteřním kanálu. U dospělého končí přibližně v úrovni prvního až druhého bederního obratle.",
        "function": "Přenáší nervové signály a zajišťuje jednoduché reflexní odpovědi.",
        "connection": "Navazuje na prodlouženou míchu v mozku. Z míchy vystupují nervové kořeny.",
        "remember": "Žlutá vlákna pod koncem míchy jsou nervové kořeny, označované jako koňský ohon (cauda equina).",
        "anchor": [
          511,
          348
        ],
        "label": [
          740,
          310
        ],
        "paths": [
          "M500 200 L521 200 C515 287 520 387 517 487 L521 632 C520 684 516 721 510 749 C502 721 500 683 502 632 L499 477 C503 361 497 281 500 200 Z"
        ]
      },
      {
        "id": "plice",
        "name": "Plíce",
        "system": "dychaci",
        "latin": "Pulmones",
        "lead": "Místo, kde si vzduch a krev vyměňují plyny.",
        "location": "V hrudníku po obou stranách srdce, nad bránicí.",
        "function": "V plicních sklípcích přechází kyslík do krve a oxid uhličitý opačným směrem.",
        "connection": "Krev mezi srdcem a plícemi proudí malým neboli plicním oběhem.",
        "remember": "Levá plíce je menší a má dva laloky. Pravá má tři; část místa vlevo zabírá srdce.",
        "anchor": [
          402,
          557
        ],
        "label": [
          45,
          475
        ],
        "paths": [
          "M444 402 Q463 401 467 435 L466 510 C464 544 442 551 430 587 L416 656 C375 679 334 683 307 740 C299 717 302 668 312 618 C325 538 369 452 414 416 Z",
          "M571 402 C613 404 656 484 680 538 C711 610 720 686 715 742 Q675 701 632 689 L579 670 C575 634 572 596 564 568 Q552 548 554 506 L554 445 Q556 410 571 402 Z"
        ]
      },
      {
        "id": "srdce",
        "name": "Srdce",
        "system": "obehova",
        "latin": "Cor",
        "lead": "Svalová pumpa, která udržuje krev v pohybu.",
        "location": "Mezi plícemi, před páteří a převážně vlevo. Při pohledu zezadu leží hlouběji než páteř, která jej částečně zakrývá.",
        "function": "Pravá polovina pumpuje krev do plic, levá do zbytku těla.",
        "connection": "S cévami tvoří oběhovou soustavu. Krev přináší tkáním kyslík a živiny.",
        "remember": "Levá strana těla je při pohledu zezadu vlevo. Viditelné červené části po stranách páteře patří jednomu srdci.",
        "anchor": [
          451,
          610
        ],
        "label": [
          45,
          590
        ],
        "paths": [
          "M479 548 L485 579 L479 597 L484 612 L480 637 Q448 653 425 654 C411 637 426 592 442 573 Z",
          "M543 565 Q562 565 569 592 L576 636 Q568 650 542 641 L537 622 L544 603 L537 587 Z"
        ]
      },
      {
        "id": "jatra",
        "name": "Játra",
        "system": "travici",
        "latin": "Hepar",
        "lead": "Zpracovávají živiny a tvoří žluč.",
        "location": "Pod bránicí převážně vpravo. V zadním pohledu jsou vpravo a částečně je zakrývá pravá ledvina.",
        "function": "Přeměňují a ukládají živiny, zpracovávají řadu látek a vytvářejí žluč potřebnou při trávení tuků.",
        "connection": "Přijímají krev bohatou na vstřebané živiny ze střeva. Žluč odtéká žlučovými cestami.",
        "remember": "Játra žluč vyrábějí. Žlučník ji pouze skladuje a zahušťuje.",
        "anchor": [
          653,
          732
        ],
        "label": [
          765,
          665
        ],
        "paths": [
          "M541 670 C579 685 662 690 693 735 Q712 774 696 823 Q677 802 663 795 Q649 758 614 751 L580 746 L574 775 L546 780 L538 756 L553 746 L548 735 L570 731 L562 706 L548 704 Z"
        ]
      },
      {
        "id": "zaludek",
        "name": "Žaludek",
        "system": "travici",
        "latin": "Gaster",
        "lead": "Svalový vak, který promíchává potravu.",
        "location": "Pod bránicí převážně vlevo. Zezadu jsou jeho části odkryté nad levou ledvinou a za slinivkou.",
        "function": "Mísí potravu se žaludeční šťávou a začíná trávit bílkoviny.",
        "connection": "Navazuje na jícen a vyprazdňuje se do dvanáctníku, první části tenkého střeva.",
        "remember": "Většina živin se vstřebá až v tenkém střevě.",
        "anchor": [
          391,
          735
        ],
        "label": [
          40,
          695
        ],
        "paths": [
          "M477 673 L485 693 Q474 714 459 724 L439 749 Q402 751 377 774 C360 769 353 751 355 729 Q362 702 394 698 C430 697 450 682 477 673 Z"
        ]
      },
      {
        "id": "slezina",
        "name": "Slezina",
        "latin": "Lien",
        "system": "mízní",
        "lead": "Pomáhá obraně těla a filtruje krev.",
        "location": "V levém podžebří, vedle žaludku a v blízkosti levé ledviny.",
        "function": "Podílí se na imunitních reakcích a odstraňuje stárnoucí červené krvinky.",
        "connection": "Patří k míznímu a imunitnímu systému; souvisí s krevním oběhem.",
        "remember": "Slezina je vlevo při předním i zadním pohledu na tělo; mění se její strana na obrázku.",
        "anchor": [
          332,
          763
        ],
        "label": [
          35,
          780
        ],
        "paths": [
          "M345 711 Q362 710 359 736 C346 758 340 784 337 815 Q328 830 316 811 C302 780 311 741 327 724 Z"
        ]
      },
      {
        "id": "slinivka",
        "name": "Slinivka břišní",
        "latin": "Pancreas",
        "system": "travici",
        "lead": "Tvoří trávicí šťávu i hormony regulující krevní cukr.",
        "location": "Napříč horní částí břicha za žaludkem. Zezadu ji částečně zakrývají ledviny a páteř.",
        "function": "Trávicí enzymy odtékají do dvanáctníku. Inzulin a glukagon se uvolňují do krve.",
        "connection": "Má trávicí i hormonální funkci; v přehledu je zařazena k trávicí soustavě.",
        "remember": "Žlutá žláza uprostřed břicha není ledvina ani střevo.",
        "anchor": [
          461,
          783
        ],
        "label": [
          750,
          840
        ],
        "paths": [
          "M428 754 Q453 748 480 753 L477 774 L468 785 L477 799 Q470 811 445 805 L434 791 Z",
          "M445 804 Q463 804 458 827 Q469 843 451 851 L428 839 Q422 827 431 815 Z",
          "M548 769 L572 774 L580 797 L577 822 Q559 829 540 813 L546 799 L540 791 Z",
          "M346 783 Q359 776 376 776 L364 791 L354 810 L335 816 Z"
        ]
      },
      {
        "id": "nadledviny",
        "name": "Nadledviny",
        "latin": "Glandulae suprarenales",
        "system": "hormonalni",
        "lead": "Dvě žlázy, které uvolňují hormony do krve.",
        "location": "U horních pólů ledvin; na obrázku jako malé žlutavé útvary.",
        "function": "Tvoří například kortizol, aldosteron a adrenalin.",
        "connection": "Pomáhají řídit reakci na zátěž a hospodaření s vodou a solemi.",
        "remember": "Nadledviny leží u ledvin, ale moč netvoří.",
        "anchor": [
          607,
          760
        ],
        "label": [
          750,
          755
        ],
        "paths": [
          "M375 774 Q386 757 408 757 Q429 756 439 781 L437 798 Q416 772 388 784 Z",
          "M577 769 L580 749 Q587 737 605 748 Q624 751 634 769 L617 771 Q592 766 578 785 Z"
        ]
      },
      {
        "id": "ledviny",
        "name": "Ledviny",
        "latin": "Renes",
        "system": "mocova",
        "lead": "Filtrují krev a vytvářejí moč.",
        "location": "Na zadní stěně břišní dutiny po stranách páteře, za pobřišnicí. Pravá ledvina bývá o něco níže.",
        "function": "Odstraňují odpadní látky a přebytečnou vodu. Pomáhají udržovat rovnováhu vody a minerálních látek.",
        "connection": "Moč z každé ledviny odtéká močovodem do močového měchýře.",
        "remember": "Ledviny tvoří moč průběžně. Močový měchýř ji pouze shromažďuje.",
        "anchor": [
          389,
          846
        ],
        "label": [
          35,
          875
        ],
        "paths": [
          "M396 780 C419 775 438 792 438 812 Q436 829 421 835 Q418 846 428 860 C444 874 445 897 429 911 C410 925 381 913 368 895 C346 866 347 825 363 801 Q377 785 396 780 Z",
          "M611 772 C635 767 654 787 662 810 C674 846 661 882 643 897 C624 913 599 908 587 890 Q576 872 589 855 Q599 844 587 831 C576 819 577 793 591 781 Z"
        ]
      },
      {
        "id": "tenke_strevo",
        "name": "Tenké střevo",
        "system": "travici",
        "latin": "Intestinum tenue",
        "lead": "Hlavní místo trávení a vstřebávání živin.",
        "location": "Kličky vyplňují velkou část břišní dutiny uvnitř rámce tlustého střeva.",
        "function": "Dokončuje trávení a vstřebává většinu živin do krve nebo mízy.",
        "connection": "Konečný úsek, kyčelník, ústí přes ileocekální chlopeň do slepého střeva v pravém podbřišku.",
        "remember": "Klky a mikroklky zvětšují plochu pro vstřebávání.",
        "anchor": [
          412,
          990
        ],
        "label": [
          35,
          985
        ],
        "paths": [
          "M377 914 Q396 910 421 923 L463 925 L459 949 L472 956 L460 976 L462 1001 L450 1020 L461 1036 L443 1062 L422 1084 L417 1132 Q398 1137 389 1116 L378 1092 L365 1058 L369 1023 C365 981 366 943 377 914 Z",
          "M552 921 Q576 911 600 913 L647 899 L656 930 L650 965 L649 1010 L630 1035 L637 1063 L623 1094 L620 1128 Q609 1142 597 1126 L587 1101 L576 1080 L555 1052 L563 1035 L551 1014 L560 995 L551 979 L559 960 L548 941 Z"
        ]
      },
      {
        "id": "tluste_strevo",
        "name": "Tlusté střevo",
        "system": "travici",
        "latin": "Intestinum crassum",
        "lead": "Vstřebává vodu a podílí se na tvorbě stolice.",
        "location": "Tračník rámuje tenké střevo. V zadním pohledu je vzestupný tračník vpravo a sestupný vlevo; esovitá klička směřuje do konečníku.",
        "function": "Vstřebává část vody a minerálních látek. Zahušťuje střevní obsah a posouvá ho k vyloučení.",
        "connection": "Začíná slepým střevem v pravém podbřišku, do jehož vnitřní stěny ústí kyčelník. Pokračuje tračníkem a konečníkem.",
        "remember": "Konečník je závěrečnou částí tlustého střeva. V zadním pohledu má vlastní popisek.",
        "anchor": [
          690,
          994
        ],
        "label": [
          755,
          1020
        ],
        "paths": [
          "M340 819 L357 819 L353 847 L353 888 L360 923 L353 960 L354 1000 L360 1031 C361 1067 364 1084 390 1096 C416 1110 431 1144 432 1196 L410 1191 C389 1179 381 1158 365 1148 C329 1131 309 1120 302 1090 C291 1063 297 1023 302 993 L311 928 L318 872 Q315 839 340 819 Z",
          "M674 824 Q697 834 698 866 L704 918 L715 970 L723 1023 Q731 1056 712 1078 C698 1093 672 1090 653 1079 L640 1069 L633 1055 Q635 1032 656 1026 L660 999 L655 969 L655 925 L661 902 L664 875 Z",
          "M438 834 Q456 827 473 840 L466 852 L478 865 L468 878 L470 901 L447 905 L430 889 L427 869 L440 860 Z",
          "M548 835 Q569 825 585 836 L588 855 L576 865 L583 881 L574 898 L549 902 L545 887 L556 875 L548 858 Z"
        ]
      },
      {
        "id": "konecnik",
        "name": "Konečník",
        "latin": "Rectum",
        "system": "travici",
        "lead": "Závěrečná část tlustého střeva, která shromažďuje stolici.",
        "location": "V zadní části malé pánve, před křížovou kostí. Na obrázku je odkrytý okénkem v oblasti křížové kosti.",
        "function": "Dočasně uchovává stolici a účastní se jejího vyprazdňování.",
        "connection": "Navazuje na esovitou kličku tračníku a přechází v řitní kanál.",
        "remember": "Močový měchýř leží v pánvi více vpředu. Zadní atlas jej nezobrazuje.",
        "anchor": [
          510,
          1161
        ],
        "label": [
          45,
          1235
        ],
        "paths": [
          "M498 1114 Q517 1106 529 1122 C541 1143 541 1186 533 1201 L527 1237 L516 1282 Q511 1295 505 1284 L496 1243 L485 1202 C478 1172 480 1133 498 1114 Z"
        ]
      }
    ]
  }
];
window.ANATOMY_SYSTEMS = {
  "nervova": "Nervová soustava",
  "dychaci": "Dýchací soustava",
  "obehova": "Oběhová soustava",
  "travici": "Trávicí soustava",
  "mocova": "Močová soustava",
  "mízní": "Mízní a imunitní soustava",
  "hormonalni": "Hormonální soustava"
};
