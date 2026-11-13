# formworkdesign

模板支撐系統結構分析設計程式（面板、貫材、次墊條、主墊條、鋼柱支撐，含對拉螺桿檢核），須以公司帳號登入，可將專案存到 Supabase 雲端。

網址：https://cmhe0723-maker.github.io/formworkdesign/

## 檔案

| 檔案 | 說明 |
|---|---|
| `index.html` | 主程式（GitHub Pages 首頁） |
| `auth.js` | 登入畫面：限 @sucoot.com、忘記密碼、閒置 12 小時自動登出 |
| `cloud.js` | 雲端專案：儲存、開啟、刪除（刪除限管理員） |
| `supabase/schema.sql` | 資料表、附件 Storage bucket、參考資料 |
| `supabase/migrations/002_slab_flags.sql` | 樓版自動載重欄位 |
| `supabase/migrations/003_auth_roles.sql` | 公司帳號限制、管理員／一般使用者權限 |
| `supabase/migrations/004_grants.sql` | 資料表存取授權（較新的 Supabase 專案必須執行） |
| `supabase/migrations/005_waler_tie.sql` | 貫材分頁、對拉螺桿檢核設定 |

## 使用方式

- 開啟網頁先登入（公司信箱＋密碼），登入後才會顯示程式；右上角顯示帳號與「登出」。
- 登入狀態會保留在瀏覽器，閒置超過 12 小時自動登出。
- 分頁：1 面板、2 貫材、3 次墊條、4 主墊條、5 支撐、6 附件。
  - **貫材**：內容與次墊條相同，可勾選是否使用；未使用時不列入計算書，章節編號自動連續。
  - **對拉螺桿抗拉強度檢核**（主墊條頁最後）：勾選後從 SUCOOT 型錄的 Tie Rod、Wing Nut 選擇材料
    （螺帽只列出同螺紋者，也可「自動選擇合適組合」）。螺桿拉力取 ASD 載重組合下主墊條最大支承反力，
    與型錄安全荷重（最大荷重 ÷ 2）比較；結果列在設計檢核與計算書中。
    啟用時「5. 支撐容許承載力檢核」頁標示為未使用，不列入計算書。
  - 計算書目錄的各頁標題會附上該頁選用的材料與斷面規格。
  - 舊版三頁的專案檔、瀏覽器暫存與雲端專案，開啟時會自動補上「未使用」的貫材頁。
- 右上角 **☁ 雲端**：儲存目前專案、另存新專案、開啟雲端專案。
  - 一般使用者：只看得到、只能修改自己的專案，不能刪除。
  - 管理員：看得到所有人的專案（標示建立者），可以刪除專案。

## Supabase 後台設定（一次性）

1. **SQL Editor** 依序執行（`schema.sql` 只在全新資料庫執行一次，migrations 都可重複執行）：
   `supabase/schema.sql` → `supabase/migrations/002_slab_flags.sql` → `supabase/migrations/003_auth_roles.sql` → `supabase/migrations/004_grants.sql` → `supabase/migrations/005_waler_tie.sql`
   （已執行過 `schema.sql` 的話，從 002 開始。）
2. **Authentication → Sign In / Providers**
   - 關閉 **Allow new users to sign up**（網頁沒有註冊功能，這裡也要關，才能真正擋住自行註冊）。
   - Email provider 保持開啟。
3. **Authentication → URL Configuration**
   - Site URL：`https://cmhe0723-maker.github.io/formworkdesign/`
   - Redirect URLs 加入同一個網址（重設密碼、邀請信的連結才會回到網站）。
4. （建議）**Authentication → Emails → SMTP Settings** 設定公司的寄信伺服器。
   Supabase 內建寄信每小時只能寄少量信件，僅供測試。

## 帳號管理

### 新增帳號
**Authentication → Users → Add user**，二擇一：
- **Create new user**：輸入信箱與初始密碼，勾選 **Auto Confirm User**，再把密碼告訴同事，登入後可用「忘記密碼」自行改密碼。
- **Send invitation**：輸入信箱，同事收到邀請信、點連結後會在網站上設定自己的密碼。

信箱必須是 `@sucoot.com`，其他網域即使建立了帳號也無法登入或讀取資料。

### 設為管理員／取消管理員
在 **SQL Editor** 執行（改完後，對方要登出再登入才會生效）：

```sql
-- 設為管理員
update auth.users
   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'
 where email = 'someone@sucoot.com';

-- 改回一般使用者
update auth.users
   set raw_app_meta_data = raw_app_meta_data - 'role'
 where email = 'someone@sucoot.com';

-- 查看所有管理員
select email from auth.users where raw_app_meta_data ->> 'role' = 'admin';
```

### 停用／恢復帳號
停用後無法再登入；已登入的瀏覽器最多 1 小時內（登入權杖到期）會被登出。

```sql
-- 停用
update auth.users set banned_until = 'infinity' where email = 'someone@sucoot.com';

-- 恢復
update auth.users set banned_until = null where email = 'someone@sucoot.com';
```

### 刪除帳號
**Authentication → Users**，在該帳號右側選單選 **Delete user**。
該帳號建立的雲端專案會一併刪除；若要保留，請改用「停用」。

## 安全性說明

- 雲端專案資料由資料庫權限（RLS）保護：未登入、非公司帳號都讀不到；刪除專案在資料庫端也限管理員。
- 網頁程式本身放在公開的 GitHub Pages，登入畫面擋住的是使用介面，懂技術的人仍可下載網頁原始碼。
- `auth.js`、`cloud.js` 內的 Supabase publishable key 是設計給前端公開使用的金鑰。
