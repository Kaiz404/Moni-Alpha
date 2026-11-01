const MONEY_PATTERN =
  /\b(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB)\s*[\d,]+(?:[.,]\d{1,2})?\b|(?:[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾])\s*[\d,]+(?:[.,]\d{1,2})?|\b[\d,]+(?:[.,]\d{1,2})?\s*(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB)\b/i;

const TRANSFER_SIGNAL_PATTERN =
  /\b(credited|debited|received|sent|paid|payment|purchase|spent|withdrawn|withdrawal|deposit|transferred|transfer|refund|dr\b|cr\b|from\s+|to\s+|at\s+|via\s+|merchant|beneficiary|sender|receiver|bayaran|pembayaran|membayar|dibayar|pindahan|pemindahan|dipindahkan|belian|pembelian|pengeluaran|dikreditkan|didebitkan|diterima|menerima|kepada|daripada)\b/i;

// A one-time code never leaves the phone, so this runs before the money check: banks quote the
// amount inside the code ("TAC for a transfer of RM 300"). An alert can name a code without
// carrying one, so what reads as advice, a payee or another kind of code comes out first, and
// whatever still names a code counts as one. oneTimeCode in
// apps/backend/internal/extract/service.go is the same rule; both run testdata/one_time_codes.json.
const CODE_WORD =
  'o\\.?t\\.?p|t\\.?a\\.?c|one[- ]?time[- ](?:password|passcode|pin|code)|verification (?:code|number|pin)|security code|secure code|authentication code|activation code|log[- ]?in code|sign[- ]?in code|access code|pass ?code|sms code|2fa|kod (?:otp|tac|pengesahan|keselamatan|pengaktifan|akses|sms|sekali guna)|kata (?:laluan|sandi) sekali guna|pin sekali guna';
const CODE_VALUE = '(?:\\d{4,8}|\\d{3}[ -]\\d{3})';
const AFTER_CODE_WORD = '(?:\\s+(?:is|ialah|adalah|anda)|\\s*[:=-])*\\s*';

// "Do not share your OTP 482910" reads as advice until the value arrives.
const CODE_WORD_WITH_VALUE = new RegExp(
  `\\b(?:${CODE_WORD})${AFTER_CODE_WORD}${CODE_VALUE}\\b`,
  'i',
);

const NOT_A_CODE = [
  // "Never share your password, PIN or OTP" is advice. "Do not share this TAC" is about a code.
  new RegExp(
    `\\b(?:never|not|don'?t|dont|won'?t|jangan|tidak akan|tidak pernah)\\s+(?:\\w+\\s+){0,4}?(?:share|reveal|disclose|give|tell|send|asks?(?:\\s+(?:you\\s+)?for)?|requests?|kongsi(?:kan)?|berkongsi|dedah(?:kan)?|mendedahkan|beri(?:kan)?|minta)\\s+(?:(?:your|any|anda|sebarang|kod|nombor|passwords?|pin|card|details|or|and|atau|dan|&)[\\s,/]+)*(?:${CODE_WORD})(?:(?:\\s*[,/&]\\s*|\\s+(?:or|and|atau|dan)\\s+)(?:${CODE_WORD}))*\\b`,
    'gi',
  ),
  new RegExp(`\\b(?:asking|asks?|requesting)\\s+(?:for\\s+)?your\\s+(?:${CODE_WORD})\\b`, 'gi'),
  // A payee ("at TAC Trading", "Payment of RM45.00 to TAC", "TAC Cafe") and terms ("TAC apply").
  /\b(?:at|to|from|kepada|dari|daripada|merchant|payee|beneficiary|penerima)\s*:?\s+(?:the\s+)?(?:otp|tac)\b/gi,
  /\b(?:otp|tac)\s+(?:sdn|bhd|berhad|plt|ltd|inc|cafe|restaurant|restoran|kopitiam|trading|holdings?|enterprise|resources|services|solutions|group|mart|store|shop|apply|applies)\b/gi,
  /\btic[- ]tac\b/gi,
  // Codes that are not secrets.
  /\b(?:promo|promotion|promotional|voucher|discount|coupon|referral|redemption|redeem|gift|reward|cashback|invite|qr|merchant|mcc|approval|auth|authori[sz]ation|transaction|txn|reference|ref|swift|bank|branch|postal|zip|booking|confirmation|product|item|tracking|error)\s+codes?\b/gi,
  /\bkod\s+(?:promo|promosi|baucar|diskaun|qr|kelulusan|rujukan|pos|tempahan)\b/gi,
];

