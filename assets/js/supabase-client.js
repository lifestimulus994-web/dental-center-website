// დენტალ ცენტრი — Supabase კონფიგურაცია
//
// შეავსეთ ეს ორი მნიშვნელობა Supabase პროექტის შექმნის შემდეგ:
// Dashboard → Project Settings → API → Project URL / anon public key.
// ეს "anon" გასაღები საჯაროდ ხილვადია ბრაუზერში (ეს ნორმალურია და
// უსაფრთხოა Supabase-ის მოდელში) — რეალურ დაცვას რიგები (RLS
// policies, იხ. supabase/schema.sql) უზრუნველყოფს, არა ამ გასაღების
// დამალვა.
const SUPABASE_URL = 'https://biofroklzxfogfztvjlv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_cerF0XVDk8gTzlwvC6n52Q_psnyXCda';
const SUPABASE_BUCKET = 'site-content';

const isConfigured =
  SUPABASE_URL !== 'YOUR_SUPABASE_PROJECT_URL' &&
  SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';

const client = isConfigured
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

function publicUrl(storagePath) {
  if (!storagePath || !client) return null;
  const { data } = client.storage.from(SUPABASE_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

// გლობალურად ხელმისაწვდომი — index.html-ისთვისაც და admin.html-ისთვისაც
window.DentalDB = { client, isConfigured, bucket: SUPABASE_BUCKET, publicUrl };
