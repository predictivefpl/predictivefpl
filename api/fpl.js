export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Allow-Headers", "Content-Type")

  if (req.method === "OPTIONS") {
    return res.status(200).end()
  }

  const path = req.query.path || ""
  const fplUrl = `https://fantasy.premierleague.com/api${path}`

  try {
    const response = await fetch(fplUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": "https://fantasy.premierleague.com/",
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({ error: "FPL API error" })
    }

    const data = await response.json()
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=30")
    return res.status(200).json(data)
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }
}
