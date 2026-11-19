// Package tracing sends one Langfuse trace per AI request over OpenTelemetry, with a
// generation per model call. Without Langfuse keys it records nothing.
package tracing

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	"go.opentelemetry.io/otel/trace"
	"go.opentelemetry.io/otel/trace/noop"
)

type Config struct {
	PublicKey string
	SecretKey string
	BaseURL   string
	// Environment separates production traces from dev, e2e and eval ones.
	Environment string
	// Release names the deployed build, e.g. the Cloud Run revision.
	Release string
	// CaptureContent sends request and model text, receipt images included. Off, traces keep
	// only names, timings, tokens, status and errors.
	CaptureContent bool
}

func (c Config) Enabled() bool { return c.PublicKey != "" && c.SecretKey != "" }

var (
	tracer         trace.Tracer = noop.NewTracerProvider().Tracer("")
	captureContent bool
	media          *mediaUploader
)

// Setup installs the Langfuse exporter. The returned shutdown flushes buffered spans.
func Setup(ctx context.Context, cfg Config) (func(context.Context) error, error) {
	if !cfg.Enabled() {
		log.Printf("tracing: LANGFUSE_PUBLIC_KEY or LANGFUSE_SECRET_KEY is not set, AI requests are not traced")
		return func(context.Context) error { return nil }, nil
	}
	base := strings.TrimRight(cfg.BaseURL, "/")
	auth := "Basic " + base64.StdEncoding.EncodeToString([]byte(cfg.PublicKey+":"+cfg.SecretKey))
	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpointURL(base+"/api/public/otel/v1/traces"),
		// Version 4 makes spans show up in real time instead of up to 10 minutes later.
		otlptracehttp.WithHeaders(map[string]string{"Authorization": auth, "x-langfuse-ingestion-version": "4"}),
	)
	if err != nil {
		return nil, err
	}
	provider := Install(cfg, sdktrace.WithBatcher(exporter, sdktrace.WithBatchTimeout(2*time.Second)))
	if cfg.CaptureContent {
		media = &mediaUploader{baseURL: base, auth: auth, http: &http.Client{Timeout: 15 * time.Second}}
	}
	log.Printf("tracing: sending AI traces to %s (environment %s, content %t)", base, cfg.Environment, cfg.CaptureContent)
	return provider.Shutdown, nil
}

// Reset turns tracing off again, as when no keys are set.
func Reset() {
	tracer = noop.NewTracerProvider().Tracer("")
	captureContent = false
	media = nil
}

// Install points the package at a provider built from opts. Tests pass an in-memory exporter.
func Install(cfg Config, opts ...sdktrace.TracerProviderOption) *sdktrace.TracerProvider {
	common := []attribute.KeyValue{attribute.String("langfuse.environment", cfg.Environment)}
	if cfg.Release != "" {
		common = append(common, attribute.String("langfuse.release", cfg.Release))
	}
	opts = append(opts,
		sdktrace.WithResource(resource.NewSchemaless(attribute.String("service.name", "moni-backend"))),
		sdktrace.WithSpanProcessor(traceAttributes{common}),
	)
	provider := sdktrace.NewTracerProvider(opts...)
	tracer = provider.Tracer("moni-backend")
	captureContent = cfg.CaptureContent
	media = nil
	return provider
}

type userKey struct{}

// traceAttributes copies the attributes Langfuse filters on to every span, as its OTel docs ask.
type traceAttributes struct{ common []attribute.KeyValue }

func (p traceAttributes) OnStart(ctx context.Context, s sdktrace.ReadWriteSpan) {
	s.SetAttributes(p.common...)
	if user, _ := ctx.Value(userKey{}).(string); user != "" {
		s.SetAttributes(attribute.String("user.id", user))
	}
}
func (traceAttributes) OnEnd(sdktrace.ReadOnlySpan)      {}
func (traceAttributes) Shutdown(context.Context) error   { return nil }
func (traceAttributes) ForceFlush(context.Context) error { return nil }