const NAMES_A_CODE = [
  new RegExp(`\\b(?:${CODE_WORD})\\b`, 'i'),
  /验证码|驗證碼|校验码|校驗碼|动态码|動態碼/,
  // "Your code is 482910", "PIN: 4829", "482910 is your code".
  new RegExp(`\\b(?:code|kod|pin|password|kata laluan)\\b${AFTER_CODE_WORD}${CODE_VALUE}\\b`, 'i'),
  new RegExp(
    `\\b${CODE_VALUE}\\s+(?:is|ialah|adalah)\\s+(?:\\w+\\s+){0,3}?(?:code|kod|pin|password)\\b`,
    'i',
  ),
  // "Use 482910 to approve", "482910 to approve": a value offered as the way to approve something.
  new RegExp(
    `\\b(?:use|enter|key in|input|gunakan|guna|masukkan)\\s+(?:\\w+\\s+){0,2}?${CODE_VALUE}\\s*(?:to|for|untuk|bagi|as|sebagai|[.,]|$)`,
    'i',
  ),
  new RegExp(
    `\\b${CODE_VALUE}\\s+(?:to|untuk|bagi)\\s+(?:approve|authori[sz]e|confirm|verify|complete|log|sign|sahkan|luluskan|mengesahkan)\\b`,
    'i',
  ),
];

const SHARE_WARNING = /\b(?:do not|don'?t|never|jangan)\s+(?:share|reveal|disclose|kongsi|dedah)/i;
const MONEY_ANYWHERE = new RegExp(MONEY_PATTERN.source, 'gi');
const VALUE_ANYWHERE = new RegExp(`\\b${CODE_VALUE}\\b`);

function normalizeText(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function notificationText(notification) {
  return [
    notification.title,
    notification.titleBig,
    notification.text,
    notification.bigText,
    notification.subText,
    notification.summaryText,
    notification.extraInfoText,
  ]
    .map(normalizeText)
    .filter(Boolean)
    .join(' ');
}

function isOneTimeCode(notification) {
  const grouped = Array.isArray(notification.groupedMessages)
    ? notification.groupedMessages.flatMap((message) => [message?.title, message?.text])
    : [];
  const text = [notificationText(notification), ...grouped.map(normalizeText)]
    .filter(Boolean)
    .join(' ')
    .replace(/transaction authori[sz]ation code/gi, 'TAC');
  if (CODE_WORD_WITH_VALUE.test(text)) return true;
  const rest = NOT_A_CODE.reduce((left, pattern) => left.replace(pattern, ' '), text);
  if (NAMES_A_CODE.some((pattern) => pattern.test(rest))) return true;
  // "Transfer RM300 to Ali: 482910. Do not share." The warning is about this alert.
  return SHARE_WARNING.test(rest) && VALUE_ANYWHERE.test(rest.replace(MONEY_ANYWHERE, ' '));
}

/** The log keeps that a code arrived and which app sent it, never the code. */
function withoutOneTimeCode(notification) {
  if (!isOneTimeCode(notification)) return notification;
  return {
    ...notification,
    title: '',
    titleBig: '',
    text: '',
    bigText: '',
    subText: '',
    summaryText: '',
    extraInfoText: '',
    groupedMessages: [],
    oneTimeCode: true,
  };
}

function passesNotificationTransactionPrefilter(notification) {
  if (isOneTimeCode(notification)) return false;
  const text = notificationText(notification);
  return MONEY_PATTERN.test(text) && TRANSFER_SIGNAL_PATTERN.test(text);
}

module.exports = {
  MONEY_PATTERN,
  TRANSFER_SIGNAL_PATTERN,
  isOneTimeCode,
  notificationText,
  passesNotificationTransactionPrefilter,
  withoutOneTimeCode,
};
