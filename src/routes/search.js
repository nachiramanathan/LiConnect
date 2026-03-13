const express = require("express");
const { searchConnections, searchByKeyword } = require("../services/searchService");
const { authenticate } = require("../middleware/auth");

const router = express.Router();
router.use(authenticate);

/**
 * POST /api/search
 *
 * Body: { query: "I want to reach customers of VeriPark", limit?: 20 }
 *
 * Returns connections ranked by semantic similarity, along with
 * who in your network can make the introduction.
 */
router.post("/", async (req, res) => {
  try {
    const { query, limit } = req.body;

    if (!query) {
      return res.status(400).json({ error: "Query is required" });
    }

    const results = await searchConnections(query, limit || 20);

    res.json({
      query,
      count: results.length,
      results: results.map((r) => ({
        name: r.full_name,
        headline: r.headline,
        company: r.company,
        position: r.position,
        linkedin_url: r.linkedin_url,
        introduced_by: r.friend_name || r.introduced_by,
        friend_email: r.friend_email,
        similarity: parseFloat(r.similarity).toFixed(4),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/search/keyword?q=VeriPark&limit=20
 * Simple keyword fallback search.
 */
router.get("/keyword", async (req, res) => {
  try {
    const { q, limit } = req.query;
    if (!q) return res.status(400).json({ error: "q parameter required" });

    const results = await searchByKeyword(q, parseInt(limit) || 20);
    res.json({ query: q, count: results.length, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
