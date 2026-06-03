'use client'

import Image from 'next/image'
import { APP_NAME_AR } from '@/lib/constants'

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Logo({ size = 'md' }: LogoProps) {
  const sizes = {
    sm: { width: 32, height: 32 },
    md: { width: 40, height: 40 },
    lg: { width: 48, height: 48 },
    xl: { width: 64, height: 64 },
  }

  const sizeClass = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }

  return (
    <div className={`${sizeClass[size]} rounded-full flex items-center justify-center flex-shrink-0 shadow-lg overflow-hidden bg-white`}>
      <Image
        src="/favicon.png"
        alt={APP_NAME_AR}
        width={sizes[size].width}
        height={sizes[size].height}
        className="w-full h-full object-cover"
      />
    </div>
  )
}
