-- =====================================================================
-- 資料表與函式的基本存取授權（可重複執行）
-- ---------------------------------------------------------------------
-- 較新的 Supabase 專案不會自動把 SQL 建立的資料表授權給登入使用者，
-- 會出現「permission denied for table ...」。
-- 這裡只授權給已登入的 authenticated 角色；實際能讀寫哪些資料，
-- 仍由 003_auth_roles.sql 的 RLS 規則決定。未登入（anon）不授權。
-- 執行順序：schema.sql → 002 → 003 → 004（本檔）
-- =====================================================================

grant usage on schema public to authenticated;

-- 參考資料：唯讀
grant select on public.material_grades, public.catalog_sections to authenticated;

-- 專案與子資料表
grant select, insert, update, delete on
  public.projects,
  public.beam_tabs,
  public.spans,
  public.supports,
  public.point_loads,
  public.distributed_loads,
  public.moment_loads,
  public.load_combinations,
  public.column_designs,
  public.attachments
to authenticated;

-- RLS 規則中使用的判斷函式
grant execute on function
  public.is_member(),
  public.is_admin(),
  public.owns_project(uuid),
  public.owns_tab(uuid),
  public.can_read_project(uuid),
  public.can_read_tab(uuid)
to authenticated;

-- 未登入者不可存取
revoke all on
  public.material_grades,
  public.catalog_sections,
  public.projects,
  public.beam_tabs,
  public.spans,
  public.supports,
  public.point_loads,
  public.distributed_loads,
  public.moment_loads,
  public.load_combinations,
  public.column_designs,
  public.attachments
from anon;
