-- =====================================================================
-- 模板與支撐系統分析與設計程式 — Supabase 資料表結構
-- ---------------------------------------------------------------------
-- 依網頁程式的專案檔格式（app: 'continuous-beam', format: 2）設計：
--   一個專案 = 3 個連續梁分頁（0 面板、1 次墊條、2 主墊條）
--            + 1 個鋼柱（支撐）頁 + 附件 + 報告設定。
-- 連續梁分頁的數值一律以 SI 內部單位儲存：m、kN、mm、MPa、GPa
--   （顯示單位 projects.unit_* 只影響畫面）。
-- 鋼柱頁沿用其模組自己的單位（column_designs.unit_*），欄位值即輸入值。
-- 附件檔案本體放在 Storage bucket「attachments」，資料表只存中繼資料。
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- 共用：updated_at 自動更新
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =====================================================================
-- 參考資料（唯讀）
-- =====================================================================

-- 鋼材等級（GRADES）與鋼筋等級（RGRADES）
create table public.material_grades (
  code        text primary key,                       -- 'SS400', 'SD420' …
  kind        text not null check (kind in ('steel', 'rebar')),
  fy_mpa      numeric not null check (fy_mpa > 0),
  sort_order  int not null default 0
);

-- 型錄斷面（CATALOG）：系統模板用鋼構件
create table public.catalog_sections (
  id          text primary key,                       -- 'BBx', 'BBy', 'TB'
  grade       text not null,
  fy_mpa      numeric not null,                       -- MPa
  e_gpa       numeric not null,                       -- GPa
  g_mpa       numeric,                                -- MPa
  ag_mm2      numeric not null,                       -- 全斷面積 mm²
  an_mm2      numeric,                                -- 淨斷面積 mm²
  i_mm4       numeric not null,                       -- mm⁴
  s_mm3       numeric not null,                       -- mm³
  r_mm        numeric,                                -- 迴轉半徑 mm
  ma_knm      numeric,                                -- 容許彎矩 kN·m
  va_kn       numeric,                                -- 容許剪力 kN
  maj_knm     numeric,                                -- 續接處容許彎矩 kN·m
  vaj_kn      numeric,                                -- 續接處容許剪力 kN
  depth_mm    numeric not null,
  weight_kg_m numeric,                                -- kg/m
  max_span_m  numeric,
  dims        text
);

-- =====================================================================
-- 專案
-- =====================================================================
create table public.projects (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null default auth.uid()
                references auth.users (id) on delete cascade,
  file_name     text not null default '',
  active_tab    smallint not null default 0 check (active_tab between 0 and 2),

  -- 全專案共用設定
  design_code   text not null default 'TW'  check (design_code in ('TW', 'AISC')),
  design_method text not null default 'ASD' check (design_method in ('ASD', 'LRFD')),
  lang          text not null default 'zh'  check (lang in ('zh', 'en', 'th', 'id')),
  unit_force    text not null default 'kN'  check (unit_force  in ('kN', 'N', 'kgf', 'tf', 'kip', 'lbf')),
  unit_length   text not null default 'm'   check (unit_length in ('m', 'cm', 'mm', 'ft', 'in')),
  unit_dim      text not null default 'mm'  check (unit_dim    in ('mm', 'cm', 'in')),
  unit_stress   text not null default 'MPa' check (unit_stress in ('MPa', 'kgf/cm²', 'tf/cm²', 'ksi')),

  -- 報告設定（rep）
  report_name     text not null default '',            -- 工程名稱
  report_item     text not null default '',            -- 項目／構件
  report_no       text not null default '',            -- 編號
  report_designer text not null default '',
  report_date     date default current_date,
  report_paper    text not null default 'A4',
  report_include  jsonb not null default
    '{"inputs":true,"diag":true,"res":true,"design":true,"details":true}'::jsonb,
  -- 各頁是否納入報告：[面板, 次墊條, 主墊條, 鋼柱, 附件]
  report_tabs_include boolean[] not null default array[true, true, true, true, true],

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index projects_owner_idx on public.projects (owner_id, updated_at desc);

create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 連續梁分頁（0 面板、1 次墊條、2 主墊條）
-- =====================================================================
create table public.beam_tabs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  tab_index   smallint not null check (tab_index between 0 and 2),

  view        text not null default 'env',             -- 圖形顯示模式
  flip_m      boolean not null default false,          -- 彎矩圖正負翻轉
  both_we     boolean not null default true,           -- W、E 正反向皆考慮

  -- 撓度限制（dl）
  defl_l_ratio_live  numeric not null default 360,     -- L / ?（活載）
  defl_l_ratio_total numeric not null default 240,     -- L / ?（總載）
  defl_mode          text not null default 'ratio'
                     check (defl_mode in ('ratio', 'abs', 'both')),
  defl_abs_mm        numeric not null default 3,

  -- 樓版載重自動產生（slab）
  slab_on       boolean not null default false,
  slab_t_mm     numeric not null default 250,          -- 樓版厚 mm
  slab_gc_knm3  numeric not null default 23.536,       -- 混凝土單位重 kN/m³
  slab_sd_knm2  numeric not null default 0,            -- 附加靜載 kN/m²
  slab_ll_knm2  numeric not null default 2.452,        -- 施工活載 kN/m²
  slab_s_m      numeric not null default 1,            -- 受載寬度 m

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (project_id, tab_index)
);

