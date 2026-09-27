// Vercel serverless function (Node.js runtime).
// Keeps the Gemini API key on the server — never expose it in
// client-side code. Set GEMINI_API_KEY in your Vercel project's
// Environment Variables, then redeploy.
// Get a free key from https://aistudio.google.com/apikey

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "GEMINI_API_KEY is not set on this deployment. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
    });
    return;
  }

  try {
    const { data, mediaType } = req.body || {};
    if (!data || !mediaType) {
      res.status(400).json({ error: "Missing file data or mediaType." });
      return;
    }

    const prompt = `You are the AI layer of MediVault, an emergency medical identity app. You are given an uploaded medical report belonging to the account holder.

Write a short emergency summary a first responder could read in seconds: any diagnosed conditions or past illnesses, allergies, and current medications relevant to emergency care.

Return ONLY plain text, no headings or markdown, in this exact shape:
- 2 to 4 short lines of summary
- then, on its own final line, exactly: For clinician verification — not a diagnosis.`;

    const model = "gemini-3.8-flash";

    // Gemini sometimes returns a transient 503 ("model overloaded"). Retry a
    // few times with a short backoff before giving up, so a busy moment on
    // Google's side doesn't surface as a hard failure to the user.
    async function callGemini() {
      const maxAttempts = 3;
      let lastErrText = "";
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const apiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { inline_data: { mime_type: mediaType, data } },
                    { text: prompt },
                  ],
                },
              ],
              generationConfig: { maxOutputTokens: 400 },
            }),
          }
        );

        if (apiRes.ok) return apiRes;

        lastErrText = await apiRes.text();
        const retryable = apiRes.status === 503 || apiRes.status === 429;
        if (!retryable || attempt === maxAttempts) {
          const err = new Error(lastErrText);
          err.status = apiRes.status;
          throw err;
        }
        // Backoff: ~1s, then ~2s before the next attempt.
        await new Promise((r) => setTimeout(r, attempt * 1000));
      }
    }

    let apiRes;
    try {
      apiRes = await callGemini();
    } catch (e) {
      res.status(e.status || 500).json({ error: `Gemini API error: ${e.message}` });
      return;
    }

    const json = await apiRes.json();
    const summary = (json.candidates?.[0]?.content?.parts || [])
      .map((part) => part.text || "")
      .join("\n")
      .trim();

    if (!summary) {
      res.status(500).json({ error: "Gemini returned an empty response." });
      return;
    }

    res.status(200).json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown server error" });
  }
}