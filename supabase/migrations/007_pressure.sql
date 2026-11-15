-- =====================================================================
-- 混凝土側壓力計算頁（可重複執行）
-- 存放該頁設定：是否使用、構件型式、澆置高度、速率、溫度、密度、水泥種類、澆置條件
-- （內部單位：m、m/h、°C、kg/m³）
-- 執行順序：schema.sql → 002 → … → 006 → 007（本檔）
-- =====================================================================

alter table public.projects
  add column if not exists pressure jsonb;

-- 各梁頁自動均佈載重的來源：slab = 樓版載重（頂版模板）、press = 混凝土側壓力（牆模）
alter table public.beam_tabs
  add column if not exists slab_src text not null default 'slab';
