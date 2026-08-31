// /api/video — trova su YouTube un tutorial DAVVERO pertinente all'attivita'.
//
// Differenze rispetto al gemello di meal-prep: qui il pubblico sono bambini,
// quindi oltre alla pertinenza contano due cose in piu'.
//   1. La sicurezza: i canali "craft" da milioni di view (5-Minute Crafts,
//      Troom Troom, 123 GO) sono noti per tutorial finti, non riproducibili o
//      con passaggi pericolosi. Sono penalizzati fino a farli sparire.
//   2. Il fatto che un tutorial di bricolage si capisce anche senza parlato.
//      Se nessun video italiano supera la soglia, facciamo un secondo giro
//      accettando video muti / stranieri e li marchiamo noSpeech: l'utente
//      vede l'etichetta "senza parlato" e sa che deve guardare le immagini.
//
// Costo quota: 100 unita' per search.list + 1 per videos.list. Con la quota
// gratuita (10.000/giorno) sono circa 100 ricerche al giorno, condivise con
// meal-prep se usi la stessa chiave. La cache in memoria taglia le ripetute
// finche' l'istanza Vercel resta calda.

const YT_SEARCH = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS = "https://www.googleapis.com/youtube/v3/videos";

const CACHE = new Map();
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const CACHE_MAX = 400;

