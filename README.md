# Alice's Building World

Trova cose da **costruire con le mani** usando materiale di recupero che è già in casa.
Ogni proposta arriva con la descrizione di com'è l'oggetto finito, il video tutorial (quando ne
esiste uno davvero pertinente) e le istruzioni passo passo. Pensata per bambini dai 6 ai 12 anni.

App gemella di `meal-prep-app`: stessa struttura, stesso account GitHub/Vercel, stesse chiavi API.

---

## Come funziona

1. **Filtri** — età, difficoltà, tempo, materiali che hai in casa, tipo di gioco, abilità da allenare.
   I filtri fanno due lavori: guidano la generazione *e* filtrano quello che vedi a schermo
   (utile anche su preferiti e archivio).
2. **Genera** — Claude propone N progetti con **nomi reali** (quelli con cui il progetto è
   davvero conosciuto), perché è l'unico modo per trovare poi un video tutorial vero.
3. **Video** — `/api/video` cerca su YouTube e assegna a ogni candidato un punteggio di
   pertinenza. Sotto soglia non restituisce niente: meglio nessun video che un video che
   costruisce un'altra cosa.
4. **Cuoricini** — ❤️ su un progetto lo salva nei preferiti e insegna i gusti: alla generazione
   successiva Claude ne tiene conto, senza riproporlo.
5. **Archivio** — ogni serie generata si può salvare; resta con i suoi video e i suoi cuoricini.

### Le immagini del risultato finale

L'immagine grande di ogni scheda è la **miniatura del video tutorial trovato**: è letteralmente
una foto dell'oggetto finito, ed è gratis. Quando nessun video supera la soglia di pertinenza, la
scheda mostra una card illustrata e le istruzioni scritte restano complete.

### Le scelte sui video, in breve

`api/video.js` non si limita a prendere il primo risultato di YouTube:

- **canali da evitare** (5-Minute Crafts, Troom Troom, 123 GO e simili) → esclusi in partenza:
  sono noti per tutorial spettacolarizzati, non riproducibili, a volte pericolosi;
- **Short sotto i 70 secondi** → esclusi prima del punteggio, non insegnano un montaggio;
- **carrellate** tipo "25 lavoretti con…" → penalizzate pesantemente: si guardano, non si seguono;
- **materiale sbagliato** → penalizzato: "macchinina a elastico con siringhe" non è
  "macchinina a elastico con tappi di bottiglia", anche se il nome si somiglia;
- **secondo giro**: se in italiano non esce niente di valido, cerca un tutorial visivo
  straniero e lo etichetta *senza parlato* — un bricolage si segue anche guardando.

---

## Avvio in locale

```bash
npm install
npm start
```

Nota: in locale le due funzioni sotto `api/` non girano con `npm start` (sono funzioni
serverless Vercel). Per provarle serve `vercel dev`.

## Deploy

Stesso flusso di meal-prep-app:

```bash
build-and-deploy.bat "messaggio del commit"
```

Fa la build con `CI=true` (identica a quella di Vercel, i warning diventano errori) e procede
al commit/push solo se la build passa. Il log finisce in `build-log.txt`.

## Variabili d'ambiente su Vercel

| Variabile | Dove serve | Note |
|---|---|---|
| `ANTHROPIC_KEY` | server (`/api/claude`) | stessa chiave e stesso conto di meal-prep-app |
| `YOUTUBE_API_KEY` | server (`/api/video`) | stessa chiave di meal-prep-app |
| `REACT_APP_FB_API_KEY` | client | opzionale: c'è già il fallback nel codice |
| `REACT_APP_FB_AUTH_DOMAIN` | client | opzionale |
| `REACT_APP_FB_PROJECT_ID` | client | opzionale |
| `REACT_APP_FB_APP_ID` | client | opzionale |

**Attenzione alla quota YouTube.** Ogni ricerca costa 100 unità sulle 10.000 gratuite
giornaliere, quindi circa 100 ricerche al giorno **condivise con meal-prep-app** se usi la
stessa chiave. Una generazione da 6 attività con ricerca *accurata* può arrivare a ~12 ricerche.
Se vuoi separare i due consumi, crea una seconda chiave nella Google Cloud Console e mettila
solo qui. Quando la quota finisce l'app continua a funzionare: mostra le attività senza video
e lo dice esplicitamente.

## Dati

Firebase è lo stesso progetto di meal-prep-app (`meal-prep-studio`): stesso login, nessuna
configurazione nuova. I dati però vivono in un documento separato, `users/{uid}/data/building`,
quindi le due app non si vedono e non si sovrascrivono. Senza login tutto finisce in
`localStorage` sotto la chiave `abw-data`.

## Struttura

```
api/claude.js      proxy verso l'API Anthropic (la chiave resta sul server)
api/video.js       ricerca YouTube + punteggio di pertinenza e sicurezza
src/App.js         tutta l'interfaccia: filtri, generazione, schede, cuoricini, archivio
public/            index.html, icone, manifest
```
