import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function POST(req: Request) {
  try {
    const { fileName, base64 } = await req.json()

    if (!fileName || !base64) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 })
    }

    const buffer = Buffer.from(base64, 'base64')

    const localDir = path.join(process.cwd(), 'jobcards')
    if (!fs.existsSync(localDir)) {
      fs.mkdirSync(localDir, { recursive: true })
    }

    const localPath = path.join(localDir, fileName)
    fs.writeFileSync(localPath, buffer)

    const nasPath = process.env.NAS_PATH
    if (nasPath) {
      try {
        const nasFilePath = path.join(nasPath, fileName)
        fs.writeFileSync(nasFilePath, buffer)
      } catch (err) {
        console.error('NAS save failed:', err)
      }
    }

    return NextResponse.json({ success: true, localPath })
  } catch (err) {
    console.error('Server error:', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}