# دليل تطبيق Migration على قاعدة البيانات

## الطرق المتاحة لتطبيق Migration

### الطريقة 1: استخدام Supabase Dashboard (موصى بها) ✅

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اذهب إلى مشروعك: `bnkhgvdoopwyivsaehfa`
3. من القائمة الجانبية، اختر **SQL Editor**
4. انسخ محتوى الملف `supabase/migrations/20240523000000_init_schema.sql`
5. الصق المحتوى في SQL Editor
6. اضغط على **Run** أو `Ctrl+Enter`

### الطريقة 2: استخدام Node.js Script

قم بتشغيل الأمر التالي في Terminal:

```bash
npm run migrate
```

أو:

```bash
node scripts/apply-migration-pg.mjs
```

### الطريقة 3: استخدام psql (إذا كان مثبتاً)

```bash
psql "postgresql://postgres:wWJ47WVKHfHiL1vo@db.bnkhgvdoopwyivsaehfa.supabase.co:5432/postgres" -f supabase/migrations/20240523000000_init_schema.sql
```

## التحقق من نجاح Migration

بعد تطبيق Migration، يمكنك التحقق من خلال:

### 1. Supabase Dashboard
- اذهب إلى **Table Editor**
- يجب أن ترى الجداول التالية:
  - `profiles`
  - `restaurants`
  - `orders`
  - `deliveries`

### 2. استخدام SQL Query
قم بتشغيل هذا الاستعلام في SQL Editor:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'restaurants', 'orders', 'deliveries');
```

## الجداول المُنشأة

### 1. profiles
- `user_id` (UUID, Primary Key)
- `role` (customer | restaurant | driver)
- `full_name`, `phone`
- `created_at`, `updated_at`

### 2. restaurants
- `id` (UUID, Primary Key)
- `name`, `location`, `status`
- `owner_id` (Foreign Key → profiles)
- `created_at`, `updated_at`

### 3. orders
- `id` (UUID, Primary Key)
- `customer_id` (Foreign Key → profiles)
- `restaurant_id` (Foreign Key → restaurants)
- `status`, `total_amount`, `items` (JSONB)
- `created_at`, `updated_at`

### 4. deliveries
- `id` (UUID, Primary Key)
- `order_id` (Foreign Key → orders)
- `driver_id` (Foreign Key → profiles)
- `status`, `location_data` (JSONB)
- `created_at`, `updated_at`

## الميزات المُفعّلة

✅ **Row Level Security (RLS)** على جميع الجداول
✅ **Indexes** لتحسين الأداء
✅ **Triggers** لتحديث `updated_at` تلقائياً
✅ **Realtime** للتحديثات الفورية
✅ **Foreign Keys** لضمان سلامة البيانات

## استكشاف الأخطاء

### خطأ: "relation already exists"
هذا يعني أن الجداول موجودة بالفعل. يمكنك:
- تجاهل الخطأ إذا كانت الجداول صحيحة
- حذف الجداول وإعادة التشغيل (احذر: سيتم فقدان البيانات!)

### خطأ: "permission denied"
تأكد من استخدام `SUPABASE_SERVICE_ROLE_KEY` وليس `ANON_KEY`

### خطأ: "connection refused"
تحقق من:
- صحة `DATABASE_URL` في `.env.local`
- الاتصال بالإنترنت
- أن المشروع نشط في Supabase

## الخطوات التالية

بعد تطبيق Migration بنجاح:

1. ✅ تشغيل خادم التطوير: `npm run dev`
2. ✅ اختبار الواجهات على `http://localhost:3000`
3. ✅ إضافة بيانات تجريبية
4. ✅ تطوير الوظائف الكاملة للنظام
