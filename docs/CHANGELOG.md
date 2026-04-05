# 📝 سجل التغييرات (Changelog)
## Restaurant Distributed System

جميع التغييرات الملحوظة في هذا المشروع موثقة في هذا الملف.

---

## [0.8.0] - 4 أبريل 2026

### 🏪 تسجيل المطاعم متعدد الخطوات + إصلاحات شاملة

#### ✅ الإضافات الجديدة (Added)

##### 1. نظام تسجيل المطاعم متعدد الخطوات (Multi-Step Wizard)
- **الملف**: `app/signup/page.tsx`
- **الميزات**:
  - خطوة 1: بيانات الحساب (الاسم، الهاتف، البريد، كلمة المرور)
  - خطوة 2: بيانات المطعم (اسم المطعم، الموقع) - لأصحاب المطاعم فقط
  - شريط تقدم مرئي يعرض الخطوة الحالية
  - زر "السابق" للعودة للخطوة الأولى
  - تسجيل ذري (Atomic): إنشاء الحساب والمطعم في معاملة واحدة

##### 2. دالة RPC لتسجيل صاحب المطعم
- **الملف**: `supabase/migrations/20240523000017_register_restaurant_owner.sql`
- **الدالة**: `register_restaurant_owner(p_user_id, p_full_name, p_phone, p_restaurant_name, p_restaurant_location, p_restaurant_status)`
- **الميزات**:
  - `SECURITY DEFINER` لتجاوز RLS
  - إنشاء الملف الشخصي والمطعم في معاملة واحدة
  - Rollback تلقائي عند فشل أي جزء
  - رسائل خطأ واضحة

##### 3. إصلاح دالة قبول التوصيل
- **الملف**: `supabase/migrations/20240523000015_fix_accept_delivery.sql`
- **التحسينات**:
  - جلب `pickup_location` من جدول `restaurants`
  - جلب `delivery_location` من ملاحظات الطلب
  - إدراج المواقع في جدول `deliveries`

##### 4. إصلاح دالة إكمال التوصيل
- **الملف**: `supabase/migrations/20240523000016_fix_complete_delivery.sql`
- **التحسينات**:
  - إضافة أعمدة `delivered_at` و `picked_up_at` لجدول `deliveries`
  - تحسين معالجة الأخطاء مع رسائل تفصيلية
  - التحقق من نجاح التحديث باستخدام `GET DIAGNOSTICS`

##### 5. إصلاح شامل لسياسات RLS
- **الملف**: `supabase/migrations/20240523000014_fix_rls_recursion_final.sql`
- **الدوال الجديدة**:
  - `get_user_restaurant_ids(user_uuid)` - جلب معرفات مطاعم المستخدم
  - `get_driver_order_ids(driver_uuid)` - جلب معرفات طلبات السائق
  - `user_owns_restaurant(user_uuid, rest_id)` - التحقق من ملكية المطعم
- **السياسات المُصلحة**:
  - `orders_select_ready` - السائقين يرون الطلبات الجاهزة
  - `orders_select_delivering` - السائقين يرون طلباتهم
  - `orders_update_driver` - السائقين يحدثون طلباتهم

#### 🔄 التحديثات (Changed)

##### تحسين Realtime Subscriptions
- **الملفات**: `app/restaurant/dashboard/page.tsx`, `app/driver/dashboard/page.tsx`
- **التحسينات**:
  - استخدام supabase client واحد في كل effect
  - ترتيب صحيح: `channel() -> on() -> subscribe()`
  - إضافة cleanup function مع `removeChannel()`
  - إضافة session logging للتصحيح
  - أسماء قنوات فريدة لكل مستخدم

##### تحسين UserNav
- **الملف**: `components/auth/UserNav.tsx`
- **التحسينات**:
  - استخدام `useRef` لتخزين supabase client
  - فحص session قبل getUser
  - إضافة cleanup لمنع memory leaks

##### تحسين سكريبت Seed
- **الملف**: `scripts/seed-users.mjs`
- **التحسينات**:
  - إضافة dotenv لتحميل `.env.local`
  - استخدام `NEXT_PUBLIC_SUPABASE_URL` من البيئة

#### 🐛 الإصلاحات (Fixed)

| المشكلة | الحل |
|---------|------|
| `infinite recursion in policy for relation "orders"` | استخدام `SECURITY DEFINER` functions |
| `null value in column "pickup_location"` | جلب الموقع من جدول `restaurants` |
| `Error completing delivery` | إضافة عمود `delivered_at` وتحسين الدالة |
| `Lock was released` errors | تقليل استدعاءات `supabase.auth.getUser()` |
| Realtime subscriptions not cleaning up | إضافة cleanup في useEffect |

