package tracing

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"go.opentelemetry.io/otel/trace"
)

// Langfuse renders these types inline; anything else stays out of the trace.
var mediaTypes = map[string]bool{"image/jpeg": true, "image/png": true, "image/webp": true, "image/gif": true}

const mediaPlaceholder = "[image not uploaded to Langfuse]"

// mediaWait bounds how long a trace waits for its image upload. The upload runs while
// the model reads the receipt, so it is normally done first.
const mediaWait = 5 * time.Second

type mediaUploader struct {
	baseURL string
	auth    string
	http    *http.Client
}

type pendingMedia struct {
	dataURI string
	// escaped is dataURI as it appears inside JSON, which differs when the base64 has line breaks.
	escaped string
	done    chan struct{}
	token   string
}

type mediaKey struct{}

// WithMedia uploads a base64 data URI to Langfuse in the background. Inputs and outputs
// recorded under the returned context carry a Langfuse media token in its place, so the
// UI shows the image and the trace stays small.
func WithMedia(ctx context.Context, dataURI string) context.Context {
	if !captureContent || !strings.HasPrefix(dataURI, "data:") {
		return ctx
	}
	quoted, _ := json.Marshal(dataURI)
	p := &pendingMedia{dataURI: dataURI, escaped: string(quoted[1 : len(quoted)-1]), done: make(chan struct{}), token: mediaPlaceholder}
	traceID := trace.SpanFromContext(ctx).SpanContext().TraceID().String()
	uploader := media
	go func() {
		defer close(p.done)
		if uploader == nil {
			return
		}
		token, err := uploader.upload(traceID, dataURI)
		if err != nil {
			log.Printf("tracing: receipt image upload failed: %v", err)
			return
		}
		p.token = token
	}()
	return context.WithValue(ctx, mediaKey{}, p)
}

func replaceMedia(ctx context.Context, s string) string {
	p, _ := ctx.Value(mediaKey{}).(*pendingMedia)
	if p == nil || !strings.Contains(s, p.dataURI) && !strings.Contains(s, p.escaped) {
		return s
	}
	token := mediaPlaceholder
	select {
	case <-p.done:
		token = p.token
	case <-time.After(mediaWait):
	}
	return strings.NewReplacer(p.dataURI, token, p.escaped, token).Replace(s)
}

// upload follows Langfuse's media API: register the file, PUT it to the returned URL
// (absent when Langfuse already holds the same bytes), then report the upload result.
func (m *mediaUploader) upload(traceID, dataURI string) (string, error) {
	header, encoded, ok := strings.Cut(strings.TrimPrefix(dataURI, "data:"), ",")
	contentType, isBase64 := strings.CutSuffix(header, ";base64")
	if !ok || !isBase64 || !mediaTypes[contentType] {
		return "", fmt.Errorf("tracing: unsupported data URI %q", header)
	}
	data, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	hash := base64.StdEncoding.EncodeToString(sum[:])

	var created struct {
		MediaID   string `json:"mediaId"`
		UploadURL string `json:"uploadUrl"`
	}
	err = m.api(http.MethodPost, "/api/public/media", map[string]any{
		"traceId":       traceID,
		"contentType":   contentType,
		"contentLength": len(data),
		"sha256Hash":    hash,
		"field":         "input",
	}, &created)
	if err != nil {
		return "", err
	}
	if created.UploadURL != "" {
		req, err := http.NewRequest(http.MethodPut, created.UploadURL, bytes.NewReader(data))
		if err != nil {
			return "", err
		}
		req.Header.Set("Content-Type", contentType)
		req.Header.Set("x-amz-checksum-sha256", hash)
		res, err := m.http.Do(req)
		if err != nil {
			return "", err
		}
		res.Body.Close()
		status := map[string]any{"uploadedAt": time.Now().UTC().Format(time.RFC3339Nano), "uploadHttpStatus": res.StatusCode}
		if res.StatusCode != http.StatusOK {
			status["uploadHttpError"] = res.Status
		}
		if err := m.api(http.MethodPatch, "/api/public/media/"+created.MediaID, status, nil); err != nil {
			return "", err
		}
		if res.StatusCode != http.StatusOK {
			return "", fmt.Errorf("tracing: media upload %s", res.Status)
		}
	}
	return fmt.Sprintf("@@@langfuseMedia:type=%s|id=%s|source=base64_data_uri@@@", contentType, created.MediaID), nil
}

func (m *mediaUploader) api(method, path string, body, out any) error {
	payload, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequest(method, m.baseURL+path, bytes.NewReader(payload))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", m.auth)
	req.Header.Set("Content-Type", "application/json")
	res, err := m.http.Do(req)
	if err != nil {
		return err
	}
	defer res.Body.Close()
	if res.StatusCode >= 300 {
		return fmt.Errorf("tracing: %s %s: %s", method, path, res.Status)
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(res.Body).Decode(out)
}
