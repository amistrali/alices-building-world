import { useState, useCallback, useEffect, useMemo } from "react";
import "./App.css";
import { initializeApp } from "firebase/app";
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";

// ── FIREBASE ───────────────────────────────────────────────────────────────
// Stesso progetto di meal-prep-app: stesso login, nessuna configurazione nuova.
// I dati pero' vivono in un documento diverso (data/building), quindi le due
// app non si vedono e non si sovrascrivono a vicenda.
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FB_API_KEY || "AIzaSyD9CxZxjoOJp89DJSdFF2H-73oeKtRqq7M",
  authDomain: process.env.REACT_APP_FB_AUTH_DOMAIN || "meal-prep-studio.firebaseapp.com",
  projectId: process.env.REACT_APP_FB_PROJECT_ID || "meal-prep-studio",
  storageBucket: "meal-prep-studio.firebasestorage.app",
  messagingSenderId: "439901909097",
  appId: process.env.REACT_APP_FB_APP_ID || "1:439901909097:web:dd624037ebeb164c05b2f8"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const googleProvider = new GoogleAuthProvider();

const DOC_ID = "building";
const LS_KEY = "abw-data";

// ── PALETTE ────────────────────────────────────────────────────────────────
const T = {
  bg: "#FFF9F0",
  card: "#FFFFFF",
  ink: "#4A3F35",
  inkSoft: "#7C6E60",
  inkFaint: "#A79684",
  line: "#EDE2D0",
  lineStrong: "#DCCDB6",
  accent: "#2E9C8E",
  accentSoft: "#E4F3F0",
  warm: "#F09A3C",
  warmSoft: "#FDEEDC",
  rose: "#CE5A6E",
  roseSoft: "#FBE7EA",
  violet: "#7C63B8"
};

const COLORS = ["#2E9C8E", "#F09A3C", "#CE5A6E", "#7C63B8", "#4A8FCE", "#8FA33C", "#D97757", "#3FA5B8"];

// ── TASSONOMIE ─────────────────────────────────────────────────────────────
// Sono liste chiuse: l'AI deve usare esattamente questi id. Cosi' i filtri
// funzionano davvero, invece di sperare che due stringhe libere coincidano.
const CATEGORIES = [
  { id: "veicoli", label: "Veicoli e mezzi", emoji: "🚗" },
  { id: "meccanismi", label: "Meccanismi e ingranaggi", emoji: "⚙️" },
  { id: "lancio", label: "Razzi, catapulte e lanci", emoji: "🚀" },
  { id: "giochi", label: "Giochi di abilità e da tavolo", emoji: "🎯" },
  { id: "costruzioni", label: "Costruzioni e architettura", emoji: "🏰" },
  { id: "animali", label: "Animali e creature", emoji: "🦖" },
  { id: "marionette", label: "Marionette e teatrino", emoji: "🎭" },
  { id: "musica", label: "Strumenti musicali", emoji: "🥁" },
  { id: "scienza", label: "Giocattoli scientifici", emoji: "🔬" },
  { id: "arredo", label: "Oggetti utili per la cameretta", emoji: "🗄️" }
];

const MATERIALS = [
  { id: "cartone", label: "Cartone e scatole", emoji: "📦" },
  { id: "rotoli", label: "Rotoli di carta", emoji: "🧻" },
  { id: "bottiglie", label: "Bottiglie di plastica", emoji: "🧴" },
  { id: "tappi", label: "Tappi e coperchi", emoji: "🔘" },
  { id: "barattoli", label: "Barattoli e lattine", emoji: "🥫" },
  { id: "stecchini", label: "Stecchi del gelato", emoji: "🍦" },
  { id: "mollette", label: "Mollette da bucato", emoji: "📌" },
  { id: "cannucce", label: "Cannucce", emoji: "🥤" },
  { id: "elastici", label: "Elastici e palloncini", emoji: "🎈" },
  { id: "stoffa", label: "Stoffa, feltro, calzini", emoji: "🧵" },
  { id: "legno", label: "Legnetti e rametti", emoji: "🪵" },
  { id: "spago", label: "Spago e lana", emoji: "🧶" },
  { id: "bicchieri", label: "Piatti e bicchieri di carta", emoji: "🥛" },
  { id: "giornali", label: "Giornali e riviste", emoji: "📰" },
  { id: "cd", label: "CD e vecchi dischi", emoji: "💿" },
  { id: "natura", label: "Sassi, pigne, conchiglie", emoji: "🌰" }
];

const SKILLS = [
  { id: "taglio", label: "Taglio", emoji: "✂️" },
  { id: "incollaggio", label: "Incollaggio", emoji: "🩹" },
  { id: "misura", label: "Misura e precisione", emoji: "📏" },
  { id: "pittura", label: "Pittura e decoro", emoji: "🎨" },
  { id: "cucito", label: "Cucito", emoji: "🪡" },
  { id: "nodi", label: "Nodi e legature", emoji: "🪢" },
  { id: "assemblaggio", label: "Assemblaggio", emoji: "🔧" },
  { id: "elettricita", label: "Elettricità semplice", emoji: "💡" }
];

const DIFFICULTIES = [
  { id: "facile", label: "Facile", emoji: "🟢" },
  { id: "media", label: "Media", emoji: "🟡" },
  { id: "impegnativa", label: "Impegnativa", emoji: "🔴" }
];

const TIME_BUCKETS = [
  { id: "breve", label: "< 30 min", min: 0, max: 29 },
  { id: "medio", label: "30–60 min", min: 30, max: 60 },
  { id: "lungo", label: "1–2 ore", min: 61, max: 120 },
  { id: "maxi", label: "oltre 2 ore", min: 121, max: 100000 }
];

const AGE_BANDS = [
  { id: "6-8", label: "6–8 anni", min: 6, max: 8 },
  { id: "9-12", label: "9–12 anni", min: 9, max: 12 }
];

const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));
const MAT_BY_ID = Object.fromEntries(MATERIALS.map(m => [m.id, m]));
const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

function timeBucketOf(min) {
  const n = Number(min) || 0;
  return (TIME_BUCKETS.find(b => n >= b.min && n <= b.max) || TIME_BUCKETS[1]).id;
}

function slugify(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

function fmtDuration(sec) {
  if (!sec) return "";
  const m = Math.round(sec / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function fmtDate(ts) {
  try {
    return new Date(ts).toLocaleDateString("it-IT", { day: "numeric", month: "long", year: "numeric" });
  } catch { return ""; }
}

// ── PERSISTENZA ────────────────────────────────────────────────────────────
async function fbSave(uid, data) {
  if (!uid) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(data)); } catch {}
    return;
  }
  try {
    await setDoc(doc(db, "users", uid, "data", DOC_ID), data, { merge: true });
  } catch (e) {
    console.error("Firebase save error:", e);
  }
}

