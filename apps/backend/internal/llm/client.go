// Package llm is a minimal client for OpenRouter's OpenAI-compatible chat
// completions API with JSON-mode output and 429 handling.
package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Client struct {
	apiKey  string
	baseURL string
	http    *http.Client
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
		Enabled bool `json:"enabled"`
	} `json:"reasoning"`
	// RequireParameters keeps requests off upstream hosts that would silently ignore JSON mode.
	Provider struct {
		RequireParameters bool `json:"require_parameters"`
	} `json:"provider"`
}

type chatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error"`
}

// RateLimitedError signals a 429 with the suggested wait.
type RateLimitedError struct {
	RetryAfter time.Duration
}

func (e *RateLimitedError) Error() string {
	return fmt.Sprintf("llm rate limited, retry after %s", e.RetryAfter)
}

type Options struct {
	Model       string
	Temperature float64
	MaxTokens   int
	// JSONMode asks for a JSON object response.
	JSONMode bool
	// MaxRetryWait caps how long a single 429 retry may wait; 0 disables
	// the retry entirely (fail fast for latency-sensitive flows).
	MaxRetryWait time.Duration
}

// Complete runs one chat completion and returns the raw text content.
func (c *Client) Complete(ctx context.Context, messages []Message, opts Options) (string, error) {
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

func (c *Client) completeOnce(ctx context.Context, messages []Message, opts Options) (string, error) {
	reqBody := ChatRequest{
		Model:       opts.Model,
		Messages:    messages,
		Temperature: opts.Temperature,
		MaxTokens:   opts.MaxTokens,
	}
	reqBody.Provider.RequireParameters = true
	if opts.JSONMode {
		reqBody.ResponseFormat = &struct {
			Type string `json:"type"`
		}{Type: "json_object"}
	}

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		c.baseURL+"/chat/completions", bytes.NewReader(payload))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	res, err := c.http.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()

	body, err := io.ReadAll(io.LimitReader(res.Body, 1<<20))
	if err != nil {
		return "", err
	}

	if res.StatusCode == http.StatusTooManyRequests {
		wait := 10 * time.Second
		if s := res.Header.Get("retry-after"); s != "" {
			if secs, err := strconv.Atoi(s); err == nil {
				wait = time.Duration(secs) * time.Second
			}
		}
		return "", &RateLimitedError{RetryAfter: wait}
	}
	if res.StatusCode != http.StatusOK {
		var parsed chatResponse
		if json.Unmarshal(body, &parsed) == nil && parsed.Error != nil {
			return "", fmt.Errorf("llm %d: %s", res.StatusCode, parsed.Error.Message)
		}
		return "", fmt.Errorf("llm %d: %s", res.StatusCode, truncate(string(body), 200))
	}

	var parsed chatResponse
	if err := json.Unmarshal(body, &parsed); err != nil {
		return "", fmt.Errorf("llm: invalid response body: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", fmt.Errorf("llm: empty choices")
	}
	return parsed.Choices[0].Message.Content, nil
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