#### 📁 الملفات المُضافة

```
supabase/migrations/20240523000013_fix_rls_final.sql
supabase/migrations/20240523000014_fix_rls_recursion_final.sql
supabase/migrations/20240523000015_fix_accept_delivery.sql
supabase/migrations/20240523000016_fix_complete_delivery.sql
supabase/migrations/20240523000017_register_restaurant_owner.sql
```

#### 📁 الملفات المُحدّثة

```
app/signup/page.tsx                    # Multi-step wizard
app/restaurant/dashboard/page.tsx      # Realtime fixes
app/driver/dashboard/page.tsx          # Realtime fixes
components/auth/UserNav.tsx            # Performance fixes
scripts/seed-users.mjs                 # dotenv support
```

#### 🔒 معمارية التسجيل الذري

```
┌─────────────────┐
│   Signup Form   │
│   (Step 1)      │
│  User Details   │
└────────┬────────┘
         │
         ▼ (if restaurant)
┌─────────────────┐
│   Signup Form   │
│   (Step 2)      │
│ Restaurant Info │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  supabase.auth  │────→│   Auth User     │
│    .signUp()    │     │   Created       │
└────────┬────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  supabase.rpc   │────→│   TRANSACTION   │
│  'register_     │     │  ┌───────────┐  │
│   restaurant_   │     │  │ profiles  │  │
│   owner'        │     │  │  INSERT   │  │
└─────────────────┘     │  └─────┬─────┘  │
                        │        │        │
                        │  ┌─────▼─────┐  │
                        │  │restaurants│  │
                        │  │  INSERT   │  │
                        │  └───────────┘  │
                        │   COMMIT/       │
                        │   ROLLBACK      │
                        └─────────────────┘
```

---

## [0.7.0] - 2 أبريل 2026

### 🔒 إصلاح شامل لسياسات RLS ونظام تتبع الطلبات

#### ✅ الإضافات الجديدة (Added)

##### 1. نظام تتبع الطلب في الوقت الفعلي (Order Tracker)
- **الملف**: `app/customer/orders/[orderId]/page.tsx`
- **الميزات**:
  - شريط تقدم (Stepper) عصري يعرض مراحل الطلب
  - مراحل الطلب: ⏳ قيد الانتظار → ✅ تم التأكيد → 👨‍🍳 جاري التحضير → 📦 جاهز → 🚗 جاري التوصيل → 🎉 تم التوصيل
  - Supabase Realtime للاستماع لتحديثات الطلب فوراً
  - Toast Notifications تظهر عند تغيير حالة الطلب
  - تصميم متجاوب مع Tailwind CSS
  - عرض تفاصيل الطلب (المطعم، المبلغ، الملاحظات)

##### 2. صفحة قائمة طلبات العميل
- **الملف**: `app/customer/orders/page.tsx`
- **الميزات**:
  - عرض جميع طلبات العميل
  - بطاقات تفاعلية مع حالة كل طلب
  - رابط لصفحة التتبع لكل طلب
  - ألوان مميزة لكل حالة

##### 3. Toast Notifications
- **الملف**: `app/layout.tsx`
- إضافة `<Toaster />` من Sonner للإشعارات
- إشعارات فورية عند تغيير حالة الطلب

##### 4. دوال Security Definer للتحقق من الأدوار
- **الملف**: `supabase/migrations/20240523000011_comprehensive_rls_fix.sql`
- **الدوال**:
  - `is_customer(user_uuid)` - التحقق من أن المستخدم عميل
  - `is_restaurant_owner(user_uuid)` - التحقق من أن المستخدم صاحب مطعم
  - `is_driver(user_uuid)` - التحقق من أن المستخدم سائق
  - `owns_restaurant(user_uuid, rest_id)` - التحقق من ملكية المطعم
  - `get_user_restaurant_id(user_uuid)` - جلب معرف مطعم المستخدم

#### 🔄 التحديثات (Changed)

##### إصلاح شامل لسياسات RLS

###### جدول Orders
| السياسة | الوصف |
|---------|-------|
| `orders_select_customer` | العميل يرى طلباته فقط |
| `orders_select_restaurant` | المطعم يرى طلبات مطعمه فقط |
| `orders_select_ready_drivers` | السائق يرى الطلبات الجاهزة للتوصيل |
| `orders_select_delivering_driver` | السائق يرى الطلبات التي يوصلها |
| `orders_insert_customer` | العميل يمكنه إنشاء طلبات |
| `orders_update_customer_pending` | العميل يمكنه تعديل طلباته المعلقة |
| `orders_update_restaurant` | المطعم يمكنه تحديث طلبات مطعمه |
| `orders_update_driver` | السائق يمكنه تحديث الطلبات التي يوصلها |

