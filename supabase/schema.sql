-- დენტალ ცენტრი — ადმინ პანელის სქემა
-- გაუშვით მთლიანად ერთბაშად Supabase Dashboard → SQL Editor-ში, ერთხელ.
-- უსაფრთხოა თავიდან გაშვება (create if not exists / drop policy if exists),
-- ანუ თუ რამე შეცდომაზე შეჩერდა და ხელახლა გინდა გაშვება — პრობლემა არაა.

-- ============ TABLES ============

create table if not exists doctors (
  id text primary key,              -- 'galaktion' | 'beka' | 'lika'
  name text not null,
  sort_order int not null default 0
);

insert into doctors (id, name, sort_order) values
  ('galaktion', 'გალაქტიონ (გიგა) ღვინჯილია', 1),
  ('beka', 'ბექა მიროტაძე', 2),
  ('lika', 'ლიკა გოგია', 3)
on conflict (id) do nothing;

-- ერთი ფოტოს სლოტები საიტის სექციებისთვის (ჰერო, ჩვენ შესახებ, სერვისები).
-- storage_path = null ნიშნავს: გამოიყენე საიტის ჩაშენებული ნაგულისხმევი ფოტო.
create table if not exists site_images (
  section_key text primary key,
  storage_path text,
  alt_text text,
  updated_at timestamptz not null default now()
);

insert into site_images (section_key) values
  ('hero'), ('about'),
  ('service_therapy'), ('service_kids'), ('service_orthopedics'),
  ('service_orthodontics'), ('service_surgery'), ('service_implant'),
  ('service_aesthetic'), ('service_lab')
on conflict (section_key) do nothing;

-- ექიმის ფოტოების გალერეა (სლაიდი საიტზე)
create table if not exists doctor_photos (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null references doctors(id) on delete cascade,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ექიმის შედეგები/ნამუშევრები (ახალი სექცია საიტზე)
create table if not exists doctor_results (
  id uuid primary key default gen_random_uuid(),
  doctor_id text not null references doctors(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- სერვისის ბარათის ფოტო-სლაიდი (საიტზე ავტომატურად იცვლება)
create table if not exists service_photos (
  id uuid primary key default gen_random_uuid(),
  service_key text not null,
  storage_path text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ჯავშნის ფორმის ყოველი გაგზავნის ასლი — WhatsApp-ის გარდა, აქაც რჩება,
-- რომ თუ შეტყობინება WhatsApp-ში გამოგრჩათ ან წაიშალა, პაციენტი არ დაიკარგოს.
create table if not exists booking_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  service text,
  note text,
  created_at timestamptz not null default now()
);

-- ============ ROW LEVEL SECURITY ============
-- ყველას შეუძლია წაკითხვა (საიტი საჯაროა).
-- მხოლოდ ავტორიზებულ (ადმინ) მომხმარებელს შეუძლია ჩაწერა/რედაქტირება/წაშლა.
-- booking_requests პირიქითაა: ნებისმიერს (საიტის სტუმარს) შეუძლია ახალი
-- განაცხადის დამატება, მაგრამ მხოლოდ ადმინს შეუძლია მათი ნახვა/წაშლა.

alter table doctors enable row level security;
alter table site_images enable row level security;
alter table doctor_photos enable row level security;
alter table doctor_results enable row level security;
alter table service_photos enable row level security;
alter table booking_requests enable row level security;

drop policy if exists "public read doctors" on doctors;
create policy "public read doctors" on doctors for select using (true);

drop policy if exists "public read site_images" on site_images;
create policy "public read site_images" on site_images for select using (true);
drop policy if exists "admin write site_images" on site_images;
create policy "admin write site_images" on site_images for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read doctor_photos" on doctor_photos;
create policy "public read doctor_photos" on doctor_photos for select using (true);
drop policy if exists "admin write doctor_photos" on doctor_photos;
create policy "admin write doctor_photos" on doctor_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read doctor_results" on doctor_results;
create policy "public read doctor_results" on doctor_results for select using (true);
drop policy if exists "admin write doctor_results" on doctor_results;
create policy "admin write doctor_results" on doctor_results for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public read service_photos" on service_photos;
create policy "public read service_photos" on service_photos for select using (true);
drop policy if exists "admin write service_photos" on service_photos;
create policy "admin write service_photos" on service_photos for all
  using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

drop policy if exists "public insert booking_requests" on booking_requests;
create policy "public insert booking_requests" on booking_requests for insert
  with check (true);
drop policy if exists "admin read booking_requests" on booking_requests;
create policy "admin read booking_requests" on booking_requests for select
  using (auth.role() = 'authenticated');
drop policy if exists "admin delete booking_requests" on booking_requests;
create policy "admin delete booking_requests" on booking_requests for delete
  using (auth.role() = 'authenticated');

-- ============ STORAGE ============
-- ერთი საჯარო bucket ყველა ატვირთული ფოტოსთვის.

insert into storage.buckets (id, name, public)
values ('site-content', 'site-content', true)
on conflict (id) do nothing;

drop policy if exists "public read site-content" on storage.objects;
create policy "public read site-content" on storage.objects for select
  using (bucket_id = 'site-content');

drop policy if exists "admin write site-content" on storage.objects;
create policy "admin write site-content" on storage.objects for insert
  with check (bucket_id = 'site-content' and auth.role() = 'authenticated');

drop policy if exists "admin update site-content" on storage.objects;
create policy "admin update site-content" on storage.objects for update
  using (bucket_id = 'site-content' and auth.role() = 'authenticated');

drop policy if exists "admin delete site-content" on storage.objects;
create policy "admin delete site-content" on storage.objects for delete
  using (bucket_id = 'site-content' and auth.role() = 'authenticated');
