// /api/claude — proxy verso l'API Anthropic.
//
// La chiave sta solo qui, come variabile d'ambiente su Vercel (ANTHROPIC_KEY):
// il browser non la vede mai. Stesso conto e stessa chiave di meal-prep-app.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.ANTHROPIC_KEY) {
    return res.status(500).json({ error: { message: "ANTHROPIC_KEY non configurata su Vercel" } });
  }

  try {
    const body = {
      ...req.body,
      max_tokens: req.body?.max_tokens || 4000
    };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);

  } catch (e) {
    return res.status(500).json({ error: { message: e.message } });
  }
}
