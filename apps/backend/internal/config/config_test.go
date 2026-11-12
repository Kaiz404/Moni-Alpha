package config

import "testing"

func TestPlacesCaps(t *testing.T) {
	t.Setenv("SUPABASE_URL", "https://example.supabase.co")
	t.Setenv("OPENROUTER_API_KEY", "key")

	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.PlacesDailyCap != 1000 || cfg.PlacesUserDailyCap != 100 {
		t.Fatalf("defaults: daily %d, per user %d", cfg.PlacesDailyCap, cfg.PlacesUserDailyCap)
	}

	t.Setenv("PLACES_USER_DAILY_CAP", "0")
	if cfg, err = Load(); err != nil || cfg.PlacesUserDailyCap != 0 {
		t.Fatalf("PLACES_USER_DAILY_CAP=0: %d, %v", cfg.PlacesUserDailyCap, err)
	}

	for _, key := range []string{"PLACES_DAILY_CAP", "PLACES_USER_DAILY_CAP"} {
		for _, bad := range []string{"-1", "lots", "1.5"} {
			t.Run(key+"="+bad, func(t *testing.T) {
				t.Setenv(key, bad)
				_, err := Load()
				if err == nil || err.Error() != key+" must be a non-negative integer" {
					t.Fatalf("got %v", err)
				}
			})
		}
	}
}