create trigger beam_tabs_updated_at
  before update on public.beam_tabs
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 跨（spans）：依序 0..n-1
-- ---------------------------------------------------------------------
create table public.spans (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.beam_tabs (id) on delete cascade,
  idx         smallint not null check (idx >= 0),

  length_m    numeric not null check (length_m > 0),   -- L
  material    text not null default 'steel'
              check (material in ('steel', 'conc', 'wood', 'alum', 'custom')),
  e_gpa       numeric,                                 -- E
  section     text not null default 'H'
              check (section in ('rect', 'circle', 'pipe', 'rhs', 'H', 'cat', 'custom')),

  -- 矩形 rect
  rect_b_mm   numeric, rect_h_mm numeric,
  -- 實心圓 circle
  circle_d_mm numeric,
  -- 圓管 pipe
  pipe_do_mm  numeric, pipe_t_mm numeric,
  -- H 型鋼
  h_h_mm numeric, h_b_mm numeric, h_tw_mm numeric, h_tf_mm numeric,
  -- 矩形管 rhs
  rhs_h_mm numeric, rhs_b_mm numeric, rhs_t_mm numeric,
  -- 自訂 custom：慣性矩（×10⁶ mm⁴）
  ic_e6_mm4   numeric,
  -- 型錄 cat
  catalog_id  text references public.catalog_sections (id),
  splice      boolean not null default false,          -- 是否有續接

  -- 鋼材
  grade       text,                                    -- 'A572-50'、'custom' …
  fy_mpa      numeric,
  lb_m        numeric default 0,                       -- 側向無支撐長度（0 = 跨長）
  cb          numeric default 1,

  -- 鋼筋混凝土
  fc_mpa      numeric, fyr_mpa numeric,
  bot_bars_n  smallint, bot_bar_size text,             -- nb, db（'D22'）
  top_bars_n  smallint, top_bar_size text,             -- nt, dt
  cover_mm    numeric,
  stirrup_size text, stirrup_legs smallint, stirrup_s_mm numeric,  -- ds, legs, sv

  -- 木材容許應力
  wood_fb_mpa numeric, wood_fv_mpa numeric,

  unique (tab_id, idx)
);

-- ---------------------------------------------------------------------
-- 支承（supports）：數量 = 跨數 + 1
-- ---------------------------------------------------------------------
create table public.supports (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.beam_tabs (id) on delete cascade,
  idx         smallint not null check (idx >= 0),
  type        text not null check (type in ('fixed', 'pin', 'roller', 'spring', 'free')),
  spring_k    numeric,                                 -- kN/m（type = spring）
  settlement_mm numeric,                               -- 支承沉陷
  unique (tab_id, idx)
);

-- ---------------------------------------------------------------------
-- 載重（P、w 向下為正；M 逆時針為正；x 自左端起算 m）
-- ---------------------------------------------------------------------
create table public.point_loads (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.beam_tabs (id) on delete cascade,
  idx         smallint not null default 0,
  x_m         numeric not null,
  p_kn        numeric not null,
  load_case   text not null default 'D' check (load_case in ('D', 'L', 'Lr', 'W', 'E'))
);

