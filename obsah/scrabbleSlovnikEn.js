/* ============================================================
   scrabbleSlovnikEn.js – anglický školní slovník pro hru
   obsah/scrabble_en.html.

   Slovník je záměrně malý a školní: obsahuje slovní zásobu, se kterou
   se dítě potká na ZŠ, ne turnajový seznam. Hra tak zůstane hratelná
   (počítač nehraje slova, která nikdo nezná) a u každého zahraného
   slova jde ukázat český význam.

   Zdrojem jsou dva seznamy:
     ZAKLAD  – slova s českým významem ve tvaru "word|český význam|příznaky"
     NAVIC   – další platná slova bez překladu (nepravidelné tvary,
               krátká slovíčka, tvary, které by pravidlo neodvodilo)

   Příznaky u základního tvaru říkají, jaké odvozené tvary se mají
   dopočítat při načtení (proto je soubor malý, ale slovník velký):
     n  podstatné jméno  → množné číslo (cat→cats, box→boxes, city→cities)
     v  sloveso          → -s, -ing, -ed (stop→stopped, like→liked, cry→cried)
     a  přídavné jméno   → -er, -est (big→bigger, nice→nicer, happy→happier)

   Zdvojení koncové souhlásky se dělá jen u jednoslabičných slov typu
   souhláska-samohláska-souhláska (stop, big, run). U delších slov by
   pravidlo chybovalo (visit → visitted), takže se tam nepoužije;
   výjimky patří do NAVIC.

   Hra očekává dvě globální hodnoty (stejně jako český scrabbleSlovnik.js):
     SCRABBLE_SLOVNIK  – všechna platná slova oddělená mezerou
     SCRABBLE_VYZNAMY  – slovo → český význam (jen tam, kde je znám)
   ============================================================ */