// ── NORMALIZZAZIONE ─────────────────────────────────────────────────────────
function norm(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Parole che non aiutano a capire di che progetto si tratta.
const STOPWORDS = new Set([
  "di","del","della","dello","dei","degli","delle","da","dal","dalla","con","e",
  "ed","il","lo","la","i","gli","le","un","uno","una","al","allo","alla","ai",
  "agli","alle","in","nel","nella","su","per","a","the","and","of","with","for",
  "come","fare","costruire","costruzione","creare","realizzare","tutorial","video",
  "lavoretto","lavoretti","facile","semplice","veloce","fai","te","diy","bambini",
  "bambino","bambina","casa","riciclo","riciclato","riciclata","creativo","creativa",
  "materiale","materiali","recupero","idea","idee","progetto","gioco","giocattolo",
  "divertente","bello","bella","originale","fatto","mano","passo"
]);

function contentTokens(s) {
  return norm(s).split(" ").filter(t => t.length > 2 && !STOPWORDS.has(t));
}

// Match tollerante sulle desinenze ("cartoni" aggancia "cartone") ma non fra
// parole di lunghezza troppo diversa: "carta" NON deve agganciare "cartone".
function tokenMatches(token, haystackTokens) {
  const stem = w => w.slice(0, Math.max(4, w.length - 2));
  const st = stem(token);
  return haystackTokens.some(h => {
    if (h === token) return true;
    if (Math.abs(h.length - token.length) > 2) return false;
    return h.startsWith(st) || token.startsWith(stem(h));
  });
}

// ── MATERIALI ───────────────────────────────────────────────────────────────
// Materiali generici: quasi ogni lavoretto li usa, da soli non identificano
// niente. Se il video usa colla e il progetto anche, non ho imparato nulla.
const BASE_MATERIALS = new Set([
  "colla","forbici","nastro","scotch","pennarelli","tempere","colori","pittura",
  "carta","cartoncino","matita","righello","graffette","glue","scissors","tape",
  "paint","paper","marker","pencil","ruler"
]);

// Materiali caratterizzanti, raggruppati per significato. Le varianti (singolare,
// plurale, sinonimi, inglese) puntano tutte allo stesso id: cosi' "bottle caps"
// e "tappi di bottiglia" risultano lo stesso materiale, e il confronto fra
// progetto e video non dipende dalla lingua ne' dalla desinenza.
const MATERIAL_GROUPS = {
  cartone:     ["cartone","cartoni","scatola","scatole","scatolone","cardboard","carton","box","boxes"],
  rotoli:      ["rotolo","rotoli","tubo","tubi","tube","tubes","roll","rolls"],
  bottiglie:   ["bottiglia","bottiglie","bottle","bottles","brik","tetrapak"],
  tappi:       ["tappo","tappi","coperchio","coperchi","cap","caps","lid","lids"],
  barattoli:   ["barattolo","barattoli","lattina","lattine","vasetto","vasetti","can","cans","jar","jars","tin"],
  stecchini:   ["stecchino","stecchini","stecco","stecchi","abbassalingua","popsicle","stick","sticks","spiedini","skewer"],
  mollette:    ["molletta","mollette","clothespin","clothespins","peg","pegs"],
  cannucce:    ["cannuccia","cannucce","straw","straws"],
  elastici:    ["elastico","elastici","palloncino","palloncini","rubber","band","bands","balloon","balloons"],
  stoffa:      ["stoffa","feltro","calzino","calzini","bottoni","perline","fabric","felt","sock","socks","cloth","buttons"],
  legno:       ["legno","legnetti","legnetto","rametti","rametto","compensato","wood","wooden","twig","twigs","plywood"],
  spago:       ["spago","lana","corda","cordino","string","yarn","wool","rope","twine"],
  bicchieri:   ["bicchiere","bicchieri","piatto","piatti","cup","cups","plate","plates"],
  giornali:    ["giornale","giornali","rivista","riviste","newspaper","magazine","magazines"],
  cd:          ["cd","dvd","disco","dischi"],
  natura:      ["sasso","sassi","pigna","pigne","conchiglia","conchiglie","foglie","stone","stones","pinecone","pinecones","shell","shells","leaves"],
  siringhe:    ["siringa","siringhe","syringe","syringes"],
  polistirolo: ["polistirolo","styrofoam"],
  argilla:     ["argilla","das","gesso","clay","plaster"],
  elettrico:   ["led","pila","pile","batteria","batterie","motorino","motore","circuito","battery","batteries","motor","circuit"],
  magneti:     ["calamita","calamite","magnete","magneti","magnet","magnets"],
  spugna:      ["spugna","spugne","sponge","sponges"],
  sughero:     ["sughero","cork","corks"],
  uova:        ["ovetti","portauova","uova","egg","eggs"]
};

// variante -> id di gruppo
const MATERIAL_INDEX = {};
for (const [group, words] of Object.entries(MATERIAL_GROUPS)) {
  for (const w of words) MATERIAL_INDEX[w] = group;
}

// Quali gruppi di materiale compaiono in una lista di parole. Il confronto e'
// esatto sulle varianti: e' quello che impedisce a "carta" di agganciare
// "cartone", errore che rendeva pertinente qualunque lavoretto.
function groupsIn(tokens) {
  const out = new Set();
  for (const t of tokens) {
    if (BASE_MATERIALS.has(t)) continue;
    const g = MATERIAL_INDEX[t];
    if (g) out.add(g);
  }
  return out;
}

function materialsOf(activity) {
  const hay = norm(activity.name) + " " +
    (activity.materials || []).map(m => norm(typeof m === "string" ? m : m.name)).join(" ");
  return groupsIn(hay.split(" "));
}

// ── CANALI ──────────────────────────────────────────────────────────────────
// Parole nel nome del canale che indicano un canale di lavoretti/bricolage.
// Preferisco i marcatori ai nomi propri: la lista di nomi invecchia male,
// i marcatori no.
const CHANNEL_MARKERS = [
  "lavoretti","creativ","riciclo","fai da te","faidate","bricolage","craft",
  "bambini","kids","maestra","scuola","laboratorio","manine","hobby","cartonlab",
  "handmade","tutorial","costruzioni","makers","maker","officina"
];

// Canali e format da evitare: tutorial spettacolarizzati, spesso non
// riproducibili, a volte con passaggi pericolosi per un bambino.
// Questa e' la penalita' piu' pesante di tutto il punteggio, di proposito.
const BLOCKED_CHANNELS = [
  "5 minute crafts","5-minute crafts","5 minuti","troom troom","123 go","123go",
  "wow crafts","slick slime sam","la la life","crafty panda","t studio",
  "so yummy","blossom","gotcha","mr degree","tricky ways"
];

const CLICKBAIT_TITLE = /\b(incredibile|assurdo|non crederai|shock|hack|life hack|trucchi geniali|geniale|magia|esperimento pazzesco)\b/;

// Marcatori che indicano che il titolo e' in italiano.
const IT_MARKERS = [
  "come","fare","costruire","con","alla","al","di","della","del","fai","te",
  "lavoretto","lavoretti","riciclo","cartone","bambini","facile","semplice",
  "casa","tutorial","passo","idee","gioco","giocattolo","creare","realizzare"
];

function isItalianTitle(title) {
  const t = norm(title).split(" ");
  return IT_MARKERS.some(m => t.includes(m));
}

function parseDuration(iso) {
  const m = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
  if (!m) return 0;
  return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0);
}

