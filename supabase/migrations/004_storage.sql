-- ============================================================================
-- Лапометр · миграция 4 (после 003_realtime.sql)
-- Фотографии записей журнала в Supabase Storage (вместо base64 в снапшоте).
--
-- Путь объекта: {pet_id}/{log_id}.jpg
--  · запись создаёт только участник питомца (is_pet_member по 1-му сегменту);
--  · чтение публичное — <img src> работает без токена (MVP; для закрытого
--    доступа замените бакет на private и используйте signed URLs);
--  · удаление — участникам питомца (чистка при удалении активности/данных).
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('pet-photos', 'pet-photos', true)
on conflict (id) do nothing;

drop policy if exists "pet_photos_insert" on storage.objects;
create policy "pet_photos_insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and public.is_pet_member(split_part(name, '/', 1))
  );

drop policy if exists "pet_photos_update" on storage.objects;
create policy "pet_photos_update" on storage.objects for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.is_pet_member(split_part(name, '/', 1))
  );

drop policy if exists "pet_photos_delete" on storage.objects;
create policy "pet_photos_delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and public.is_pet_member(split_part(name, '/', 1))
  );

-- Публичное чтение (бакет public; политика — для явности и порядка)
drop policy if exists "pet_photos_select" on storage.objects;
create policy "pet_photos_select" on storage.objects for select
  using (bucket_id = 'pet-photos');
