package extract

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kaiz404/moni/backend/internal/groq"
)

// TestBenchModels runs every labelled case through the production Service once per candidate
// model and writes a markdown scorecard to bench-results/. Opt in: `pnpm --filter backend bench:llm`.
// MONI_BENCH_RUNS repeats each case (default 3); MONI_BENCH_MODELS keeps models whose id
// contains any comma-separated substring. Targets without an API key are skipped.

type benchProvider struct {
	name, baseURL, keyEnv string
	pace                  time.Duration
	rewrite               func(body map[string]any)
}

var benchGroq = &benchProvider{name: "groq", baseURL: "https://api.groq.com/openai/v1", keyEnv: "GROQ_API_KEY", pace: 2500 * time.Millisecond}

// OpenRouter takes reasoning as one object, not Groq's reasoning_effort/reasoning_format.
// require_parameters keeps requests off upstream hosts that would silently drop JSON mode.
var benchOpenRouter = &benchProvider{name: "openrouter", baseURL: "https://openrouter.ai/api/v1", keyEnv: "OPENROUTER_API_KEY",
	rewrite: func(body map[string]any) {
		reasoning := map[string]any{"effort": "low", "exclude": true}
		if body["reasoning_effort"] == "none" {
			reasoning = map[string]any{"enabled": false}
		}
		delete(body, "reasoning_effort")
		delete(body, "reasoning_format")
		body["reasoning"] = reasoning
		body["provider"] = map[string]any{"require_parameters": true}
		body["usage"] = map[string]any{"include": true}
	},
}

type benchTarget struct {
	provider *benchProvider
	model    string
	vision   bool
}

var benchTargets = []benchTarget{
	{benchGroq, "openai/gpt-oss-20b", false},
	{benchGroq, "openai/gpt-oss-120b", false},
	{benchGroq, "qwen/qwen3.8-27b", true},
	{benchOpenRouter, "qwen/qwen3.8-27b", true},
	{benchOpenRouter, "qwen/qwen3.8-flash", true},
	{benchOpenRouter, "qwen/qwen3.7-flash", true},
	{benchOpenRouter, "deepseek/deepseek-v4-flash", false},
	{benchOpenRouter, "deepseek/deepseek-v4.1-flash", true},
	{benchOpenRouter, "z-ai/glm-5.3-flash", true},
	{benchOpenRouter, "moonshotai/kimi-k2.5", true},
	{benchOpenRouter, "minimax/minimax-m3", true},
	{benchOpenRouter, "bytedance-seed/seed-2.0-mini", true},
	{benchOpenRouter, "xiaomi/mimo-v2.6-flash", true},
}

var benchWallets = []WalletContext{
	{ID: "w-maybank", Name: "Maybank", Type: strPtr("bank"), Currency: strPtr("MYR")},
	{ID: "w-tng", Name: "Touch n Go eWallet", Type: strPtr("ewallet"), Currency: strPtr("MYR")},
	{ID: "w-cash", Name: "Cash", Type: strPtr("cash"), Currency: strPtr("MYR")},
	{ID: "w-wise", Name: "Wise USD", Type: strPtr("bank"), Currency: strPtr("USD")},
}

type benchKind string

const (
	kindText         benchKind = "text"
	kindNotification benchKind = "notification"
	kindImage        benchKind = "image"
)

// A zero amount means the case must be skipped. Empty strings are not checked.
type benchWant struct {
	amount                     float64
	txType, currency, merchant string
	wallet, toWallet           string
}

type benchCase struct {
	kind benchKind
	name string
	// pkg and title are notification-only; input is the text, notification body, or image file.
	pkg, title, input string
	want              benchWant
}

const (
	pkgMaybank = "com.maybank2u.life"
	pkgTNG     = "my.com.tngdigital.ewallet"
)

