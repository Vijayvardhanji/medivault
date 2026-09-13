// Vercel serverless function (Node.js runtime).
// Keeps the Anthropic API key on the server — never expose it in
// client-side code. Set ANTHROPIC_API_KEY in your Vercel project's
// Environment Variables, then redeploy.

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({
      error:
        "ANTHROPIC_API_KEY is not set on this deployment. Add it in Vercel → Project → Settings → Environment Variables, then redeploy.",
    });
    return;
  }

  try {
    const { data, mediaType } = req.body || {};
    if (!data || !mediaType) {
      res.status(400).json({ error: "Missing file data or mediaType." });
      return;
    }

    const isPdf = mediaType === "application/pdf";
    const contentBlock = isPdf
      ? { type: "document", source: { type: "base64", media_type: mediaType, data } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data } };

    const prompt = `You are the AI layer of MediVault, an emergency medical identity app. You are given an uploaded medical report belonging to the account holder.

Write a short emergency summary a first responder could read in seconds: any diagnosed conditions or past illnesses, allergies, and current medications relevant to emergency care.

Return ONLY plain text, no headings or markdown, in this exact shape:
- 2 to 4 short lines of summary
- then, on its own final line, exactly: For clinician verification — not a diagnosis.`;

    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 400,
        messages: [{ role: "user", content: [contentBlock, { type: "text", text: prompt }] }],
      }),
    });

    if (!apiRes.ok) {
      const errText = await apiRes.text();
      res.status(apiRes.status).json({ error: `Anthropic API error: ${errText}` });
      return;
    }

    const json = await apiRes.json();
    const summary = (json.content || [])
      .map((block) => block.text || "")
      .join("\n")
      .trim();

    res.status(200).json({ summary });
  } catch (e) {
    res.status(500).json({ error: e.message || "Unknown server error" });
  }
}
