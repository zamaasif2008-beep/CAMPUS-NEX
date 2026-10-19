// CAMPUS NEX Hub - Node server (serves index.html + voice AI route)
// Needs Node 18+ and:  npm install express
// Keys go in a file named .env next to this file (use ONE of these):
//   GEMINI_API_KEY=your_google_key        (free tier, from aistudio.google.com)
//   ANTHROPIC_API_KEY=your_claude_key     (paid, from console.anthropic.com)
// Optional: GEMINI_MODEL=gemini-flash-latest
// Run:  node server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

// Load keys from a local .env file (no extra package needed)
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  });
} catch {}

const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json({ limit: '10kb' }));

// Serve only the app page (keeps server.js / .env private)
app.use('/images', express.static(path.join(__dirname, 'images')));   // food photos go in the images folder
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

const LANG_NAMES = {
  'en-IN': 'English', 'en-US': 'English', 'en-GB': 'English', 'hi-IN': 'Hindi', 'ta-IN': 'Tamil', 'te-IN': 'Telugu',
  'ml-IN': 'Malayalam', 'gu-IN': 'Gujarati', 'kn-IN': 'Kannada', 'bn-IN': 'Bengali',
  'mr-IN': 'Marathi', 'pa-IN': 'Punjabi', 'ur-IN': 'Urdu',
  'es-ES': 'Spanish', 'fr-FR': 'French', 'de-DE': 'German', 'pt-BR': 'Portuguese', 'ru-RU': 'Russian',
  'ar-SA': 'Arabic', 'ja-JP': 'Japanese', 'ko-KR': 'Korean', 'zh-CN': 'Chinese (Simplified)',
};
const TAB_IDS = ['home', 'canteen', 'bus', 'hostel', 'academic', 'collab', 'life', 'career', 'study', 'finance', 'tools', 'submit'];
const systemFor = language =>
  `You are the voice assistant of CAMPUS NEX Hub, a student campus app (canteen, bus radar, hostel and mess, timetable, GPA, attendance, ledger). The user speaks ${language}; reply in ${language}.
Respond with ONLY a JSON object, no markdown: {"tab": <id or null>, "reply": "<at most 2 short plain-text sentences that sound natural when read aloud>"}.
If the user asks to open, show or go to a section of the app, set "tab" to the matching id and make "reply" a short confirmation such as "Opening the timetable". Otherwise set "tab" to null and simply answer the question; never claim to have done anything else.
Tab ids: home (dashboard), canteen (food, menu), bus (buses, commute), hostel (mess, outpass, laundry, maintenance), academic (timetable, schedule, attendance, GPA, seats), collab (peer collaboration, study groups), life (campus life, lost and found), career (jobs, internships), study (AI voice, study tools, PDF), finance (ledger, payments, backup), tools, submit (problem box, suggestions).`;

// The model is asked for JSON; fall back to plain text if it doesn't comply
function parseAI(raw) {
  const m = String(raw || '').match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const j = JSON.parse(m[0]);
      return { reply: String(j.reply || '').trim(), tab: TAB_IDS.includes(j.tab) ? j.tab : null };
    } catch {}
  }
  return { reply: String(raw || '').trim(), tab: null };
}

// ---- Google Gemini (free tier) ----
// Fastest models first; the first one that answers is remembered so later questions skip the slow retries.
const THINK_OFF = [{ thinkingConfig: { thinkingBudget: 0 } }, { thinkingConfig: { thinkingLevel: 'minimal' } }, {}];   // ways to switch "thinking" off
let goodModel = null;
const thinkVariant = {};   // model -> index of the THINK_OFF variant that worked
async function askGemini(text, language) {
  const models = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-2.5-flash'].filter(Boolean);
  if (goodModel) models.unshift(goodModel);
  let lastErr = 'Gemini error';
  for (const model of [...new Set(models)]) {
    const call = variant => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemFor(language) }] },
        contents: [{ role: 'user', parts: [{ text }] }],
        generationConfig: { maxOutputTokens: 300, responseMimeType: 'application/json', ...THINK_OFF[variant] },
      }),
    });
    const t0 = Date.now();
    let v = thinkVariant[model] ?? 0, r = await call(v);
    while (r.status === 400 && v < THINK_OFF.length - 1) r = await call(++v);   // this model doesn't accept that "no thinking" setting - try the next
    const data = await r.json().catch(() => ({}));
    if (r.ok) {
      const out = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('').trim();
      if (out) { goodModel = model; thinkVariant[model] = v; console.log(`AI reply from ${model} in ${Date.now() - t0} ms`); return out; }
      lastErr = 'Gemini returned an empty reply';
      continue;
    }
    lastErr = data.error?.message || `Gemini error ${r.status}`;
    console.error(`Gemini (${model}):`, lastErr);
    if (r.status !== 404) break;   // 404 = model name not available, try the next one
  }
  throw new Error(lastErr);
}

// ---- Anthropic Claude (paid) ----
async function askClaude(text, language) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 300, system: systemFor(language), messages: [{ role: 'user', content: text }] }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error?.message || `Anthropic error ${r.status}`);
  return data.content?.[0]?.text || '';
}

app.post('/api/voice-chat', async (req, res) => {
  try {
    const text = String(req.body.text || '').slice(0, 500);
    const language = LANG_NAMES[req.body.lang] || 'English';
    if (!text) return res.json({ reply: '', tab: null });
    if (!process.env.GEMINI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ reply: '', error: 'No AI key on the server. Add GEMINI_API_KEY=... to the .env file and restart node server.js' });
    }
    const raw = process.env.GEMINI_API_KEY ? await askGemini(text, language) : await askClaude(text, language);
    res.json(parseAI(raw));
  } catch (e) {
    console.error(e);
    res.status(502).json({ reply: '', error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`CAMPUS NEX running at http://localhost:${PORT}`);
  console.log(process.env.GEMINI_API_KEY ? 'AI: Google Gemini key loaded ✔'
    : process.env.ANTHROPIC_API_KEY ? 'AI: Anthropic key loaded ✔'
    : 'AI key NOT set - add GEMINI_API_KEY=... to a .env file');
});
