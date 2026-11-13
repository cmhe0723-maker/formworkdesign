-- =====================================================================
-- 登入限制與角色權限（可重複執行）
-- ---------------------------------------------------------------------
-- 1. 只有 @sucoot.com 信箱的帳號可以存取任何資料。
-- 2. 角色存在 auth.users.raw_app_meta_data 的 role 欄位：
--      'admin' = 管理員，其他（或未設定）= 一般使用者。
--    app_metadata 只有後台（SQL / service role）能改，使用者無法自行變更。
-- 3. 一般使用者：只能看、改自己的專案，不能刪除專案。
--    管理員：可以看所有人的專案、刪除任何專案；只能修改自己的專案。
--    （存檔時替換跨、載重等子資料不算刪除專案，一般使用者可以進行。）
-- 執行順序：schema.sql → migrations/002 → migrations/003（本檔）
-- =====================================================================

-- ---------------------------------------------------------------------
-- 判斷函式
-- ---------------------------------------------------------------------
create or replace function public.is_member()
returns boolean
language sql stable
as $$
  select coalesce(lower(auth.jwt() ->> 'email') like '%@sucoot.com', false);
$$;

create or replace function public.is_admin()
returns boolean
language sql stable
as $$
  select public.is_member()
     and coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
$$;

-- 可修改：自己的專案
create or replace function public.owns_project(p uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.projects where id = p and owner_id = auth.uid()
  );
$$;

create or replace function public.owns_tab(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.beam_tabs bt
    join public.projects p on p.id = bt.project_id
    where bt.id = t and p.owner_id = auth.uid()
  );
$$;

-- 可讀取：自己的專案；管理員可讀所有專案
create or replace function public.can_read_project(p uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.projects
    where id = p and (owner_id = auth.uid() or public.is_admin())
  );
$$;

create or replace function public.can_read_tab(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.is_member() and exists (
    select 1 from public.beam_tabs bt
    join public.projects p on p.id = bt.project_id
    where bt.id = t and (p.owner_id = auth.uid() or public.is_admin())
  );
$$;

-- ---------------------------------------------------------------------
-- 專案建立者信箱（管理員清單顯示用）
-- ---------------------------------------------------------------------
alter table public.projects
  add column if not exists owner_email text default (auth.jwt() ->> 'email');

update public.projects p
   set owner_email = u.email
  from auth.users u
 where u.id = p.owner_id and p.owner_email is null;

-- ---------------------------------------------------------------------
-- 參考資料：限公司帳號讀取
-- ---------------------------------------------------------------------
drop policy if exists "read grades"  on public.material_grades;
drop policy if exists "read catalog" on public.catalog_sections;
create policy "read grades"  on public.material_grades  for select to authenticated using (public.is_member());
create policy "read catalog" on public.catalog_sections for select to authenticated using (public.is_member());

-- ---------------------------------------------------------------------
-- 專案
-- ---------------------------------------------------------------------
drop policy if exists "own projects"    on public.projects;
drop policy if exists "projects select" on public.projects;
drop policy if exists "projects insert" on public.projects;
drop policy if exists "projects update" on public.projects;
drop policy if exists "projects delete" on public.projects;

create policy "projects select" on public.projects for select to authenticated
  using (public.is_member() and (owner_id = auth.uid() or public.is_admin()));
create policy "projects insert" on public.projects for insert to authenticated
  with check (public.is_member() and owner_id = auth.uid());
create policy "projects update" on public.projects for update to authenticated
  using (public.is_member() and owner_id = auth.uid())
  with check (public.is_member() and owner_id = auth.uid());
create policy "projects delete" on public.projects for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 子資料表：讀取依 can_read_*，新增／修改／刪除依 owns_*
-- ---------------------------------------------------------------------
do $$
declare
  t text;
  key text;
  rd text;
  wr text;
begin
  foreach t in array array['beam_tabs', 'column_designs', 'attachments',
                           'spans', 'supports', 'point_loads', 'distributed_loads',
                           'moment_loads', 'load_combinations']
  loop
    if t in ('beam_tabs', 'column_designs', 'attachments') then
      key := 'project_id'; rd := 'public.can_read_project'; wr := 'public.owns_project';
    else
      key := 'tab_id';     rd := 'public.can_read_tab';     wr := 'public.owns_tab';
    end if;

    execute format('drop policy if exists %I on public.%I', 'own ' || t, t);
    execute format('drop policy if exists %I on public.%I', t || ' select', t);
    execute format('drop policy if exists %I on public.%I', t || ' insert', t);
    execute format('drop policy if exists %I on public.%I', t || ' update', t);
    execute format('drop policy if exists %I on public.%I', t || ' delete', t);

    execute format('create policy %I on public.%I for select to authenticated using (%s(%I))',
                   t || ' select', t, rd, key);
    execute format('create policy %I on public.%I for insert to authenticated with check (%s(%I))',
                   t || ' insert', t, wr, key);
    execute format('create policy %I on public.%I for update to authenticated using (%s(%I)) with check (%s(%I))',
                   t || ' update', t, wr, key, wr, key);
    execute format('create policy %I on public.%I for delete to authenticated using (%s(%I))',
                   t || ' delete', t, wr, key);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 附件檔案（Storage）：路徑第一層為建立者 id
-- ---------------------------------------------------------------------
drop policy if exists "own attachment files"     on storage.objects;
drop policy if exists "attachment files select" on storage.objects;
drop policy if exists "attachment files insert" on storage.objects;
drop policy if exists "attachment files update" on storage.objects;
drop policy if exists "attachment files delete" on storage.objects;

create policy "attachment files select" on storage.objects for select to authenticated
  using (bucket_id = 'attachments' and public.is_member()
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "attachment files insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
create policy "attachment files update" on storage.objects for update to authenticated
  using (bucket_id = 'attachments' and public.is_member()
         and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and public.is_member()
              and (storage.foldername(name))[1] = auth.uid()::text);
-- 自己的檔案（存檔時移除已刪附件）或管理員刪除專案時
create policy "attachment files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'attachments' and public.is_member()
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
