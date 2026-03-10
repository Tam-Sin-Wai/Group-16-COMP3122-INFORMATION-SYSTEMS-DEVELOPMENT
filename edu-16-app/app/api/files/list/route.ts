import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'files'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const path = url.searchParams.get('path') || ''

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.storage.from(bucket).list(path)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ files: data })
}
