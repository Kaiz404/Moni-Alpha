package extract

import (
	"net/http"

	"github.com/gin-gonic/gin"
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
	c.JSON(http.StatusOK, h.svc.FromText(c.Request.Context(), req))
}

func (h *Handler) image(c *gin.Context) {
	var req ImageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, h.svc.FromImage(c.Request.Context(), req))
}

func (h *Handler) notification(c *gin.Context) {
	var req NotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	c.JSON(http.StatusOK, h.svc.FromNotification(c.Request.Context(), req))
}