var benchCases = []benchCase{
	{kindText, "cash food", "", "", "nasi lemak ayam rm8.50 paid cash", benchWant{amount: 8.5, txType: "expense", wallet: "w-cash"}},
	{kindText, "grab on tng", "", "", "Grab to KLCC 23.40 tng", benchWant{amount: 23.4, txType: "expense", merchant: "grab", wallet: "w-tng"}},
	{kindText, "salary", "", "", "got my salary 3200 in maybank", benchWant{amount: 3200, txType: "income", wallet: "w-maybank"}},
	{kindText, "atm withdrawal", "", "", "withdrew 200 from atm", benchWant{amount: 200, txType: "transfer", wallet: "w-maybank", toWallet: "w-cash"}},
	{kindText, "tng top up", "", "", "topped up tng 50 from maybank", benchWant{amount: 50, txType: "transfer", wallet: "w-maybank", toWallet: "w-tng"}},
	{kindText, "subscription", "", "", "Spotify premium 15.90 this month", benchWant{amount: 15.9, txType: "expense", merchant: "spotify"}},
	{kindText, "split bill", "", "", "mamak with friends, I paid 42 for everyone, they'll pay me back 28 later", benchWant{amount: 42, txType: "expense"}},
	{kindText, "refund", "", "", "shopee refunded me rm 59", benchWant{amount: 59, txType: "income", merchant: "shopee"}},
	{kindText, "malay groceries", "", "", "beli barang dapur kat mydin rm 87.30 guna maybank", benchWant{amount: 87.3, txType: "expense", merchant: "mydin", wallet: "w-maybank"}},
	{kindText, "multi item total", "", "", "zus coffee 2 lattes, total 19.80", benchWant{amount: 19.8, txType: "expense", merchant: "zus"}},
	{kindText, "no amount", "", "", "remember to check my credit card statement", benchWant{}},

	{kindNotification, "card purchase", pkgMaybank, "Maybank2u: Card Purchase", "You have made a purchase of RM 23.90 at FAMILYMART KLCC with your card ending 4821.", benchWant{amount: 23.9, txType: "expense", currency: "MYR", merchant: "familymart"}},
	{kindNotification, "duitnow received", pkgTNG, "You've received money!", "ALI BIN ABU has transferred RM 15.00 to you. Tap here to check the transaction details.", benchWant{amount: 15, txType: "income", currency: "MYR"}},
	{kindNotification, "tng merchant payment", pkgTNG, "Payment successful", "You have paid RM 6.50 to ZUS COFFEE SUNWAY.", benchWant{amount: 6.5, txType: "expense", currency: "MYR", merchant: "zus"}},
	{kindNotification, "duitnow sent", pkgMaybank, "DuitNow Transfer", "You have successfully transferred RM 150.00 to AHMAD BIN ALI.", benchWant{amount: 150, txType: "expense", currency: "MYR"}},
	{kindNotification, "salary credited", pkgMaybank, "Money In", "You have received RM 2,500.00 from SYARIKAT ABC SDN BHD into your account ending 1234.", benchWant{amount: 2500, txType: "income", currency: "MYR"}},
	{kindNotification, "grabfood", "com.grabtaxi.passenger", "GrabFood", "Your order from McDonald's Bangsar is on the way. RM 32.70 paid with GrabPay.", benchWant{amount: 32.7, txType: "expense", currency: "MYR", merchant: "mcdonald"}},
	{kindNotification, "refund in", "com.lazada.android", "Refund processed", "Refund of RM 25.00 for order 8829 has been credited to your Lazada Wallet.", benchWant{amount: 25, txType: "income", currency: "MYR"}},
	{kindNotification, "foreign currency", "com.transferwise.android", "Wise", "You spent 12.00 USD at AMAZON WEB SERVICES.", benchWant{amount: 12, txType: "expense", currency: "USD", merchant: "amazon"}},
	{kindNotification, "malay payment", pkgMaybank, "Maybank2u", "Anda telah membuat pembayaran RM 12.00 kepada KEDAI MAKAN ALI.", benchWant{amount: 12, txType: "expense", currency: "MYR"}},
	{kindNotification, "promotion", pkgTNG, "Weekend deal", "Enjoy 20% cashback up to RM 10 on Shopee this weekend! T&C apply.", benchWant{}},
	{kindNotification, "balance snapshot", pkgMaybank, "Balance update", "Your available balance is RM 1,204.50 as of 07 Oct.", benchWant{}},
	{kindNotification, "bill due", "com.tnb.mytnb", "Bill reminder", "Your TNB bill of RM 120.35 is due on 15 Oct. Pay now to avoid disconnection.", benchWant{}},
	{kindNotification, "failed payment", pkgTNG, "Payment failed", "Your payment of RM 45.00 to GRAB was unsuccessful. No money was deducted.", benchWant{}},
	{kindNotification, "shipping update", "com.shopee.my", "Order shipped", "Your order 220931 (RM 89.00) has been shipped and will arrive in 2 days.", benchWant{}},

	{kindImage, "familymart", "", "", "familymart.png", benchWant{amount: 12.5, txType: "expense", merchant: "familymart"}},
	{kindImage, "mamak sst and change", "", "", "mamak.png", benchWant{amount: 31.9, txType: "expense", merchant: "pelita"}},
	{kindImage, "watsons discount and points", "", "", "watsons.png", benchWant{amount: 59.04, txType: "expense", merchant: "watsons"}},
	{kindImage, "tealive service tax", "", "", "tealive.png", benchWant{amount: 24.7, txType: "expense", merchant: "tealive"}},
}

