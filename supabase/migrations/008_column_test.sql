-- =====================================================================
-- 支撐（鋼柱）頁：依破壞載重試驗報告檢核（可重複執行）
-- test_load：試驗報告承載力值（單腳，依該頁力單位輸入之數值）
-- test_fs  ：安全係數（預設 2.5）
-- 執行順序：schema.sql → 002 → … → 007 → 008（本檔）
-- =====================================================================

alter table public.column_designs
  add column if not exists test_load numeric,
  add column if not exists test_fs   numeric;
