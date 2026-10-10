package auth

import (
	"net/http/httptest"
	"testing"
)

func TestClientIP(t *testing.T) {
	cases := []struct {
		name string
		xff  []string
		want string
	}{
		{"no header uses remote addr", nil, "192.0.2.1"},
		{"single entry", []string{"203.0.113.7"}, "203.0.113.7"},
		{"spoofed leftmost entries ignored", []string{"1.1.1.1, 2.2.2.2, 203.0.113.7"}, "203.0.113.7"},
		{"spaces trimmed", []string{"1.1.1.1 ,  203.0.113.7 "}, "203.0.113.7"},
		{"multiple header lines use the last", []string{"1.1.1.1", "9.9.9.9, 203.0.113.7"}, "203.0.113.7"},
		{"ipv6", []string{"1.1.1.1, 2001:db8::1"}, "2001:db8::1"},
		{"garbage rightmost falls back", []string{"203.0.113.7, nope"}, "192.0.2.1"},
		{"empty rightmost falls back", []string{"203.0.113.7,"}, "192.0.2.1"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/", nil)
			for _, v := range tc.xff {
				req.Header.Add("X-Forwarded-For", v)
			}
			if got := ClientIP(req); got != tc.want {
				t.Fatalf("got %q, want %q", got, tc.want)
			}
		})
	}
}
