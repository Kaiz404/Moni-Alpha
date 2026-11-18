// Starts a QR sign-in on the dev project the way the web does, as Chrome on Windows, and leaves its
// code in output.qrCode for flows/account/scan-to-sign-in.yaml. qr-start needs no key or session.
var response = http.post('https://yucjcjquwpwkgowzthhn.supabase.co/functions/v1/qr-start', {
  headers: {
    'Content-Type': 'application/json',
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  },
  body: '{}',
});
output.qrCode = json(response.body).code;
