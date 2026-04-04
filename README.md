# Restaurant Distributed System

نظام موزع لإدارة طلبات المطاعم باستخدام Next.js و Supabase

## Tech Stack

- **Frontend & API**: Next.js 15 (App Router, TypeScript)
- **Backend Infrastructure**: Supabase (PostgreSQL, Realtime, Auth)
- **Database Management**: Supabase Migrations (SQL)
- **Communication**: Supabase Realtime Channels & Database Triggers
- **Styling**: Tailwind CSS

## Project Structure

```
DS_Project/
├── app/                      # Next.js App Router
│   ├── customer/            # واجهة العميل
│   ├── restaurant/          # واجهة المطعم
│   ├── driver/              # واجهة السائق
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── lib/                     # Shared utilities
│   ├── supabase/
│   │   ├── client.ts       # Browser client
│   │   ├── server.ts       # Server client
│   │   └── admin.ts        # Admin client (Service Role)
│   └── types/
│       └── database.types.ts
├── supabase/
│   ├── migrations/          # SQL migrations
│   │   └── 20240523000000_init_schema.sql
│   ├── functions/           # Edge Functions (Microservices)
│   └── config.toml
└── .env.local              # Environment variables
```

## Database Schema

### Tables

1. **profiles** - ملفات المستخدمين
   - `user_id` (UUID, PK)
   - `role` (customer | restaurant | driver)
   - `full_name`, `phone`

2. **restaurants** - المطاعم
   - `id` (UUID, PK)
   - `name`, `location`, `status`
   - `owner_id` (FK → profiles)

3. **orders** - الطلبات
   - `id` (UUID, PK)
   - `customer_id` (FK → profiles)
   - `restaurant_id` (FK → restaurants)
   - `status`, `total_amount`, `items` (JSONB)

4. **deliveries** - التوصيلات
   - `id` (UUID, PK)
   - `order_id` (FK → orders)
   - `driver_id` (FK → profiles)
   - `status`, `location_data` (JSONB)

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

تأكد من وجود ملف `.env.local` مع المتغيرات التالية:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
DATABASE_URL=your_database_url
```

### 3. Run Database Migration

```bash
npx supabase db push
```

أو إذا كنت تستخدم Supabase CLI محلياً:

```bash
npx supabase migration up
```

### 4. Run Development Server

```bash
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000) في المتصفح.

## Features

### Event-Driven Architecture

- استخدام Supabase Realtime للتحديثات الفورية
- Database Triggers للأحداث التلقائية
- Row Level Security (RLS) لأمن البيانات

### User Interfaces

- **Customer Interface**: عرض المطاعم وإنشاء الطلبات
- **Restaurant Interface**: إدارة الطلبات الواردة
- **Driver Interface**: عرض طلبات التوصيل المتاحة

## Security

- تم تفعيل Row Level Security (RLS) على جميع الجداول
- سياسات أمان محددة لكل دور (Role)
- استخدام Service Role Key فقط من Server-Side

## Next Steps

1. تطوير واجهات المستخدم الكاملة
2. إضافة Edge Functions للعمليات المعقدة
3. تطبيق Realtime Subscriptions
4. إضافة نظام المصادقة (Authentication)
5. تطوير نظام الإشعارات

## License

MIT
