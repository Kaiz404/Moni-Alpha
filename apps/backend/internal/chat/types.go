package chat

import "encoding/json"

type HistoryMessage struct {
	Role    string `json:"role" binding:"required,oneof=user assistant"`
	Content string `json:"content" binding:"required,max=4000"`
}

type AnalyzeRequest struct {
	Message  string           `json:"message" binding:"required,min=1,max=2000"`
	Snapshot json.RawMessage  `json:"snapshot" binding:"required"`
	History  []HistoryMessage `json:"history,omitempty" binding:"max=12,dive"`
}

type AnalyzeResult struct {
	Status  string `json:"status"` // "ok" | "unavailable"
	Reply   string `json:"reply,omitempty"`
	ModelID string `json:"modelId,omitempty"`
	Reason  string `json:"reason,omitempty"`
}