func (c benchCase) run(ctx context.Context, s *Service, images map[string]string) Result {
	switch c.kind {
	case kindText:
		return s.FromText(ctx, TextRequest{Text: c.input, Wallets: benchWallets})
	case kindNotification:
		return s.FromNotification(ctx, NotificationRequest{
			Notification: RawNotification{PackageName: c.pkg, Title: c.title, Text: c.input}, Wallets: benchWallets,
		})
	default:
		return s.FromImage(ctx, ImageRequest{ImageBase64: images[c.input], Wallets: benchWallets})
	}
}

// check returns "" on a pass, otherwise the first field that is wrong.
func (c benchCase) check(r Result) string {
	w := c.want
	switch {
	case r.Status == "unavailable":
		return "unavailable"
	case w.amount == 0 && r.Status == "skipped":
		return ""
	case w.amount == 0:
		return "should skip"
	case r.Status != "ok":
		return "missed transaction"
	}
	e := r.Extraction
	letters := func(s string) string {
		return strings.Map(func(r rune) rune {
			if r >= 'a' && r <= 'z' {
				return r
			}
			return -1
		}, strings.ToLower(s))
	}
	contains := func(got *string, want string) bool {
		return got != nil && strings.Contains(letters(*got), want)
	}
	is := func(got *string, want string) bool { return got != nil && *got == want }
	switch {
	case math.Abs(e.Amount-w.amount) > 0.005:
		return fmt.Sprintf("amount %.2f", e.Amount)
	case e.Type != w.txType:
		return "type " + e.Type
	case w.currency != "" && e.Currency != w.currency:
		return "currency " + e.Currency
	case w.merchant != "" && !contains(e.Merchant, w.merchant):
		return "merchant"
	case w.wallet != "" && !is(e.WalletID, w.wallet):
		return "wallet"
	case w.toWallet != "" && !is(e.TransferToWalletID, w.toWallet):
		return "to wallet"
	}
	return ""
}

type benchAttempt struct {
	status                   int
	latency                  time.Duration
	inTokens, outTokens      int
	cost                     float64
	finishReason, retryAfter string
}

// benchCall travels in the request context so the shared transport can tell targets apart.
type benchCall struct {
	rewrite  func(map[string]any)
	attempts []benchAttempt
}

type benchCallKey struct{}

type benchTransport struct{ base http.RoundTripper }

func (t benchTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	call, _ := req.Context().Value(benchCallKey{}).(*benchCall)
	if call == nil {
		return t.base.RoundTrip(req)
	}
	if call.rewrite != nil {
		var body map[string]any
		raw, _ := io.ReadAll(req.Body)
		if err := json.Unmarshal(raw, &body); err != nil {
			return nil, err
		}
		call.rewrite(body)
		raw, _ = json.Marshal(body)
		req.Body, req.ContentLength = io.NopCloser(bytes.NewReader(raw)), int64(len(raw))
	}
	start := time.Now()
	res, err := t.base.RoundTrip(req)
	if err != nil {
		call.attempts = append(call.attempts, benchAttempt{latency: time.Since(start)})
		return nil, err
	}
	raw, err := io.ReadAll(res.Body)
	res.Body.Close()
	res.Body = io.NopCloser(bytes.NewReader(raw))
	a := benchAttempt{status: res.StatusCode, latency: time.Since(start), retryAfter: res.Header.Get("retry-after")}
	var parsed struct {
		Choices []struct {
			FinishReason string `json:"finish_reason"`
		} `json:"choices"`
		Usage struct {
			PromptTokens     int     `json:"prompt_tokens"`
			CompletionTokens int     `json:"completion_tokens"`
			Cost             float64 `json:"cost"`
		} `json:"usage"`
	}
	if json.Unmarshal(raw, &parsed) == nil {
		a.inTokens, a.outTokens, a.cost = parsed.Usage.PromptTokens, parsed.Usage.CompletionTokens, parsed.Usage.Cost
		if len(parsed.Choices) > 0 {
			a.finishReason = parsed.Choices[0].FinishReason
		}
	}
	call.attempts = append(call.attempts, a)
	return res, nil
}

