-- =====================================================================
-- 檢核流程修正（可重複執行）
-- spans          ：H 型鋼受壓翼板連續側撐確認、RC 上層筋位置、RC 規範版次
-- beam_tabs      ：牆模側壓力分布方式、對拉螺桿型錄版本與雙主墊條承壓檢核
-- column_designs ：破壞載重試驗配置與適用確認
-- projects       ：主墊條反力帶入鋼柱的來源（控制支點、組合、上拔）
-- 執行順序：schema.sql → 002 → … → 009 → 010（本檔）
-- =====================================================================

alter table public.spans
  add column if not exists lb_braced    boolean not null default false,
  add column if not exists top_cover_mm numeric,
  add column if not exists rc_code      text;

alter table public.beam_tabs
  add column if not exists slab_dist  text not null default 'max',
  add column if not exists slab_z_m   numeric not null default 0,
  add column if not exists slab_rev   boolean not null default false,
  add column if not exists tie_cat    text,
  add column if not exists tie_dbl    boolean not null default false,
  add column if not exists tie_gap_mm numeric,
  add column if not exists tie_bf_mm  numeric,
  add column if not exists tie_fp_mpa numeric;

alter table public.column_designs
  add column if not exists test_report text,
  add column if not exists test_height text,
  add column if not exists test_layers text,
  add column if not exists test_brace  text,
  add column if not exists test_jack   text,
  add column if not exists test_ecc    text,
  add column if not exists test_conf   boolean not null default false;

alter table public.projects
  add column if not exists column_reaction jsonb;

-- 側壓力分布方式只允許 max（全長 Pmax）、fix（固定深度）、vert（沿深度分布）
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'beam_tabs_slab_dist_chk') then
    alter table public.beam_tabs add constraint beam_tabs_slab_dist_chk check (slab_dist in ('max', 'fix', 'vert'));
  end if;
end $$;

comment on column public.spans.lb_m is '側撐間距 Lb（m）；null = 未輸入（H 型鋼必填），0 = 受壓翼板連續側撐（須 lb_braced = true）';