async function fbLoad(uid) {
  if (!uid) {
    try {
      const v = localStorage.getItem(LS_KEY);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  }
  try {
    const snap = await getDoc(doc(db, "users", uid, "data", DOC_ID));
    return snap.exists() ? snap.data() : null;
  } catch (e) {
    console.error("Firebase load error:", e);
    return null;
  }
}

// ── PROMPT ─────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Sei un educatore esperto di laboratori di manualità e costruzione per bambini dai 6 ai 12 anni.
Proponi attività in cui il bambino COSTRUISCE con le proprie mani un giocattolo o un oggetto che funziona, usando materiale di recupero che si trova già in casa.

REGOLE SUI NOMI (la più importante):
- Usa il nome con cui il progetto è REALMENTE conosciuto, come lo titolerebbe un canale italiano di lavoretti: "Macchinina a elastico con tappi di bottiglia", "Flipper di cartone", "Braccio idraulico con siringhe", "Catapulta con stecchi del gelato", "Chitarra con scatola di scarpe ed elastici", "Labirinto a biglie di cartone", "Caleidoscopio con rotolo di carta", "Telefono con bicchieri e spago", "Teatrino delle ombre", "Mangiatoia per uccellini con brik del latte", "Girandola di carta", "Barchetta a elastico", "Robot di scatole", "Bilboquet con bottiglia di plastica", "Pista per biglie con rotoli di carta".
- VIETATI i nomi inventati in stile marketing ("Super Mega Costruzione Creativa", "Laboratorio dell'Energia"): non corrispondono a nessun progetto esistente e rendono impossibile trovare un video tutorial.
- Il nome deve dire COSA si costruisce e CON COSA. "Macchinina fai da te" è troppo generico: scrivi "Macchinina a elastico con tappi di bottiglia".
- A parità di tutto, preferisci progetti classici e diffusi: sono quelli per cui esiste davvero un buon video in italiano.

REGOLE DI VARIETÀ (obbligatorie):
- Ogni attività deve appartenere a una CATEGORIA DIVERSA dalle altre della stessa risposta.
- Ogni attività deve avere un MATERIALE PRINCIPALE DIVERSO: non tre progetti di fila tutti di cartone.
- Varia il tipo di risultato: qualcosa che si muove, qualcosa con cui si gioca in due, qualcosa da appendere, qualcosa che fa rumore, qualcosa che serve davvero.

REGOLE DI SICUREZZA (obbligatorie):
- Niente coltelli affilati, pistole a colla a caldo usate da soli, taglierini, fornelli, sostanze chimiche, pile al litio a bottone, parti piccole ingeribili per i più piccoli.
- Quando un passaggio richiede un adulto (foratura, colla a caldo, taglio di plastica dura) dillo esplicitamente nel campo adultHelp e ripetilo dentro lo step interessato.

IL RISULTATO FINALE (campo cruciale):
- "result" deve far VEDERE con le parole com'è l'oggetto finito: forma, colori, dimensioni reali, di che materiale sembra fatto, cosa si nota per primo. Almeno 3 righe, scritte per un genitore che deve decidere se vale la pena iniziare.
- "plays" spiega come ci si gioca una volta finito, e perché è divertente.

IMPORTANTE: Rispondi ESCLUSIVAMENTE con un array JSON valido, nessun testo prima o dopo, nessun markdown.
Ogni elemento:
{"name":"string",
"emoji":"un solo emoji che rappresenta l'oggetto costruito",
"category":"uno tra: veicoli | meccanismi | lancio | giochi | costruzioni | animali | marionette | musica | scienza | arredo",
"ageMin":number, "ageMax":number,
"difficulty":"facile | media | impegnativa",
"timeMin":number (minuti realistici di lavoro effettivo),
"materialTags":["sottoinsieme di: cartone, rotoli, bottiglie, tappi, barattoli, stecchini, mollette, cannucce, elastici, stoffa, legno, spago, bicchieri, giornali, cd, natura"],
"skills":["sottoinsieme di: taglio, incollaggio, misura, pittura, cucito, nodi, assemblaggio, elettricita"],
"result":"descrizione dettagliata dell'oggetto finito: aspetto, dimensioni, colori, cosa colpisce",
"resultSize":"dimensione indicativa, es. 'circa 25 cm di lunghezza'",
"plays":"come ci si gioca e perché diverte",
"materials":[{"name":"string","qty":number,"unit":"string","recupero":true/false}],
"tools":["strumenti necessari, es. forbici, righello, pennarelli"],
"steps":[
  "passaggio autonomo e completo, con misure precise, tempi di asciugatura, come capire che è venuto bene, cosa fare se non funziona",
  "ogni step deve bastare da solo a un bambino che non ha mai costruito niente, con l'aiuto di un adulto per la lettura",
  "l'ultimo step spiega come decorare, come conservarlo e come ripararlo se si rompe"
],
"tips":"2-3 consigli pratici: varianti, sostituzioni di materiale, errori tipici da evitare",
"safety":"i punti di attenzione concreti di QUESTO progetto",
"adultHelp":"cosa deve fare un adulto, oppure 'Nessun passaggio richiede un adulto' se davvero non serve",
"variants":"come renderlo più semplice per un bambino di 6 anni e più difficile per uno di 12",
"videoQuery":"come cercheresti su YouTube il tutorial di QUESTO progetto in italiano, es: 'macchinina elastico tappi bottiglia fai da te'",
"videoQueryEn":"la stessa ricerca in inglese, es: 'rubber band car bottle caps cardboard diy'"}
Gli steps devono essere almeno 6 e massimo 10, ognuno di almeno 2 righe di testo dettagliato.`;

// Ogni attività costa circa 1100 token in uscita: il tetto deve seguire il
// numero di attività chieste, altrimenti la risposta si tronca a metà JSON.
function tokensFor(count) {
  return Math.min(16000, 1400 * count + 800);
}

async function callClaudeAPI(userMsg, maxTokens) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: maxTokens,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMsg }]
    })
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${errText.slice(0, 200)}`);
  }
  const data = await response.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  if (!text) throw new Error("Risposta vuota dal modello");

  let parsed = null;
  const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
  try { parsed = JSON.parse(cleaned); } catch {}
  if (!parsed) {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch {} }
  }
  if (!parsed || !Array.isArray(parsed)) {
    const objMatches = [...cleaned.matchAll(/\{[\s\S]*?"steps"[\s\S]*?\}\s*(?=,|\]|$)/g)];
    if (objMatches.length > 0) {
      try { parsed = objMatches.map(m => JSON.parse(m[0])); } catch {}
    }
  }
  if (!parsed || !Array.isArray(parsed) || parsed.length === 0) {
    console.error("Risposta API non parsabile:", text.slice(0, 500));
    throw new Error("Formato risposta non valido");
  }
  return parsed;
}

// Normalizza quello che torna dal modello: id stabile, tassonomie ripulite,
// campi mancanti riempiti. Meglio una scheda con qualche buco che un crash.
function normalizeActivity(raw, idx) {
  const name = String(raw?.name || "Progetto senza nome").trim();
  const cat = CAT_BY_ID[raw?.category] ? raw.category : "costruzioni";
  const materialTags = (Array.isArray(raw?.materialTags) ? raw.materialTags : [])
    .filter(m => MAT_BY_ID[m]);
  const skills = (Array.isArray(raw?.skills) ? raw.skills : []).filter(s => SKILL_BY_ID[s]);
  const timeMin = Math.max(5, Number(raw?.timeMin) || 45);
  const diff = DIFFICULTIES.some(d => d.id === raw?.difficulty) ? raw.difficulty : "media";
  return {
    id: slugify(name) || `att-${idx}`,
    name,
    emoji: String(raw?.emoji || "🛠️").slice(0, 4),
    color: COLORS[idx % COLORS.length],
    category: cat,
    ageMin: Math.max(4, Number(raw?.ageMin) || 6),
    ageMax: Math.min(14, Number(raw?.ageMax) || 12),
    difficulty: diff,
    timeMin,
    timeBucket: timeBucketOf(timeMin),
    materialTags,
    skills,
    result: String(raw?.result || ""),
    resultSize: String(raw?.resultSize || ""),
    plays: String(raw?.plays || ""),
    materials: Array.isArray(raw?.materials) ? raw.materials : [],
    tools: Array.isArray(raw?.tools) ? raw.tools : [],
    steps: Array.isArray(raw?.steps) ? raw.steps : [],
    tips: String(raw?.tips || ""),
    safety: String(raw?.safety || ""),
    adultHelp: String(raw?.adultHelp || ""),
    variants: String(raw?.variants || ""),
    videoQuery: String(raw?.videoQuery || ""),
    videoQueryEn: String(raw?.videoQueryEn || ""),
    video: null
  };
}

// ── VIDEO ──────────────────────────────────────────────────────────────────
async function resolveVideos(activities, effort) {
  if (!activities || activities.length === 0) return { list: activities, warning: null };
  try {
    const r = await fetch("/api/video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        effort,
        activities: activities.map((a, i) => ({
          key: String(i),
          name: a.name,
          materials: a.materials,
          videoQuery: a.videoQuery,
          videoQueryEn: a.videoQueryEn
        }))
      })
    });
    if (!r.ok) return { list: activities.map(a => ({ ...a, video: null })), warning: null };
    const data = await r.json();
    const res = data.results || {};
    return {
      list: activities.map((a, i) => ({ ...a, video: res[String(i)] || null })),
      warning: data.warning || null
    };
  } catch {
    return { list: activities.map(a => ({ ...a, video: null })), warning: null };
  }
}