type benchOutcome struct {
	c           benchCase
	failure     string
	reason      string
	attempts    []benchAttempt // final try only; rate-limited tries are counted separately
	rateLimited int
	latency     time.Duration
}

// retries counts calls the fallback had to make because an earlier call failed for a reason other than a 429.
func (o benchOutcome) retries() (n int) {
	for i, a := range o.attempts {
		if i < len(o.attempts)-1 && a.status != http.StatusTooManyRequests {
			n++
		}
	}
	return
}

func (o benchOutcome) cost() (cost float64, outTokens int) {
	for _, a := range o.attempts {
		cost += a.cost
		outTokens += a.outTokens
	}
	return
}

// runCase retries a case whose only problem was a 429, so free-tier quotas don't count as model errors.
func runCase(ctx context.Context, s *Service, rewrite func(map[string]any), c benchCase, images map[string]string) benchOutcome {
	o := benchOutcome{c: c}
	for try := 0; ; try++ {
		call := &benchCall{rewrite: rewrite}
		res := c.run(context.WithValue(ctx, benchCallKey{}, call), s, images)
		o.attempts, o.failure, o.reason = call.attempts, c.check(res), res.Reason
		limited := slices.ContainsFunc(call.attempts, func(a benchAttempt) bool { return a.status == http.StatusTooManyRequests })
		if o.failure != "unavailable" || !limited || try == 5 {
			break
		}
		o.rateLimited++
		wait := 20 * time.Second
		if secs, err := strconv.Atoi(call.attempts[len(call.attempts)-1].retryAfter); err == nil {
			wait = time.Duration(secs+1) * time.Second
		}
		time.Sleep(wait)
	}
	for _, a := range o.attempts {
		if a.status != http.StatusTooManyRequests {
			o.latency += a.latency
		}
	}
	if o.failure == "unavailable" && len(o.attempts) > 0 {
		last := o.attempts[len(o.attempts)-1]
		switch {
		case last.finishReason == "length":
			o.failure = "unavailable: truncated"
		case last.status == http.StatusOK:
			o.failure = "unavailable: bad JSON"
		default:
			o.failure = fmt.Sprintf("unavailable: HTTP %d", last.status)
		}
	}
	return o
}

func TestBenchModels(t *testing.T) {
	if os.Getenv("MONI_BENCH") != "1" {
		t.Skip("set MONI_BENCH=1 to benchmark candidate models against live providers")
	}
	runs := 3
	if n, err := strconv.Atoi(os.Getenv("MONI_BENCH_RUNS")); err == nil && n > 0 {
		runs = n
	}
	var filters []string
	if f := os.Getenv("MONI_BENCH_MODELS"); f != "" {
		filters = strings.Split(f, ",")
	}

	images := map[string]string{}
	for _, c := range benchCases {
		if c.kind == kindImage {
			png, err := os.ReadFile(filepath.Join("testdata", "bench", c.input))
			if err != nil {
				t.Fatal(err)
			}
			images[c.input] = "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
		}
	}

	orig := http.DefaultTransport
	http.DefaultTransport = benchTransport{base: orig}
	t.Cleanup(func() { http.DefaultTransport = orig })

	var targets []benchTarget
	for _, tg := range benchTargets {
		keep := len(filters) == 0 || slices.ContainsFunc(filters, func(f string) bool { return strings.Contains(tg.model, strings.TrimSpace(f)) })
		if !keep {
			continue
		}
		if os.Getenv(tg.provider.keyEnv) == "" {
			t.Logf("skip %s/%s: %s is not set", tg.provider.name, tg.model, tg.provider.keyEnv)
			continue
		}
		targets = append(targets, tg)
	}

	results := make([][]benchOutcome, len(targets))
	var wg sync.WaitGroup
	for i, tg := range targets {
		wg.Add(1)
		go func() {
			defer wg.Done()
			s := &Service{
				groq:   groq.NewClient(os.Getenv(tg.provider.keyEnv), tg.provider.baseURL),
				models: Models{Fast: tg.model, Quality: tg.model, Vision: tg.model},
			}
			for range runs {
				for _, c := range benchCases {
					if c.kind == kindImage && !tg.vision {
						continue
					}
					results[i] = append(results[i], runCase(context.Background(), s, tg.provider.rewrite, c, images))
					time.Sleep(tg.provider.pace)
				}
			}
			t.Logf("done %s/%s", tg.provider.name, tg.model)
		}()
	}
	wg.Wait()

	report := benchReport(targets, results, runs)
	fmt.Println(report)
	dir := filepath.Join("..", "..", "bench-results")
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatal(err)
	}
	out := filepath.Join(dir, time.Now().Format("2006-01-02T15-04")+".md")
	if err := os.WriteFile(out, []byte(report), 0o644); err != nil {
		t.Fatal(err)
	}
	t.Logf("wrote %s", out)
}

