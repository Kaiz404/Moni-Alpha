package places

import (
	"errors"
	"log"
	"net/http"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	client          *Client
	autocompleteCap *dailyCap
	detailsCap      *dailyCap
}

// NewHandler returns a handler that answers every call with unavailable when client is nil (no API key).
func NewHandler(client *Client, dailyCapPerEndpoint int, now func() time.Time) *Handler {
	return &Handler{
		client:          client,
		autocompleteCap: newDailyCap(dailyCapPerEndpoint, now),
		detailsCap:      newDailyCap(dailyCapPerEndpoint, now),
	}
}

func (h *Handler) Register(r gin.IRoutes) {
	r.POST("/places/autocomplete", h.autocomplete)
	r.POST("/places/details", h.details)
}

func (h *Handler) autocomplete(c *gin.Context) {
	var req AutocompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	req.Input = strings.TrimSpace(req.Input)
	if n := utf8.RuneCountInString(req.Input); n < 2 || n > 100 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": "input must be 2 to 100 characters"})
		return
	}
	if h.client == nil || !h.autocompleteCap.take() {
		c.JSON(http.StatusOK, AutocompleteResult{Status: StatusUnavailable})
		return
	}
	predictions, err := h.client.Autocomplete(c.Request.Context(), req)
	if err != nil {
		log.Printf("places autocomplete: %v", err)
		c.JSON(http.StatusOK, AutocompleteResult{Status: StatusUnavailable})
		return
	}
	c.JSON(http.StatusOK, AutocompleteResult{Status: StatusOK, Predictions: predictions})
}

func (h *Handler) details(c *gin.Context) {
	var req DetailsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body", "details": err.Error()})
		return
	}
	if h.client == nil || !h.detailsCap.take() {
		c.JSON(http.StatusOK, DetailsResult{Status: StatusUnavailable})
		return
	}
	place, err := h.client.Details(c.Request.Context(), req.PlaceID, req.SessionToken)
	switch {
	case errors.Is(err, errNotFound):
		c.JSON(http.StatusOK, DetailsResult{Status: StatusNotFound})
	case err != nil:
		log.Printf("places details: %v", err)
		c.JSON(http.StatusOK, DetailsResult{Status: StatusUnavailable})
	default:
		c.JSON(http.StatusOK, DetailsResult{Status: StatusOK, Place: &place})
	}
}