// ── UI DI BASE ─────────────────────────────────────────────────────────────
function Chip({ active, onClick, children, tone }) {
  const c = tone === "warm" ? T.warm : tone === "rose" ? T.rose : T.accent;
  return (
    <button
      type="button"
      className="abw-chip"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 20,
        border: `1.5px solid ${active ? c : T.lineStrong}`,
        background: active ? c : "transparent",
        color: active ? "#fff" : T.inkSoft,
        fontSize: 12.5,
        fontWeight: active ? 600 : 500,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }}
    >
      {children}
    </button>
  );
}

function Pill({ children, bg, color, title }) {
  return (
    <span title={title} style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      padding: "3px 9px", borderRadius: 14, background: bg || T.accentSoft,
      color: color || T.accent, fontSize: 11.5, fontWeight: 600, whiteSpace: "nowrap"
    }}>{children}</span>
  );
}

function Heart({ liked, onClick, size = 22 }) {
  const [bump, setBump] = useState(false);
  return (
    <button
      type="button"
      aria-label={liked ? "Togli dai preferiti" : "Aggiungi ai preferiti"}
      className={bump ? "abw-heart-pop" : ""}
      onAnimationEnd={() => setBump(false)}
      onClick={(e) => { e.stopPropagation(); setBump(true); onClick(); }}
      style={{
        border: "none", background: "transparent", cursor: "pointer",
        fontSize: size, lineHeight: 1, padding: 2,
        filter: liked ? "none" : "grayscale(1) opacity(0.45)"
      }}
    >
      {liked ? "❤️" : "🤍"}
    </button>
  );
}