func benchReport(targets []benchTarget, results [][]benchOutcome, runs int) string {
	var b strings.Builder
	fmt.Fprintf(&b, "# LLM benchmark %s\n\n%d cases x %d runs. Pass means every labelled field matched.\n", time.Now().Format("2006-01-02 15:04"), len(benchCases), runs)
	b.WriteString("Retries counts extra calls the fallback made (bad JSON, HTTP errors). 429 waits are excluded from latency and accuracy.\n\n")
	b.WriteString("| Provider | Model | Pass | Text | Notif | Image | Retries | 429s | p50 | p95 | Out tok | $/1k calls |\n")
	b.WriteString("|---|---|---|---|---|---|---|---|---|---|---|---|\n")
	for i, tg := range targets {
		outs := results[i]
		pass := func(kind benchKind) string {
			n, ok := 0, 0
			for _, o := range outs {
				if kind == "" || o.c.kind == kind {
					n++
					if o.failure == "" {
						ok++
					}
				}
			}
			if n == 0 {
				return "n/a"
			}
			return fmt.Sprintf("%.0f%%", 100*float64(ok)/float64(n))
		}
		var lat []time.Duration
		retries, limited, outTok, cost := 0, 0, 0, 0.0
		for _, o := range outs {
			lat = append(lat, o.latency)
			retries += o.retries()
			limited += o.rateLimited
			c, tok := o.cost()
			cost, outTok = cost+c, outTok+tok
		}
		slices.Sort(lat)
		pct := func(p float64) string {
			if len(lat) == 0 {
				return "n/a"
			}
			return fmt.Sprintf("%.1fs", lat[int(p*float64(len(lat)-1))].Seconds())
		}
		price := "free"
		if tg.provider.name != "groq" {
			price = fmt.Sprintf("%.3f", 1000*cost/float64(max(len(outs), 1)))
		}
		fmt.Fprintf(&b, "| %s | %s | %s | %s | %s | %s | %d | %d | %s | %s | %d | %s |\n",
			tg.provider.name, tg.model, pass(""), pass(kindText), pass(kindNotification), pass(kindImage),
			retries, limited, pct(0.5), pct(0.95), outTok/max(len(outs), 1), price)
	}

	b.WriteString("\n## Failures\n")
	for i, tg := range targets {
		type key struct{ name, failure string }
		counts := map[key]int{}
		var order []key
		reasons := map[key]string{}
		for _, o := range results[i] {
			if o.failure == "" {
				continue
			}
			k := key{string(o.c.kind) + "/" + o.c.name, o.failure}
			if counts[k] == 0 {
				order = append(order, k)
				reasons[k] = o.reason
			}
			counts[k]++
		}
		if len(order) == 0 {
			continue
		}
		fmt.Fprintf(&b, "\n### %s/%s\n\n", tg.provider.name, tg.model)
		for _, k := range order {
			line := fmt.Sprintf("- %s: %s (%d/%d)", k.name, k.failure, counts[k], runs)
			if reasons[k] != "" {
				line += " " + truncate(reasons[k], 160)
			}
			b.WriteString(line + "\n")
		}
	}
	return b.String()
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "..."
}
