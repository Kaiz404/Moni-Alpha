package chat

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/kaiz404/moni/backend/internal/tracing"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(r gin.IRoutes) {
	r.POST("/chat/analyze", h.analyze)
}

func (h *Handler) analyze(c *gin.Context) {
	var req AnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	if err := ValidateSnapshot(req.Snapshot); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid snapshot", "details": err.Error()})
		return
	}
	ctx := c.Request.Context()
	res := h.svc.Analyze(ctx, req)
	tracing.Record(ctx, req, res, res.Status, res.Reason)
	c.JSON(http.StatusOK, res)
}
