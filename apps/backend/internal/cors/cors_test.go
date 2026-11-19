package cors

import (
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/gin-gonic/gin"
)

func router() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(Middleware([]string{"http://localhost:3000", "https://app.moni.test"}))
	r.POST("/v1/extract/text", func(c *gin.Context) { c.JSON(http.StatusOK, gin.H{"status": "skipped"}) })
	return r
}

func send(method, origin string, headers map[string]string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(method, "/v1/extract/text", nil)
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	w := httptest.NewRecorder()
	router().ServeHTTP(w, req)
	return w
}

var preflight = map[string]string{
	"Access-Control-Request-Method":  "POST",
	"Access-Control-Request-Headers": "authorization,content-type",
}

func TestPreflightFromAnAllowedOrigin(t *testing.T) {
	w := send(http.MethodOptions, "https://app.moni.test", preflight)
	got := []string{
		w.Header().Get("Access-Control-Allow-Origin"),
		w.Header().Get("Access-Control-Allow-Methods"),
		w.Header().Get("Access-Control-Allow-Headers"),
		w.Header().Get("Vary"),
	}
	want := []string{"https://app.moni.test", "GET, POST", "Authorization, Content-Type", "Origin"}
	if w.Code != http.StatusNoContent || !slices.Equal(got, want) {
		t.Fatalf("status %d headers %q, want 204 %q", w.Code, got, want)
	}
}

func TestPreflightFromAnotherOriginIsRefused(t *testing.T) {
	w := send(http.MethodOptions, "https://evil.test", preflight)
	if w.Code != http.StatusForbidden || w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("status %d allow-origin %q, want 403 and none", w.Code, w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestRequestFromAnAllowedOriginIsReadable(t *testing.T) {
	w := send(http.MethodPost, "http://localhost:3000", nil)
	got := []string{w.Header().Get("Access-Control-Allow-Origin"), w.Header().Get("Access-Control-Expose-Headers"), w.Body.String()}
	want := []string{"http://localhost:3000", "Retry-After", `{"status":"skipped"}`}
	if !slices.Equal(got, want) {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestRequestFromAnotherOriginGetsNoAllowHeader(t *testing.T) {
	w := send(http.MethodPost, "http://localhost:3001", nil)
	if w.Code != http.StatusOK || w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("status %d allow-origin %q", w.Code, w.Header().Get("Access-Control-Allow-Origin"))
	}
}

func TestThePhoneSendsNoOriginAndSeesNoCORSHeaders(t *testing.T) {
	w := send(http.MethodPost, "", nil)
	if w.Code != http.StatusOK || w.Header().Get("Vary") != "" || w.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("status %d headers %v", w.Code, w.Header())
	}
}