###### جدول Profiles
| السياسة | الوصف |
|---------|-------|
| `profiles_select_own` | المستخدم يرى ملفه فقط |
| `profiles_insert_own` | المستخدم يمكنه إنشاء ملفه |
| `profiles_update_own` | المستخدم يمكنه تعديل ملفه |
| `profiles_service_role` | Service Role له صلاحية كاملة |

###### جدول Deliveries
| السياسة | الوصف |
|---------|-------|
| `deliveries_select_driver` | السائق يرى توصيلاته |
| `deliveries_select_available` | السائق يرى التوصيلات المتاحة |
| `deliveries_select_customer` | العميل يرى توصيلات طلباته |
| `deliveries_select_restaurant` | المطعم يرى توصيلات طلباته |
| `deliveries_insert_driver` | السائق يمكنه قبول التوصيلات |
| `deliveries_update_driver` | السائق يمكنه تحديث توصيلاته |

###### جدول Restaurants
| السياسة | الوصف |
|---------|-------|
| `restaurants_select_all` | الجميع يمكنهم رؤية المطاعم |
| `restaurants_insert_owner` | صاحب المطعم يمكنه إنشاء مطعم |
| `restaurants_update_owner` | صاحب المطعم يمكنه تعديل مطعمه |

#### 🐛 الإصلاحات (Fixed)

##### 1. إصلاح خطأ Infinite Recursion
- **المشكلة**: سياسات RLS كانت تستخدم `EXISTS` للتحقق من جدول `profiles` مما يسبب تكرار لا نهائي
- **الحل**: استخدام دوال `SECURITY DEFINER` لتجاوز RLS في التحقق

##### 2. إصلاح عدم ظهور الطلبات للسائق
- **المشكلة**: السائق لم يكن يرى الطلبات الجاهزة للتوصيل
- **الحل**: إضافة سياسة `orders_select_ready_drivers` للسماح للسائقين برؤية الطلبات بحالة `ready`

##### 3. إصلاح خطأ إنشاء الطلب
- **المشكلة**: خطأ "infinite recursion detected in policy for relation orders"
- **الحل**: إعادة هيكلة سياسات RLS باستخدام Security Definer functions

#### 📊 معمارية Realtime المحدثة

```
┌─────────────────┐                              
│    Customer     │  Creates Order               
│   Order Page    │ ─────────────────────────────┐
└─────────────────┘                              │
                                                 ▼
┌─────────────────┐     Realtime      ┌─────────────────┐
│   Restaurant    │◄─────────────────│     orders      │
│   Dashboard     │   (filter:        │     table       │
└────────┬────────┘   restaurant_id)  └────────┬────────┘
         │                                      │
         │ UPDATE status='ready'                │
         ▼                                      │
┌─────────────────┐     Realtime      ┌────────▼────────┐
│     Driver      │◄─────────────────│   Broadcast     │
│   Dashboard     │   (filter:        │ 'new_order_ready'│
└────────┬────────┘   status=ready)   └─────────────────┘
         │
         │ Accept Delivery
         ▼
┌─────────────────┐     Realtime      ┌─────────────────┐
│    Customer     │◄─────────────────│   Order Update  │
│  Order Tracker  │   (filter:        │   (Stepper)     │
└─────────────────┘   order_id)       └─────────────────┘
```

#### 📁 الملفات المُضافة

```
app/customer/orders/page.tsx              # قائمة طلبات العميل
app/customer/orders/[orderId]/page.tsx    # صفحة تتبع الطلب
components/ui/sonner.tsx                  # مكون Toast
scripts/seed-users.mjs                    # سكريبت إنشاء المستخدمين
supabase/migrations/20240523000008_fix_orders_rls_recursion.sql
supabase/migrations/20240523000009_fix_driver_orders_rls.sql
supabase/migrations/20240523000011_comprehensive_rls_fix.sql
```

#### 📁 الملفات المُحدّثة

```
app/layout.tsx                            # إضافة Toaster
app/customer/order/page.tsx               # توجيه لصفحة التتبع بعد الإنشاء
```

---

## [0.6.0] - 2 أبريل 2026

### 🎨 بوابة الدخول الموحدة (Unified Login Gateway) - UI/UX Update

#### ✅ الإضافات الجديدة (Added)

