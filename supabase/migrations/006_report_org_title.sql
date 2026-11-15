-- =====================================================================
-- 計算書封面：工程單位、自訂標題（可重複執行）
-- 執行順序：schema.sql → 002 → 003 → 004 → 005 → 006（本檔）
-- =====================================================================

alter table public.projects
  add column if not exists report_org   text not null default '',   -- 工程單位
  add column if not exists report_title text not null default '';   -- 計算書標題（空白 = 使用預設名稱）