create table public.distributed_loads (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.beam_tabs (id) on delete cascade,
  idx         smallint not null default 0,
  x1_m        numeric not null,
  x2_m        numeric not null,
  w1_kn_m     numeric not null,
  w2_kn_m     numeric not null,
  load_case   text not null default 'D' check (load_case in ('D', 'L', 'Lr', 'W', 'E'))
);

create table public.moment_loads (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.beam_tabs (id) on delete cascade,
  idx         smallint not null default 0,
  x_m         numeric not null,
  m_knm       numeric not null,
  load_case   text not null default 'D' check (load_case in ('D', 'L', 'Lr', 'W', 'E'))
);

create index point_loads_tab_idx       on public.point_loads (tab_id, idx);
create index distributed_loads_tab_idx on public.distributed_loads (tab_id, idx);
create index moment_loads_tab_idx      on public.moment_loads (tab_id, idx);

-- ---------------------------------------------------------------------
-- 載重組合（combos）：每分頁 4 組預設 ASD / LRFD / TW-ASD / TW-LRFD
-- 每列為一個組合，存各載重情況的係數
-- ---------------------------------------------------------------------
create table public.load_combinations (
  id          uuid primary key default gen_random_uuid(),
  tab_id      uuid not null references public.beam_tabs (id) on delete cascade,
  combo_set   text not null check (combo_set in ('ASD', 'LRFD', 'TW-ASD', 'TW-LRFD')),
  idx         smallint not null check (idx >= 0),
  f_d         numeric not null default 0,
  f_l         numeric not null default 0,
  f_lr        numeric not null default 0,
  f_w         numeric not null default 0,
  f_e         numeric not null default 0,
  unique (tab_id, combo_set, idx)
);

-- =====================================================================
-- 鋼柱（支撐）頁：app 'steel-column-design'
-- 數值為使用者輸入值，單位依本表 unit_* 欄位
-- =====================================================================
create table public.column_designs (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null unique references public.projects (id) on delete cascade,
  version     int not null default 1,
  lang        text not null default 'zh',

  -- 單位
  unit_force  text,                                    -- uf
  unit_length text,                                    -- ul
  unit_dim    text,                                    -- ud
  unit_stress text,                                    -- us

  -- 下拉選單
  design_code   text,                                  -- code
  design_method text,                                  -- method
  grade         text,
  section_type  text,                                  -- secType
  shape         text,
  boundary      text,                                  -- bc（端部條件）
  k_basis       text,                                  -- kb

  -- 材料
  fy numeric, e numeric,
  -- H 型鋼
  h_d numeric, h_bf numeric, h_tw numeric, h_tf numeric,
  -- 箱型
  box_h numeric, box_b numeric, box_t numeric,
  -- 圓管
  pipe_d numeric, pipe_t numeric,
  -- 自訂斷面
  custom_a numeric, custom_ix numeric, custom_iy numeric,
  -- 長度與有效長度係數
  length_x numeric, length_y numeric, kx numeric, ky numeric,
  -- 軸力（PD 靜載、PL 活載）
  p_dead numeric, p_live numeric,
  include_self_weight boolean not null default true,   -- selfwt

  -- 報告抬頭
  project_name text,                                   -- pj
  member_name  text,                                   -- mb
  designer     text,                                   -- dz
  design_date  text,                                   -- dt

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger column_designs_updated_at
  before update on public.column_designs
  for each row execute function public.set_updated_at();

-- =====================================================================
-- 附件（PDF、圖片）— 檔案本體存 Storage：attachments/<owner_id>/<project_id>/<id>
-- =====================================================================
create table public.attachments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects (id) on delete cascade,
  idx           smallint not null default 0,
  name          text not null,                         -- 原始檔名
  title         text not null default '',              -- 報告中顯示的標題
  kind          text not null check (kind in ('pdf', 'image')),
  mime          text,
  size_bytes    bigint check (size_bytes >= 0),
  storage_path  text not null,
  include       boolean not null default true,         -- inc：是否納入報告
  pages         int,                                   -- PDF 頁數
  created_at    timestamptz not null default now()
);

