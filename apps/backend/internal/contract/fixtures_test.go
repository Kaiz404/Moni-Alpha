// Package contract holds the AI wire contract to the TypeScript side: the golden fixtures in
// packages/types/fixtures/ai, which @repo/types parses with Zod, decode here into the Go structs.
package contract

import (
	"bytes"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"slices"
	"strings"
	"testing"

	"github.com/gin-gonic/gin/binding"
	"github.com/kaiz404/moni/backend/internal/budget"
	"github.com/kaiz404/moni/backend/internal/chat"
	"github.com/kaiz404/moni/backend/internal/extract"
	"github.com/kaiz404/moni/backend/internal/places"
)

const fixtureDir = "../../../../packages/types/fixtures/ai"

// shape is the Go struct one fixture decodes into. A request must also pass the handler's binding
// rules; a response must encode back to the fixture exactly, so Go sends what the client parses.
type shape struct {
	target   func() any
	response bool
}

var shapes = map[string]shape{
	"extract-text-request":                   {func() any { return &extract.TextRequest{} }, false},
	"extract-image-request":                  {func() any { return &extract.ImageRequest{} }, false},
	"extract-image-url-request":              {func() any { return &extract.ImageRequest{} }, false},
	"extract-notification-request":           {func() any { return &extract.NotificationRequest{} }, false},
	"extract-result-ok":                      {func() any { return &extract.Result{} }, true},
	"extract-result-skipped":                 {func() any { return &extract.Result{} }, true},
	"extract-result-unavailable":             {func() any { return &extract.Result{} }, true},
	"chat-analyze-request":                   {func() any { return &chat.AnalyzeRequest{} }, false},
	"chat-analyze-result-ok":                 {func() any { return &chat.AnalyzeResult{} }, true},
	"chat-analyze-result-unavailable":        {func() any { return &chat.AnalyzeResult{} }, true},
	"budget-suggest-request":                 {func() any { return &budget.Request{} }, false},
	"budget-suggest-result-questions":        {func() any { return &budget.Result{} }, true},
	"budget-suggest-result-suggestion":       {func() any { return &budget.Result{} }, true},
	"budget-suggest-result-unavailable":      {func() any { return &budget.Result{} }, true},
	"places-autocomplete-request":            {func() any { return &places.AutocompleteRequest{} }, false},
	"places-autocomplete-result-ok":          {func() any { return &places.AutocompleteResult{} }, true},
	"places-autocomplete-result-unavailable": {func() any { return &places.AutocompleteResult{} }, true},
	"places-details-request":                 {func() any { return &places.DetailsRequest{} }, false},
	"places-details-result-ok":               {func() any { return &places.DetailsResult{} }, true},
	"places-details-result-not-found":        {func() any { return &places.DetailsResult{} }, true},
	"places-details-result-unavailable":      {func() any { return &places.DetailsResult{} }, true},
}

func TestEveryFixtureHasAShape(t *testing.T) {
	entries, err := os.ReadDir(fixtureDir)
	if err != nil {
		t.Fatal(err)
	}
	var files, named []string
	for _, e := range entries {
		if name, ok := strings.CutSuffix(e.Name(), ".json"); ok {
			files = append(files, name)
		}
	}
	for name := range shapes {
		named = append(named, name)
	}
	slices.Sort(files)
	slices.Sort(named)
	if !slices.Equal(files, named) {
		t.Fatalf("fixture files %v, shapes %v", files, named)
	}
}

func TestFixturesDecodeStrictly(t *testing.T) {
	for name, s := range shapes {
		t.Run(name, func(t *testing.T) {
			raw, err := os.ReadFile(filepath.Join(fixtureDir, name+".json"))
			if err != nil {
				t.Fatal(err)
			}
			target := s.target()
			dec := json.NewDecoder(bytes.NewReader(raw))
			dec.DisallowUnknownFields()
			if err := dec.Decode(target); err != nil {
				t.Fatalf("decode: %v", err)
			}
			if !s.response {
				if err := binding.Validator.ValidateStruct(target); err != nil {
					t.Fatalf("binding rules refuse it: %v", err)
				}
				return
			}
			encoded, err := json.Marshal(target)
			if err != nil {
				t.Fatal(err)
			}
			var want, got any
			json.Unmarshal(raw, &want)
			json.Unmarshal(encoded, &got)
			if !reflect.DeepEqual(got, want) {
				t.Fatalf("Go encodes\n%s\nthe fixture says\n%s", encoded, raw)
			}
		})
	}
}