const SLOVNIK_EN = (function () {

  /* ---- základní slovní zásoba ZŠ (s významem) ---- */
  const ZAKLAD = `
  animal|zvíře|n
  ant|mravenec|n
  bear|medvěd|n
  bee|včela|n
  bird|pták|n
  bug|brouk|n
  bull|býk|n
  calf|tele|
  camel|velbloud|n
  cat|kočka|n
  chick|kuře|n
  chicken|kuře, kuřecí|n
  cow|kráva|n
  crab|krab|n
  crow|vrána|n
  deer|jelen|
  dog|pes|n
  dolphin|delfín|n
  donkey|osel|n
  duck|kachna|n
  eagle|orel|n
  elephant|slon|n
  fish|ryba|
  fly|moucha|
  fox|liška|n
  frog|žába|n
  goat|koza|n
  goose|husa|
  hen|slepice|n
  horse|kůň|n
  insect|hmyz|n
  kitten|koťátko|n
  lamb|jehně|n
  lion|lev|n
  lizard|ještěrka|n
  monkey|opice|n
  mouse|myš|
  owl|sova|n
  panda|panda|n
  parrot|papoušek|n
  pet|domácí mazlíček|n
  pig|prase|n
  puppy|štěně|n
  rabbit|králík|n
  rat|krysa|n
  sheep|ovce|
  shark|žralok|n
  snail|hlemýžď|n
  snake|had|n
  spider|pavouk|n
  squirrel|veverka|n
  swan|labuť|n
  tiger|tygr|n
  turtle|želva|n
  whale|velryba|n
  wolf|vlk|
  worm|červ|n
  zebra|zebra|n

  apple|jablko|n
  bacon|slanina|
  banana|banán|n
  bean|fazole|n
  beef|hovězí maso|
  bread|chléb|
  breakfast|snídaně|n
  butter|máslo|
  cake|dort|n
  candy|bonbon|n
  carrot|mrkev|n
  cheese|sýr|n
  cherry|třešeň|n
  chocolate|čokoláda|n
  coffee|káva|n
  cream|smetana|n
  dinner|večeře|n
  egg|vejce|n
  fruit|ovoce|n
  garlic|česnek|n
  grape|hroznové víno|n
  ham|šunka|
  honey|med|
  juice|džus|n
  lemon|citron|n
  lunch|oběd|n
  meal|jídlo|n
  meat|maso|
  melon|meloun|n
  milk|mléko|
  mushroom|houba|n
  nut|ořech|n
  oil|olej|n
  onion|cibule|n
  orange|pomeranč|n
  pear|hruška|n
  pepper|pepř, paprika|n
  plate|talíř|n
  plum|švestka|n
  potato|brambora|n
  rice|rýže|
  salad|salát|n
  salt|sůl|
  sandwich|sendvič|n
  sauce|omáčka|n
  soup|polévka|n
  sugar|cukr|n
  supper|večeře|n
  tea|čaj|n
  toast|toast|n
  tomato|rajče|n
  water|voda|n
  wheat|pšenice|

  arm|paže|n
  back|záda, zpět|n
  beard|vous|n
  blood|krev|
  body|tělo|n
  bone|kost|n
  brain|mozek|n
  cheek|tvář|n
  chest|hruď|n
  chin|brada|n
  ear|ucho|n
  elbow|loket|n
  eye|oko|n
  face|obličej|n
  finger|prst|n
  foot|chodidlo|
  hair|vlasy|n
  hand|ruka|n
  head|hlava|n
  heart|srdce|n
  heel|pata|n
  hip|bok|n
  knee|koleno|n
  leg|noha|n
  lip|ret|n
  lung|plíce|n
  mouth|ústa|n
  neck|krk|n
  nose|nos|n
  shoulder|rameno|n
  skin|kůže|n
  stomach|žaludek|n
  thumb|palec|n
  toe|prst u nohy|n
  tongue|jazyk|n
  tooth|zub|
  waist|pas|n

  aunt|teta|n
  baby|miminko|n
  boy|chlapec|n
  brother|bratr|n
  child|dítě|
  cousin|bratranec, sestřenice|n
  dad|táta|n
  daughter|dcera|n
  family|rodina|n
  father|otec|n
  friend|kamarád|n
  girl|dívka|n
  grandma|babička|n
  grandpa|dědeček|n
  husband|manžel|n
  kid|dítě|n
  lady|dáma|n
  man|muž|
  mother|matka|n
  mum|máma|n
  name|jméno|n
  neighbour|soused|n
  parent|rodič|n
  people|lidé|
  person|osoba|n
  sister|sestra|n
  son|syn|n
  twin|dvojče|n
  uncle|strýc|n
  wife|manželka|
  woman|žena|

  answer|odpověď|n v
  book|kniha|n v
  chalk|křída|
  class|třída|n
  clock|hodiny|n
  desk|lavice|n
  eraser|guma|n
  exam|zkouška|n
  glue|lepidlo|n
  homework|domácí úkol|
  lesson|hodina, lekce|n
  library|knihovna|n
  map|mapa|n
  mark|známka, značka|n v
  math|matematika|
  note|poznámka|n v
  page|stránka|n
  paper|papír|n
  pen|pero|n
  pencil|tužka|n
  pupil|žák|n
  question|otázka|n
  ruler|pravítko|n
  school|škola|n
  student|student|n
  study|studovat|v
  subject|předmět|n
  teacher|učitel|n
  test|test|n v
  word|slovo|n

  bag|taška|n
  belt|pásek|n
  boot|bota|n
  cap|čepice|n
  coat|kabát|n
  dress|šaty|n
  glove|rukavice|n
  hat|klobouk|n
  jacket|bunda|n
  jeans|džíny|
  pocket|kapsa|n
  ring|prsten|n
  scarf|šála|
  shirt|košile|n
  shoe|bota|n
  skirt|sukně|n
  sock|ponožka|n
  suit|oblek|n
  sweater|svetr|n
  tie|kravata|n
  trousers|kalhoty|
  uniform|uniforma|n
  wear|nosit|
  zip|zip|n

  attic|půda|n
  bath|koupel|n
  bed|postel|n
  bell|zvonek|n
  blanket|deka|n
  bowl|miska|n
  brush|kartáč|n
  candle|svíčka|n
  carpet|koberec|n
  ceiling|strop|n
  chair|židle|n
  cup|hrnek|n
  curtain|záclona|n
  cushion|polštář|n
  door|dveře|n
  fence|plot|n
  fireplace|krb|n
  floor|podlaha|n
  fork|vidlička|n
  fridge|lednička|n
  furniture|nábytek|
  garage|garáž|n
  garden|zahrada|n
  glass|sklenice|n
  home|domov|n
  house|dům|n
  key|klíč|n
  kitchen|kuchyně|n
  knife|nůž|
  lamp|lampa|n
  mirror|zrcadlo|n
  oven|trouba|n
  pan|pánev|n
  pillow|polštář|n
  pot|hrnec|n
  roof|střecha|n
  room|pokoj|n
  rug|koberec|n
  shelf|police|
  soap|mýdlo|n
  sofa|pohovka|n
  spoon|lžíce|n
  stairs|schody|
  stove|kamna|n
  table|stůl|n
  towel|ručník|n
  wall|zeď|n
  window|okno|n
  yard|dvůr|

  autumn|podzim|n
  cloud|mrak|n
  cold|studený, nachlazení|a n
  fog|mlha|n
  frost|mráz|n
  heat|horko, hřát|n v
  ice|led|n
  rain|déšť, pršet|n v
  rainbow|duha|n
  season|roční období|n
  shade|stín|n
  sky|obloha|n
  snow|sníh, sněžit|n v
  spring|jaro, pramen|n
  storm|bouřka|n
  summer|léto|n
  sun|slunce|n
  thunder|hrom|n
  weather|počasí|
  wind|vítr|n
  winter|zima|n

  beach|pláž|n
  branch|větev|n
  cave|jeskyně|n
  cliff|útes|n
  coast|pobřeží|n
  desert|poušť|n
  earth|země|
  field|pole|n
  flower|květina|n
  forest|les|n
  grass|tráva|
  ground|země, půda|n
  hill|kopec|n
  island|ostrov|n
  lake|jezero|n
  land|země, přistát|n v
  leaf|list|
  moon|měsíc|n
  mountain|hora|n
  mud|bláto|
  ocean|oceán|n
  path|stezka|n
  plant|rostlina, sázet|n v
  pond|rybník|n
  river|řeka|n
  rock|skála|n
  root|kořen|n
  sand|písek|
  sea|moře|n
  seed|semeno|n
  shore|břeh|n
  soil|půda|n
  star|hvězda|n
  stone|kámen|n
  stream|potok|n
  tree|strom|n
  valley|údolí|n
  wave|vlna, mávat|n v
  wood|dřevo, les|n
  world|svět|n

  airport|letiště|n
  bank|banka|n
  bridge|most|n
  building|budova|n
  bus|autobus|
  car|auto|n
  castle|hrad|n
  church|kostel|n
  city|město|n
  corner|roh|n
  country|země|n
  farm|farma|n
  hospital|nemocnice|n
  hotel|hotel|n
  market|trh|n
  museum|muzeum|n
  park|park, parkovat|n v
  place|místo|n
  police|policie|
  post|pošta, poslat|n v
  road|silnice|n
  shop|obchod|n v
  square|náměstí, čtverec|n
  station|nádraží|n
  store|obchod, skladovat|n v
  street|ulice|n
  town|město|n
  village|vesnice|n
  zoo|zoo|n

  bicycle|jízdní kolo|n
  bike|kolo|n
  boat|loď|n
  driver|řidič|n
  engine|motor|n
  flight|let|n
  motorbike|motorka|n
  plane|letadlo|n
  rocket|raketa|n
  sail|plout, plachta|n v
  seat|sedadlo|n
  ship|loď|n
  ticket|jízdenka|n
  traffic|doprava|
  train|vlak, trénovat|n v
  tram|tramvaj|n
  travel|cestovat|v
  trip|výlet|n
  truck|nákladní auto|n
  wheel|kolo|n

  ball|míč|n
  bat|pálka, netopýr|n
  camp|tábor|n v
  cards|karty|
  chess|šachy|n
  club|klub|n
  coach|trenér|n
  dance|tančit, tanec|n v
  game|hra|n
  goal|gól, cíl|n
  gym|tělocvična|n
  hobby|koníček|n
  match|zápas|n
  net|síť|n
  player|hráč|n
  race|závod|n v
  score|skóre, bodovat|n v
  skate|bruslit|v
  ski|lyžovat, lyže|n v
  sport|sport|n
  swim|plavat|v
  team|tým|n
  tennis|tenis|
  toy|hračka|n
  win|vyhrát|v

  actor|herec|n
  artist|umělec|n
  baker|pekař|n
  boss|šéf|
  builder|stavitel|n
  chef|kuchař|n
  clerk|úředník|n
  cook|kuchař, vařit|n v
  dentist|zubař|n
  doctor|doktor|n
  farmer|farmář|n
  guard|hlídač, hlídat|n v
  guide|průvodce, vést|n v
  job|práce|n
  judge|soudce, soudit|n v
  nurse|zdravotní sestra|n
  office|kancelář|n
  painter|malíř|n
  pilot|pilot|n
  sailor|námořník|n
  singer|zpěvák|n
  soldier|voják|n
  waiter|číšník|n
  work|práce, pracovat|n v
  writer|spisovatel|n

  art|umění|n
  band|kapela|n
  bell|zvon|n
  camera|fotoaparát|n
  colour|barva|n
  drum|buben|n
  film|film|n
  flute|flétna|n
  guitar|kytara|n
  music|hudba|
  note|nota|n
  paint|barva, malovat|n v
  photo|fotka|n
  piano|klavír|n
  picture|obrázek|n
  poem|báseň|n
  radio|rádio|n
  song|píseň|n
  sound|zvuk, znít|n v
  stage|jeviště|n
  story|příběh|n
  theatre|divadlo|n
  video|video|n
  violin|housle|n
  voice|hlas|n

  black|černý|a
  blue|modrý|a
  brown|hnědý|a
  green|zelený|a
  grey|šedý|a
  pink|růžový|a
  purple|fialový|
  red|červený|a
  white|bílý|a
  yellow|žlutý|a

  angry|rozzlobený|a
  bad|špatný|
  beautiful|krásný|
  best|nejlepší|
  big|velký|a
  brave|statečný|a
  bright|jasný|a
  busy|zaneprázdněný|a
  calm|klidný|a
  cheap|levný|a
  clean|čistý, uklidit|a v
  clear|jasný|a v
  clever|chytrý|a
  close|blízký, zavřít|a v
  cool|chladný, super|a
  crazy|bláznivý|a
  cute|roztomilý|a
  dark|tmavý|a
  dead|mrtvý|
  deep|hluboký|a
  dirty|špinavý|a
  dry|suchý, sušit|a v
  early|brzký|
  easy|snadný|a
  empty|prázdný|a
  fair|spravedlivý|a
  false|nepravdivý|
  famous|slavný|
  fast|rychlý|a
  fat|tlustý|a
  free|volný, zdarma|a
  fresh|čerstvý|a
  full|plný|a
  funny|vtipný|a
  glad|rád|a
  good|dobrý|
  great|skvělý|a
  half|polovina|
  happy|šťastný|a
  hard|tvrdý, těžký|a
  healthy|zdravý|a
  heavy|těžký|a
  high|vysoký|a
  hot|horký|a
  hungry|hladový|a
  kind|laskavý, druh|a n
  large|velký|a
  late|pozdní|a
  lazy|líný|a
  light|lehký, světlo|a n
  long|dlouhý|a
  loud|hlasitý|a
  low|nízký|a
  lucky|šťastný|a
  mad|šílený|a
  mean|zlý, znamenat|a v
  narrow|úzký|a
  nasty|ošklivý|a
  new|nový|a
  nice|milý|a
  noisy|hlučný|a
  old|starý|a
  poor|chudý|a
  proud|hrdý|a
  quick|rychlý|a
  quiet|tichý|a
  rich|bohatý|a
  right|správný, pravý|
  ripe|zralý|a
  round|kulatý|a
  sad|smutný|a
  safe|bezpečný|a
  same|stejný|
  sharp|ostrý|a
  short|krátký|a
  sick|nemocný|a
  silly|hloupý|a
  slow|pomalý|a
  small|malý|a
  smart|chytrý|a
  soft|měkký|a
  sorry|omlouvám se|
  sour|kyselý|a
  strange|zvláštní|a
  strong|silný|a
  sure|jistý|a
  sweet|sladký|a
  tall|vysoký|a
  thick|tlustý|a
  thin|tenký|a
  thirsty|žíznivý|a
  tired|unavený|
  true|pravdivý|a
  ugly|ošklivý|a
  warm|teplý, hřát|a v
  weak|slabý|a
  wet|mokrý|a
  wide|široký|a
  wild|divoký|a
  wise|moudrý|a
  wrong|špatný|
  young|mladý|a

  add|přidat|v
  agree|souhlasit|v
  allow|dovolit|v
  arrive|přijet|v
  ask|ptát se|v
  bake|péct|v
  bring|přinést|
  build|stavět|
  burn|hořet|v
  buy|koupit|
  call|volat|v
  carry|nést|v
  catch|chytit|
  change|změnit, změna|n v
  check|zkontrolovat|n v
  choose|vybrat|
  climb|lézt|v
  count|počítat|v
  cover|zakrýt, obal|n v
  cross|přejít, kříž|n v
  cry|plakat|v
  cut|řezat|
  decide|rozhodnout|v
  dig|kopat|
  draw|kreslit|
  dream|snít, sen|n v
  drink|pít, nápoj|n
  drive|řídit|
  drop|upustit, kapka|n v
  eat|jíst|
  enter|vstoupit|v
  explain|vysvětlit|v
  fall|padat, podzim|n
  feed|krmit|
  feel|cítit|
  fight|bojovat, boj|n
  fill|naplnit|v
  find|najít|
  finish|dokončit|v
  fix|opravit|v
  follow|následovat|v
  forget|zapomenout|
  give|dát|
  grow|růst|
  guess|hádat|v
  happen|stát se|v
  hate|nenávidět|v
  have|mít|
  hear|slyšet|
  help|pomoci, pomoc|n v
  hide|schovat|
  hit|udeřit|
  hold|držet|
  hope|doufat, naděje|n v
  hurry|spěchat|v
  hurt|bolet|
  invite|pozvat|v
  join|připojit se|v
  jump|skákat|n v
  keep|držet, nechat si|
  kick|kopnout|n v
  know|vědět, znát|
  laugh|smát se|n v
  learn|učit se|v
  leave|odejít|
  lend|půjčit|
  let|nechat|
  lie|ležet, lhát|
  lift|zvednout, výtah|n v
  like|mít rád|v
  listen|poslouchat|v
  live|žít|v
  lock|zamknout, zámek|n v
  look|dívat se, pohled|n v
  lose|ztratit|
  love|milovat, láska|n v
  make|dělat|
  meet|potkat|
  miss|zmeškat, minout|v
  move|hýbat se|v
  need|potřebovat|v
  open|otevřít|v
  order|objednat, pořádek|n v
  pack|balit, balíček|n v
  pass|projít, podat|v
  pay|platit|
  pick|vybrat, trhat|v
  play|hrát, hra|n v
  point|ukázat, bod|n v
  pour|nalít|v
  pull|táhnout|v
  push|tlačit|v
  put|položit|
  read|číst|
  ride|jet|
  ring|zvonit|
  run|běžet|
  save|zachránit, šetřit|v
  say|říct|
  see|vidět|
  sell|prodat|
  send|poslat|
  shout|křičet|v
  show|ukázat|v
  shut|zavřít|
  sing|zpívat|
  sit|sedět|
  sleep|spát, spánek|n
  smell|vonět, čichat|n v
  smile|usmívat se, úsměv|n v
  speak|mluvit|
  spell|hláskovat|
  spend|utratit, strávit|
  stand|stát|
  start|začít|n v
  stay|zůstat|v
  steal|krást|
  stop|zastavit, zastávka|n v
  swim|plavat|
  take|vzít|
  talk|mluvit|n v
  taste|chutnat, chuť|n v
  teach|učit|
  tell|říct|
  thank|děkovat|v
  think|myslet|
  throw|házet|
  touch|dotknout se|v
  try|zkusit|v
  turn|otočit, řada|n v
  understand|rozumět|
  use|použít|v
  visit|navštívit|n v
  wait|čekat|v
  wake|probudit|
  walk|jít pěšky, procházka|n v
  want|chtít|v
  wash|mýt|v
  watch|dívat se, hodinky|v
  wish|přát si, přání|n v
  work|pracovat|v
  worry|bát se|v
  write|psát|

  bit|kousek|n
  box|krabice|n
  can|plechovka, moci|n
  card|karta|n
  case|případ, pouzdro|n
  cash|hotovost|
  chance|šance|n
  coin|mince|n
  cost|cena, stát|n
  dust|prach|
  end|konec, skončit|n v
  fact|fakt|n
  fire|oheň|n
  form|tvar, formulář|n
  gift|dárek|n
  gold|zlato|
  group|skupina|n
  hole|díra|n
  idea|nápad|n
  iron|železo, žehlit|n v
  line|čára, řada|n
  list|seznam|n v
  luck|štěstí|
  metal|kov|n
  money|peníze|
  news|zprávy|
  noise|hluk|n
  number|číslo|n
  oxygen|kyslík|
  part|část|n
  piece|kousek|n
  plan|plán, plánovat|n v
  price|cena|n
  prize|cena, výhra|n
  problem|problém|n
  rope|lano|n
  rule|pravidlo, vládnout|n v
  sign|značka, podepsat|n v
  size|velikost|n
  smoke|kouř, kouřit|n v
  space|vesmír, místo|n
  speed|rychlost|n
  steam|pára|
  steel|ocel|
  stick|hůl, přilepit|n
  thing|věc|n
  truth|pravda|
  way|cesta, způsob|n
  weight|váha|n
  wire|drát|n

  age|věk|n
  april|duben|
  autumn|podzim|n
  clock|hodiny|n
  date|datum, rande|n
  day|den|n
  evening|večer|n
  friday|pátek|
  hour|hodina|n
  minute|minuta|n
  moment|okamžik|n
  monday|pondělí|
  month|měsíc|n
  morning|ráno|n
  night|noc|n
  noon|poledne|
  today|dnes|
  week|týden|n
  year|rok|n

  computer|počítač|n
  data|data|
  email|e-mail|n
  file|soubor|n
  internet|internet|
  laptop|notebook|n
  mobile|mobil|n
  mouse|myš|
  phone|telefon, telefonovat|n v
  robot|robot|n
  screen|obrazovka|n
  website|web|n

  one|jedna|
  two|dva|
  three|tři|
  four|čtyři|
  five|pět|
  six|šest|
  seven|sedm|
  eight|osm|
  nine|devět|
  ten|deset|
  eleven|jedenáct|
  twelve|dvanáct|
  twenty|dvacet|
  thirty|třicet|
  forty|čtyřicet|
  fifty|padesát|
  sixty|šedesát|
  eighty|osmdesát|
  hundred|sto|
  million|milion|n
  first|první|
  second|druhý, vteřina|n
  third|třetí|
  half|polovina|
  pair|pár|n
  dozen|tucet|n
  `;

  /* ---- další platná slova (bez překladu) ----
     Nepravidelné tvary sloves a množná čísla, spojky, předložky, zájmena
     a krátká slovíčka, bez kterých by se ve Scrabble nedalo hrát. */
  const NAVIC = `
  a an the and or but so if as at by for from in into of off on out to up
  with about above across after again against along among around before behind
  below beside between beyond down during near over past round since through
  under until upon within without over here there where when why how what who
  which whose whom that this these those than then too very much many more most
  less least all any both each every few no none some such other another same
  own not now never always often sometimes seldom ever soon still yet just only
  also almost enough quite rather really too well better worse away back down
  forward home indeed instead maybe perhaps together
  i me my mine myself you your yours yourself he him his himself she her hers
  herself it its itself we us our ours ourselves they them their theirs
  themselves one ones
  am is are was were be been being do does did done doing go goes went gone
  going have has had having can could shall should will would may might must
  ought used
  ate eaten came come coming began begin begun bought brought built came caught
  chose chosen cut dug drank drunk drew drawn drove driven fell fallen fed felt
  fought found flew flown forgot forgotten gave given grew grown heard hid
  hidden held kept knew known laid lay led left lent let lost made meant met
  paid put ran rang rung read ridden rode rose risen said sang sung sat saw
  seen sold sent sewn shone shot showed shown shut slept sold spoke spoken
  spent stood stole stolen swam swum taken took taught tore torn thought threw
  thrown told understood woke woken wore worn won wrote written
  children feet geese men mice teeth women lives leaves knives wolves shelves
  wives loaves halves calves thieves
  am an as at ax be by do go ha he hi id if in is it la ma me my no of oh ok on
  or ox pa pi so to up us we ye
  ace act age aid aim air ale all ape apt arc are ark arm art ash ask ate awe
  axe bad bag ban bar bat bay bed bee beg bet bib bid big bin bit boa bob bog
  bow box boy bud bug bun bus but buy cab cad cam cap car cat cob cod cog con
  cop cot cow coy cry cub cue cup cur cut dab dad dam day den dew did die dig
  dim din dip doe dog don dot dry dub dud due dug duo dye ear eat eel egg ego
  elf elk elm end era err eve ewe eye fad fan far fat fax fed fee few fib fig
  fin fir fit fix flu fly fob foe fog for fox fry fun fur gag gal gap gas gel
  gem get gig gin god got gum gun gut guy gym had hag ham has hat hay hem hen
  her hew hid him hip his hit hoe hog hop hot how hub hue hug hum hut ice icy
  ill imp ink inn ion ire irk its ivy jab jam jar jaw jay jet jig job jog jot
  joy jug jut keg key kid kin kit lab lad lag lam lap law lax lay led leg let
  lid lie lip lit lob log lot low lug mad man map mar mat may men met mid mix
  mob mop mud mug mum nag nap nay net new nib nil nip nod nor not now nun nut
  oak oar oat odd ode off oil old one opt orb ore our out owe owl own pad pal
  pan pap par pat paw pay pea peg pen pep per pet pew pie pig pin pit ply pod
  pop pot pro pry pub pug pun pup put rag ram ran rap rat raw ray red rib rid
  rig rim rip rob rod roe rot row rub rue rug rum run rye sad sag sap sat saw
  say sea see set sew she shy sin sip sir sit six ski sky sly sob sod son sow
  soy spa spy sty sub sue sum sun tab tag tan tap tar tax tea ten the thy tidy
  tie tin tip toe ton too top tow toy try tub tug two urn use van vat vet vex
  via vie vow wag war was wax way web wed wee wet who why wig win wit woe wok
  won woo wow wry yak yam yap yes yet yew you zap zip zoo
  able acid acre aged also amid ants arch area army atom aunt away axis babe
  ball band bank bare barn base bath beam bean bear beat beef been beer bell
  belt bend bent best bike bill bind bird bite blow blue boat body boil bold
  bolt bomb bond bone book boom boot bore born boss both bowl bulk bull burn
  bury bush busy cage cake calf call calm came camp cane cape card care cars
  cart case cash cast cave cell cent chat chef chew chin chip chop city clap
  claw clay clip club coal coat code coil coin cold colt comb come cook cool
  cope copy cord core cork corn cost cosy crab crew crop crow cube cure curl
  cute dais dare dark dart dash date dawn dead deaf deal dean dear debt deck
  deed deep deer dent desk dial dice diet dime dine dirt dish dive dock does
  dole doll dome done doom door dose dote dove down doze drag draw drew drip
  drop drug drum dual duck duct dude duke dull dump dune dusk dust duty each
  earl earn ease east easy echo edge edit envy epic even ever evil exam exit
  face fact fade fail fair fake fall fame fare farm fast fate fear feat feed
  feel fell felt fern fest file fill film find fine fire firm fish fist five
  flag flat flee flew flat flip flow foam foil fold folk fond food fool foot
  ford fore fork form fort foul four free fret frog from fuel full fund fury
  fuse gain gale game gang gape gate gave gaze gear gene gift girl give glad
  glow glue goal goat goes gold golf gone good gown grab gram gray grew grey
  grid grim grin grip grow gulf gull guru gush gust hail hair half hall halt
  hand hang hard hare harm harp haste hate haul have hawk haze head heal heap
  hear heat heel heir held hell helm help herb herd here hero hide high hike
  hill hint hire hive hold hole holy home hone honk hood hoof hook hoop hope
  horn hose host hour huge hull hump hunt hurl hurt hush husk hymn icon idea
  idle idol inch info into iron isle itch jade jail jazz jeep jest join joke
  jolt jump junk jury just keen keep kept kick kids kill kilt kind king kiss
  kite knee knew knit knob knot know lace lack lady laid lake lamb lame lamp
  land lane last late lava lawn lazy lead leaf leak lean leap left lend lens
  less lest lick lied life lift like limb lime limp line link lion list live
  load loaf loan lock loft logo lone long look loom loop lord lose loss lost
  loud love luck lump lung lure lush lute made mail main make male mall many
  mare mark mask mass mast mate math meal mean meat meek meet melt memo mend
  menu mere mesh mess mice mild mile milk mill mind mine mint miss mist mixed
  moan mode mole monk mood moon moor mope more moss most moth move much mule
  mute nail name nape navy near neat neck need neon nest news next nice nick
  nine node none noon norm nose note noun null numb oath obey odds odor okay
  once only onto open oral ouch ours oval oven over pace pack page paid pail
  pain pair pale palm pane pant park part pass past path pave pawn peak pear
  peel peer pest pick pier pile pill pine pink pint pipe pity plan play plea
  plot plug plum plus poem poet pole poll pond pony pool poor pope pork port
  pose post pour pray prey prim prod prop pull pulp pump punk pure push quit
  quiz race rack raft rage raid rail rain rake ramp rang rank rare rash rate
  rave read real reap rear reed reef reel rely rent rest ribs rice rich ride
  ring riot ripe rise risk road roam roar robe rock rode role roll roof room
  root rope rose rosy ruby rude ruin rule rung runs rush rust sack safe sage
  said sail sake sale salt same sand sang sank save scan scar seal seam seat
  seed seek seem seen self sell send sent sews shed shin ship shoe shop shot
  show shut sick side sigh sign silk sing sink site size skin skip slab slam
  slap sled slid slim slip slot slow slug smog snap snow soak soap soar sock
  soda sofa soft soil sold sole solo some song soon sore sort soul soup sour
  span spin spit spot spun spur stab stag star stay stem step stew stir stop
  stow stub stud such suit sunk sure surf swan swap swim swan tail take tale
  talk tall tame tank tape task team tear teas tell tend tent term test text
  than that thaw thee them then they thin this thud thus tick tide tidy tied
  tier tile till tilt time tiny tips tire toad toil told toll tomb tone took
  tool toot tore torn toss tour town toys trap tray tree trek trim trip trot
  true tube tuck tuna tune turf turn twig twin type ugly unit upon urge used
  user vain vary vase vast veal veil vein vent verb very vest veto vice view
  vine visa void vote wade wage wail wait wake walk wall wand want ward ware
  warm warn wart wash wasp wave wavy waxy weak wear weed week weep well went
  were west what when whim whip whom wick wide wife wild will wind wine wing
  wink wipe wire wise wish with wolf wood wool word wore work worm worn wrap
  yard yarn yawn yean year yell yoga yolk your zeal zero zest zone zoom
  `;

  /* ---- odvozování tvarů ---- */
  const SAMOHLASKY = 'aeiou';
  const jeSamohlaska = z => SAMOHLASKY.includes(z);

  // jednoslabičné souhláska-samohláska-souhláska (stop, big, run) → zdvojit
  function zdvojit(s) {
    if (s.length < 3) return false;
    const [a, b, c] = [s.at(-3), s.at(-2), s.at(-1)];
    if (jeSamohlaska(c) || 'wxy'.includes(c)) return false;
    if (!jeSamohlaska(b) || jeSamohlaska(a)) return false;
    // víc samohláskových skupin = víc slabik, tam pravidlo neplatí
    const skupiny = s.match(/[aeiouy]+/g) || [];
    return skupiny.length === 1;
  }

  function mnozne(s) {
    if (/(s|x|z|ch|sh)$/.test(s)) return [s + 'es'];
    if (/[^aeiou]y$/.test(s)) return [s.slice(0, -1) + 'ies'];
    if (/[^aeiou]o$/.test(s)) return [s + 'es', s + 's'];
    return [s + 's'];
  }

  function slovesne(s) {
    const t = [];
    t.push(...mnozne(s));                                    // he plays / goes
    if (s.endsWith('e') && !s.endsWith('ee')) {              // like → liking, liked
      t.push(s.slice(0, -1) + 'ing', s + 'd');
    } else if (/[^aeiou]y$/.test(s)) {                       // cry → crying, cried
      t.push(s + 'ing', s.slice(0, -1) + 'ied');
    } else if (zdvojit(s)) {                                 // stop → stopping, stopped
      t.push(s + s.at(-1) + 'ing', s + s.at(-1) + 'ed');
    } else {
      t.push(s + 'ing', s + 'ed');
    }
    return t;
  }

  function stupnovani(s) {
    if (s.endsWith('e')) return [s + 'r', s + 'st'];
    if (/[^aeiou]y$/.test(s)) return [s.slice(0, -1) + 'ier', s.slice(0, -1) + 'iest'];
    if (zdvojit(s)) return [s + s.at(-1) + 'er', s + s.at(-1) + 'est'];
    return [s + 'er', s + 'est'];
  }

  /* ---- sestavení slovníku ---- */
  const vyznamy = new Map();   // slovo → význam (i u odvozených tvarů)
  const platna = new Set();

  function pridej(slovo, vyznam) {
    if (!/^[a-z]{2,15}$/.test(slovo)) return;
    platna.add(slovo);
    if (vyznam && !vyznamy.has(slovo)) vyznamy.set(slovo, vyznam);
  }

  ZAKLAD.trim().split('\n').forEach(radek => {
    const r = radek.trim();
    if (!r) return;
    const [slovo, vyznam, priznaky = ''] = r.split('|').map(x => (x || '').trim());
    const zakl = slovo.toLowerCase();
    pridej(zakl, vyznam);
    if (priznaky.includes('n')) mnozne(zakl).forEach(t => pridej(t, vyznam));
    if (priznaky.includes('v')) slovesne(zakl).forEach(t => pridej(t, vyznam));
    if (priznaky.includes('a')) stupnovani(zakl).forEach(t => pridej(t, vyznam));
  });

  NAVIC.trim().split(/\s+/).forEach(s => pridej(s.toLowerCase(), ''));

  const seznam = [...platna].sort();

  return {
    slova: seznam.join(' '),
    vyznamy: Object.fromEntries(vyznamy),
  };
})();

const SCRABBLE_SLOVNIK = SLOVNIK_EN.slova;
const SCRABBLE_VYZNAMY = SLOVNIK_EN.vyznamy;
