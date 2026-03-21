const MONEY_PATTERN =
  /\b(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB)\s*[\d,]+(?:[.,]\d{1,2})?\b|(?:[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾])\s*[\d,]+(?:[.,]\d{1,2})?|\b[\d,]+(?:[.,]\d{1,2})?\s*(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD|RM|Rs|IDR|PHP|THB)\b/i;

const TRANSFER_SIGNAL_PATTERN =
  /\b(credited|debited|received|sent|paid|payment|purchase|spent|withdrawn|withdrawal|deposit|transferred|transfer|refund|dr\b|cr\b|from\s+|to\s+|at\s+|via\s+|merchant|beneficiary|sender|receiver)\b/i;

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

function passesNotificationTransactionPrefilter(notification) {
  const text = notificationText(notification);
  return MONEY_PATTERN.test(text) && TRANSFER_SIGNAL_PATTERN.test(text);
}

module.exports = {
  MONEY_PATTERN,
  TRANSFER_SIGNAL_PATTERN,
  notificationText,
  passesNotificationTransactionPrefilter,
};