create index attachments_project_idx on public.attachments (project_id, idx);

-- =====================================================================
-- Row Level Security：使用者只能存取自己的專案
-- =====================================================================
alter table public.material_grades   enable row level security;
alter table public.catalog_sections  enable row level security;
alter table public.projects          enable row level security;
alter table public.beam_tabs         enable row level security;
alter table public.spans             enable row level security;
alter table public.supports          enable row level security;
alter table public.point_loads       enable row level security;
alter table public.distributed_loads enable row level security;
alter table public.moment_loads      enable row level security;
alter table public.load_combinations enable row level security;
alter table public.column_designs    enable row level security;
alter table public.attachments       enable row level security;

-- 參考資料：登入者可讀
create policy "read grades"  on public.material_grades  for select to authenticated using (true);
create policy "read catalog" on public.catalog_sections for select to authenticated using (true);

-- 專案
create policy "own projects" on public.projects
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- 判斷是否為自己的專案／分頁
create or replace function public.owns_project(p uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.projects where id = p and owner_id = auth.uid());
$$;

create or replace function public.owns_tab(t uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.beam_tabs bt
    join public.projects p on p.id = bt.project_id
    where bt.id = t and p.owner_id = auth.uid()
  );
$$;

create policy "own beam_tabs" on public.beam_tabs
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy "own column_designs" on public.column_designs
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy "own attachments" on public.attachments
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy "own spans" on public.spans
  for all to authenticated
  using (public.owns_tab(tab_id)) with check (public.owns_tab(tab_id));

create policy "own supports" on public.supports
  for all to authenticated
  using (public.owns_tab(tab_id)) with check (public.owns_tab(tab_id));

create policy "own point_loads" on public.point_loads
  for all to authenticated
  using (public.owns_tab(tab_id)) with check (public.owns_tab(tab_id));

create policy "own distributed_loads" on public.distributed_loads
  for all to authenticated
  using (public.owns_tab(tab_id)) with check (public.owns_tab(tab_id));

create policy "own moment_loads" on public.moment_loads
  for all to authenticated
  using (public.owns_tab(tab_id)) with check (public.owns_tab(tab_id));

create policy "own load_combinations" on public.load_combinations
  for all to authenticated
  using (public.owns_tab(tab_id)) with check (public.owns_tab(tab_id));

-- =====================================================================
-- Storage：附件 bucket（私有），路徑第一層為使用者 id
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "own attachment files" on storage.objects
  for all to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- 參考資料初始值
-- =====================================================================
insert into public.material_grades (code, kind, fy_mpa, sort_order) values
  ('SS400',        'steel', 245, 1),
  ('SN400B',       'steel', 235, 2),
  ('SM490',        'steel', 325, 3),
  ('SN490B',       'steel', 325, 4),
  ('SM570',        'steel', 450, 5),
  ('A36',          'steel', 250, 6),
  ('A572-50',      'steel', 345, 7),
  ('A992',         'steel', 345, 8),
  ('A500-C (HSS)', 'steel', 345, 9),
  ('SD280',        'rebar', 280, 1),
  ('SD420',        'rebar', 420, 2),
  ('SD490',        'rebar', 490, 3),
  ('SD550',        'rebar', 550, 4)
on conflict (code) do nothing;

insert into public.catalog_sections
  (id, grade, fy_mpa, e_gpa, g_mpa, ag_mm2, an_mm2, i_mm4, s_mm3, r_mm,
   ma_knm, va_kn, maj_knm, vaj_kn, depth_mm, weight_kg_m, max_span_m, dims) values
  ('BBx', 'SM490A', 355, 200, 76900, 2300, 1655, 12600000, 126000, 87.3,
   26.8, 90.9, 13,  90,   200, 16.8, null, null),
  ('BBy', 'SM490A', 355, 200, 76900, 2300, 1655,  4400000,  54600, 51.6,
   11.6, null, 5.3, null, 160, 16.8, null, null),
  ('TB',  'SGH490', 365, 200, null,   560,  560,  1754000,  26000, null,
   5.5,  17,   null, null, 135, 5.5,  3.0, '135×50×2.3')
on conflict (id) do nothing;
