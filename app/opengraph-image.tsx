import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { APP_NAME_AR, APP_NAME_EN, SITE_DESCRIPTION_EN } from '@/lib/constants'

export const alt = `${APP_NAME_EN} app logo`
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = 'image/png'

export default async function OgImage() {
  const logoData = await readFile(join(process.cwd(), 'public', 'favicon.png'), 'base64')
  const logoSrc = `data:image/png;base64,${logoData}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fff7ed',
          color: '#0f172a',
          padding: 72,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
          <div
            style={{
              width: 220,
              height: 220,
              borderRadius: 44,
              background: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 28px 80px rgba(220, 38, 38, 0.28)',
            }}
          >
            <img
              src={logoSrc}
              width={220}
              height={220}
              alt=""
              style={{ width: 220, height: 220, borderRadius: 44, objectFit: 'cover' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 18 }}>
              <span style={{ fontSize: 92, fontWeight: 800, color: '#dc2626' }}>{APP_NAME_EN}</span>
              <span style={{ fontSize: 54, fontWeight: 700, color: '#b91c1c' }}>{APP_NAME_AR}</span>
            </div>
            <div style={{ fontSize: 40, lineHeight: 1.25, fontWeight: 600 }}>
              Fresh meals, exclusive offers, and fast delivery.
            </div>
            <div style={{ fontSize: 28, lineHeight: 1.35, color: '#475569' }}>
              {SITE_DESCRIPTION_EN}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  )
}
