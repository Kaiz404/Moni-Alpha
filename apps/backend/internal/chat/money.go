package chat

import (
	"bytes"
	"encoding/json"
	"math"
	"regexp"
	"strconv"
	"strings"
)

// Money in Moni chat follows docs/redesign/glossary.md: "RM1,116.20" with no space, U+2212 for a
// negative, whole ringgit rounded toward zero for forward-looking numbers. Other currencies keep
// their ISO code ("SGD 78.40") so two dollar currencies never read alike in one reply.

const minus = "−"

type rounding int

const (
	cents rounding = iota
	wholeUnits
)

// Snapshot keys whose numbers are money, by how the glossary rounds them. Every other number
// (counts, days, percentages, shares, confidence) reaches the model unchanged.
var moneyKeys = map[string]rounding{
	"amount":                       cents,
	"avgDailyExpenseCurrentMonth":  cents,
	"avgDailyExpensePreviousMonth": cents,
	"billsTotal":                   cents,
	"changeLast30Days":             cents,
	"dailyExpense":                 cents,
	"expenseCurrentMonthToDate":    cents,
	"expensePreviousCalendarMonth": cents,
	"expenseTotal":                 cents,
	"incomeTotal":                  cents,
	"liquid":                       cents,
	"net":                          cents,
	"spendDiningOutLike":           cents,
	"spendGroceryLike":             cents,
	"spendOther":                   cents,
	"spentTotal":                   cents,
	"startBalance":                 cents,
	"budgetAmount":                 wholeUnits,
	"remaining":                    wholeUnits,
	"low":                          wholeUnits,
	"likely":                       wholeUnits,
	"high":                         wholeUnits,
	"worstCaseAfter":               wholeUnits,
	"likelyAfter":                  wholeUnits,
}

func formatMoney(value float64, currency string, r rounding) string {
	magnitude := math.Abs(value)
	var digits string
	if r == wholeUnits {
		digits = strconv.FormatFloat(math.Floor(magnitude), 'f', 0, 64)
	} else {
		digits = strconv.FormatFloat(magnitude, 'f', 2, 64)
	}
	sign := ""
	if value < 0 && strings.Trim(digits, "0.") != "" {
		sign = minus
	}
	if currency == "MYR" {
		return sign + "RM" + groupThousands(digits)
	}
	return sign + currency + " " + groupThousands(digits)
}

func groupThousands(digits string) string {
	whole, fraction, hasFraction := strings.Cut(digits, ".")
	var b strings.Builder
	for i, d := range whole {
		if i > 0 && (len(whole)-i)%3 == 0 {
			b.WriteByte(',')
		}
		b.WriteRune(d)
	}
	if hasFraction {
		b.WriteString("." + fraction)
	}
	return b.String()
}

// modelSnapshot rewrites every amount under snapshot.currencies.<code> as the glossary string the
// reply should quote, so the model copies "RM365.10" instead of choosing its own currency format.
// A snapshot without that shape passes through untouched.
func modelSnapshot(raw json.RawMessage) json.RawMessage {
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	var snapshot map[string]any
	if err := dec.Decode(&snapshot); err != nil {
		return raw
	}
	currencies, ok := snapshot["currencies"].(map[string]any)
	if !ok {
		return raw
	}
	for code, block := range currencies {
		currencies[code] = formatAmounts(block, strings.ToUpper(code), "")
	}
	var out bytes.Buffer
	enc := json.NewEncoder(&out)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(snapshot); err != nil {
		return raw
	}
	return bytes.TrimSpace(out.Bytes())
}

func formatAmounts(node any, currency, key string) any {
	switch v := node.(type) {
	case map[string]any:
		for k, child := range v {
			v[k] = formatAmounts(child, currency, k)
		}
	case []any:
		for i, child := range v {
			v[i] = formatAmounts(child, currency, key)
		}
	case json.Number:
		r, isMoney := moneyKeys[key]
		f, err := v.Float64()
		if isMoney && err == nil {
			return formatMoney(f, currency, r)
		}
	}
	return node
}

const replyNumber = `\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`

// A ringgit amount written the model's way: "MYR 365.10", "RM 42", "RM-45.90", "-RM45.90",
// "1500 MYR", "4,500 ringgit". Groups 1 to 3 are the prefix form (sign, inner sign, number),
// groups 4 and 5 the suffix form (sign, number).
var ringgitAmount = regexp.MustCompile(
	`([-–−]?)\b(?:MYR|RM) ?([-–−]?)(` + replyNumber + `)(?: ?MYR\b)?` +
		`|([-–−]?)\b(` + replyNumber + `) ?(?:MYR|ringgit)\b`,
)

// glossaryReply rewrites the ringgit amounts a reply still writes its own way to the glossary
// form. A dash glued to the word before it ("RM5-RM9") is a range, not a minus. Other currencies
// are left as written.
func glossaryReply(reply string) string {
	var b strings.Builder
	last := 0
	for _, loc := range ringgitAmount.FindAllStringSubmatchIndex(reply, -1) {
		group := func(i int) string {
			if loc[2*i] < 0 {
				return ""
			}
			return reply[loc[2*i]:loc[2*i+1]]
		}
		sign, number, negative := group(1), group(3), group(2) != ""
		if number == "" {
			sign, number = group(4), group(5)
		}
		b.WriteString(reply[last:loc[0]])
		if sign != "" {
			if loc[0] == 0 || strings.ContainsAny(reply[loc[0]-1:loc[0]], " \t\n(") {
				negative = true
			} else {
				b.WriteString(sign)
			}
		}
		if negative {
			b.WriteString(minus)
		}
		b.WriteString("RM" + groupThousands(strings.ReplaceAll(number, ",", "")))
		last = loc[1]
	}
	b.WriteString(reply[last:])
	out := bareMYR.ReplaceAllString(b.String(), "ringgit")
	return signAfterDirection.ReplaceAllString(out, "$1 ")
}

var (
	// "MYR" left as a word once every amount reads RM ("your MYR balance", "In MYR, ...").
	bareMYR = regexp.MustCompile(`\bMYR\b`)
	// A word that already gives the direction makes the minus a double negative: "down −SGD 78.40".
	signAfterDirection = regexp.MustCompile(`\b(down|short|over|by) ` + minus)
)
