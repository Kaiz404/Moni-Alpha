package main

import (
	"encoding/json"
	"os"
	"testing"
)

// Answers the questions exported by `pnpm --filter moni bench:chat:live` through the real chat
// service and writes the replies for the mobile scorer. Opt in with MONI_CHAT_BENCH_IN and
// MONI_CHAT_BENCH_OUT on top of the live-test variables.
func TestLiveChatBench(t *testing.T) {
	in, out := os.Getenv("MONI_CHAT_BENCH_IN"), os.Getenv("MONI_CHAT_BENCH_OUT")
	if in == "" || out == "" {
		t.Skip("set MONI_CHAT_BENCH_IN and MONI_CHAT_BENCH_OUT to run the live chat bench")
	}
	raw, err := os.ReadFile(in)
	if err != nil {
		t.Fatal(err)
	}
	var bench struct {
		Snapshot  json.RawMessage `json:"snapshot"`
		Questions []struct {
			ID       string `json:"id"`
			Question string `json:"question"`
		} `json:"questions"`
	}
	if err := json.Unmarshal(raw, &bench); err != nil {
		t.Fatal(err)
	}
	s := newLiveServer(t)
	replies := map[string]map[string]any{}
	for _, q := range bench.Questions {
		_, res := s.post(t, "/v1/chat/analyze", map[string]any{"message": q.Question, "snapshot": bench.Snapshot})
		replies[q.ID] = res
	}
	data, err := json.Marshal(map[string]any{"replies": replies})
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(out, data, 0o600); err != nil {
		t.Fatal(err)
	}
}
