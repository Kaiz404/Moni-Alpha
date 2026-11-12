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

// dailyCap counts one endpoint's calls in this process, in total and per user. Cloud Run runs one
// instance, so the total is the global count.
type dailyCap struct {
	mu      sync.Mutex
	limit   int
	perUser int
	now     func() time.Time
	day     string
	used    int
	usedBy  map[string]int
}

func newDailyCap(limit, perUser int, now func() time.Time) *dailyCap {
	return &dailyCap{limit: limit, perUser: perUser, now: now}
}

// take reserves one of today's calls for userID. It reports false, reserving nothing, once the
// user's allowance or the global limit is spent.
func (c *dailyCap) take(userID string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	if today := c.now().In(quotaDay).Format(time.DateOnly); today != c.day {
		c.day, c.used, c.usedBy = today, 0, map[string]int{}
	}
	if c.usedBy[userID] >= c.perUser || c.used >= c.limit {
		return false
	}
	c.used++
	c.usedBy[userID]++
	return true
}