// Middleware opens the trace for each request it wraps. names maps a route to its trace name;
// the trace id goes back in X-Trace-Id so a client can attach feedback to it.
func Middleware(names map[string]string, userID func(*gin.Context) string) gin.HandlerFunc {
	return func(c *gin.Context) {
		name, ok := names[c.FullPath()]
		if !ok {
			c.Next()
			return
		}
		ctx := context.WithValue(c.Request.Context(), userKey{}, userID(c))
		ctx, span := tracer.Start(ctx, name)
		if span.SpanContext().IsValid() {
			c.Header("X-Trace-Id", span.SpanContext().TraceID().String())
		}
		c.Request = c.Request.WithContext(ctx)
		c.Next()
		if status := c.Writer.Status(); status >= http.StatusBadRequest {
			span.SetAttributes(attribute.String("langfuse.observation.level", "WARNING"))
			span.SetStatus(codes.Error, http.StatusText(status))
		}
		span.End()
	}
}

// Record sets the request and response on the trace and files its outcome: status is the
// response status ("ok", "skipped", "unavailable") and reason why it was not "ok".
func Record(ctx context.Context, input, output any, status, reason string) {
	span := trace.SpanFromContext(ctx)
	if !span.IsRecording() {
		return
	}
	span.SetAttributes(attribute.String("langfuse.trace.metadata.status", status))
	if captureContent {
		span.SetAttributes(
			attribute.String("langfuse.observation.input", marshal(ctx, input)),
			attribute.String("langfuse.observation.output", marshal(ctx, output)),
		)
		if reason != "" {
			span.SetAttributes(attribute.String("langfuse.trace.metadata.reason", reason))
		}
	}
	if status == "unavailable" {
		span.SetAttributes(
			attribute.String("langfuse.observation.level", "ERROR"),
			attribute.String("langfuse.observation.status_message", reason),
		)
		span.SetStatus(codes.Error, reason)
	}
}

// Metadata adds filterable keys to the trace, such as the app a notification came from.
func Metadata(ctx context.Context, kv map[string]string) {
	span := trace.SpanFromContext(ctx)
	for k, v := range kv {
		span.SetAttributes(attribute.String("langfuse.trace.metadata."+k, v))
	}
}

// Usage is what the provider billed for one model call.
type Usage struct {
	InputTokens  int
	OutputTokens int
	// Cost is in USD, nil when the provider reported none.
	Cost *float64
}

// Generation is one model call inside a trace.
type Generation struct {
	ctx      context.Context
	span     trace.Span
	messages any
}

// StartGeneration opens a generation named for what the call does, never for the model.
func StartGeneration(ctx context.Context, name, model string, params map[string]any, messages any) *Generation {
	ctx, span := tracer.Start(ctx, name)
	if span.IsRecording() {
		paramsJSON, _ := json.Marshal(params)
		span.SetAttributes(
			attribute.String("langfuse.observation.type", "generation"),
			attribute.String("langfuse.observation.model.name", model),
			attribute.String("langfuse.observation.model.parameters", string(paramsJSON)),
		)
	}
	return &Generation{ctx, span, messages}
}

// End records the messages, the model's raw output, usage and failure, if any. The messages
// are set here, not at the start, so the call never waits on a receipt image upload.
func (g *Generation) End(output string, usage Usage, err error, warn bool) {
	defer g.span.End()
	if !g.span.IsRecording() {
		return
	}
	if captureContent {
		g.span.SetAttributes(attribute.String("langfuse.observation.input", marshal(g.ctx, g.messages)))
		if output != "" {
			g.span.SetAttributes(attribute.String("langfuse.observation.output", output))
		}
	}
	if usage.InputTokens > 0 || usage.OutputTokens > 0 {
		details, _ := json.Marshal(map[string]int{"input": usage.InputTokens, "output": usage.OutputTokens})
		g.span.SetAttributes(attribute.String("langfuse.observation.usage_details", string(details)))
	}
	if usage.Cost != nil {
		details, _ := json.Marshal(map[string]float64{"total": *usage.Cost})
		g.span.SetAttributes(attribute.String("langfuse.observation.cost_details", string(details)))
	}
	if err != nil {
		level := "ERROR"
		if warn {
			level = "WARNING"
		}
		g.span.SetAttributes(
			attribute.String("langfuse.observation.level", level),
			attribute.String("langfuse.observation.status_message", err.Error()),
		)
		g.span.SetStatus(codes.Error, err.Error())
	}
}

func marshal(ctx context.Context, v any) string {
	if s, ok := v.(string); ok {
		return replaceMedia(ctx, s)
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return ""
	}
	return replaceMedia(ctx, string(raw))
}
