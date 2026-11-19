package budget

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
	r.POST("/budget/suggest", h.suggest)
}

func (h *Handler) suggest(c *gin.Context) {
	var req Request
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	ctx := c.Request.Context()
	res := h.svc.Suggest(ctx, req)
	tracing.Record(ctx, req, res, res.Status, res.Reason)
	c.JSON(http.StatusOK, res)
}
