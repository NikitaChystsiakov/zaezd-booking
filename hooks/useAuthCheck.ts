// hooks/useAuthCheck.ts (оптимизированный)
'use client'

import { useState, useEffect, useCallback } from 'react'

const AUTH_STATE_KEY = 'auth_cache'
const CACHE_DURATION = 5 * 60 * 1000 // 5 минут

interface AuthCache {
  isAuthenticated: boolean
  user: any | null
  timestamp: number
}

export function useAuthCheck() {
  const [state, setState] = useState<{
    isAuthenticated: boolean
    isLoading: boolean
    user: any | null
    isFromCache: boolean
  }>(() => {
    // При первой загрузке пытаемся взять из кэша
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(AUTH_STATE_KEY)
      if (cached) {
        try {
          const parsed: AuthCache = JSON.parse(cached)
          const isCacheValid = Date.now() - parsed.timestamp < CACHE_DURATION
          
          if (isCacheValid) {
            return {
              isAuthenticated: parsed.isAuthenticated,
              isLoading: true, // Все равно проверяем в фоне
              user: parsed.user,
              isFromCache: true
            }
          } else {
            // Кэш устарел, удаляем
            localStorage.removeItem(AUTH_STATE_KEY)
          }
        } catch (e) {
          localStorage.removeItem(AUTH_STATE_KEY)
        }
      }
    }
    
    return {
      isAuthenticated: false,
      isLoading: true,
      user: null,
      isFromCache: false
    }
  })

  const checkAuth = useCallback(async (background = false) => {
    // Если это фоновая проверка и у нас уже есть валидные данные,
    // можем пропустить обновление UI
    if (background && state.isAuthenticated && !state.isFromCache) {
      return state.isAuthenticated
    }

    if (!background) {
      setState(prev => ({ ...prev, isLoading: true }))
    }

    try {
      const response = await fetch('/api/v1/auth/check', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Cache-Control': 'no-cache',
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      const isAuth = data.authenticated === true
      
      const newState = {
        isAuthenticated: isAuth,
        isLoading: false,
        user: data.user || null,
        isFromCache: false
      }
      
      if (!background) {
        setState(newState)
      }
      
      // Всегда обновляем кэш
      if (typeof window !== 'undefined') {
        localStorage.setItem(AUTH_STATE_KEY, JSON.stringify({
          isAuthenticated: isAuth,
          user: data.user || null,
          timestamp: Date.now()
        }))
      }

      return isAuth
    } catch (error) {
      console.warn('Auth check failed:', error)
      
      if (!background) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          isFromCache: false
        }))
      }
      
      // При ошибке сети используем кэшированное значение
      return state.isAuthenticated
    }
  }, [state.isAuthenticated, state.isFromCache])

  useEffect(() => {
    checkAuth(false) // Основная проверка
    
    // Фоновая проверка каждую минуту
    const intervalId = setInterval(() => {
      checkAuth(true)
    }, 60000)

    return () => clearInterval(intervalId)
  }, [checkAuth])

  return state
}