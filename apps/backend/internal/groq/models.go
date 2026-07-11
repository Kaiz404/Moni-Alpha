package groq

// Model allocation (Groq Developer tier), chosen for Moni's constraints:
// live UX flows need the fastest inference; notifications need efficiency.
//
//   - ModelTextFast: llama-3.1-8b-instant — fastest and cheapest, highest
//     RPD ceiling. Used for live text extraction and notification extraction.
//   - ModelTextQuality: llama-3.3-70b-versatile — fallback when the fast
//     model returns unparseable output, and primary for insight prose.
//   - ModelVision: llama-4-scout — Groq's vision model (30K TPM), used for
//     receipt image extraction.
const (
	ModelTextFast    = "llama-3.1-8b-instant"
	ModelTextQuality = "llama-3.3-70b-versatile"
	ModelVision      = "meta-llama/llama-4-scout-17b-16e-instruct"
)
