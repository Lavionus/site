// jwt_decoder – en. Doplňuje _test/i18n_vytahni.py; null = zatím nepřeloženo.
I18N.pridej('en', {
  'JWT decoder': 'JWT decoder',
  'JWT token': 'JWT token',
  'Vzorek': 'Sample',
  'Hlavička (Header)': 'Header',
  'Obsah (Payload)': 'Payload',
  'Dekódování probíhá lokálně. JWT není šifrovaný – payload je jen Base64, takže do něj nikdy nepatří hesla. Podpis se zde neověřuje (k tomu je potřeba tajný klíč).': 'Decoding happens locally. A JWT is not encrypted – the payload is just Base64, so passwords never belong in it. The signature is not verified here (that requires the secret key).',
  'Subjekt (uživatel)': 'Subject (user)',
  'Příjemce': 'Audience',
  'Platný od': 'Not before',
  'Vydáno': 'Issued at',
  'JWT musí mít 3 části oddělené tečkou.': 'A JWT must have 3 parts separated by dots.',
  'vypršel': 'expired',
  'Neplatný JWT: {message}': 'Invalid JWT: {message}',
  'Jan Novák': 'Jan Novák',
});
