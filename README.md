# TempMail Server — server ខ្លួនឯងសម្រាប់ TempMail

Server តូច (Node.js + Express, អត់មាន build step) ដែលហៅ mail.tm
(@fldubai.com) ពីខាង server — ដូច្នេះ app អាចទទួលសំបុត្រពិត
(រួមទាំងកូដ OTP / verification code ពី Meta, Muse…) បាន ហើយអាច
share ជា public link បាន។

**គ្មាន API key, គ្មាន password របស់អ្នកប្រើ ក្នុងកូដទេ។**
Password សម្រាប់ account បណ្តោះអាសន្ននីមួយៗ បង្កើតដោយ server
ដោយចៃដន្យ។ Token រក្សាទុកក្នុង browser របស់អ្នកប្រើ (localStorage)
ហើយផ្ញើមក server វិញរាល់ request — server អត់រក្សាទុកអ្វីលើ disk ទេ។

## របៀបដាក់លើ Render (Free)

### ជំហាន ១ — ដាក់កូដលើ GitHub
1. បើក https://github.com/new → បង្កើត repo ថ្មី ឈ្មោះ `tempmail-server` (Public) → Create repository
2. នៅលើទូរស័ព្ទ ប្រើ app GitHub ឬ Termux ដើម្បី upload file ទាំងអស់នេះ
   (`server.js`, `package.json`, `public/index.html`, `README.md`) ទៅ repo នោះ
   (ឬបើក github.com លើ browser ហើយចុច Add file → Upload files)

### ជំហាន ២ — បង្កើត Web Service នៅ Render
1. បើក https://render.com → Log in (ប្រើ Gmail របស់អ្នក)
2. ចុច **New +** → **Web Service**
3. ជ្រើស repo `tempmail-server` → Connect
4. កំណត់ដូចនេះ៖
   - **Name:** `tempmail-server`
   - **Region:** Singapore
   - **Branch:** main
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Instance Type:** **Free**
5. ចុច **Create Web Service** → រង់ចាំ 2–3 នាទីរហូតដល់ Status បង្ហាញ **Live**
6. Link public របស់អ្នកនឹងជា៖ `https://tempmail-server.onrender.com`
   (បើឈ្មោះនេះមានគេយកហើយ Render នឹងដាក់លេខបន្ថែមដោយស្វ័យប្រវត្តិ)

### ជំហាន ៣ — កុំឲ្យ server ដេក (Free tier ដេកក្រោយ 15 នាទីអត់មានគេប្រើ)
- បើក link ម្តងម្កាល ឬដាក់ cron ping រាល់ 10 នាទីទៅ `https://tempmail-server.onrender.com/api/health`
  (ដូច MovAi ដែរ)។ ពេលគេបើក link លើកដំបូងក្រោយដេក វាអាចចាំ ~30–50 វិនាទី
  ដើម្បីភ្ញាក់ — នោះជារឿងធម្មតារបស់ Free tier។

## រត់លើកុំព្យូទ័រខ្លួនឯង (សាក)
```
npm install
node server.js
```
រួចបើក http://localhost:3000

## API របស់ server
- `GET /api/domains` — domain ដែលមាន (live ពី mail.tm)
- `POST /api/address` `{username?, domain?}` — បង្កើត account ថ្មី → `{address, accountId, token}`
- `GET /api/messages` — header `Authorization: Bearer <token>` — បញ្ជីសំបុត្រ
- `GET /api/message/:id` — header `Authorization: Bearer <token>` — សំបុត្រពេញ
- `DELETE /api/address/:id` — header `Authorization: Bearer <token>` — លុប account
- `GET /api/health` — ឆែកថា server ដើរឬអត់
