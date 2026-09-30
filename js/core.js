'use strict';
// ---------- utilities ----------
const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const sstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const mulc = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const rgb = c => 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + a.toFixed(3) + ')';
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
class RNG {
  constructor(s) { this.f = mulberry32(s >>> 0); }
  n() { return this.f(); }
  r(a, b) { return a + (b - a) * this.f(); }
  i(a, b) { return Math.floor(a + (b - a + 1) * this.f()); }
  p(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  c(p) { return this.f() < p; }
}
function hash(a, b, c) {
  let h = (Math.imul(a | 0, 374761393) + Math.imul((b | 0) + 7, 668265263) + Math.imul((c | 0) + 13, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
const QP = new URLSearchParams(location.search);
const G = new RNG((Date.now() ^ (Math.random() * 1e9)) >>> 0); // story RNG
const CLOCK = +(QP.get('clock') || 6); // sim seconds per real second

// ---------- weather & daylight ----------
const WX = {
  clear:    { cloud: .10, rain: 0,   fog: .0035 },
  cloudy:   { cloud: .55, rain: 0,   fog: .0048 },
  overcast: { cloud: .95, rain: 0,   fog: .0065 },
  drizzle:  { cloud: .95, rain: .35, fog: .0090 },
  rain:     { cloud: 1,   rain: .85, fog: .0120 },
  fog:      { cloud: .90, rain: 0,   fog: .0200 },
};
const WX_NEXT = {
  clear: ['cloudy', 'cloudy', 'clear'], cloudy: ['clear', 'overcast', 'drizzle'],
  overcast: ['cloudy', 'drizzle', 'fog', 'cloudy'], drizzle: ['rain', 'overcast', 'overcast'],
  rain: ['drizzle', 'overcast'], fog: ['overcast', 'cloudy'],
};
const env = {
  hour: QP.has('t') ? +QP.get('t') : G.r(11, 18.5),
  wx: QP.get('w') || G.p(['clear', 'clear', 'cloudy', 'overcast', 'drizzle']),
  cloud: 0, rain: 0, fog: .004, wet: 0,
  day: 1, night: 0, amb: 1, tint: [1, 1, 1], twi: 0, lamp: 0, winLit: 0,
  skyTop: [90, 150, 220], skyBot: [190, 210, 235], fogC: [190, 205, 220],
};
{ const T = WX[env.wx]; env.cloud = T.cloud; env.rain = T.rain; env.fog = T.fog; env.wet = T.rain > 0 ? 1 : 0; }
let wxTimer = G.r(240, 520);
function updateEnv(dt) {
  env.hour = (env.hour + dt * CLOCK / 3600) % 24;
  const T = WX[env.wx];
  const k = 1 - Math.exp(-dt * 0.06);
  env.cloud += (T.cloud - env.cloud) * k;
  env.rain += (T.rain - env.rain) * k * 1.5;
  env.fog += (T.fog - env.fog) * k;
  env.wet += ((env.rain > .1 ? 1 : 0) - env.wet) * dt * (env.rain > .1 ? .15 : .006);
  wxTimer -= dt;
  if (wxTimer <= 0 && !QP.has('w')) { wxTimer = G.r(260, 620); env.wx = G.p(WX_NEXT[env.wx]); }
  const elev = Math.sin(Math.PI * (env.hour - 6.7) / 11.6);
  const day = sstep(-0.10, 0.25, elev);
  env.day = day; env.night = 1 - day;
  env.twi = Math.max(0, 1 - Math.abs(elev - 0.03) / 0.22) * (1 - env.cloud * .55);
  env.amb = (0.2 + 0.8 * day * (1 - 0.42 * env.cloud - 0.15 * env.rain));
  const dayTint = mixc([1, 1, 1], [1.1, .93, .78], env.twi * .8);
  env.tint = mixc([.72, .82, 1.15], dayTint, day);
  env.lamp = 1 - sstep(0.25, 0.75, day * (1 - env.cloud * .25));
  env.winLit = clamp(1 - day * 1.05 + env.cloud * .25 * day, 0, 1);
  const dayTop = mixc([62, 128, 214], [138, 148, 160], env.cloud);
  const dayBot = mixc([168, 205, 238], [192, 196, 200], env.cloud);
  let top = mixc([8, 11, 26], dayTop, day);
  let bot = mixc([34, 34, 56], dayBot, day);
  bot = mixc(bot, [238, 140, 88], env.twi * .7);
  top = mixc(top, [92, 88, 128], env.twi * .35);
  env.skyTop = top; env.skyBot = bot;
  const fogness = clamp((env.fog - .006) / .014, 0, 1);
  env.fogC = mixc(mulc(bot, .96), mulc([205, 206, 208], .35 + .65 * env.amb), fogness);
}
function shade(c, z, k, add) {
  const a = env.amb * (k === undefined ? 1 : k), t = env.tint;
  let r = c[0] * a * t[0], g = c[1] * a * t[1], b = c[2] * a * t[2];
  if (add) { r += add[0]; g += add[1]; b += add[2]; }
  const f = 1 - Math.exp(-z * env.fog), fc = env.fogC;
  r += (fc[0] - r) * f; g += (fc[1] - g) * f; b += (fc[2] - b) * f;
  return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
}
const fogAmt = z => 1 - Math.exp(-z * env.fog);
function clockStr() {
  const h = Math.floor(env.hour), m = Math.floor((env.hour - h) * 60);
  return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m;
}

// ---------- data ----------
const PAL = {
  brick: [[142, 74, 58], [160, 88, 64], [120, 60, 50], [172, 108, 80], [104, 58, 50], [150, 82, 70]],
  stock: [[176, 150, 105], [190, 165, 120], [165, 140, 100], [182, 158, 118]],
  stucco: [[232, 226, 210], [240, 234, 220], [225, 220, 205], [214, 224, 234], [236, 220, 214]],
  painted: [[120, 150, 170], [170, 120, 120], [190, 180, 120], [130, 160, 130], [200, 150, 90], [150, 120, 160]],
  concrete: [[150, 148, 140], [130, 128, 122], [160, 156, 148], [118, 120, 124]],
  modern: [[90, 96, 104], [120, 124, 130], [70, 80, 96], [150, 152, 154]],
  glass: [[72, 112, 152], [88, 128, 160], [60, 96, 130]],
  warehouse: [[110, 70, 58], [96, 84, 76], [128, 92, 70]],
};
const FASCIA = [[30, 30, 34], [22, 60, 44], [120, 24, 32], [30, 44, 90], [200, 160, 40], [60, 30, 70], [230, 230, 224], [20, 90, 100], [180, 70, 30]];
const SHOPS = ['CAFÉ', 'PHARMACY', 'NEWS', 'NAILS', 'BARBER', 'MINI MARKET', 'LAUNDRETTE', 'PHONE REPAIR', 'BOOKS', 'PUB', 'WINE', 'DELI', 'BAKERY', 'FLORIST', 'OPTICIAN', 'TAILOR', 'VINTAGE', 'COFFEE', 'VAPE', 'DENTIST', 'GYM', 'OFF LICENCE', 'CHEMIST', 'SUPERMARKET'];

const DISTRICTS = {
  soho: { name: 'Soho', kind: 'shops', pal: ['brick', 'stock', 'painted'], floors: [4, 6], shop: .92, setback: [0, 0], lot: [6, 11], halfW: 3.7, pav: 2.4, traffic: .95, ped: 1.2, cruise: 7.5, signal: .5, tree: .04, parked: .35, curvy: .5, dest: ['flat', 'flat', 'direct'],
    streets: ['Dean Street', 'Greek Street', 'Frith Street', 'Old Compton Street', 'Wardour Street', 'Berwick Street', 'Brewer Street', 'Poland Street'] },
  shoreditch: { name: 'Shoreditch', kind: 'mixed', pal: ['brick', 'warehouse', 'painted'], floors: [3, 6], shop: .55, setback: [0, 0], lot: [8, 16], halfW: 4.2, pav: 2.6, traffic: .75, ped: .9, cruise: 8.5, signal: .4, tree: .05, parked: .5, curvy: 1, dest: ['flat', 'flat', 'direct'],
    streets: ['Redchurch Street', 'Brick Lane', 'Curtain Road', 'Rivington Street', 'Great Eastern Street', 'Club Row', 'Bethnal Green Road', 'Sclater Street'] },
  camden: { name: 'Camden', kind: 'mixed', pal: ['painted', 'brick', 'stock'], floors: [3, 5], shop: .7, setback: [0, 1], lot: [6, 12], halfW: 4.4, pav: 2.8, traffic: .85, ped: 1.3, cruise: 8, signal: .5, tree: .08, parked: .45, curvy: 1, dest: ['flat', 'house', 'direct'],
    streets: ['Camden High Street', 'Parkway', 'Arlington Road', 'Bayham Street', 'Chalk Farm Road', 'Inverness Street', 'Delancey Street', 'Kentish Town Road'] },
  kensington: { name: 'Kensington', kind: 'terrace', pal: ['stucco', 'stucco', 'stock'], floors: [4, 5], shop: .08, setback: [2.5, 4.5], lot: [7, 10], halfW: 4.8, pav: 3, traffic: .5, ped: .55, cruise: 9.5, signal: .3, tree: .38, parked: .8, curvy: 1.3, dest: ['house', 'house', 'flat'],
    streets: ['Gloucester Road', 'Cromwell Road', 'Kynance Place', 'Stanhope Gardens', 'Launceston Place', 'Ennismore Gardens', 'Harrington Road', 'Queen\'s Gate'] },
  islington: { name: 'Islington', kind: 'terrace', pal: ['stock', 'brick', 'stucco', 'painted'], floors: [3, 4], shop: .16, setback: [1.2, 3.5], lot: [5.5, 8], halfW: 4.2, pav: 2.7, traffic: .6, ped: .7, cruise: 9, signal: .3, tree: .3, parked: .8, curvy: 1.2, dest: ['house', 'house', 'direct', 'flat'],
    streets: ['Upper Street', 'Cross Street', 'Almeida Street', 'Canonbury Road', 'Liverpool Road', 'Barnsbury Street', 'Noel Road', 'Duncan Terrace'] },
  brixton: { name: 'Brixton', kind: 'mixed', pal: ['brick', 'painted', 'concrete'], floors: [3, 5], shop: .6, setback: [0, 2], lot: [7, 13], halfW: 4.6, pav: 2.8, traffic: .85, ped: 1.1, cruise: 8.5, signal: .45, tree: .1, parked: .55, curvy: 1, dest: ['flat', 'estate', 'house'],
    streets: ['Brixton Road', 'Coldharbour Lane', 'Atlantic Road', 'Electric Avenue', 'Acre Lane', 'Railton Road', 'Effra Road'] },
  canary: { name: 'Canary Wharf', kind: 'towers', pal: ['glass', 'modern'], floors: [10, 24], shop: .1, setback: [3, 6], lot: [16, 26], halfW: 5.6, pav: 3.6, traffic: .45, ped: .6, cruise: 11, signal: .45, tree: .3, parked: .05, curvy: .6, dest: ['tower', 'tower', 'flat'],
    streets: ['Westferry Circus', 'Marsh Wall', 'Bank Street', 'Cabot Square', 'Churchill Place', 'Heron Quays', 'Preston\'s Road'] },
  peckham: { name: 'Peckham', kind: 'mixed', pal: ['brick', 'stock', 'concrete', 'painted'], floors: [2, 4], shop: .65, setback: [0, 2], lot: [6, 11], halfW: 4.2, pav: 2.6, traffic: .7, ped: 1, cruise: 8.5, signal: .35, tree: .08, parked: .55, curvy: 1.2, dest: ['flat', 'estate', 'house', 'direct'],
    streets: ['Rye Lane', 'Peckham High Street', 'Bellenden Road', 'Choumert Road', 'Consort Road', 'Queen\'s Road', 'Copeland Road'] },
  hackney: { name: 'Hackney', kind: 'estate', pal: ['concrete', 'brick', 'modern'], floors: [4, 7], shop: .15, setback: [3, 7], lot: [16, 30], halfW: 4.4, pav: 2.8, traffic: .55, ped: .6, cruise: 9, signal: .3, tree: .3, parked: .6, curvy: 1.4, dest: ['estate', 'estate', 'flat', 'house'],
    streets: ['Mare Street', 'Broadway Market', 'Lauriston Road', 'Well Street', 'Homerton High Street', 'Graham Road', 'Amhurst Road', 'Dalston Lane'] },
};
const NEIGH = {
  soho: ['shoreditch', 'islington', 'kensington', 'camden'], shoreditch: ['hackney', 'islington', 'soho', 'canary'],
  camden: ['islington', 'soho', 'kensington'], kensington: ['soho', 'camden', 'brixton'], islington: ['camden', 'shoreditch', 'soho', 'hackney'],
  brixton: ['peckham', 'kensington'], canary: ['shoreditch', 'hackney', 'peckham'], peckham: ['brixton', 'canary'], hackney: ['shoreditch', 'islington', 'canary'],
};

const CUISINES = [
  { k: 'Chinese', names: ['Golden Dragon', 'Lucky Palace', 'Wok & Roll', 'Jade Garden', 'Mr Chan\'s'], suffix: ['Takeaway', 'Kitchen', 'Noodle Bar'], items: ['egg fried rice', 'sweet and sour chicken', 'chow mein', 'crispy duck', 'salt and pepper squid'], col: [176, 30, 34], wall: [168, 52, 44] },
  { k: 'Indian', names: ['Bombay', 'Spice Route', 'Tandoori Nights', 'Taj', 'Saffron'], suffix: ['Kitchen', 'Curry House', 'Tandoor'], items: ['chicken tikka masala', 'garlic naan', 'lamb rogan josh', 'pilau rice', 'onion bhajis'], col: [196, 110, 24], wall: [188, 118, 52] },
  { k: 'Burgers', names: ['Big Stack', 'Patty Lab', 'Smash', 'Bun Theory', 'Grill Society'], suffix: ['Burgers', 'Burger Co.', 'Joint'], items: ['double cheeseburger', 'fries', 'chocolate shake', 'chicken burger', 'onion rings'], col: [220, 170, 30], wall: [196, 64, 40] },
  { k: 'Chicken', names: ['Piri Piri', 'Crispy', 'Clucking', 'Cluck & Co', 'Sunday Roost'], suffix: ['Chicken', 'Chicken Shack'], items: ['peri-peri chicken', 'spicy rice', 'corn on the cob', 'coleslaw', 'wings'], col: [200, 50, 30], wall: [214, 196, 160] },
  { k: 'Pizza', names: ['Napoli', 'Slice', 'Dough Bros', 'Little Italy'], suffix: ['Pizza', 'Pizzeria'], items: ['margherita', 'pepperoni pizza', 'garlic dough balls', 'tiramisu'], col: [34, 110, 60], wall: [204, 180, 140] },
  { k: 'Kebab', names: ['Istanbul', 'Ali Baba', 'Anatolia', 'Zaytoun'], suffix: ['Kebab House', 'Grill'], items: ['doner kebab', 'chicken shish', 'falafel wrap', 'cheesy chips'], col: [30, 90, 60], wall: [190, 170, 130] },
  { k: 'Thai', names: ['Bangkok', 'Lemongrass', 'Siam', 'Basil'], suffix: ['Thai Kitchen', 'Thai'], items: ['pad thai', 'green curry', 'tom yum soup', 'sticky rice'], col: [24, 80, 90], wall: [176, 150, 100] },
  { k: 'Sushi', names: ['Sakura', 'Tokyo', 'Kaizen', 'Nori'], suffix: ['Sushi', 'Sushi Bar'], items: ['salmon nigiri', 'dragon roll', 'miso soup', 'edamame'], col: [24, 24, 30], wall: [64, 60, 60] },
  { k: 'Fish & Chips', names: ['Golden Fry', 'The Codfather', 'Codswallop'], suffix: ['Fish & Chips', 'Chippy'], items: ['cod and chips', 'mushy peas', 'battered sausage'], col: [30, 50, 100], wall: [200, 200, 190] },
  { k: 'Café', names: ['The Daily', 'Bean There', 'Flat White', 'Lark'], suffix: ['Café', 'Coffee'], items: ['breakfast bap', 'flat white', 'avocado toast', 'brownie'], col: [70, 44, 30], wall: [150, 120, 90] },
];
const FIRST = ['Sam', 'Priya', 'Ahmed', 'Chloe', 'Marcus', 'Ella', 'Tom', 'Fatima', 'Josh', 'Aisha', 'Ben', 'Lucy', 'Dan', 'Nadia', 'Olu', 'Hannah', 'Kwame', 'Grace', 'Ryan', 'Mei', 'Jack', 'Sofia', 'Liam', 'Zainab'];
const BLDG = ['Ashby Court', 'Kingsley House', 'Marlow Apartments', 'Hartley Mansions', 'Oakwood Point', 'Linden Court', 'Cedar House', 'Wharf View', 'Fairfax Court', 'Elm Lodge'];
const SKIN = [[236, 200, 170], [214, 170, 132], [176, 126, 92], [128, 88, 62], [96, 64, 46]];
const HAIR = [[30, 24, 20], [60, 40, 28], [120, 84, 50], [200, 170, 110], [150, 60, 40], [180, 180, 180], [20, 20, 24]];
const CLOTHES = [[40, 60, 96], [150, 40, 50], [50, 90, 70], [200, 190, 170], [70, 70, 76], [190, 120, 40], [110, 60, 120], [30, 30, 34], [220, 220, 224], [60, 120, 150]];
const CAR_COLS = [[24, 24, 28], [190, 190, 194], [120, 124, 130], [140, 30, 34], [30, 50, 90], [220, 220, 224], [60, 70, 62], [90, 90, 96], [200, 170, 40]];