##### 1. صفحة هبوط جديدة (`/`)
- **الملف**: `app/page.tsx`
- **الميزات**:
  - تصميم عصري مع خلفية متدرجة (Gradient)
  - تأثيرات ضوئية (Blur Effects) للخلفية
  - شعار RDS مع ألوان متدرجة
  - شرح فكرة النظام الموزع
  - أزرار "تسجيل الدخول" و "إنشاء حساب"
  - بطاقات الميزات (للعملاء، للمطاعم، للسائقين)
  - تصميم متجاوب (Responsive) للهواتف

##### 2. صفحة تسجيل دخول محسّنة (`/login`)
- **الملف**: `app/login/page.tsx`
- **الميزات**:
  - تصميم متناسق مع صفحة الهبوط
  - بطاقة شفافة (Glass Effect) مع Backdrop Blur
  - أزرار تعبئة سريعة ملونة حسب الدور
  - رسالة ترحيب "مرحباً بعودتك"
  - رابط العودة للصفحة الرئيسية

##### 3. صفحة إنشاء حساب محسّنة (`/signup`)
- **الملف**: `app/signup/page.tsx`
- **الميزات**:
  - اختيار نوع الحساب بأزرار ملونة تفاعلية
  - تصميم متناسق مع باقي الصفحات
  - حقول كلمة المرور في صف واحد (Grid)
  - رسائل نجاح/خطأ بألوان مناسبة

#### 🔄 التحديثات (Changed)

##### تحديث Middleware
- **الملف**: `middleware.ts`
- إضافة `roleDefaultPaths` للتوجيه الصحيح:
  - `customer` → `/customer`
  - `restaurant` → `/restaurant/dashboard`
  - `driver` → `/driver/dashboard`
- توجيه المستخدم المسجل تلقائياً لـ Dashboard الخاص به

##### تحديث مسارات التوجيه
- المطعم يُوجَّه إلى `/restaurant/dashboard` بدلاً من `/restaurant`
- السائق يُوجَّه إلى `/driver/dashboard` بدلاً من `/driver`

#### 🎨 نظام الألوان

| الدور | اللون الأساسي | الاستخدام |
|-------|--------------|-----------|
| عميل | أزرق (`blue-500`) | خلفية الأزرار والبطاقات |
| مطعم | أخضر (`green-500`) | خلفية الأزرار والبطاقات |
| سائق | بنفسجي (`purple-500`) | خلفية الأزرار والبطاقات |

#### 📱 التصميم المتجاوب (Responsive)

- الصفحات متوافقة مع جميع أحجام الشاشات
- استخدام `sm:`, `md:`, `lg:` breakpoints
- تخطيط مرن (Flexbox) و Grid
- أحجام خطوط متغيرة حسب الشاشة

---

## [0.5.0] - 2 أبريل 2026

### 🧪 البيانات التجريبية (Seed Data & Test Users)

#### ✅ الإضافات الجديدة (Added)

##### 1. سكريبت إنشاء المستخدمين التجريبيين
- **الملف**: `lib/supabase/seed-users.ts`
- **الميزات**:
  - إنشاء 3 مستخدمين تجريبيين (عميل، مطعم، سائق)
  - استخدام `supabase.auth.admin.createUser` مع Service Role
  - إنشاء ملفات المستخدمين في جدول `profiles`
  - إنشاء مطعم تجريبي مرتبط بصاحب المطعم
  - دالة حذف المستخدمين التجريبيين

##### 2. API Endpoint للـ Seeding
- **الملف**: `app/api/seed/route.ts`
- **الـ Endpoints**:
  - `POST /api/seed` - إنشاء البيانات التجريبية
  - `DELETE /api/seed` - حذف البيانات التجريبية

##### 3. أزرار التعبئة السريعة في صفحة تسجيل الدخول
- **الملف**: `app/login/page.tsx`
- **الميزات**:
  - زر "👤 عميل" - تعبئة بيانات العميل التجريبي
  - زر "🍽️ مطعم" - تعبئة بيانات صاحب المطعم
  - زر "🚗 سائق" - تعبئة بيانات السائق
  - زر "⚙️ إنشاء حسابات تجريبية" - إنشاء الحسابات عبر API

##### 4. Migration للبيانات التجريبية
- **الملف**: `supabase/migrations/20240523000003_seed_test_users.sql`
- دالة مساعدة `check_test_data_exists()`

#### 📋 بيانات الاختبار

| الدور | البريد الإلكتروني | كلمة المرور |
|-------|-------------------|-------------|
| عميل | `customer@example.com` | `123456` |
| مطعم | `restaurant@example.com` | `123456` |
| سائق | `driver@example.com` | `123456` |

#### 🍽️ المطعم التجريبي

| الحقل | القيمة |
|-------|--------|
| الاسم | مطعم الاختبار |
| الموقع | الرياض - حي النخيل |
| الحالة | مفتوح |

#### 🔄 طريقة الاستخدام

