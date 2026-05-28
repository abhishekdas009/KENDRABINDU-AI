# PostgreSQL Migration Guide

## 🚀 Quick Start

### Option 1: Local PostgreSQL (Development)
Best for local development and testing.

#### macOS (Intel/Apple Silicon)
```bash
# Install PostgreSQL
brew install postgresql

# Start PostgreSQL service
brew services start postgresql

# Create database and user
createdb jobmailer
psql jobmailer
```

In psql, create a user:
```sql
CREATE USER postgres WITH PASSWORD 'your_password';
ALTER USER postgres WITH SUPERUSER;
\q
```

Then update `.env`:
```env
DB_PROVIDER=local
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=jobmailer
```

#### Linux (Ubuntu/Debian)
```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start service
sudo systemctl start postgresql

# Create database
sudo -u postgres createdb jobmailer
sudo -u postgres psql
```

#### Windows
1. Download: https://www.postgresql.org/download/windows/
2. Run installer and follow setup
3. Remember the password you set during installation

---

### Option 2: Supabase (Recommended Cloud) ⭐
**Free tier: 500MB storage, enough for thousands of applications**

1. **Sign up:** https://supabase.com
2. **Create a new project:**
   - Choose a region closest to you
   - Set a database password
   - Wait for setup (2-3 minutes)
3. **Get connection details:**
   - Go to Project Settings > Database
   - Copy the "Connection string"
4. **Update `.env`:**
   ```env
   DATABASE_URL=postgresql+psycopg2://[user]:[password]@[host]:[port]/[database]
   ```

**Advantages:**
- Zero setup required
- Free SSL/TLS encryption
- Can access via Supabase UI
- Auto backups included
- Easy to scale

---

### Option 3: Railway (Easy Alternative)
**Free tier: $5/month credit (enough for database)**

1. **Sign up:** https://railway.app
2. **Create project → Add Postgres**
3. **Copy connection string** from Connect section
4. **Update `.env`:**
   ```env
   DATABASE_URL=postgresql+psycopg2://[user]:[password]@[host]:[port]/[database]
   ```

---

### Option 4: Render
**Free tier: 90 days, then paid**

1. **Sign up:** https://render.com
2. **Create → PostgreSQL**
3. **Copy Internal Database URL**
4. **Update `.env`:**
   ```env
   DATABASE_URL=postgresql+psycopg2://[user]:[password]@[host]:[port]/[database]
   ```

---

## 📦 Install Dependencies

```bash
cd /home/abhishek/Desktop/jobmailer

# Install new database driver
pip install -r backend/requirements.txt
```

This installs `psycopg2-binary` (PostgreSQL driver).

---

## 🔄 Migrate Data (SQLite → PostgreSQL)

If you have existing data in SQLite, follow this:

```bash
# 1. Export SQLite data
sqlite3 jobmailer.db ".dump" > sqlite_backup.sql

# 2. Create migration script
# (We'll create a script for this)

# 3. Verify data in PostgreSQL
psql jobmailer
\dt  # List tables
SELECT COUNT(*) FROM applications;  # Check data
```

---

## 🧪 Test Connection

```bash
cd backend

# Python script to test
python3 -c "
from database import engine
try:
    with engine.connect() as conn:
        print('✓ Connected to PostgreSQL successfully!')
except Exception as e:
    print(f'✗ Connection failed: {e}')
"
```

---

## 🚀 Run Application

```bash
cd /home/abhishek/Desktop/jobmailer

# Option 1: Using the run script (both backend + frontend)
./run.sh

# Option 2: Using Make
make dev

# Option 3: Separate terminals
# Terminal 1: Backend
source .venv/bin/activate && cd backend && python -m uvicorn main:app --reload

# Terminal 2: Frontend
cd frontend && npm run dev
```

---

## 📊 Database Comparison

| Feature | SQLite | PostgreSQL |
|---------|--------|-----------|
| File-based | ✅ | ❌ |
| Storage | < 1GB | Unlimited |
| Concurrency | Limited | ✅ Full |
| Transactions | Basic | ✅ Advanced |
| Free Hosting | N/A | ✅ (Supabase) |
| Scalability | Low | ✅ High |
| Multi-user | Poor | ✅ Excellent |
| Best for | Dev/Testing | Production |

---

## 🔍 Troubleshooting

### "Connection refused"
```bash
# Ensure PostgreSQL is running
# macOS:
brew services list | grep postgresql

# Linux:
sudo systemctl status postgresql

# Windows: Check Services app
```

### "Authentication failed"
- Check DB_PASSWORD in `.env`
- Verify database user exists
- Try resetting password

### "Database does not exist"
```bash
# Local PostgreSQL
createdb jobmailer

# Supabase/Cloud: Already created during setup
```

### Still stuck?
1. Check `.env` file is configured correctly
2. Verify PostgreSQL is running
3. Test with `psql` command directly
4. Check backend logs for full error message

---

## 💾 Backup & Recovery

### Local PostgreSQL Backup
```bash
# Backup
pg_dump jobmailer > backup.sql

# Restore
psql jobmailer < backup.sql
```

### Supabase Backup
- Automatic daily backups in Supabase Dashboard
- Can restore to any point in time
- Keep local SQL exports for extra safety

---

## ✅ Checklist Before Going Live

- [ ] `.env` file configured with DB_* variables
- [ ] PostgreSQL server running and accessible
- [ ] Database created
- [ ] `pip install psycopg2-binary` completed
- [ ] `init_db()` called to create tables
- [ ] Sample data inserted and queried successfully
- [ ] Frontend & Backend both connect without errors
- [ ] Backups configured (for Supabase)

---

## 📚 Next Steps

1. **Local Development:** Use `DB_PROVIDER=local` option
2. **Production:** Use Supabase or Railway
3. **Scale:** Both support horizontal scaling

Questions? Check PostgreSQL docs or your provider's support.
