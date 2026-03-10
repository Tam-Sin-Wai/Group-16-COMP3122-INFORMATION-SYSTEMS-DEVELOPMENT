import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'files'

export async function DELETE(request: Request) {
  const body = await request.json()
  const { path } = body

  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data, error } = await supabase.storage.from(bucket).remove([path])

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ deleted: data })
}
