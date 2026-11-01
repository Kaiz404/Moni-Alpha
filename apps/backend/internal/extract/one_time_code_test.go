package extract

import (
	"context"
	"encoding/json"
	"os"
	"testing"
)

type oneTimeCodeCase struct {
	Name    string `json:"name"`
	Title   string `json:"title"`
	Text    string `json:"text"`
	BigText string `json:"bigText"`
	SubText string `json:"subText"`
}

func (c oneTimeCodeCase) combined() string {
	return RawNotification{Title: c.Title, Text: c.Text, BigText: c.BigText, SubText: c.SubText}.CombinedText()
}

func readOneTimeCodeCases(t *testing.T) (codes, genuine []oneTimeCodeCase) {
	t.Helper()
	raw, err := os.ReadFile("testdata/one_time_codes.json")
	if err != nil {
		t.Fatal(err)
	}
	var cases struct {
		Codes   []oneTimeCodeCase `json:"codes"`
		Genuine []oneTimeCodeCase `json:"genuine"`
	}
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatal(err)
	}
	return cases.Codes, cases.Genuine
}

func TestIsOneTimeCode(t *testing.T) {
	codes, genuine := readOneTimeCodeCases(t)
	for _, c := range codes {
		if !isOneTimeCode(c.combined()) {
			t.Errorf("%s: a one-time code passed: %q", c.Name, c.combined())
		}
	}
	for _, c := range genuine {
		if isOneTimeCode(c.combined()) {
			t.Errorf("%s: a transaction alert was skipped: %q", c.Name, c.combined())
		}
	}
}

func TestFromNotificationSkipsOneTimeCodeBeforeTheModel(t *testing.T) {
	s := NewService(nil)
	req := NotificationRequest{Notification: RawNotification{Text: "TAC for a transfer of RM 300"}}
	if got := s.FromNotification(context.Background(), req); got.Status != "skipped" {
		t.Fatalf("status %q, want skipped", got.Status)
	}
}
