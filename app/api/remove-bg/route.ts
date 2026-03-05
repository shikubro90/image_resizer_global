import { NextRequest, NextResponse } from 'next/server'
import { removeBackground } from '@imgly/background-removal-node'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData()
    const file = fd.get('file') as File
    if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

    const buf = Buffer.from(await file.arrayBuffer())
    const blob = new Blob([buf], { type: file.type || 'image/png' })
    const resultBlob = await removeBackground(blob)
    const out = Buffer.from(await resultBlob.arrayBuffer())

    return new NextResponse(new Uint8Array(out), { headers: { 'Content-Type': 'image/png' } })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