1. افتح صفحة تسجيل الدخول `/login`
2. اضغط على "⚙️ إنشاء حسابات تجريبية"
3. انتظر رسالة النجاح
4. اضغط على أحد أزرار التعبئة السريعة (عميل/مطعم/سائق)
5. اضغط "تسجيل الدخول"

#### 🔒 ملاحظات أمنية

- يتم استخدام Service Role Key لإنشاء المستخدمين
- الـ API محمي ويعمل فقط في بيئة التطوير
- كلمة المرور موحدة للاختبار فقط

---

## [0.4.0] - 2 أبريل 2026

### 🚗 نظام التوصيل (Delivery System) - Application-Level Multicast

#### ✅ الإضافات الجديدة (Added)

##### 1. لوحة تحكم السائق (`/driver/dashboard`)
- **الملف**: `app/driver/dashboard/page.tsx`
- **الميزات**:
  - عرض الطلبات الجاهزة للتوصيل في الوقت الفعلي
  - استقبال إشعارات فورية عند توفر طلبات جديدة (Multicast)
  - زر "قبول التوصيل" مع معالجة Race Condition
  - عرض توصيلاتي النشطة
  - زر "تم التوصيل" لإكمال التوصيل
  - إشعارات مرئية (Alert) للطلبات الجديدة

##### 2. نظام Multicast للسائقين
- **Channel**: `available_drivers`
- **الأحداث**:
  - `new_order_ready` - إشعار جميع السائقين بطلب جاهز
  - `order_taken` - إشعار السائقين بأن الطلب تم حجزه

##### 3. معالجة Race Condition
- **الملف**: `supabase/migrations/20240523000002_delivery_system.sql`
- **الدالة**: `accept_delivery(p_order_id, p_driver_id)`
  - قفل الصف (Row Lock) باستخدام `FOR UPDATE NOWAIT`
  - التحقق من حالة الطلب قبل القبول
  - منع قبول نفس الطلب من سائقين مختلفين
  - إرسال Broadcast لإلغاء الطلب من شاشات السائقين الآخرين

##### 4. دالة إكمال التوصيل
- **الدالة**: `complete_delivery(p_delivery_id, p_driver_id)`
  - تحديث حالة التوصيل إلى `delivered`
  - تحديث حالة الطلب إلى `delivered`
  - إرسال إشعار بإكمال التوصيل

##### 5. Database Triggers للتوصيل
- **Trigger**: `trigger_notify_drivers_order_ready`
  - يُنفذ عند تغيير حالة الطلب إلى `ready`
  - يُرسل `pg_notify` لجميع السائقين

##### 6. تحسينات جدول profiles
- إضافة حقل `current_location` (TEXT)
- إضافة حقل `is_available` (BOOLEAN)
- فهرس للسائقين المتاحين

##### 7. سياسات RLS للتوصيلات
- السائق يمكنه تحديث توصيلاته المعينة له فقط

#### 🔄 التحديثات (Changed)

##### تحديث واجهة السائق
- **الملف**: `app/driver/page.tsx`
- إضافة زر "لوحة التحكم - الطلبات"

##### تحديث لوحة تحكم المطعم
- **الملف**: `app/restaurant/dashboard/page.tsx`
- إرسال Broadcast للسائقين عند تغيير حالة الطلب إلى `ready`

#### 📊 معمارية Multicast

```
┌─────────────────┐                              ┌─────────────────┐
│   Restaurant    │  UPDATE status='ready'       │     orders      │
│   Dashboard     │ ────────────────────────────→│     table       │
└─────────────────┘                              └────────┬────────┘
        │                                                 │
        │ Broadcast                              ┌────────▼────────┐
        │ 'new_order_ready'                      │    TRIGGER      │
        │                                        │ notify_drivers  │
        ▼                                        └────────┬────────┘
┌─────────────────┐                                       │
│  Supabase       │                              ┌────────▼────────┐
│  Channel:       │←─────────────────────────────│   pg_notify     │
│ available_drivers│                             │'delivery_requests'│
└────────┬────────┘                              └─────────────────┘
         │
         │ Multicast to ALL connected drivers
         │
    ┌────┴────┬────────────┬────────────┐
    ▼         ▼            ▼            ▼
┌───────┐ ┌───────┐   ┌───────┐   ┌───────┐
│Driver1│ │Driver2│   │Driver3│   │Driver4│
│  🔔   │ │  🔔   │   │  🔔   │   │  🔔   │
└───────┘ └───────┘   └───────┘   └───────┘
    │
    │ First to click "Accept"
    ▼
┌─────────────────┐     Race Condition      ┌─────────────────┐
│ accept_delivery │ ───────────────────────→│   deliveries    │
│   (with lock)   │     Handled!            │     table       │
└─────────────────┘                         └─────────────────┘
         │
         │ Broadcast 'order_taken'
         ▼
┌───────┐ ┌───────┐   ┌───────┐
│Driver2│ │Driver3│   │Driver4│
│  ❌   │ │  ❌   │   │  ❌   │  (Order removed from their screens)
└───────┘ └───────┘   └───────┘
```

