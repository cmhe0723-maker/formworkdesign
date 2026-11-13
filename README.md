# formworkdesign

模板與支撐系統分析與設計程式（面板、次墊條、主墊條、鋼柱支撐），可將專案存到 Supabase 雲端。

網址：https://cmhe0723-maker.github.io/formworkdesign/

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html` | 主程式（GitHub Pages 首頁） |
| `cloud.js` | 雲端專案：登入、儲存、開啟、刪除（Supabase） |
| `supabase/schema.sql` | 資料表、權限（RLS）、附件 Storage bucket、參考資料 |
| `supabase/migrations/002_slab_flags.sql` | 已執行過舊版 schema 的資料庫才需要執行 |

## 使用方式

- 右上角 **☁ 雲端**（或「檔案」選單）→ 登入或註冊 → 儲存目前專案、另存新專案、開啟或刪除雲端專案。
- 「檔案」選單原本的開啟／儲存 JSON 仍可使用，存檔會以瀏覽器下載。

## 首次設定

1. **Supabase 資料庫**：在 Supabase 的 SQL Editor 執行 `supabase/schema.sql`。
   若之前已執行過舊版，改執行 `supabase/migrations/002_slab_flags.sql`。
2. **Supabase 登入網址**：Authentication → URL Configuration，
   Site URL 與 Redirect URLs 加入 `https://cmhe0723-maker.github.io/formworkdesign/`，
   註冊確認信的連結才會回到網站。
3. **GitHub Pages**：Repository Settings → Pages → Source 選 *Deploy from a branch*，
   Branch 選 `main`、資料夾 `/ (root)`。

`cloud.js` 內的 Supabase publishable key 是公開金鑰，可以放在前端；資料由 RLS 保護，
每位使用者只能存取自己的專案與附件。
