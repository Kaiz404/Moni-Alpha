package extract

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
	r.POST("/extract/text", h.text)
	r.POST("/extract/image", h.image)
	r.POST("/extract/notification", h.notification)
}

func (h *Handler) text(c *gin.Context) {
	var req TextRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	ctx := c.Request.Context()
	res := h.svc.FromText(ctx, req)
	tracing.Record(ctx, req, res, res.Status, res.Reason)
	c.JSON(http.StatusOK, res)
}

func (h *Handler) image(c *gin.Context) {
	var req ImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	image := req.imageURL()
	ctx := tracing.WithMedia(c.Request.Context(), image)
	res := h.svc.FromImage(ctx, req)
	traced := req
	traced.ImageBase64, traced.ImageURL = "", image
	tracing.Record(ctx, traced, res, res.Status, res.Reason)
	c.JSON(http.StatusOK, res)
}

func (h *Handler) notification(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	ctx := c.Request.Context()
	tracing.Metadata(ctx, map[string]string{"app": req.Notification.PackageNameForRouting()})
	res := h.svc.FromNotification(ctx, req)
	tracing.Record(ctx, req, res, res.Status, res.Reason)
	c.JSON(http.StatusOK, res)
}
