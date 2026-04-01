# Environment Setup Guide

## Problem
The grades fetch error occurs because **Supabase environment variables are not configured**. When environment variables are missing, the routes try to create a Supabase client with empty strings, which causes the error:
```
Error: supabaseUrl is required.
```

## Solution

### Step 1: Create `.env.local` file
Copy the `.env.local.example` file and populate it with your actual Supabase credentials:

```bash
cp .env.local.example .env.local
```

### Step 2: Add Your Supabase Credentials
Edit `.env.local` and fill in your Supabase project details:

1. **Get your Supabase URL and keys:**
   - Go to [Supabase Dashboard](https://supabase.com/dashboard)
   - Select your project
   - Navigate to **Settings** → **API**
   - Copy:
     - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
     - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
     - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY`

2. **Your `.env.local` should look like:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENAI_API_KEY=sk-...  # Optional, only needed for AI features
```

### Step 3: Restart Development Server
After setting environment variables, restart your Next.js development server:

```bash
npm run dev
```

## What Was Fixed
✅ Updated all API routes to use proper Supabase client initialization with validation
✅ Fixed `supabaseAdmin.ts` to use consistent environment variable names
✅ Routes now throw clear error messages if environment variables are missing
✅ Created `.env.local.example` as a configuration template

## Important Notes
- ⚠️ **Never commit `.env.local`** to git (it's automatically ignored by `.gitignore`)
- 🔒 **Service role key is secret** – only use it in server-side code (API routes)
- 📱 **Anon key is public** – safe to use in client-side code
- 🌐 **For production/Vercel**: Add environment variables in your Vercel project settings instead

## Troubleshooting
If you still see "supabaseUrl is required" error:
1. Check that `.env.local` exists and contains `NEXT_PUBLIC_SUPABASE_URL`
2. Verify the URL is correct (should start with `https://`)
3. Restart the development server (Ctrl+C, then `npm run dev`)
4. Clear `.next` folder if needed: `rm -rf .next && npm run dev`
