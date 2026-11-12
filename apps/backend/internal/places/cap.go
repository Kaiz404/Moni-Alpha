package places

import (
	"sync"
	"time"
	_ "time/tzdata"
)

// Google's per-day quotas reset at midnight Pacific, so the backend's cap counts the same day.
var quotaDay = mustLoadLocation("America/Los_Angeles")

func mustLoadLocation(name string) *time.Location {
	loc, err := time.LoadLocation(name)
	if err != nil {
		panic(err)
	}
	return loc
}

// dailyCap counts calls in this process. Cloud Run runs one instance, so one counter is the global count.
type dailyCap struct {
	mu    sync.Mutex
	limit int
	now   func() time.Time
	day   string
	used  int
}

func newDailyCap(limit int, now func() time.Time) *dailyCap {
	return &dailyCap{limit: limit, now: now}
}

// take reserves one call for today and reports false once today's limit is spent.
func (c *dailyCap) take() bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if today := c.now().In(quotaDay).Format(time.DateOnly); today != c.day {
		c.day, c.used = today, 0
	}
	if c.used >= c.limit {
		return false
	}
	c.used++
	return true
}
