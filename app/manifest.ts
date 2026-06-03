import type { MetadataRoute } from 'next'
import { APP_NAME_AR, APP_NAME_EN, SITE_DESCRIPTION_AR } from '@/lib/constants'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME_AR} - ${APP_NAME_EN}`,
    short_name: APP_NAME_AR,
    description: SITE_DESCRIPTION_AR,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#dc2626',
    icons: [
      {
        src: '/favicon.png',
        sizes: '1024x1024',
        type: 'image/png',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