#### 🔒 معالجة Race Condition

```sql
-- Lock the order row to prevent race conditions
SELECT * INTO v_order
FROM public.orders
WHERE id = p_order_id
FOR UPDATE NOWAIT;

-- If another driver is processing, return error
EXCEPTION
  WHEN lock_not_available THEN
    RETURN jsonb_build_object(
      'success', false, 
      'error', 'Order is being processed by another driver'
    );
```

---

## [0.3.0] - 2 أبريل 2026

### 🔄 دورة حياة الطلب (Order Lifecycle) - Event-Driven Architecture

#### ✅ الإضافات الجديدة (Added)

##### 1. صفحة إنشاء طلب (`/customer/order`)
- **الملف**: `app/customer/order/page.tsx`
- **الميزات**:
  - نموذج لإنشاء طلب جديد
  - اختيار المطعم من قائمة المطاعم المفتوحة
  - إدخال المبلغ الإجمالي
  - إضافة ملاحظات اختيارية
  - إدراج الطلب في جدول `orders` بحالة `pending`
  - رسائل نجاح وخطأ واضحة
  - توجيه تلقائي بعد إنشاء الطلب

##### 2. لوحة تحكم المطعم (`/restaurant/dashboard`)
- **الملف**: `app/restaurant/dashboard/page.tsx`
- **الميزات**:
  - عرض الطلبات الواردة في الوقت الفعلي (Realtime)
  - تصنيف الطلبات: جديدة، قيد التنفيذ، مكتملة
  - استخدام `supabase.channel()` للاستماع للتغييرات
  - زر "قبول الطلب" لتحديث الحالة إلى `confirmed`
  - تحديث حالة الطلب (confirmed → preparing → ready)
  - عرض معلومات العميل (الاسم، الهاتف)
  - ألوان مميزة لكل حالة طلب
  - تحديث تلقائي بدون تحديث الصفحة

##### 3. صفحة إعدادات المطعم (`/restaurant/setup`)
- **الملف**: `app/restaurant/setup/page.tsx`
- **الميزات**:
  - إنشاء مطعم جديد
  - تعديل بيانات المطعم (الاسم، الموقع)
  - تغيير حالة المطعم (مفتوح/مغلق/مشغول)

##### 4. جدول سجل الطلبات (`order_logs`)
- **الملف**: `supabase/migrations/20240523000001_order_notifications.sql`
- **الحقول**:
  - `id` - معرف السجل
  - `order_id` - معرف الطلب
  - `event_type` - نوع الحدث
  - `old_status` - الحالة السابقة
  - `new_status` - الحالة الجديدة
  - `metadata` - بيانات إضافية (JSONB)
  - `created_at` - وقت الإنشاء

##### 5. Database Triggers للأحداث
- **Trigger 1**: `trigger_order_created`
  - يُنفذ عند إنشاء طلب جديد
  - يُسجل الحدث في `order_logs`
  - يُرسل إشعار عبر `pg_notify`

- **Trigger 2**: `trigger_order_status_changed`
  - يُنفذ عند تغيير حالة الطلب
  - يُسجل التغيير في `order_logs`
  - يُرسل إشعار عبر `pg_notify`

##### 6. سياسات RLS لجدول order_logs
- العملاء يمكنهم عرض سجلات طلباتهم
- أصحاب المطاعم يمكنهم عرض سجلات طلبات مطاعمهم
- النظام يمكنه إدراج السجلات (عبر Triggers)

#### 🔄 التحديثات (Changed)

##### تحديث واجهة العميل
- **الملف**: `app/customer/page.tsx`
- إضافة زر "إنشاء طلب جديد"
- إضافة زر "طلباتي السابقة"

##### تحديث واجهة المطعم
- **الملف**: `app/restaurant/page.tsx`
- إضافة زر "لوحة التحكم - الطلبات"
- إضافة زر "إعدادات المطعم"

#### 📊 معمارية Event-Driven

