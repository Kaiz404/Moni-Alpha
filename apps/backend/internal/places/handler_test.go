package places

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/kaiz404/moni/backend/internal/auth"
	"github.com/kaiz404/moni/backend/internal/auth/authtest"
)

// fakeGoogle answers with a fixed status and body and records each request.
type fakeGoogle struct {
	mu       sync.Mutex
	status   int
	body     string
	requests []recorded
}

type recorded struct {
	method, path, query string
	header              http.Header
	body                map[string]any
}

func (f *fakeGoogle) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var body map[string]any
	json.NewDecoder(r.Body).Decode(&body)
	f.mu.Lock()
	f.requests = append(f.requests, recorded{r.Method, r.URL.EscapedPath(), r.URL.RawQuery, r.Header.Clone(), body})
	f.mu.Unlock()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(f.status)
	io.WriteString(w, f.body)
}

type server struct {
	handler http.Handler
	token   func(sub string) string
}

// newServer puts the handler behind the real auth middleware, so each call carries a signed user id.
func newServer(t *testing.T, google *fakeGoogle, dailyCap, userDailyCap int, now func() time.Time) *server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	var client *Client
	if google != nil {
		srv := httptest.NewServer(google)
		t.Cleanup(srv.Close)
		client = NewClient("server-key", srv.URL+"/v1")
	}
	priv, jwks := authtest.KeyAndJWKS(t)
	verifier, err := auth.NewVerifier(context.Background(), jwks.URL)
	if err != nil {
		t.Fatal(err)
	}
	r := gin.New()
	NewHandler(client, dailyCap, userDailyCap, now).Register(r.Group("/v1", verifier.Middleware()))
	return &server{
		handler: r,
		token: func(sub string) string {
			return authtest.SignToken(t, priv, sub, time.Now().Add(time.Hour))
		},
	}
}

func post(t *testing.T, s *server, path, body string) (int, string) {
	t.Helper()
	return postAs(t, s, "user-1", path, body)
}

func postAs(t *testing.T, s *server, user, path, body string) (int, string) {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewReader([]byte(body)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.token(user))
	s.handler.ServeHTTP(rec, req)
	return rec.Code, rec.Body.String()
}

func status(t *testing.T, body string) string {
	t.Helper()
	var res struct{ Status string }
	if err := json.Unmarshal([]byte(body), &res); err != nil {
		t.Fatalf("response is not JSON: %s", body)
	}
	return res.Status
}

func jsonEqual(t *testing.T, got, want string) {
	t.Helper()
	var g, w any
	if err := json.Unmarshal([]byte(got), &g); err != nil {
		t.Fatalf("response is not JSON: %s", got)
	}
	json.Unmarshal([]byte(want), &w)
	gb, _ := json.Marshal(g)
	wb, _ := json.Marshal(w)
	if string(gb) != string(wb) {
		t.Fatalf("got  %s\nwant %s", gb, wb)
	}
}

const autocompleteReply = `{"suggestions":[
	{"placePrediction":{"place":"places/A","placeId":"A","text":{"text":"Nasi Kandar Pelita, Jalan Ampang"},
		"structuredFormat":{"mainText":{"text":"Nasi Kandar Pelita"},"secondaryText":{"text":"Jalan Ampang, Kuala Lumpur"}},"distanceMeters":420}},
	{"queryPrediction":{"text":{"text":"nasi kandar near me"}}},
	{"placePrediction":{"placeId":"B","structuredFormat":{"mainText":{"text":"Nasi Kandar Line Clear"}}}},
	{"placePrediction":{"placeId":"C","structuredFormat":{"mainText":{"text":"C"}}}},
	{"placePrediction":{"placeId":"D","structuredFormat":{"mainText":{"text":"D"}}}},
	{"placePrediction":{"placeId":"E","structuredFormat":{"mainText":{"text":"E"}}}},
	{"placePrediction":{"placeId":"F","structuredFormat":{"mainText":{"text":"F"}}}}
]}`

func TestAutocompleteSendsTheRequestGoogleExpectsAndMapsPlacePredictions(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: autocompleteReply}
	h := newServer(t, google, 10, 10, time.Now)

	code, body := post(t, h, "/v1/places/autocomplete",
		`{"input":"  nasi kandar ","sessionToken":"tok-1","bias":{"latitude":3.13,"longitude":101.67}}`)

	if code != http.StatusOK {
		t.Fatalf("status %d: %s", code, body)
	}
	jsonEqual(t, body, `{"status":"ok","predictions":[
		{"placeId":"A","primaryText":"Nasi Kandar Pelita","secondaryText":"Jalan Ampang, Kuala Lumpur","distanceMeters":420},
		{"placeId":"B","primaryText":"Nasi Kandar Line Clear","secondaryText":null,"distanceMeters":null},
		{"placeId":"C","primaryText":"C","secondaryText":null,"distanceMeters":null},
		{"placeId":"D","primaryText":"D","secondaryText":null,"distanceMeters":null},
		{"placeId":"E","primaryText":"E","secondaryText":null,"distanceMeters":null}]}`)

	got := google.requests[0]
	if got.method != http.MethodPost || got.path != "/v1/places:autocomplete" {
		t.Fatalf("called %s %s", got.method, got.path)
	}
	if got.header.Get("X-Goog-Api-Key") != "server-key" {
		t.Fatalf("api key header %q", got.header.Get("X-Goog-Api-Key"))
	}
	sent, _ := json.Marshal(got.body)
	jsonEqual(t, string(sent), `{"input":"nasi kandar","sessionToken":"tok-1","includedRegionCodes":["my"],"languageCode":"en",
		"locationBias":{"circle":{"center":{"latitude":3.13,"longitude":101.67},"radius":5000}},
		"origin":{"latitude":3.13,"longitude":101.67}}`)
}

