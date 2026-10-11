'use client'

import { useEffect } from 'react'

// Сообщает странице-хозяину высоту формы, чтобы iframe рос вместе с ней
export function EmbedHeight() {
  useEffect(() => {
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    const send = () => window.parent?.postMessage({ type: 'booking:height', height: document.documentElement.scrollHeight }, '*')
    const ro = new ResizeObserver(send)
    ro.observe(document.body)
    send()
    return () => ro.disconnect()
  }, [])
  return null
}