```
┌─────────────────┐     INSERT      ┌─────────────────┐
│    Customer     │ ───────────────→│     orders      │
│  Creates Order  │                 │     table       │
└─────────────────┘                 └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │    TRIGGER      │
                                    │ log_order_created│
                                    └────────┬────────┘
                                             │
                    ┌────────────────────────┼────────────────────────┐
                    │                        │                        │
           ┌────────▼────────┐     ┌────────▼────────┐     ┌────────▼────────┐
           │   order_logs    │     │   pg_notify     │     │    Realtime     │
           │     table       │     │  'order_events' │     │   Broadcast     │
           └─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                                    │
                                                           ┌────────▼────────┐
                                                           │   Restaurant    │
                                                           │   Dashboard     │
                                                           │ (Live Updates)  │
                                                           └─────────────────┘
```

---

## [0.2.0] - 2 أبريل 2026

### 🔐 نظام المصادقة (Authentication System)

#### ✅ الإضافات الجديدة (Added)

##### 1. صفحة تسجيل الدخول (`/login`)
- **الملف**: `app/login/page.tsx`
- **الميزات**:
  - نموذج تسجيل دخول بتصميم نظيف باستخدام shadcn/ui
  - التحقق من البريد الإلكتروني وكلمة المرور
  - عرض رسائل خطأ واضحة بالعربية
  - توجيه المستخدم تلقائياً حسب دوره بعد تسجيل الدخول
  - حالة تحميل (Loading State) أثناء المعالجة

##### 2. صفحة إنشاء حساب (`/signup`)
- **الملف**: `app/signup/page.tsx`
- **الميزات**:
  - نموذج تسجيل شامل مع اختيار الدور
  - حقول: الاسم، الهاتف، البريد، كلمة المرور
  - قائمة منسدلة لاختيار نوع الحساب (عميل/مطعم/سائق)
  - التحقق من تطابق كلمات المرور
  - إنشاء ملف المستخدم في جدول `profiles` تلقائياً
  - رسائل نجاح وخطأ واضحة

##### 3. Middleware لحماية المسارات
- **الملف**: `middleware.ts`
- **الميزات**:
  - حماية جميع المسارات المحمية
  - توجيه المستخدم غير المسجل إلى `/login`
  - منع الوصول للمسارات غير المصرح بها حسب الدور
  - السماح بالوصول للمسارات العامة (`/`, `/login`, `/signup`)
  - توجيه المستخدم المسجل بعيداً عن صفحات المصادقة

##### 4. دوال التحقق من الدور
- **الملف**: `lib/supabase/admin.ts`
- **الدوال الجديدة**:
  - `getUserRole(userId)` - جلب دور المستخدم
  - `verifyUserRole(userId, expectedRole)` - التحقق من دور محدد
  - `getUserProfile(userId)` - جلب ملف المستخدم الكامل
  - `updateUserRole(userId, newRole)` - تحديث دور المستخدم

##### 5. مكتبة المصادقة للعميل
- **الملف**: `lib/auth/index.ts`
- **الدوال**:
  - `getCurrentUser()` - جلب المستخدم الحالي
  - `getCurrentUserProfile()` - جلب ملف المستخدم مع البيانات
  - `signOut()` - تسجيل الخروج
  - `getRoleDisplayName(role)` - اسم الدور بالعربية
  - `getRoleColor(role)` - لون الدور للتصميم

##### 6. مكون شريط المستخدم
- **الملف**: `components/auth/UserNav.tsx`
- **الميزات**:
  - عرض اسم المستخدم ودوره
  - زر تسجيل الخروج
  - حالة تحميل أثناء جلب البيانات
  - عرض أزرار تسجيل الدخول/إنشاء حساب للزوار

##### 7. مكونات shadcn/ui
- **المكونات المضافة**:
  - `Button` - الأزرار
  - `Input` - حقول الإدخال
  - `Label` - التسميات
  - `Card` - البطاقات
  - `Alert` - التنبيهات
  - `Select` - القوائم المنسدلة

#### 🔄 التحديثات (Changed)

##### تحديث واجهات المستخدم
- **الملفات المحدثة**:
  - `app/customer/page.tsx`
  - `app/restaurant/page.tsx`
  - `app/driver/page.tsx`
- **التغييرات**:
  - إضافة Header مع شريط المستخدم (UserNav)
  - تحسين التصميم والهيكلية
  - إضافة رسالة ترحيب

---

## [0.1.0] - 2 أبريل 2026

### 🏗️ الإعداد الأولي (Initial Setup)

#### ✅ الإضافات (Added)

##### 1. تهيئة المشروع
- Next.js 15 مع App Router
- TypeScript configuration
- Tailwind CSS
- ESLint

##### 2. المكتبات الأساسية
- `@supabase/supabase-js` - Supabase Client
- `@supabase/ssr` - Server-Side Rendering
- `pg` - PostgreSQL Client
- `dotenv` - Environment Variables

