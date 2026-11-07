# AI Sales Assistant

Solar aur electrical wholesale/retail business (Precision Digi Electronics) ke liye sales aur inventory system. AI agent baad mein isi ke upar lagega.

## Stack

| Hissa | Technology |
|---|---|
| Frontend | Next.js 15 + Tailwind (`frontend/`) |
| Database | PostgreSQL on Supabase (`supabase/`) |
| Login | Supabase Auth |
| Images / datasheets | Supabase Storage (`product-files` bucket) |
| Hosting | Vercel |

## Folder structure

```
AI Sales Assistant/
├── docs/REQUIREMENTS.md        # requirements aur architecture
├── supabase/
│   ├── migrations/             # 0001 schema, 0002 business logic, 0003 security, 0004 storage
│   ├── seed.sql                # starter products, customers, suppliers
│   └── setup_all.sql           # upar wali sab files aik saath (SQL Editor mein paste karne ke liye)
└── frontend/                   # Next.js dashboard
```

## Pehli dafa setup

1. **supabase.com** par free project banayein (region: Mumbai ya Singapore).
2. **SQL Editor → New query** mein `supabase/setup_all.sql` ka poora content paste karke **Run** karein.
3. **Authentication → Users → Add user → Create new user**: apna email aur password daalein, "Auto Confirm User" on rakhein. Pehla user khud **admin** banta hai.
4. **Project Settings → API** se values copy karein:
   ```bash
   cd frontend
   cp .env.example .env.local
   # .env.local mein URL, anon key aur service_role key daalein
   ```
5. Server chalayein:
   ```bash
   npm install
   npm run dev -- -p 3002
   ```
   http://localhost:3002 par login karein.

Baqi staff ke accounts app ke andar **Roles & Users → Add user** se banayein (is ke liye service_role key zaroori hai).

## Business rules (database mein enforce hote hain)

- Stock sirf `stock_movements` se badalta hai. Sale par OUT, purchase par IN, manual tabdeeli ADJUST. Stock negative nahi ho sakta.
- Sale aur quotation mein price database se aati hai. Browser se bheji hui price nahi maani jati.
- Salesperson minimum price se kam par sale nahi kar sakta. Quotation par manager approval lagti hai.
- Purchase price sirf admin/manager dekh sakte hain (`product_catalog` view mein nahi hai, jo AI agent bhi use karega).
- Walk-in customer ko udhaar nahi. Payment pending se zyada nahi ho sakti.

## Roadmap progress

- [x] Requirements aur dashboard design
- [x] Database (Supabase) aur login
- [x] Products (add/edit/search/delete, image, datasheet), categories, inventory, stock alerts
- [x] Sales (invoice, POS, stock kam), purchases (stock zyada), quotations (approval, PDF)
- [x] Customers, suppliers, receivables, payables, payments
- [x] Pricing rules: purchase / standard / minimum price, reorder level
- [ ] AI agent ke backend tools (search_product, get_current_price, check_stock, …)
- [ ] Knowledge base (RAG), voice, WhatsApp, automated follow-ups
- [ ] Abhi demo data par: proforma, returns, expenses, services, reports, tax report, bulk upload, sync, backup, settings
