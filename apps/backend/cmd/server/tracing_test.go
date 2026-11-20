package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/sdk/trace/tracetest"

	"github.com/kaiz404/moni/backend/internal/llm"
	"github.com/kaiz404/moni/backend/internal/tracing"
)

func recordSpans(t *testing.T, capture bool) *tracetest.InMemoryExporter {
	t.Helper()
	exporter := tracetest.NewInMemoryExporter()
	provider := tracing.Install(tracing.Config{Environment: "test", Release: "rev-7", CaptureContent: capture}, sdktrace.WithSyncer(exporter))
	t.Cleanup(func() {
		provider.Shutdown(context.Background())
		tracing.Reset()
	})
	return exporter
}

func attrs(span tracetest.SpanStub) map[string]string {
	out := map[string]string{}
	for _, kv := range span.Attributes {
		out[string(kv.Key)] = kv.Value.Emit()
	}
	return out
}

func spanNamed(t *testing.T, spans tracetest.SpanStubs, name string) tracetest.SpanStub {
	t.Helper()
	for _, s := range spans {
		if s.Name == name {
			return s
		}
	}
	t.Fatalf("no span %q among %d spans", name, len(spans))
	return tracetest.SpanStub{}
}

func TestExtractTextIsTracedAsOneTraceWithAGeneration(t *testing.T) {
	exporter := recordSpans(t, true)
	s := newTestServer(t, nil, ok(`{"amount": 12.5, "type": "expense", "merchant": "Grab"}`))

	code, header, _ := s.call(t, http.MethodPost, "/v1/extract/text", s.token("user-1"),
		map[string]any{"text": "grab 12.50", "wallets": wallets})
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}

	spans := exporter.GetSpans()
	root := spanNamed(t, spans, "extract-text")
	gen := spanNamed(t, spans, "extract-transaction")
	if got := header.Get("X-Trace-Id"); got != root.SpanContext.TraceID().String() {
		t.Errorf("X-Trace-Id %q, want the trace id %s", got, root.SpanContext.TraceID())
	}
	if gen.Parent.SpanID() != root.SpanContext.SpanID() {
		t.Errorf("generation is not nested under the request span")
	}

	r := attrs(root)
	for key, want := range map[string]string{
		"user.id":                        "user-1",
		"langfuse.environment":           "test",
		"langfuse.release":               "rev-7",
		"langfuse.trace.metadata.status": "ok",
	} {
		if r[key] != want {
			t.Errorf("root %s = %q, want %q", key, r[key], want)
		}
	}
	if !strings.Contains(r["langfuse.observation.input"], "grab 12.50") || !strings.Contains(r["langfuse.observation.output"], `"merchant":"Grab"`) {
		t.Errorf("root input/output = %q / %q", r["langfuse.observation.input"], r["langfuse.observation.output"])
	}

	g := attrs(gen)
	for key, want := range map[string]string{
		"langfuse.observation.type":          "generation",
		"langfuse.observation.model.name":    llm.Model,
		"langfuse.observation.usage_details": `{"input":120,"output":30}`,
		"langfuse.observation.cost_details":  `{"total":0.0002}`,
		"user.id":                            "user-1",
		"langfuse.environment":               "test",
	} {
		if g[key] != want {
			t.Errorf("generation %s = %q, want %q", key, g[key], want)
		}
	}
	if !strings.Contains(g["langfuse.observation.input"], "grab 12.50") {
		t.Errorf("generation input misses the user's text: %q", g["langfuse.observation.input"])
	}
}

