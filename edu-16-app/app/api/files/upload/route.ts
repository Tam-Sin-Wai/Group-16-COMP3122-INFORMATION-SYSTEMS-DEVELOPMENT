import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

const bucket = process.env.SUPABASE_STORAGE_BUCKET || 'files'

export async function POST(request: Request) {
  const body = await request.json()
  const { path, content, contentType } = body

  if (!path || !content) {
    return NextResponse.json(
      { error: 'path and content are required' },
      { status: 400 }
    )
  }

  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const fileBuffer = Buffer.from(content, 'base64')

  const { data, error } = await supabase.storage.from(bucket).upload(path, fileBuffer, {
    contentType: contentType || 'application/octet-stream',
    upsert: true,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ uploaded: data })
}