// ── PUNTEGGIO DI PERTINENZA ─────────────────────────────────────────────────
// allowForeign: secondo giro, quando in italiano non e' uscito niente. Un
// tutorial di bricolage muto resta utilissimo, quindi la lingua pesa meno.
function scoreVideo(activity, video, actMat, allowForeign) {
  const titleTokens = norm(video.title).split(" ");
  const channel = norm(video.channel);
  const titleN = norm(video.title);

  // 0. Canali da evitare: fuori subito, non c'e' punteggio che li recuperi.
  if (BLOCKED_CHANNELS.some(c => channel.includes(c))) return { score: -999 };

  // 1. Quanta parte del nome del progetto compare nel titolo.
  //    Nel giro sui video stranieri il confronto va fatto con la query
  //    inglese: misurare un titolo in inglese contro un nome italiano da'
  //    sempre zero, ed e' il motivo per cui i tutorial muti sparivano.
  const coverageOf = (text) => {
    const toks = contentTokens(text);
    if (!toks.length) return 0;
    return toks.filter(t => tokenMatches(t, titleTokens)).length / toks.length;
  };
  let coverage = coverageOf(activity.name);
  if (allowForeign && activity.videoQueryEn) {
    coverage = Math.max(coverage, coverageOf(activity.videoQueryEn));
  }
  if (coverage < 0.3) return { score: 0, coverage };

  let score = coverage * 50;

  // 2. Materiali caratterizzanti. E' qui che si distingue "razzo di cartone"
  //    da "razzo di bottiglia": stesso nome, progetto completamente diverso.
  const videoMat = groupsIn(titleTokens);
  const shared = [...videoMat].filter(m => actMat.has(m));
  const conflicting = [...videoMat].filter(m => !actMat.has(m));

  if (shared.length > 0) score += 20 + Math.min(2, shared.length - 1) * 5;
  else if (actMat.size > 0 && coverage < 0.8) score -= 28;

  // Un materiale diverso significa un altro progetto, non una variante:
  // il bambino guarderebbe costruire una cosa e ne avrebbe un'altra in mano.
  if (conflicting.length > 0) score -= 40 + Math.min(2, conflicting.length - 1) * 12;

  // 3. E' un tutorial di costruzione, non una vetrina di idee.
  if (/\b(come fare|come costruire|come realizzare|tutorial|passo passo|fai da te|faidate|diy|how to make|how to build)\b/.test(titleN)) score += 10;
  // "20 idee per..." e' una carrellata: si guarda, non si segue. Vale meno
  // di niente, perche' occupa il posto del tutorial vero.
  if (/\b(\d{2,}|dieci|venti|cinque|quindici)\s+(idee|lavoretti|modi|progetti|giochi|ideas|crafts|diy)\b/.test(titleN)) score -= 45;
  if (CLICKBAIT_TITLE.test(titleN)) score -= 25;

  // 4. Segnali di materiale di recupero: e' il cuore dell'app.
  if (/\b(riciclo|riciclato|riciclata|recupero|riutilizzare|riutilizzo|recycled|recycling)\b/.test(titleN)) score += 8;

  // 5. Canale che fa lavoretti di mestiere.
  if (CHANNEL_MARKERS.some(c => channel.includes(c))) score += 12;

  // 6. Lingua.
  const lang = (video.lang || "").toLowerCase();
  if (lang.startsWith("it")) score += 14;
  else if (lang && !lang.startsWith("it")) score += allowForeign ? -6 : -30;
  else if (isItalianTitle(video.title)) score += 8;
  else score += allowForeign ? -2 : -15;

  // 7. Durata. Sotto i 70 secondi il video viene scartato prima di arrivare
  //    qui (vedi runPass): e' uno Short, non spiega nessun montaggio.
  const d = video.durationSec;
  if (d >= 70 && d < 120) score -= 12;
  else if (d >= 120 && d <= 1200) score += 8;
  else if (d > 1800) score -= 10;

  return { score: Math.round(score), coverage };
}

