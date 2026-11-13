-- =====================================================================
-- 貫材分頁與對拉螺桿檢核（可重複執行）
-- ---------------------------------------------------------------------
-- 分頁編號沿用舊值：0 面板、1 次墊條、2 主墊條，新增 3 = 貫材。
-- 舊專案沒有編號 3，網頁開啟時會自動補上「未使用」的貫材頁。
-- 執行順序：schema.sql → 002 → 003 → 004 → 005（本檔）
-- =====================================================================

-- 分頁編號允許 0–3
alter table public.beam_tabs drop constraint if exists beam_tabs_tab_index_check;
alter table public.beam_tabs add constraint beam_tabs_tab_index_check check (tab_index between 0 and 3);

alter table public.projects drop constraint if exists projects_active_tab_check;
alter table public.projects add constraint projects_active_tab_check check (active_tab between 0 and 3);

-- 是否使用此頁（貫材頁可取消）
alter table public.beam_tabs
  add column if not exists in_use boolean not null default true;

-- 對拉螺桿抗拉強度檢核（主墊條頁）：是否檢核、螺桿與螺帽型號（型錄編號，例如 BS84-17、WN94-17B）
alter table public.beam_tabs
  add column if not exists tie_on  boolean not null default false,
  add column if not exists tie_rod text,
  add column if not exists tie_nut text;
