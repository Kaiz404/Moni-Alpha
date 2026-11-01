package extract

import (
	"regexp"
	"strings"
)

// The phone's prefilter (apps/mobile/lib/notifications/notification-filter.core.js) holds the same
// rule and drops one-time codes before they leave; this copy covers builds older than that rule.
// Both run testdata/one_time_codes.json. A payment alert can carry a safety footer ("Never share
// your TAC") or a payee named TAC, so what reads as advice, a payee or another kind of code comes
// out first, and whatever still names a code counts as one.
const (
	codeWord       = `o\.?t\.?p|t\.?a\.?c|one[- ]?time[- ](?:password|passcode|pin|code)|verification (?:code|number|pin)|security code|secure code|authentication code|activation code|log[- ]?in code|sign[- ]?in code|access code|pass ?code|sms code|2fa|kod (?:otp|tac|pengesahan|keselamatan|pengaktifan|akses|sms|sekali guna)|kata (?:laluan|sandi) sekali guna|pin sekali guna`
	codeValue      = `(?:\d{4,8}|\d{3}[ -]\d{3})`
	afterCodeWord  = `(?:\s+(?:is|ialah|adalah|anda)|\s*[:=-])*\s*`
	moneyCurrency  = `USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB`
	adviceListJoin = `(?:(?:\s*[,/&]\s*|\s+(?:or|and|atau|dan)\s+)(?:` + codeWord + `))*`
)

var (
	transactionAuthCode = regexp.MustCompile(`(?i)transaction authori[sz]ation code`)
	codeWordWithValue   = regexp.MustCompile(`(?i)\b(?:` + codeWord + `)` + afterCodeWord + codeValue + `\b`)

	notACode = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(?:never|not|don'?t|dont|won'?t|jangan|tidak akan|tidak pernah)\s+(?:\w+\s+){0,4}?(?:share|reveal|disclose|give|tell|send|asks?(?:\s+(?:you\s+)?for)?|requests?|kongsi(?:kan)?|berkongsi|dedah(?:kan)?|mendedahkan|beri(?:kan)?|minta)\s+(?:(?:your|any|anda|sebarang|kod|nombor|passwords?|pin|card|details|or|and|atau|dan|&)[\s,/]+)*(?:` + codeWord + `)` + adviceListJoin + `\b`),
		regexp.MustCompile(`(?i)\b(?:asking|asks?|requesting)\s+(?:for\s+)?your\s+(?:` + codeWord + `)\b`),
		regexp.MustCompile(`(?i)\b(?:at|to|from|kepada|dari|daripada|merchant|payee|beneficiary|penerima)\s*:?\s+(?:the\s+)?(?:otp|tac)\b`),
		regexp.MustCompile(`(?i)\b(?:otp|tac)\s+(?:sdn|bhd|berhad|plt|ltd|inc|cafe|restaurant|restoran|kopitiam|trading|holdings?|enterprise|resources|services|solutions|group|mart|store|shop|apply|applies)\b`),
		regexp.MustCompile(`(?i)\btic[- ]tac\b`),
		regexp.MustCompile(`(?i)\b(?:promo|promotion|promotional|voucher|discount|coupon|referral|redemption|redeem|gift|reward|cashback|invite|qr|merchant|mcc|approval|auth|authori[sz]ation|transaction|txn|reference|ref|swift|bank|branch|postal|zip|booking|confirmation|product|item|tracking|error)\s+codes?\b`),
		regexp.MustCompile(`(?i)\bkod\s+(?:promo|promosi|baucar|diskaun|qr|kelulusan|rujukan|pos|tempahan)\b`),
	}

	namesACode = []*regexp.Regexp{
		regexp.MustCompile(`(?i)\b(?:` + codeWord + `)\b`),
		regexp.MustCompile(`验证码|驗證碼|校验码|校驗碼|动态码|動態碼`),
		regexp.MustCompile(`(?i)\b(?:code|kod|pin|password|kata laluan)\b` + afterCodeWord + codeValue + `\b`),
		regexp.MustCompile(`(?i)\b` + codeValue + `\s+(?:is|ialah|adalah)\s+(?:\w+\s+){0,3}?(?:code|kod|pin|password)\b`),
		regexp.MustCompile(`(?i)\b(?:use|enter|key in|input|gunakan|guna|masukkan)\s+(?:\w+\s+){0,2}?` + codeValue + `\s*(?:to|for|untuk|bagi|as|sebagai|[.,]|$)`),
		regexp.MustCompile(`(?i)\b` + codeValue + `\s+(?:to|untuk|bagi)\s+(?:approve|authori[sz]e|confirm|verify|complete|log|sign|sahkan|luluskan|mengesahkan)\b`),
	}

	shareWarning = regexp.MustCompile(`(?i)\b(?:do not|don'?t|never|jangan)\s+(?:share|reveal|disclose|kongsi|dedah)`)
	money        = regexp.MustCompile(`(?i)\b(?:` + moneyCurrency + `)\s*[\d,]+(?:[.,]\d{1,2})?\b|[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾]\s*[\d,]+(?:[.,]\d{1,2})?|\b[\d,]+(?:[.,]\d{1,2})?\s*(?:` + moneyCurrency + `)\b`)
	bareValue    = regexp.MustCompile(`\b` + codeValue + `\b`)
)

func isOneTimeCode(combined string) bool {
	text := transactionAuthCode.ReplaceAllString(strings.Join(strings.Fields(combined), " "), "TAC")
	if codeWordWithValue.MatchString(text) {
		return true
	}
	rest := text
	for _, pattern := range notACode {
		rest = pattern.ReplaceAllString(rest, " ")
	}
	for _, pattern := range namesACode {
		if pattern.MatchString(rest) {
			return true
		}
	}
	return shareWarning.MatchString(rest) && bareValue.MatchString(money.ReplaceAllString(rest, " "))
}