func TestAutocompleteWithoutBiasOrTokenOmitsThem(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: `{}`}
	h := newServer(t, google, 10, 10, time.Now)

	code, body := post(t, h, "/v1/places/autocomplete", `{"input":"zus","sessionToken":null,"bias":null}`)

	if code != http.StatusOK {
		t.Fatalf("status %d: %s", code, body)
	}
	jsonEqual(t, body, `{"status":"ok","predictions":[]}`)
	sent, _ := json.Marshal(google.requests[0].body)
	jsonEqual(t, string(sent), `{"input":"zus","includedRegionCodes":["my"],"languageCode":"en"}`)
}

func TestDetailsRequestsOnlyEssentialsFields(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: `{"id":"ChIJabc","location":{"latitude":3.15,"longitude":101.71},"formattedAddress":"Jalan Ampang, 50450 Kuala Lumpur"}`}
	h := newServer(t, google, 10, 10, time.Now)

	code, body := post(t, h, "/v1/places/details", `{"placeId":"ChIJabc","sessionToken":"tok-1"}`)

	if code != http.StatusOK {
		t.Fatalf("status %d: %s", code, body)
	}
	jsonEqual(t, body, `{"status":"ok","place":{"placeId":"ChIJabc","latitude":3.15,"longitude":101.71,"address":"Jalan Ampang, 50450 Kuala Lumpur"}}`)
	got := google.requests[0]
	if got.method != http.MethodGet || got.path != "/v1/places/ChIJabc" || got.query != "sessionToken=tok-1" {
		t.Fatalf("called %s %s?%s", got.method, got.path, got.query)
	}
	if got.header.Get("X-Goog-FieldMask") != "id,location,formattedAddress" || got.header.Get("X-Goog-Api-Key") != "server-key" {
		t.Fatalf("headers %v", got.header)
	}
}

func TestDetailsWithoutTokenOrAddress(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: `{"id":"ChIJabc","location":{"latitude":3.15,"longitude":101.71}}`}
	h := newServer(t, google, 10, 10, time.Now)

	_, body := post(t, h, "/v1/places/details", `{"placeId":"ChIJabc","sessionToken":null}`)

	jsonEqual(t, body, `{"status":"ok","place":{"placeId":"ChIJabc","latitude":3.15,"longitude":101.71,"address":null}}`)
	if google.requests[0].query != "" {
		t.Fatalf("sent query %q without a session token", google.requests[0].query)
	}
}

func TestDetailsBadPlaceIDIsNotFound(t *testing.T) {
	for _, status := range []int{http.StatusNotFound, http.StatusBadRequest} {
		google := &fakeGoogle{status: status, body: `{"error":{"code":400,"status":"INVALID_ARGUMENT"}}`}
		h := newServer(t, google, 10, 10, time.Now)

		code, body := post(t, h, "/v1/places/details", `{"placeId":"nope/../x"}`)

		if code != http.StatusOK {
			t.Fatalf("google %d: status %d", status, code)
		}
		jsonEqual(t, body, `{"status":"not_found"}`)
		if google.requests[0].path != "/v1/places/nope%2F..%2Fx" {
			t.Fatalf("place id not escaped: %s", google.requests[0].path)
		}
	}
}

func TestGoogleFailuresAreUnavailable(t *testing.T) {
	google := &fakeGoogle{status: http.StatusInternalServerError, body: `{"error":{"code":500}}`}
	h := newServer(t, google, 10, 10, time.Now)

	for path, body := range map[string]string{
		"/v1/places/autocomplete": `{"input":"nasi kandar"}`,
		"/v1/places/details":      `{"placeId":"ChIJabc"}`,
	} {
		code, got := post(t, h, path, body)
		if code != http.StatusOK {
			t.Fatalf("%s: status %d", path, code)
		}
		jsonEqual(t, got, `{"status":"unavailable"}`)
	}
}

func TestAutocompleteBadRequestFromGoogleIsUnavailable(t *testing.T) {
	google := &fakeGoogle{status: http.StatusBadRequest, body: `{}`}
	h := newServer(t, google, 10, 10, time.Now)

	_, body := post(t, h, "/v1/places/autocomplete", `{"input":"nasi kandar"}`)

	jsonEqual(t, body, `{"status":"unavailable"}`)
}