// ── QUERY ───────────────────────────────────────────────────────────────────
function buildQueries(activity, effort) {
  const cleanName = contentTokens(activity.name).join(" ");
  const queries = [];
  if (activity.videoQuery) queries.push(String(activity.videoQuery).slice(0, 90));
  if (cleanName) queries.push(cleanName + " fai da te tutorial");
  if (effort >= 2 && cleanName) {
    queries.push("come costruire " + cleanName + " bambini riciclo");
  }
  return [...new Set(queries.filter(Boolean))];
}

// Query del secondo giro: nessun vincolo di lingua, si punta al tutorial
// visivo. In inglese si trova molto di piu' sul bricolage con il cartone.
function buildForeignQueries(activity) {
  const cleanName = contentTokens(activity.name).join(" ");
  const out = [];
  if (activity.videoQueryEn) out.push(String(activity.videoQueryEn).slice(0, 90));
  else if (cleanName) out.push(cleanName + " cardboard diy craft kids");
  return out.filter(Boolean);
}

// ── CHIAMATE YOUTUBE ────────────────────────────────────────────────────────
async function ytSearch(key, query, italian) {
  const langPart = italian ? "&relevanceLanguage=it&regionCode=IT" : "";
  const url = `${YT_SEARCH}?part=snippet&type=video&videoEmbeddable=true&maxResults=20` +
    `${langPart}&safeSearch=strict&q=${encodeURIComponent(query)}&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    const err = new Error(`youtube search ${r.status}`);
    err.detail = body.slice(0, 300);
    err.status = r.status;
    throw err;
  }
  const data = await r.json();
  return (data.items || []).map(it => ({
    id: it.id?.videoId,
    title: it.snippet?.title || "",
    channel: it.snippet?.channelTitle || "",
    thumb: it.snippet?.thumbnails?.medium?.url || it.snippet?.thumbnails?.default?.url || "",
    thumbHi: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.medium?.url || ""
  })).filter(v => v.id);
}

async function ytDetails(key, ids) {
  if (ids.length === 0) return {};
  const url = `${YT_VIDEOS}?part=contentDetails,status,snippet&id=${ids.join(",")}&key=${key}`;
  const r = await fetch(url);
  if (!r.ok) return {};
  const data = await r.json();
  const out = {};
  for (const it of data.items || []) {
    out[it.id] = {
      durationSec: parseDuration(it.contentDetails?.duration),
      embeddable: it.status?.embeddable !== false,
      madeForKids: it.status?.madeForKids === true,
      lang: it.snippet?.defaultAudioLanguage || it.snippet?.defaultLanguage || "",
      live: it.snippet?.liveBroadcastContent && it.snippet.liveBroadcastContent !== "none",
      thumbMax: it.snippet?.thumbnails?.maxres?.url ||
                it.snippet?.thumbnails?.standard?.url ||
                it.snippet?.thumbnails?.high?.url || ""
    };
  }
  return out;
}

// Soglia in italiano. Il secondo giro (video muti/stranieri) usa una soglia
// piu' bassa perche' la lingua li ha gia' penalizzati: e' un ripescaggio,
// non un abbassamento degli standard sulla pertinenza.
const MIN_SCORE = 48;
const MIN_SCORE_FOREIGN = 45;

function pack(best, noSpeech) {
  return {
    id: best.id,
    title: best.title,
    channel: best.channel,
    thumb: best.thumbMax || best.thumbHi || best.thumb,
    thumbSmall: best.thumb,
    durationSec: best.durationSec,
    score: best.score,
    noSpeech: !!noSpeech,
    url: "https://www.youtube.com/watch?v=" + best.id
  };
}

async function runPass(key, activity, actMat, queries, italian, allowForeign, minScore) {
  let best = null;
  let used = 0;
  for (const q of queries) {
    used++;
    let candidates;
    try {
      candidates = await ytSearch(key, q, italian);
    } catch (e) {
      if (e.status === 403) throw e; // quota finita o chiave non valida
      continue;
    }
    if (candidates.length === 0) continue;

    const details = await ytDetails(key, candidates.map(c => c.id).slice(0, 50));
    for (const c of candidates) {
      const d = details[c.id] || {};
      if (d.embeddable === false || d.live) continue;
      // Gli Short non insegnano a costruire niente: via prima del punteggio.
      if (d.durationSec > 0 && d.durationSec < 70) continue;
      const enriched = {
        ...c,
        durationSec: d.durationSec || 0,
        lang: d.lang || "",
        thumbMax: d.thumbMax || ""
      };
      let { score } = scoreVideo(activity, enriched, actMat, allowForeign);
      if (d.madeForKids) score += 5;
      if (!best || score > best.score) best = { ...enriched, score };
    }
    if (best && best.score >= 70) break;
    if (best && best.score >= minScore && used >= 2) break;
  }
  return best && best.score >= minScore ? best : null;
}

async function resolveActivity(key, activity, effort) {
  const cacheKey = norm(activity.name) + "|" + effort;
  const hit = CACHE.get(cacheKey);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;

  const actMat = materialsOf(activity);

  // Primo giro: italiano, standard pieni.
  let best = await runPass(key, activity, actMat, buildQueries(activity, effort), true, false, MIN_SCORE);
  let value = best ? pack(best, false) : null;

  // Secondo giro: solo se il primo non ha trovato niente e l'utente ha
  // chiesto di insistere. Un tutorial di bricolage si segue anche muto.
  if (!value && effort >= 2) {
    const fq = buildForeignQueries(activity);
    if (fq.length) {
      const alt = await runPass(key, activity, actMat, fq, false, true, MIN_SCORE_FOREIGN);
      if (alt) value = pack(alt, true);
    }
  }

  if (CACHE.size > CACHE_MAX) CACHE.clear();
  CACHE.set(cacheKey, { at: Date.now(), value });
  return value;
}

// ── HANDLER ─────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) {
    return res.status(200).json({ results: {}, warning: "missing_key" });
  }

  const activities = Array.isArray(req.body?.activities) ? req.body.activities.slice(0, 20) : [];
  const effort = Math.min(3, Math.max(1, Number(req.body?.effort) || 1));
  if (activities.length === 0) return res.status(200).json({ results: {} });

  const results = {};
  let quotaError = null;

  const CHUNK = 5;
  for (let i = 0; i < activities.length; i += CHUNK) {
    const chunk = activities.slice(i, i + CHUNK);
    const settled = await Promise.all(chunk.map(async a => {
      const k = a.key ?? a.name;
      try {
        return [k, await resolveActivity(key, a, effort)];
      } catch (e) {
        if (e.status === 403) quotaError = e.detail || "quota";
        return [k, null];
      }
    }));
    settled.forEach(([k, v]) => { results[k] = v; });
    if (quotaError) break;
  }

  return res.status(200).json(
    quotaError ? { results, warning: "quota", detail: quotaError } : { results }
  );
}
