package auth

import (
	"net"
	"net/http"
	"strings"
)

// ClientIP returns the rightmost X-Forwarded-For entry, which Cloud Run's front
// end appends; entries to its left are client-supplied and ignored.
func ClientIP(r *http.Request) string {
	if xff := strings.Join(r.Header.Values("X-Forwarded-For"), ","); xff != "" {
		last := xff[strings.LastIndexByte(xff, ',')+1:]
		if ip := net.ParseIP(strings.TrimSpace(last)); ip != nil {
			return ip.String()
		}
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}