func TestReceiptImageNeverReachesATraceAsBase64(t *testing.T) {
	exporter := recordSpans(t, true)
	s := newTestServer(t, nil, ok(`{"amount": 8.5, "type": "expense"}`))
	// Line breaks in the base64 change how it reads once JSON-encoded; it must still be replaced.
	const image = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk\n+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

	code, _, _ := s.call(t, http.MethodPost, "/v1/extract/image", s.token("user-1"),
		map[string]any{"imageBase64": image, "wallets": wallets})
	if code != http.StatusOK {
		t.Fatalf("status %d", code)
	}

	for _, span := range exporter.GetSpans() {
		input := attrs(span)["langfuse.observation.input"]
		if strings.Contains(input, "Jggg") {
			t.Errorf("span %s carries the raw image", span.Name)
		}
		if !strings.Contains(input, "[image not uploaded to Langfuse]") {
			t.Errorf("span %s input lost the image's place: %q", span.Name, input)
		}
	}
}

func TestTracesLeaveContentOutWhenCaptureIsOff(t *testing.T) {
	exporter := recordSpans(t, false)
	s := newTestServer(t, nil, ok(`{"is_transaction": false, "reasoning": "Promo from Shopee"}`))

	s.post(t, "/v1/extract/notification", map[string]any{
		"notification": map[string]any{"packageName": "com.shopee.my", "title": "Sale", "text": "50% off today"},
		"wallets":      wallets,
	})

	spans := exporter.GetSpans()
	root := attrs(spanNamed(t, spans, "extract-notification"))
	if root["langfuse.trace.metadata.status"] != "skipped" || root["langfuse.trace.metadata.app"] != "com.shopee.my" {
		t.Errorf("root metadata = %v", root)
	}
	for _, span := range spans {
		a := attrs(span)
		for _, key := range []string{"langfuse.observation.input", "langfuse.observation.output", "langfuse.trace.metadata.reason"} {
			if a[key] != "" {
				t.Errorf("span %s sent %s with capture off: %q", span.Name, key, a[key])
			}
		}
	}
}

func TestFailedModelCallsAreTracedAsErrors(t *testing.T) {
	exporter := recordSpans(t, true)
	s := newTestServer(t, nil, llmReply{http.StatusBadGateway, "upstream down"}, llmReply{http.StatusBadGateway, "upstream down"})

	_, res := s.post(t, "/v1/extract/text", map[string]any{"text": "coffee 5", "wallets": wallets})
	if res["status"] != "unavailable" {
		t.Fatalf("status %v", res["status"])
	}

	spans := exporter.GetSpans()
	if root := attrs(spanNamed(t, spans, "extract-text")); root["langfuse.observation.level"] != "ERROR" {
		t.Errorf("root level %q, want ERROR", root["langfuse.observation.level"])
	}
	generations := 0
	for _, span := range spans {
		if span.Name == "extract-transaction" {
			generations++
			if a := attrs(span); a["langfuse.observation.level"] != "ERROR" || !strings.Contains(a["langfuse.observation.status_message"], "upstream down") {
				t.Errorf("generation level/message = %q / %q", a["langfuse.observation.level"], a["langfuse.observation.status_message"])
			}
		}
	}
	if generations != 2 {
		t.Errorf("%d generations, want one per attempt (2)", generations)
	}
}

func TestTraceparentJoinsTheCallersTraceOnlyWhenAccepted(t *testing.T) {
	const parent = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
	for _, accept := range []bool{true, false} {
		exporter := tracetest.NewInMemoryExporter()
		provider := tracing.Install(tracing.Config{AcceptTraceparent: accept}, sdktrace.WithSyncer(exporter))
		s := newTestServer(t, nil, ok(`{"amount": 3, "type": "expense"}`))
		req := httptest.NewRequest(http.MethodPost, "/v1/extract/text", strings.NewReader(`{"text":"tea 3"}`))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+s.token("user-1"))
		req.Header.Set("traceparent", parent)
		s.handler.ServeHTTP(httptest.NewRecorder(), req)

		root := spanNamed(t, exporter.GetSpans(), "extract-text")
		joined := root.SpanContext.TraceID().String() == "4bf92f3577b34da6a3ce929d0e0e4736"
		if joined != accept {
			t.Errorf("accept=%t: joined caller's trace = %t", accept, joined)
		}
		provider.Shutdown(context.Background())
		tracing.Reset()
	}
}