func TestMissingKeyIsUnavailable(t *testing.T) {
	h := newServer(t, nil, 10, 10, time.Now)

	_, autocomplete := post(t, h, "/v1/places/autocomplete", `{"input":"nasi kandar"}`)
	_, details := post(t, h, "/v1/places/details", `{"placeId":"ChIJabc"}`)

	jsonEqual(t, autocomplete, `{"status":"unavailable"}`)
	jsonEqual(t, details, `{"status":"unavailable"}`)
}

func TestDailyCapPerEndpointResetsAtPacificMidnight(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: `{"id":"A","location":{"latitude":1,"longitude":2}}`}
	// 07:59 UTC on 12 Nov is 23:59 on 11 Nov in Los Angeles (PST, UTC-8).
	now := time.Date(2026, 11, 12, 7, 59, 0, 0, time.UTC)
	h := newServer(t, google, 2, 10, func() time.Time { return now })

	statuses := func(path, body string, n int) []string {
		out := make([]string, n)
		for i := range out {
			_, got := post(t, h, path, body)
			out[i] = status(t, got)
		}
		return out
	}
	details := `{"placeId":"A"}`
	if got := statuses("/v1/places/details", details, 3); got[0] != "ok" || got[1] != "ok" || got[2] != "unavailable" {
		t.Fatalf("before reset: %v", got)
	}
	if len(google.requests) != 2 {
		t.Fatalf("google called %d times, want 2", len(google.requests))
	}
	google.body = `{}`
	if got := statuses("/v1/places/autocomplete", `{"input":"ab"}`, 1); got[0] != "ok" {
		t.Fatalf("autocomplete shares the details cap: %v", got)
	}

	google.body = `{"id":"A","location":{"latitude":1,"longitude":2}}`
	now = now.Add(time.Minute)
	if got := statuses("/v1/places/details", details, 1); got[0] != "ok" {
		t.Fatalf("after Pacific midnight: %v", got)
	}
}

func TestUserDailyAllowanceLeavesTheGlobalCapToOthersAndResetsAtPacificMidnight(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: `{"id":"A","location":{"latitude":1,"longitude":2}}`}
	// 07:59 UTC on 12 Nov is 23:59 on 11 Nov in Los Angeles (PST, UTC-8).
	now := time.Date(2026, 11, 12, 7, 59, 0, 0, time.UTC)
	h := newServer(t, google, 3, 2, func() time.Time { return now })
	details := func(user string) string {
		_, body := postAs(t, h, user, "/v1/places/details", `{"placeId":"A"}`)
		return status(t, body)
	}

	if got := [3]string{details("alice"), details("alice"), details("alice")}; got != [3]string{"ok", "ok", "unavailable"} {
		t.Fatalf("alice: %v", got)
	}
	// The global cap is 3: had alice's refused call counted, bob would get unavailable here.
	if got := details("bob"); got != "ok" {
		t.Fatalf("bob after alice's allowance: %s", got)
	}
	if got := details("carol"); got != "unavailable" {
		t.Fatalf("carol after the global cap: %s", got)
	}
	if len(google.requests) != 3 {
		t.Fatalf("google called %d times, want 3", len(google.requests))
	}
	google.body = `{}`
	if _, body := postAs(t, h, "alice", "/v1/places/autocomplete", `{"input":"ab"}`); status(t, body) != "ok" {
		t.Fatalf("alice's autocomplete shares her details allowance: %s", body)
	}

	google.body = `{"id":"A","location":{"latitude":1,"longitude":2}}`
	now = now.Add(time.Minute)
	if got := [3]string{details("alice"), details("alice"), details("alice")}; got != [3]string{"ok", "ok", "unavailable"} {
		t.Fatalf("alice after Pacific midnight: %v", got)
	}
}

func TestInvalidBodiesAre400(t *testing.T) {
	google := &fakeGoogle{status: http.StatusOK, body: `{}`}
	h := newServer(t, google, 10, 10, time.Now)
	long := string(bytes.Repeat([]byte("a"), 101))
	cases := []struct{ path, body string }{
		{"/v1/places/autocomplete", `{}`},
		{"/v1/places/autocomplete", `{"input":`},
		{"/v1/places/autocomplete", `{"input":" a "}`},
		{"/v1/places/autocomplete", `{"input":"` + long + `"}`},
		{"/v1/places/autocomplete", `{"input":"nasi","sessionToken":"` + long + `"}`},
		{"/v1/places/autocomplete", `{"input":"nasi","bias":{"latitude":91,"longitude":0}}`},
		{"/v1/places/details", `{}`},
		{"/v1/places/details", `{"placeId":""}`},
		{"/v1/places/details", `{"placeId":"` + string(bytes.Repeat([]byte("a"), 301)) + `"}`},
		{"/v1/places/details", `{"placeId":"A","sessionToken":"` + long + `"}`},
	}
	for _, tc := range cases {
		code, body := post(t, h, tc.path, tc.body)
		var res struct{ Error string }
		json.Unmarshal([]byte(body), &res)
		if code != http.StatusBadRequest || res.Error == "" {
			t.Errorf("%s %s: got %d %s", tc.path, tc.body, code, body)
		}
	}
	if len(google.requests) != 0 {
		t.Fatalf("invalid bodies reached Google: %d", len(google.requests))
	}
}