// Immagine del risultato: la miniatura del video trovato È la foto
// dell'oggetto finito. Quando il video manca, una card illustrata con
// l'emoji del progetto — meglio di una foto di repertorio che mostra
// tutt'altro.
function ResultImage({ activity, height = 168, rounded = "14px 14px 0 0" }) {
  const [failed, setFailed] = useState(false);
  const url = activity?.video?.thumb || activity?.video?.thumbSmall;
  const show = url && !failed;
  const c = activity?.color || T.accent;

  return (
    <div style={{
      position: "relative", height, borderRadius: rounded, overflow: "hidden",
      background: `linear-gradient(135deg, ${c}26, ${c}0D)`,
      display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      {show ? (
        <img
          src={url}
          alt={`Risultato finito: ${activity.name}`}
          onError={() => setFailed(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <>
          <div style={{ fontSize: height > 140 ? 54 : 34, opacity: 0.9 }}>{activity?.emoji || "🛠️"}</div>
          <div style={{
            position: "absolute", bottom: 8, right: 10, fontSize: 10,
            color: T.inkFaint, background: "#ffffffcc", padding: "2px 7px", borderRadius: 10
          }}>
            istruzioni illustrate
          </div>
        </>
      )}
      {show && activity.video?.noSpeech && (
        <div style={{
          position: "absolute", top: 8, left: 8, fontSize: 10, fontWeight: 600,
          color: "#fff", background: "#00000099", padding: "3px 8px", borderRadius: 10
        }}>
          🔇 senza parlato
        </div>
      )}
    </div>
  );
}

// ── LOGIN ──────────────────────────────────────────────────────────────────
function AuthScreen() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const translate = (code) => {
    const map = {
      "auth/invalid-email": "Indirizzo email non valido.",
      "auth/user-not-found": "Nessun account con questa email.",
      "auth/wrong-password": "Password errata.",
      "auth/invalid-credential": "Email o password non corrette.",
      "auth/email-already-in-use": "Esiste già un account con questa email.",
      "auth/weak-password": "La password deve avere almeno 6 caratteri.",
      "auth/popup-closed-by-user": "Finestra di accesso chiusa.",
      "auth/too-many-requests": "Troppi tentativi, riprova tra qualche minuto."
    };
    return map[code] || "Qualcosa non ha funzionato. Riprova.";
  };

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setMessage(""); setLoading(true);
    try {
      if (mode === "register") {
        if (password !== confirmPassword) {
          const mismatch = new Error("mismatch");
          mismatch.code = "abw/mismatch";
          throw mismatch;
        }
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      } else if (mode === "reset") {
        await sendPasswordResetEmail(auth, email.trim());
        setMessage("Ti abbiamo mandato una email per reimpostare la password.");
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(err?.code === "abw/mismatch" ? "Le due password non coincidono." : translate(err?.code));
    } finally { setLoading(false); }
  };

  const google = async () => {
    setError(""); setLoading(true);
    try { await signInWithPopup(auth, googleProvider); }
    catch (err) { setError(translate(err?.code)); }
    finally { setLoading(false); }
  };

  const input = {
    width: "100%", padding: "11px 13px", borderRadius: 10,
    border: `1.5px solid ${T.line}`, fontSize: 14, marginBottom: 10,
    background: "#fff", color: T.ink, outline: "none"
  };

  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20
    }}>
      <div className="abw-fade" style={{
        width: "100%", maxWidth: 400, background: T.card, borderRadius: 20,
        padding: "32px 28px", border: `1.5px solid ${T.line}`,
        boxShadow: "0 12px 40px rgba(74,63,53,0.09)"
      }}>
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 40, marginBottom: 6 }}>🧰</div>
          <h1 style={{ margin: 0, fontSize: 22, color: T.ink }}>Alice's Building World</h1>
          <p style={{ margin: "7px 0 0", fontSize: 13, color: T.inkSoft, lineHeight: 1.5 }}>
            Cose da costruire con le mani, con quello che c'è già in casa.
          </p>
        </div>

        <button
          type="button"
          onClick={google}
          disabled={loading}
          style={{
            width: "100%", padding: "11px", borderRadius: 10,
            border: `1.5px solid ${T.lineStrong}`, background: "#fff",
            fontSize: 14, fontWeight: 600, color: T.ink, cursor: "pointer", marginBottom: 16
          }}
        >
          Continua con Google
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: T.line }} />
          <span style={{ fontSize: 11, color: T.inkFaint }}>oppure</span>
          <div style={{ flex: 1, height: 1, background: T.line }} />
        </div>

        <form onSubmit={submit}>
          <input style={input} type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} required autoComplete="email" />
          {mode !== "reset" && (
            <input style={input} type="password" placeholder="Password" value={password}
              onChange={e => setPassword(e.target.value)} required
              autoComplete={mode === "register" ? "new-password" : "current-password"} />
          )}
          {mode === "register" && (
            <input style={input} type="password" placeholder="Conferma password" value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)} required autoComplete="new-password" />
          )}

          {error && <div style={{ background: T.roseSoft, color: T.rose, padding: "9px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
          {message && <div style={{ background: T.accentSoft, color: T.accent, padding: "9px 12px", borderRadius: 9, fontSize: 12.5, marginBottom: 10 }}>{message}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", padding: "12px", borderRadius: 10, border: "none",
            background: T.accent, color: "#fff", fontSize: 14.5, fontWeight: 700,
            cursor: loading ? "wait" : "pointer", opacity: loading ? 0.7 : 1
          }}>
            {loading ? "Un attimo…" : mode === "register" ? "Crea account" : mode === "reset" ? "Invia email" : "Entra"}
          </button>
        </form>

        <div style={{ marginTop: 16, textAlign: "center", fontSize: 12.5, color: T.inkSoft }}>
          {mode === "login" && (
            <>
              <button type="button" onClick={() => { setMode("register"); setError(""); }} style={linkBtn}>Crea un account</button>
              <span style={{ margin: "0 8px", color: T.line }}>·</span>
              <button type="button" onClick={() => { setMode("reset"); setError(""); }} style={linkBtn}>Password dimenticata</button>
            </>
          )}
          {mode !== "login" && (
            <button type="button" onClick={() => { setMode("login"); setError(""); setMessage(""); }} style={linkBtn}>
              Torna all'accesso
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const linkBtn = {
  background: "none", border: "none", color: T.accent,
  fontSize: 12.5, cursor: "pointer", padding: 0, textDecoration: "underline"
};

// ── APP ────────────────────────────────────────────────────────────────────
const LOADING_STEPS = [
  "Cerco progetti adatti…",
  "Controllo i materiali di recupero…",
  "Scrivo le istruzioni passo passo…",
  "Cerco i video tutorial in italiano…",
  "Metto tutto in ordine…"
];

// ── IMPORT DALLA VERSIONE PRO ──────────────────────────────────────────────
// La versione su claude.ai (generazione sul piano Pro) non puo' mostrare foto
// ne' video. Il suo pulsante "Apri con foto e video" apre questa app con le
// attivita' gia' pronte dentro il link: #import=<JSON compresso deflate-raw in
// base64url>. Il frammento dopo # non arriva al server, quindi niente limiti
// di lunghezza dell'URL lato Vercel. Qui non si rigenera niente: si cercano
// solo i video, con la stessa /api/video di sempre.
const IMPORT_PREFIX = "#import=";

async function decodeImport(str) {
  let b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const stream = new Blob([bytes]).stream().pipeThrough(new window.DecompressionStream("deflate-raw"));
  const text = await new Response(stream).text();
  const data = JSON.parse(text);
  const list = Array.isArray(data?.activities) ? data.activities.slice(0, 12) : [];
  if (!list.length) throw new Error("vuoto");
  return { at: Number(data.at) || Date.now(), activities: list.map(normalizeActivity) };
}

function ImportBanner({ state, onSave, canSave, saved }) {
  return (
    <div style={{
      background: T.accentSoft, border: "1.5px solid #CDE8E3", borderRadius: 14,
      padding: "13px 16px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap"
    }}>
      <div style={{ flex: "1 1 240px", fontSize: 13, color: "#2C544E", lineHeight: 1.55 }}>
        <strong>Arrivate dalla versione Pro.</strong>{" "}
        {state === "video"
          ? "Cerco foto e video tutorial…"
          : "Qui vedi le foto del risultato e il video dentro la scheda."}
      </div>
      {canSave && (
        <button type="button" onClick={onSave} disabled={saved} style={{
          padding: "8px 15px", borderRadius: 18, border: "none", background: T.accent,
          color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: saved ? "default" : "pointer", opacity: saved ? 0.7 : 1
        }}>{saved ? "✓ In archivio" : "📦 Salva in archivio"}</button>
      )}
    </div>
  );
}

export default function App() {
  const [imported, setImported] = useState(null); // { at, activities, state: "video" | "ok" | "error" }

  useEffect(() => {
    const h = window.location.hash || "";
    if (!h.startsWith(IMPORT_PREFIX)) return;
    let alive = true;
    (async () => {
      try {
        const data = await decodeImport(h.slice(IMPORT_PREFIX.length));
        if (!alive) return;
        setImported({ ...data, state: "video" });
        const { list } = await resolveVideos(data.activities, 2);
        if (alive) setImported({ ...data, activities: list, state: "ok" });
      } catch (e) {
        console.error("import non valido", e);
        if (alive) setImported({ at: Date.now(), activities: [], state: "error" });
      }
    })();
    return () => { alive = false; };
  }, []);

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [ready, setReady] = useState(false);

  const [current, setCurrent] = useState(null);   // ultima generazione
  const [archive, setArchive] = useState([]);     // generazioni salvate
  const [liked, setLiked] = useState({});         // id -> scheda completa

  const [view, setView] = useState("laboratorio");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [notification, setNotification] = useState("");
  const [apiError, setApiError] = useState("");
  const [showFilters, setShowFilters] = useState(true);

  // Filtri: guidano la generazione E filtrano quello che vedi a schermo.
  const [fAges, setFAges] = useState([]);
  const [fDiff, setFDiff] = useState([]);
  const [fTime, setFTime] = useState([]);
  const [fMat, setFMat] = useState([]);
  const [fCat, setFCat] = useState([]);
  const [fSkill, setFSkill] = useState([]);
  const [freeText, setFreeText] = useState("");
  const [count, setCount] = useState(6);
  const [videoEffort, setVideoEffort] = useState(2);

  const notify = useCallback((msg) => {
    setNotification(msg);
    setTimeout(() => setNotification(""), 2800);
  }, []);

  // ── caricamento ──────────────────────────────────────────────────────────
  useEffect(() => {
    let unsubDoc = null;
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      setAuthReady(true);
      if (unsubDoc) { unsubDoc(); unsubDoc = null; }

      if (fbUser) {
        const data = await fbLoad(fbUser.uid);
        if (data) {
          setCurrent(data.current || null);
          setArchive(data.archive || []);
          setLiked(data.liked || {});
        }
        unsubDoc = onSnapshot(doc(db, "users", fbUser.uid, "data", DOC_ID), (snap) => {
          if (!snap.exists()) return;
          const d = snap.data();
          setCurrent(d.current || null);
          setArchive(d.archive || []);
          setLiked(d.liked || {});
        }, (e) => console.error("snapshot error", e));
      } else {
        try {
          const raw = localStorage.getItem(LS_KEY);
          if (raw) {
            const d = JSON.parse(raw);
            setCurrent(d.current || null);
            setArchive(d.archive || []);
            setLiked(d.liked || {});
          }
        } catch {}
      }
      setReady(true);
    });
    return () => { if (unsubDoc) unsubDoc(); unsub(); };
  }, []);

  const persist = useCallback((c, a, l) => {
    const payload = { current: c, archive: a, liked: l, updatedAt: Date.now() };
    fbSave(user?.uid, payload);
  }, [user]);

  // ── generazione ──────────────────────────────────────────────────────────
  const buildUserMessage = useCallback(() => {
    const parts = [`Proponi ${count} attività di costruzione diverse fra loro.`];

    if (fAges.length) {
      const bands = AGE_BANDS.filter(b => fAges.includes(b.id));
      const lo = Math.min(...bands.map(b => b.min));
      const hi = Math.max(...bands.map(b => b.max));
      parts.push(`Età del bambino: da ${lo} a ${hi} anni. Tutte le attività devono essere adatte a questa fascia.`);
    } else {
      parts.push("Età del bambino: dai 6 ai 12 anni.");
    }

    if (fDiff.length) parts.push(`Difficoltà richiesta: ${fDiff.join(", ")}.`);
    if (fTime.length) {
      const labels = TIME_BUCKETS.filter(b => fTime.includes(b.id)).map(b => b.label);
      parts.push(`Durata del lavoro: ${labels.join(" oppure ")}.`);
    }
    if (fMat.length) {
      const labels = fMat.map(m => MAT_BY_ID[m].label);
      parts.push(`In casa abbiamo questi materiali: ${labels.join(", ")}. Ogni attività deve basarsi PRINCIPALMENTE su questi, aggiungendo al massimo forbici, colla, nastro adesivo, spago e colori.`);
    }
    if (fCat.length) {
      const labels = fCat.map(c => CAT_BY_ID[c].label);
      parts.push(`Tipo di gioco desiderato: ${labels.join(", ")}.`);
    }
    if (fSkill.length) {
      const labels = fSkill.map(s => SKILL_BY_ID[s].label);
      parts.push(`Abilità da allenare: ${labels.join(", ")}.`);
    }
    if (freeText.trim()) parts.push(`Richiesta libera dell'utente: ${freeText.trim()}`);

    const likedList = Object.values(liked);
    if (likedList.length) {
      const names = likedList.slice(-14).map(a => a.name);
      parts.push(`Progetti che sono piaciuti molto in passato (usali per capire i gusti, NON riproporli identici): ${names.join("; ")}.`);
    }

    const seen = new Set();
    [...(current?.activities || []), ...archive.flatMap(s => s.activities || [])]
      .forEach(a => seen.add(a.name));
    const already = [...seen].slice(0, 45);
    if (already.length) {
      parts.push(`Già proposti in passato, NON riproporli: ${already.join("; ")}.`);
    }

    return parts.join("\n");
  }, [count, fAges, fDiff, fTime, fMat, fCat, fSkill, freeText, liked, current, archive]);

  const generate = useCallback(async () => {
    setLoading(true);
    setApiError("");
    let step = 0;
    setLoadingMsg(LOADING_STEPS[0]);
    const timer = setInterval(() => {
      step = Math.min(step + 1, LOADING_STEPS.length - 1);
      setLoadingMsg(LOADING_STEPS[step]);
    }, 4200);

    try {
      const raw = await callClaudeAPI(buildUserMessage(), tokensFor(count));
      let activities = raw.slice(0, count).map(normalizeActivity);

      // Deduplica per id: due schede con lo stesso nome romperebbero i cuoricini.
      const byId = new Map();
      activities.forEach(a => { if (!byId.has(a.id)) byId.set(a.id, a); });
      activities = [...byId.values()];

      setLoadingMsg(LOADING_STEPS[3]);
      const { list, warning } = await resolveVideos(activities, videoEffort);
      activities = list;

      if (warning === "quota") {
        setApiError("La quota giornaliera di YouTube è esaurita: le attività ci sono tutte, ma senza video. Le istruzioni scritte restano complete.");
      } else if (warning === "missing_key") {
        setApiError("Manca la chiave YOUTUBE_API_KEY su Vercel: nessun video, solo istruzioni scritte.");
      }

      const session = {
        id: `s-${Date.now()}`,
        at: Date.now(),
        filters: {
          ages: fAges, difficulty: fDiff, time: fTime,
          materials: fMat, categories: fCat, skills: fSkill,
          freeText: freeText.trim()
        },
        activities
      };

      setCurrent(session);
      persist(session, archive, liked);
      setView("laboratorio");
      const withVideo = activities.filter(a => a.video).length;
      notify(`✨ ${activities.length} attività pronte · ${withVideo} con video`);
    } catch (e) {
      console.error(e);
      setApiError(`Non sono riuscito a generare le attività. ${e.message}`);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setLoadingMsg("");
    }
  }, [buildUserMessage, count, videoEffort, fAges, fDiff, fTime, fMat, fCat, fSkill, freeText, archive, liked, persist, notify]);

  // ── cuoricini ────────────────────────────────────────────────────────────
  const toggleLike = useCallback((activity) => {
    const next = { ...liked };
    if (next[activity.id]) {
      delete next[activity.id];
      notify("Rimosso dai preferiti");
    } else {
      next[activity.id] = { ...activity, likedAt: Date.now() };
      notify("❤️ Aggiunto ai preferiti — ne terrò conto la prossima volta");
    }
    setLiked(next);
    persist(current, archive, next);
  }, [liked, current, archive, persist, notify]);

  // ── archivio ─────────────────────────────────────────────────────────────
  const archiveCurrent = useCallback(() => {
    if (!current) { notify("Non c'è ancora niente da archiviare."); return; }
    if (archive.some(s => s.id === current.id)) { notify("Già in archivio."); return; }
    const next = [current, ...archive].slice(0, 60);
    setArchive(next);
    persist(current, next, liked);
    notify("📦 Salvato in archivio");
  }, [current, archive, liked, persist, notify]);

  const removeFromArchive = useCallback((id) => {
    const next = archive.filter(s => s.id !== id);
    setArchive(next);
    persist(current, next, liked);
    notify("Rimosso dall'archivio");
  }, [archive, current, liked, persist, notify]);

  // ── filtro lato client ───────────────────────────────────────────────────
  const matchesFilters = useCallback((a) => {
    if (fAges.length) {
      const ok = fAges.some(id => {
        const b = AGE_BANDS.find(x => x.id === id);
        return a.ageMin <= b.max && a.ageMax >= b.min;
      });
      if (!ok) return false;
    }
    if (fDiff.length && !fDiff.includes(a.difficulty)) return false;
    if (fTime.length && !fTime.includes(a.timeBucket)) return false;
    if (fCat.length && !fCat.includes(a.category)) return false;
    if (fMat.length && !(a.materialTags || []).some(m => fMat.includes(m))) return false;
    if (fSkill.length && !(a.skills || []).some(s => fSkill.includes(s))) return false;
    return true;
  }, [fAges, fDiff, fTime, fCat, fMat, fSkill]);

  const anyFilter =
    fAges.length + fDiff.length + fTime.length + fMat.length + fCat.length + fSkill.length;

  const visibleCurrent = useMemo(
    () => (current?.activities || []).filter(matchesFilters),
    [current, matchesFilters]
  );
  const likedList = useMemo(
    () => Object.values(liked).sort((a, b) => (b.likedAt || 0) - (a.likedAt || 0)),
    [liked]
  );
  const visibleLiked = useMemo(() => likedList.filter(matchesFilters), [likedList, matchesFilters]);

  const clearFilters = () => {
    setFAges([]); setFDiff([]); setFTime([]); setFMat([]); setFCat([]); setFSkill([]); setFreeText("");
  };

  const toggleIn = (arr, setter) => (id) =>
    setter(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  // ── render ───────────────────────────────────────────────────────────────
  if (!authReady || !ready) {
    return (
      <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🧰</div>
          <div style={{ width: 26, height: 26, margin: "0 auto", border: `3px solid ${T.line}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        </div>
      </div>
    );
  }

  if (imported) {
    const importId = `imp-${imported.at}`;
    const savedImport = archive.some(s => s.id === importId);
    const saveImport = () => {
      if (!user || savedImport) return;
      const session = { id: importId, at: imported.at, filters: null, activities: imported.activities };
      const next = [session, ...archive].slice(0, 60);
      setArchive(next);
      persist(current, next, liked);
      notify("📦 Salvato in archivio");
    };
    const likeOrAsk = (a) => user ? toggleLike(a) : notify("Accedi all'app per salvare i preferiti");
    return (
      <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 60 }}>
        <header style={{ background: T.card, borderBottom: `1.5px solid ${T.line}`, position: "sticky", top: 0, zIndex: 40 }}>
          <div style={{ maxWidth: 1120, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 26 }}>🧰</span>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, lineHeight: 1.15 }}>Alice's Building World</div>
              <div style={{ fontSize: 11.5, color: T.inkFaint }}>Foto e video delle attività scelte</div>
            </div>
          </div>
        </header>
        <main style={{ maxWidth: 1120, margin: "0 auto", padding: "20px", display: "grid", gap: 18 }}>
          {imported.state === "error" ? (
            <EmptyState emoji="🔗" title="Questo link non si apre"
              text="Il link è incompleto o rovinato. Torna nella versione Pro e premi di nuovo «Apri con foto e video»." />
          ) : (
            <>
              <ImportBanner state={imported.state} canSave={!!user} saved={savedImport} onSave={saveImport} />
              <Grid>
                {imported.activities.map(a => (
                  <ActivityCard key={a.id} activity={a} liked={!!liked[a.id]}
                    onLike={() => likeOrAsk(a)} onOpen={() => setDetail(a)} />
                ))}
              </Grid>
            </>
          )}
        </main>
        {detail && (
          <ActivityDetail activity={detail} liked={!!liked[detail.id]}
            onLike={() => likeOrAsk(detail)} onClose={() => setDetail(null)} />
        )}
        {notification && (
          <div style={{
            position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
            background: T.ink, color: "#fff", padding: "11px 20px", borderRadius: 24,
            fontSize: 13, zIndex: 90, boxShadow: "0 8px 26px rgba(0,0,0,0.22)", maxWidth: "90vw", textAlign: "center"
          }}>{notification}</div>
        )}
      </div>
    );
  }

  if (!user) return <AuthScreen />;

  return (
    <div style={{ minHeight: "100vh", background: T.bg, paddingBottom: 60 }}>

      {/* HEADER */}
      <header style={{
        background: T.card, borderBottom: `1.5px solid ${T.line}`,
        position: "sticky", top: 0, zIndex: 40
      }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "13px 20px", display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginRight: "auto" }}>
            <span style={{ fontSize: 26 }}>🧰</span>
            <div>
              <div style={{ fontSize: 16.5, fontWeight: 800, color: T.ink, lineHeight: 1.15 }}>Alice's Building World</div>
              <div style={{ fontSize: 11.5, color: T.inkFaint }}>Costruire con le mani, con quello che c'è in casa</div>
            </div>
          </div>
          <span style={{ fontSize: 12, color: T.inkFaint }}>{user.email}</span>
          <button type="button" onClick={() => signOut(auth)} style={{
            padding: "6px 12px", borderRadius: 18, border: `1.5px solid ${T.lineStrong}`,
            background: "transparent", color: T.inkSoft, fontSize: 12, cursor: "pointer"
          }}>Esci</button>
        </div>

        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 20px 10px", display: "flex", gap: 8 }}>
          {[
            { id: "laboratorio", label: "🔨 Laboratorio" },
            { id: "preferiti", label: `❤️ Preferiti${likedList.length ? ` (${likedList.length})` : ""}` },
            { id: "archivio", label: `📦 Archivio${archive.length ? ` (${archive.length})` : ""}` }
          ].map(t => (
            <button key={t.id} type="button" onClick={() => setView(t.id)} style={{
              padding: "7px 15px", borderRadius: 20,
              border: `1.5px solid ${view === t.id ? T.accent : T.lineStrong}`,
              background: view === t.id ? T.accent : "transparent",
              color: view === t.id ? "#fff" : T.inkSoft,
              fontSize: 13, fontWeight: view === t.id ? 700 : 500, cursor: "pointer"
            }}>{t.label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth: 1120, margin: "0 auto", padding: "20px" }}>

        {apiError && (
          <div style={{
            background: T.warmSoft, border: `1.5px solid #F2D4AE`, color: "#8A5A18",
            padding: "11px 14px", borderRadius: 11, fontSize: 12.5, marginBottom: 16, lineHeight: 1.55
          }}>
            {apiError}
            <button type="button" onClick={() => setApiError("")} style={{ ...linkBtn, color: "#8A5A18", marginLeft: 8 }}>chiudi</button>
          </div>
        )}

        {/* ── PANNELLO FILTRI ── */}
        <section style={{
          background: T.card, borderRadius: 16, border: `1.5px solid ${T.line}`,
          padding: "16px 18px", marginBottom: 20
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: showFilters ? 14 : 0 }}>
            <strong style={{ fontSize: 14, color: T.ink }}>Cosa cerchiamo</strong>
            {anyFilter ? (
              <Pill bg={T.accentSoft} color={T.accent}>{anyFilter} filtri attivi</Pill>
            ) : (
              <span style={{ fontSize: 12, color: T.inkFaint }}>nessun filtro — proposte libere</span>
            )}
            <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {anyFilter > 0 && (
                <button type="button" onClick={clearFilters} style={{ ...linkBtn, fontSize: 12 }}>azzera</button>
              )}
              <button type="button" onClick={() => setShowFilters(v => !v)} style={{ ...linkBtn, fontSize: 12 }}>
                {showFilters ? "nascondi" : "mostra"}
              </button>
            </div>
          </div>

          {showFilters && (
            <div style={{ display: "grid", gap: 14 }}>
              <FilterRow label="Età">
                {AGE_BANDS.map(b => (
                  <Chip key={b.id} active={fAges.includes(b.id)} onClick={() => toggleIn(fAges, setFAges)(b.id)}>{b.label}</Chip>
                ))}
              </FilterRow>

              <FilterRow label="Difficoltà">
                {DIFFICULTIES.map(d => (
                  <Chip key={d.id} active={fDiff.includes(d.id)} onClick={() => toggleIn(fDiff, setFDiff)(d.id)}>{d.emoji} {d.label}</Chip>
                ))}
              </FilterRow>

              <FilterRow label="Tempo">
                {TIME_BUCKETS.map(b => (
                  <Chip key={b.id} active={fTime.includes(b.id)} onClick={() => toggleIn(fTime, setFTime)(b.id)}>⏱ {b.label}</Chip>
                ))}
              </FilterRow>

              <FilterRow label="Cosa abbiamo in casa">
                {MATERIALS.map(m => (
                  <Chip key={m.id} tone="warm" active={fMat.includes(m.id)} onClick={() => toggleIn(fMat, setFMat)(m.id)}>{m.emoji} {m.label}</Chip>
                ))}
              </FilterRow>

              <FilterRow label="Tipo di gioco">
                {CATEGORIES.map(c => (
                  <Chip key={c.id} tone="rose" active={fCat.includes(c.id)} onClick={() => toggleIn(fCat, setFCat)(c.id)}>{c.emoji} {c.label}</Chip>
                ))}
              </FilterRow>

              <FilterRow label="Abilità da allenare">
                {SKILLS.map(s => (
                  <Chip key={s.id} active={fSkill.includes(s.id)} onClick={() => toggleIn(fSkill, setFSkill)(s.id)}>{s.emoji} {s.label}</Chip>
                ))}
              </FilterRow>

              <div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>
                  Richiesta libera
                </div>
                <input
                  value={freeText}
                  onChange={e => setFreeText(e.target.value)}
                  placeholder="es. qualcosa da regalare al nonno, o un gioco da fare in due"
                  style={{
                    width: "100%", padding: "10px 13px", borderRadius: 10,
                    border: `1.5px solid ${T.line}`, fontSize: 13.5, background: T.bg, color: T.ink, outline: "none"
                  }}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── BARRA DI GENERAZIONE ── */}
        {view === "laboratorio" && (
          <section style={{
            background: `linear-gradient(135deg, ${T.accent}, #3FA5B8)`,
            borderRadius: 16, padding: "18px 20px", marginBottom: 22,
            display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap"
          }}>
            <div style={{ color: "#fff", marginRight: "auto" }}>
              <div style={{ fontSize: 15.5, fontWeight: 800 }}>Genera nuove attività</div>
              <div style={{ fontSize: 12.5, opacity: 0.92, marginTop: 3 }}>
                Progetti con nome reale, così il video tutorial si trova davvero.
              </div>
            </div>

            <label style={selLabel}>
              quante
              <select value={count} onChange={e => setCount(Number(e.target.value))} style={selStyle}>
                {[3, 4, 6, 8].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>

            <label style={selLabel}>
              ricerca video
              <select value={videoEffort} onChange={e => setVideoEffort(Number(e.target.value))} style={selStyle}>
                <option value={1}>rapida</option>
                <option value={2}>accurata</option>
                <option value={3}>insistente</option>
              </select>
            </label>

            <button type="button" onClick={generate} disabled={loading} style={{
              padding: "12px 24px", borderRadius: 24, border: "none",
              background: "#fff", color: T.accent, fontSize: 14.5, fontWeight: 800,
              cursor: loading ? "wait" : "pointer", opacity: loading ? 0.75 : 1,
              boxShadow: "0 4px 14px rgba(0,0,0,0.13)"
            }}>
              {loading ? "Sto lavorando…" : "✨ Genera"}
            </button>
          </section>
        )}

        {loading && (
          <div style={{
            background: T.card, borderRadius: 14, border: `1.5px solid ${T.line}`,
            padding: "26px", textAlign: "center", marginBottom: 20
          }}>
            <div style={{ width: 30, height: 30, margin: "0 auto 12px", border: `3px solid ${T.line}`, borderTopColor: T.accent, borderRadius: "50%", animation: "spin 1s linear infinite" }} />
            <div style={{ fontSize: 13.5, color: T.inkSoft }}>{loadingMsg}</div>
            <div style={{ fontSize: 11.5, color: T.inkFaint, marginTop: 6 }}>di solito ci vogliono 30–60 secondi</div>
          </div>
        )}

        {/* ── LABORATORIO ── */}
        {view === "laboratorio" && !loading && (
          <>
            {!current ? (
              <EmptyState
                emoji="🔨"
                title="Il banco da lavoro è vuoto"
                text="Scegli qualche filtro qui sopra — o nessuno — e premi Genera. Ti propongo progetti veri, con video tutorial e la descrizione di com'è l'oggetto finito."
              />
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 14.5, color: T.ink }}>
                    {visibleCurrent.length} {visibleCurrent.length === 1 ? "attività" : "attività"}
                  </strong>
                  {anyFilter > 0 && current.activities.length !== visibleCurrent.length && (
                    <span style={{ fontSize: 12, color: T.inkFaint }}>
                      ({current.activities.length - visibleCurrent.length} nascoste dai filtri)
                    </span>
                  )}
                  <span style={{ fontSize: 12, color: T.inkFaint }}>· generate il {fmtDate(current.at)}</span>
                  <button type="button" onClick={archiveCurrent} style={{
                    marginLeft: "auto", padding: "6px 13px", borderRadius: 18,
                    border: `1.5px solid ${T.lineStrong}`, background: "transparent",
                    color: T.inkSoft, fontSize: 12, cursor: "pointer"
                  }}>📦 Salva in archivio</button>
                </div>

                {visibleCurrent.length === 0 ? (
                  <EmptyState emoji="🔍" title="Nessuna attività passa i filtri" text="Allarga i filtri, oppure genera una nuova serie con questi criteri." />
                ) : (
                  <Grid>
                    {visibleCurrent.map(a => (
                      <ActivityCard key={a.id} activity={a} liked={!!liked[a.id]}
                        onLike={() => toggleLike(a)} onOpen={() => setDetail(a)} />
                    ))}
                  </Grid>
                )}
              </>
            )}
          </>
        )}

        {/* ── PREFERITI ── */}
        {view === "preferiti" && (
          <>
            <div style={{
              background: T.roseSoft, border: `1.5px solid #F3D2D8`, borderRadius: 12,
              padding: "11px 15px", fontSize: 12.5, color: "#94414F", marginBottom: 16, lineHeight: 1.55
            }}>
              ❤️ Ogni cuoricino insegna i gusti di Alice: alla prossima generazione tengo conto di questi progetti
              per proporre cose nello stesso spirito, senza ripeterli.
            </div>
            {visibleLiked.length === 0 ? (
              <EmptyState emoji="🤍" title={likedList.length ? "Nessun preferito passa i filtri" : "Ancora nessun preferito"}
                text={likedList.length ? "Allarga i filtri per rivederli tutti." : "Metti il cuoricino sui progetti che vi sono piaciuti: restano qui per sempre e guidano le proposte future."} />
            ) : (
              <Grid>
                {visibleLiked.map(a => (
                  <ActivityCard key={a.id} activity={a} liked onLike={() => toggleLike(a)} onOpen={() => setDetail(a)} />
                ))}
              </Grid>
            )}
          </>
        )}

        {/* ── ARCHIVIO ── */}
        {view === "archivio" && (
          <>
            {archive.length === 0 ? (
              <EmptyState emoji="📦" title="Archivio vuoto"
                text="Dal Laboratorio puoi salvare in archivio una serie di attività: resta qui, con i suoi video e i suoi cuoricini." />
            ) : (
              <div style={{ display: "grid", gap: 16 }}>
                {archive.map(s => {
                  const acts = (s.activities || []).filter(matchesFilters);
                  const likedCount = (s.activities || []).filter(a => liked[a.id]).length;
                  return (
                    <div key={s.id} style={{
                      background: T.card, borderRadius: 16, border: `1.5px solid ${T.line}`, padding: "16px 18px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
                        <strong style={{ fontSize: 14, color: T.ink }}>{fmtDate(s.at)}</strong>
                        <span style={{ fontSize: 12, color: T.inkFaint }}>
                          {(s.activities || []).length} attività
                        </span>
                        {likedCount > 0 && <Pill bg={T.roseSoft} color={T.rose}>❤️ {likedCount}</Pill>}
                        <SessionFilters filters={s.filters} />
                        <button type="button" onClick={() => removeFromArchive(s.id)} style={{
                          marginLeft: "auto", ...linkBtn, fontSize: 12, color: T.inkFaint
                        }}>elimina</button>
                      </div>
                      {acts.length === 0 ? (
                        <div style={{ fontSize: 12.5, color: T.inkFaint }}>Nessuna attività di questa serie passa i filtri attivi.</div>
                      ) : (
                        <Grid min={210}>
                          {acts.map(a => (
                            <ActivityCard key={a.id} activity={a} liked={!!liked[a.id]}
                              onLike={() => toggleLike(a)} onOpen={() => setDetail(a)} compact />
                          ))}
                        </Grid>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>

      {detail && (
        <ActivityDetail
          activity={detail}
          liked={!!liked[detail.id]}
          onLike={() => toggleLike(detail)}
          onClose={() => setDetail(null)}
        />
      )}

      {notification && (
        <div style={{
          position: "fixed", bottom: 22, left: "50%", transform: "translateX(-50%)",
          background: T.ink, color: "#fff", padding: "11px 20px", borderRadius: 24,
          fontSize: 13, zIndex: 90, boxShadow: "0 8px 26px rgba(0,0,0,0.22)", maxWidth: "90vw", textAlign: "center"
        }}>{notification}</div>
      )}
    </div>
  );
}

// ── PEZZI DI INTERFACCIA ───────────────────────────────────────────────────
const selLabel = {
  display: "flex", flexDirection: "column", gap: 3,
  fontSize: 10.5, color: "#ffffffdd", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4
};
const selStyle = {
  padding: "7px 10px", borderRadius: 9, border: "none",
  background: "#ffffff2e", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer"
};

function FilterRow({ label, children }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.inkFaint, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 7 }}>
        {label}
      </div>
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{children}</div>
    </div>
  );
}

function Grid({ children, min = 250 }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${min}px, 1fr))`, gap: 16 }}>
      {children}
    </div>
  );
}

function EmptyState({ emoji, title, text }) {
  return (
    <div style={{
      background: T.card, borderRadius: 16, border: `1.5px dashed ${T.lineStrong}`,
      padding: "40px 28px", textAlign: "center"
    }}>
      <div style={{ fontSize: 38, marginBottom: 10 }}>{emoji}</div>
      <div style={{ fontSize: 15.5, fontWeight: 700, color: T.ink, marginBottom: 7 }}>{title}</div>
      <div style={{ fontSize: 13, color: T.inkSoft, maxWidth: 460, margin: "0 auto", lineHeight: 1.6 }}>{text}</div>
    </div>
  );
}

function SessionFilters({ filters }) {
  if (!filters) return null;
  const bits = [];
  (filters.ages || []).forEach(a => bits.push(AGE_BANDS.find(b => b.id === a)?.label));
  (filters.categories || []).forEach(c => bits.push(CAT_BY_ID[c]?.label));
  (filters.materials || []).forEach(m => bits.push(MAT_BY_ID[m]?.label));
  const list = bits.filter(Boolean).slice(0, 4);
  if (!list.length) return null;
  return <span style={{ fontSize: 11.5, color: T.inkFaint }}>· {list.join(" · ")}</span>;
}

function ActivityCard({ activity: a, liked, onLike, onOpen, compact }) {
  const cat = CAT_BY_ID[a.category];
  const diff = DIFFICULTIES.find(d => d.id === a.difficulty);
  return (
    <div
      className="abw-card abw-fade"
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(); } }}
      style={{
        background: T.card, borderRadius: 14, border: `1.5px solid ${T.line}`,
        overflow: "hidden", cursor: "pointer", display: "flex", flexDirection: "column"
      }}
    >
      <div style={{ position: "relative" }}>
        <ResultImage activity={a} height={compact ? 130 : 168} />
        <div style={{ position: "absolute", top: 7, right: 7, background: "#ffffffe8", borderRadius: 20, padding: "1px 3px" }}>
          <Heart liked={liked} onClick={onLike} size={compact ? 17 : 19} />
        </div>
        {a.video && (
          <div style={{
            position: "absolute", bottom: 8, right: 8, background: "#000000b3", color: "#fff",
            fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 10
          }}>
            ▶ {fmtDuration(a.video.durationSec) || "video"}
          </div>
        )}
      </div>

      <div style={{ padding: compact ? "11px 13px 13px" : "13px 15px 15px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 7 }}>
          <span style={{ fontSize: 17, lineHeight: 1.2 }}>{a.emoji}</span>
          <strong style={{ fontSize: compact ? 13 : 14, color: T.ink, lineHeight: 1.35 }}>{a.name}</strong>
        </div>

        {!compact && a.result && (
          <p style={{
            margin: "0 0 10px", fontSize: 12.3, color: T.inkSoft, lineHeight: 1.55,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden"
          }}>{a.result}</p>
        )}

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: "auto" }}>
          <Pill bg={T.accentSoft} color={T.accent}>{a.ageMin}–{a.ageMax} anni</Pill>
          <Pill bg={T.warmSoft} color="#B36E17">⏱ {a.timeMin} min</Pill>
          {diff && <Pill bg="#F4F1EA" color={T.inkSoft}>{diff.emoji} {diff.label}</Pill>}
          {cat && !compact && <Pill bg="#F4F1EA" color={T.inkSoft}>{cat.emoji} {cat.label}</Pill>}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children, tone }) {
  return (
    <section style={{ marginBottom: 22 }}>
      <h3 style={{
        margin: "0 0 9px", fontSize: 12.5, fontWeight: 800, color: tone || T.inkFaint,
        textTransform: "uppercase", letterSpacing: 0.6
      }}>{title}</h3>
      {children}
    </section>
  );
}

function ActivityDetail({ activity: a, liked, onLike, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const cat = CAT_BY_ID[a.category];
  const diff = DIFFICULTIES.find(d => d.id === a.difficulty);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, background: "#4A3F3599", zIndex: 80,
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "24px 16px", overflowY: "auto"
      }}
    >
      <div
        className="abw-fade"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.card, borderRadius: 18, maxWidth: 720, width: "100%",
          border: `1.5px solid ${T.line}`, overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.25)"
        }}
      >
        {/* HERO: il risultato finale, che è la cosa che conta di più */}
        <div style={{ position: "relative" }}>
          <ResultImage activity={a} height={230} rounded="0" />
          <button type="button" onClick={onClose} aria-label="Chiudi" style={{
            position: "absolute", top: 12, right: 12, width: 32, height: 32, borderRadius: 16,
            border: "none", background: "#ffffffe8", color: T.ink, fontSize: 17, cursor: "pointer", lineHeight: 1
          }}>×</button>
          <div style={{ position: "absolute", top: 12, left: 12, background: "#ffffffe8", borderRadius: 20, padding: "2px 5px" }}>
            <Heart liked={liked} onClick={onLike} size={22} />
          </div>
        </div>

        <div style={{ padding: "20px 24px 28px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
            <span style={{ fontSize: 28, lineHeight: 1 }}>{a.emoji}</span>
            <h2 style={{ margin: 0, fontSize: 21, color: T.ink, lineHeight: 1.3 }}>{a.name}</h2>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 20 }}>
            <Pill bg={T.accentSoft} color={T.accent}>{a.ageMin}–{a.ageMax} anni</Pill>
            <Pill bg={T.warmSoft} color="#B36E17">⏱ {a.timeMin} min</Pill>
            {diff && <Pill bg="#F4F1EA" color={T.inkSoft}>{diff.emoji} {diff.label}</Pill>}
            {cat && <Pill bg="#F4F1EA" color={T.inkSoft}>{cat.emoji} {cat.label}</Pill>}
            {(a.skills || []).map(s => SKILL_BY_ID[s] && (
              <Pill key={s} bg="#F4F1EA" color={T.inkSoft}>{SKILL_BY_ID[s].emoji} {SKILL_BY_ID[s].label}</Pill>
            ))}
          </div>

          {/* IL RISULTATO */}
          {(a.result || a.plays) && (
            <div style={{
              background: T.accentSoft, borderRadius: 13, padding: "15px 17px", marginBottom: 22,
              border: `1.5px solid #CDE8E3`
            }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 8 }}>
                Cosa viene fuori
              </div>
              {a.result && <p style={{ margin: 0, fontSize: 13.5, color: "#2C544E", lineHeight: 1.68 }}>{a.result}</p>}
              {a.resultSize && (
                <p style={{ margin: "9px 0 0", fontSize: 12.5, color: "#3C6862", fontWeight: 600 }}>📐 {a.resultSize}</p>
              )}
              {a.plays && (
                <p style={{ margin: "11px 0 0", fontSize: 13, color: "#2C544E", lineHeight: 1.65 }}>
                  <strong>Come ci si gioca.</strong> {a.plays}
                </p>
              )}
            </div>
          )}

          {/* VIDEO */}
          {a.video ? (
            <Section title="Video tutorial">
              <div style={{ position: "relative", paddingTop: "56.25%", borderRadius: 12, overflow: "hidden", background: "#000" }}>
                <iframe
                  title={a.video.title}
                  src={`https://www.youtube-nocookie.com/embed/${a.video.id}?rel=0&modestbranding=1`}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
                />
              </div>
              <div style={{ marginTop: 8, fontSize: 12, color: T.inkFaint, lineHeight: 1.5 }}>
                {a.video.title} · {a.video.channel}
                {a.video.durationSec ? ` · ${fmtDuration(a.video.durationSec)}` : ""}
                {a.video.noSpeech && " · 🔇 senza parlato in italiano: si segue guardando le immagini"}
              </div>
            </Section>
          ) : (
            <Section title="Video tutorial">
              <div style={{
                background: T.bg, border: `1.5px dashed ${T.lineStrong}`, borderRadius: 12,
                padding: "16px 18px", fontSize: 12.8, color: T.inkSoft, lineHeight: 1.6
              }}>
                Non ho trovato un video davvero pertinente per questo progetto — meglio nessun video che
                un video che costruisce un'altra cosa. Le istruzioni qui sotto sono complete e bastano da sole.
              </div>
            </Section>
          )}

          {/* MATERIALI */}
          {(a.materials || []).length > 0 && (
            <Section title="Materiale che serve">
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6 }}>
                {a.materials.map((m, i) => (
                  <li key={i} style={{
                    display: "flex", alignItems: "center", gap: 9, padding: "9px 13px",
                    background: T.bg, borderRadius: 9, fontSize: 13, color: T.ink
                  }}>
                    <span style={{ fontSize: 13 }}>{m.recupero === false ? "🛒" : "♻️"}</span>
                    <span style={{ flex: 1 }}>{m.name}</span>
                    {(m.qty || m.unit) && (
                      <span style={{ color: T.inkFaint, fontSize: 12 }}>{m.qty} {m.unit}</span>
                    )}
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 7, fontSize: 11.5, color: T.inkFaint }}>
                ♻️ materiale di recupero · 🛒 da comprare
              </div>
            </Section>
          )}

          {(a.tools || []).length > 0 && (
            <Section title="Strumenti">
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {a.tools.map((t, i) => <Pill key={i} bg="#F4F1EA" color={T.inkSoft}>{t}</Pill>)}
              </div>
            </Section>
          )}

          {/* PASSAGGI */}
          {(a.steps || []).length > 0 && (
            <Section title="Come si fa, passo per passo">
              <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 11 }}>
                {a.steps.map((s, i) => (
                  <li key={i} style={{ display: "flex", gap: 12 }}>
                    <div style={{
                      flexShrink: 0, width: 26, height: 26, borderRadius: 13,
                      background: T.accent, color: "#fff", fontSize: 12.5, fontWeight: 800,
                      display: "flex", alignItems: "center", justifyContent: "center"
                    }}>{i + 1}</div>
                    <p style={{ margin: 0, fontSize: 13.4, color: T.ink, lineHeight: 1.68, paddingTop: 2 }}>{s}</p>
                  </li>
                ))}
              </ol>
            </Section>
          )}

          {a.adultHelp && (
            <div style={{
              background: T.warmSoft, border: `1.5px solid #F2D4AE`, borderRadius: 12,
              padding: "13px 16px", marginBottom: 18, fontSize: 13, color: "#8A5A18", lineHeight: 1.62
            }}>
              <strong>👨‍👩‍👧 Serve un adulto.</strong> {a.adultHelp}
            </div>
          )}

          {a.safety && (
            <div style={{
              background: T.roseSoft, border: `1.5px solid #F3D2D8`, borderRadius: 12,
              padding: "13px 16px", marginBottom: 18, fontSize: 13, color: "#94414F", lineHeight: 1.62
            }}>
              <strong>⚠️ Attenzione a.</strong> {a.safety}
            </div>
          )}

          {a.tips && (
            <Section title="Consigli">
              <p style={{ margin: 0, fontSize: 13.3, color: T.inkSoft, lineHeight: 1.68 }}>{a.tips}</p>
            </Section>
          )}

          {a.variants && (
            <Section title="Più facile / più difficile">
              <p style={{ margin: 0, fontSize: 13.3, color: T.inkSoft, lineHeight: 1.68 }}>{a.variants}</p>
            </Section>
          )}

          <button type="button" onClick={onClose} style={{
            width: "100%", padding: "12px", borderRadius: 11, border: `1.5px solid ${T.lineStrong}`,
            background: "transparent", color: T.inkSoft, fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginTop: 6
          }}>Chiudi</button>
        </div>
      </div>
    </div>
  );
}