##### 3. هيكلية المشروع
```
DS_Project/
├── app/
│   ├── customer/
│   ├── restaurant/
│   ├── driver/
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   └── types/
│       └── database.types.ts
├── supabase/
│   ├── migrations/
│   └── config.toml
└── scripts/
```

##### 4. قاعدة البيانات
- **الجداول**:
  - `profiles` - ملفات المستخدمين
  - `restaurants` - بيانات المطاعم
  - `orders` - الطلبات
  - `deliveries` - التوصيلات

- **الميزات**:
  - 9 فهارس للأداء
  - 4 محفزات للتحديث التلقائي
  - 16 سياسة RLS للأمان
  - Realtime مُفعّل

##### 5. Supabase CLI
- تثبيت محلي
- ربط المشروع
- تطبيق Migration بنجاح

##### 6. التوثيق
- `README.md`
- `MIGRATION_GUIDE.md`
- `SETUP_COMPLETE.md`
- `PROJECT_STATUS.md`
- `PROJECT_DOCUMENTATION.md`

---

## 📊 ملخص الإصدارات

| الإصدار | التاريخ | الوصف |
|---------|---------|-------|
| 0.2.0 | 2 أبريل 2026 | نظام المصادقة وحماية المسارات |
| 0.1.0 | 2 أبريل 2026 | الإعداد الأولي وقاعدة البيانات |

---

## 📁 الملفات المُضافة في v0.2.0

### ملفات جديدة
```
app/login/page.tsx                    # صفحة تسجيل الدخول
app/signup/page.tsx                   # صفحة إنشاء حساب
middleware.ts                         # حماية المسارات
lib/auth/index.ts                     # دوال المصادقة للعميل
components/auth/UserNav.tsx           # مكون شريط المستخدم
components/ui/button.tsx              # shadcn Button
components/ui/input.tsx               # shadcn Input
components/ui/label.tsx               # shadcn Label
components/ui/card.tsx                # shadcn Card
components/ui/alert.tsx               # shadcn Alert
components/ui/select.tsx              # shadcn Select
lib/utils.ts                          # Utility functions
components.json                       # shadcn config
docs/CHANGELOG.md                     # هذا الملف
```

### ملفات مُحدّثة
```
app/customer/page.tsx                 # إضافة UserNav
app/restaurant/page.tsx               # إضافة UserNav
app/driver/page.tsx                   # إضافة UserNav
lib/supabase/admin.ts                 # دوال التحقق من الدور
app/globals.css                       # تحديث shadcn styles
package.json                          # مكتبات جديدة
```

---

## 🔒 سياسات الأمان المُطبقة

### حماية المسارات (Route Protection)

| المسار | الوصول |
|--------|--------|
| `/` | عام |
| `/login` | عام (يُحوّل المسجلين) |
| `/signup` | عام (يُحوّل المسجلين) |
| `/customer/*` | العملاء فقط |
| `/restaurant/*` | أصحاب المطاعم فقط |
| `/driver/*` | السائقون فقط |

### التحقق من الهوية
1. التحقق من وجود جلسة نشطة
2. جلب دور المستخدم من `profiles`
3. مطابقة الدور مع المسار المطلوب
4. توجيه أو رفض الوصول

---

## 🐛 المشاكل المعروفة

### قيد المعالجة
- [ ] إضافة "نسيت كلمة المرور"
- [ ] تأكيد البريد الإلكتروني
- [ ] تحديث الملف الشخصي

### تم حلها
- ✅ uuid_generate_v4() → gen_random_uuid()
- ✅ Supabase CLI global install → local install
- ✅ Database version mismatch → updated to v17

---

## 🚀 الخطوات القادمة

### v0.3.0 (قريباً)
- [ ] واجهة العميل الكاملة
- [ ] عرض قائمة المطاعم
- [ ] إنشاء الطلبات
- [ ] تتبع الطلبات

### v0.4.0
- [ ] واجهة المطعم الكاملة
- [ ] إدارة الطلبات
- [ ] تحديث حالة الطلب

### v0.5.0
- [ ] واجهة السائق الكاملة
- [ ] قبول/رفض التوصيلات
- [ ] تتبع الموقع

---

## 👨‍💻 المساهمون

- **المطور الرئيسي**: [اسم المطور]
- **تاريخ البدء**: 2 أبريل 2026

---

## 📝 ملاحظات

- جميع التغييرات متوافقة مع RLS المُعد مسبقاً
- تم اختبار المصادقة مع Supabase Auth
- التصميم يدعم RTL بالكامل
- جميع رسائل الخطأ بالعربية

---

**آخر تحديث**: 2 أبريل 2026
