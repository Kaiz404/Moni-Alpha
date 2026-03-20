const MONEY_PATTERN =
  /(?:[$€£¥₦₹₩₪₱฿₫₲₴₵₸₽₾R])\s*[\d,]+(?:[.,]\d{1,2})?|[\d,]+(?:[.,]\d{1,2})?\s*(?:USD|EUR|GBP|NGN|ZAR|KES|GHS|UGX|TZS|MYR|SGD|AUD|CAD|CHF|JPY|CNY|INR|BRL|MXN|AED|SAR|QAR|KWD|OMR|BHD)\b/i;

const TRANSFER_SIGNAL_PATTERN =
  /\b(credited|debited|received|sent|paid|payment|purchase|spent|withdrawn|withdrawal|deposit|transferred|transfer|refund|dr\b|cr\b|from\s+|to\s+|at\s+|via\s+|merchant|beneficiary|sender|receiver)\b/i;

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
