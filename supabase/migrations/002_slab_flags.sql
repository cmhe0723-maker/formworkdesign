-- 已執行過舊版 schema.sql 的資料庫，請再執行本檔（可重複執行）。
-- 新資料庫直接執行最新的 schema.sql 即可，不需要本檔。

-- 樓版自動載重：是否略過 D／L 載重（網頁 slab.noD、slab.noL）
alter table public.beam_tabs
  add column if not exists slab_no_d boolean not null default false,
  add column if not exists slab_no_l boolean not null default false;

-- 分布載重：是否由樓版設定自動產生（網頁 dists[].gen）
alter table public.distributed_loads
  add column if not exists is_generated boolean not null default false;
