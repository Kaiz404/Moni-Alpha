// Package llm is a minimal client for OpenRouter's OpenAI-compatible chat
// completions API with JSON-mode output and 429 handling.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kaiz404/moni/backend/internal/tracing"
)

type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
	// model and reasoningEffort replace every call's model and turn reasoning on at that effort.
	// Only the eval server sets them, to compare models on the eval suites.
	model           string
	reasoningEffort string
}

// WithModel returns a client that sends every call to model, with reasoning at effort when it is
// not empty (some models refuse reasoning off). For the eval server only.
func (c *Client) WithModel(model, effort string) *Client {
	out := *c
	out.model, out.reasoningEffort = model, effort
	return &out
}

func NewClient(apiKey, baseURL string) *Client {
	return &Client{
		apiKey:  apiKey,
		baseURL: strings.TrimRight(baseURL, "/"),
		http:    &http.Client{Timeout: 60 * time.Second},
	}
}

// Message content parts for multimodal (vision) requests.
type ContentPart struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

type ImageURL struct {
	URL string `json:"url"`
}

// Message is a chat message. Content must be a string for text-only
// requests or []ContentPart for multimodal requests.
type Message struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type ChatRequest struct {
	Model          string    `json:"model"`
	Messages       []Message `json:"messages"`
	Temperature    float64   `json:"temperature"`
	MaxTokens      int       `json:"max_tokens,omitempty"`
	ResponseFormat *struct {
		Type string `json:"type"`
	} `json:"response_format,omitempty"`
	// Reasoning is off: even low effort spent the whole token budget before the JSON in the benchmark.
	Reasoning struct {
		Enabled *bool  `json:"enabled,omitempty"`
		Effort  string `json:"effort,omitempty"`
	} `json:"reasoning"`
	// RequireParameters keeps requests off upstream hosts that would silently ignore JSON mode. ZDR
	// and DataCollection "deny" keep bank alerts, receipts and chat off hosts that store or train
	// on prompts.
	Provider struct {
		RequireParameters bool   `json:"require_parameters"`
		ZDR               bool   `json:"zdr"`
		DataCollection    string `json:"data_collection"`
	} `json:"provider"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		FinishReason string `json:"finish_reason"`
	} `json:"choices"`
	Usage struct {
		PromptTokens     int      `json:"prompt_tokens"`
		CompletionTokens int      `json:"completion_tokens"`
		Cost             *float64 `json:"cost"`
	} `json:"usage"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// ErrTruncated means the model hit max_tokens before finishing its answer.
var ErrTruncated = errors.New("llm: output truncated at max_tokens")

// RateLimitedError signals a 429 with the suggested wait.
type RateLimitedError struct {
	RetryAfter time.Duration
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("llm rate limited, retry after %s", e.RetryAfter)
}

type Options struct {
	// Name labels the call in traces by what it does, e.g. "read-receipt".
	Name        string
	Model       string
	Temperature float64
	MaxTokens   int
	// JSONMode asks for a JSON object response.
	JSONMode bool
	// MaxRetryWait caps how long a single 429 retry may wait; 0 disables
	// the retry entirely (fail fast for latency-sensitive flows).
	MaxRetryWait time.Duration
}

// Complete runs one chat completion and returns the raw text content. Output cut
// off at max_tokens is retried once with double the budget.
func (c *Client) Complete(ctx context.Context, messages []Message, opts Options) (string, error) {
	content, err := c.completeWithRateLimitRetry(ctx, messages, opts)
	if errors.Is(err, ErrTruncated) && opts.MaxTokens > 0 {
		opts.MaxTokens *= 2
		return c.completeWithRateLimitRetry(ctx, messages, opts)
	}
	return content, err
}

func (c *Client) completeWithRateLimitRetry(ctx context.Context, messages []Message, opts Options) (string, error) {
	content, err := c.completeOnce(ctx, messages, opts)
	if err == nil {
		return content, nil
	}
	var rle *RateLimitedError
	if ok := asRateLimited(err, &rle); ok && opts.MaxRetryWait > 0 && rle.RetryAfter <= opts.MaxRetryWait {
		select {
		case <-time.After(rle.RetryAfter):
		case <-ctx.Done():
			return "", ctx.Err()
		}
		return c.completeOnce(ctx, messages, opts)
	}
	return "", err
}

func asRateLimited(err error, target **RateLimitedError) bool {
	if e, ok := err.(*RateLimitedError); ok {
		*target = e
		return true
	}
	return false
}

// completeOnce makes one request, traced as one Langfuse generation.
func (c *Client) completeOnce(ctx context.Context, messages []Message, opts Options) (string, error) {
	params := map[string]any{"temperature": opts.Temperature, "max_tokens": opts.MaxTokens, "json_mode": opts.JSONMode}
	model := opts.Model
	if c.model != "" {
		model = c.model
	}
	gen := tracing.StartGeneration(ctx, opts.Name, model, params, messages)
	content, usage, err := c.send(ctx, messages, opts)
	var rle *RateLimitedError
	gen.End(content, usage, err, errors.Is(err, ErrTruncated) || asRateLimited(err, &rle))
	if err != nil {
		return "", err
	}
	return content, nil
}

func (c *Client) send(ctx context.Context, messages []Message, opts Options) (string, tracing.Usage, error) {
	var usage tracing.Usage
	reqBody := ChatRequest{
		Model:       opts.Model,
		Messages:    messages,
		Temperature: opts.Temperature,
		MaxTokens:   opts.MaxTokens,
	}
	if c.model != "" {
		reqBody.Model = c.model
	}
	if c.reasoningEffort != "" {
		reqBody.Reasoning.Effort = c.reasoningEffort
	} else {
		off := false
		reqBody.Reasoning.Enabled = &off
	}
	reqBody.Provider.RequireParameters = true
	reqBody.Provider.ZDR = true
	reqBody.Provider.DataCollection = "deny"
	if opts.JSONMode {
		reqBody.ResponseFormat = &struct {
			Type string `json:"type"`
		}{Type: "json_object"}
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", usage, err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", usage, err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	res, err := c.http.Do(req)
	if err != nil {
		return "", usage, err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", usage, err
	}

	if res.StatusCode == http.StatusTooManyRequests {
		wait := 10 * time.Second
		if s := res.Header.Get("retry-after"); s != "" {
			if secs, err := strconv.Atoi(s); err == nil {
				wait = time.Duration(secs) * time.Second
			}
		}
		return "", usage, &RateLimitedError{RetryAfter: wait}
	}
	if res.StatusCode != http.StatusOK {
		var parsed chatResponse
		if json.Unmarshal(body, &parsed) == nil && parsed.Error != nil {
			return "", usage, fmt.Errorf("llm %d: %s", res.StatusCode, parsed.Error.Message)
		}
		return "", usage, fmt.Errorf("llm %d: %s", res.StatusCode, truncate(string(body), 200))
	}

	var parsed chatResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", usage, fmt.Errorf("llm: invalid response body: %w", err)
	}
	usage = tracing.Usage{InputTokens: parsed.Usage.PromptTokens, OutputTokens: parsed.Usage.CompletionTokens, Cost: parsed.Usage.Cost}
	if len(parsed.Choices) == 0 {
		return "", usage, fmt.Errorf("llm: empty choices")
	}
	if parsed.Choices[0].FinishReason == "length" {
		return parsed.Choices[0].Message.Content, usage, ErrTruncated
	}
	return parsed.Choices[0].Message.Content, usage, nil
}

// CompleteJSON runs a completion in JSON mode and unmarshals the result
// into out. Strips markdown fences if the model added them anyway.
func (c *Client) CompleteJSON(ctx context.Context, messages []Message, opts Options, out any) error {
	opts.JSONMode = true
	content, err := c.Complete(ctx, messages, opts)
	if err != nil {
		return err
	}
	cleaned := ExtractJSON(content)
	if err := json.Unmarshal([]byte(cleaned), out); err != nil {
		return fmt.Errorf("llm: model returned invalid JSON: %w", err)
	}
	return nil
}

// ExtractJSON pulls the first JSON object out of model output, tolerating
// markdown fences and stray prose.
func ExtractJSON(s string) string {
	s = strings.TrimSpace(s)
	if fenced, ok := strings.CutPrefix(s, "```json"); ok {
		s = fenced
	} else if fenced, ok := strings.CutPrefix(s, "```"); ok {
		s = fenced
	}
	s = strings.TrimSuffix(strings.TrimSpace(s), "```")
	start := strings.IndexByte(s, '{')
	end := strings.LastIndexByte(s, '}')
	if start >= 0 && end > start {
		return s[start : end+1]
	}
	return s
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
