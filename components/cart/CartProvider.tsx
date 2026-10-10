'use client'

import {
  createContext,
  useContext,
  useEffect,
  useReducer,
  type ReactNode,
} from 'react'
import type { CartItem, AddToCartInput } from '@/types/cart'

type CartState = {
  items: CartItem[]
}

type CartAction =
  | { type: 'INIT_FROM_STORAGE'; payload: CartState }
  | { type: 'ADD_ITEM'; payload: { item: CartItem } }
  | { type: 'SET_QTY'; payload: { sku: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { sku: string } }
  | { type: 'CLEAR' }

const initialState: CartState = { items: [] }

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'INIT_FROM_STORAGE':
      return action.payload

    case 'ADD_ITEM': {
      const { item } = action.payload
      const idx = state.items.findIndex(
        (i) => i.productId === item.productId && i.sku === item.sku
      )

      if (idx === -1) {
        return { items: [...state.items, item] }
      }

      const updated = [...state.items]
      updated[idx] = {
        ...updated[idx],
        quantity: updated[idx].quantity + item.quantity,
      }
      return { items: updated }
    }

    case 'SET_QTY': {
      const { sku, quantity } = action.payload
      return {
        items: state.items
          .map((i) =>
            i.sku === sku ? { ...i, quantity: Math.max(1, quantity) } : i
          )
          .filter((i) => i.quantity > 0),
      }
    }

    case 'REMOVE_ITEM':
      return {
        items: state.items.filter((i) => i.sku !== action.payload.sku),
      }

    case 'CLEAR':
      return { items: [] }

    default:
      return state
  }
}

type CartContextValue = {
  items: CartItem[]
  totalCount: number
  totalPrice: number
  addItem: (input: AddToCartInput) => void
  setQuantity: (sku: string, quantity: number) => void
  removeItem: (sku: string) => void
  clear: () => void
}

const CartContext = createContext<CartContextValue | null>(null)

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, initialState)

  // загрузка из localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = window.localStorage.getItem('cart')
      if (!raw) return
      const parsed = JSON.parse(raw) as CartState
      if (parsed && Array.isArray(parsed.items)) {
        dispatch({ type: 'INIT_FROM_STORAGE', payload: parsed })
      }
    } catch (e) {
      console.warn('cart load error', e)
    }
  }, [])

  // сохранение в localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem('cart', JSON.stringify(state))
    } catch (e) {
      console.warn('cart save error', e)
    }
  }, [state])

  const value: CartContextValue = {
    items: state.items,
    totalCount: state.items.reduce((s, i) => s + i.quantity, 0),
    totalPrice: state.items.reduce((s, i) => s + i.quantity * i.price, 0),

    addItem: ({ product, variant, quantity = 1 }) => {
      const item: CartItem = {
        productId: variant.id,
        sku: variant.sku,
        name: product.name,
        materialName: variant.material.name,
        price: variant.price,
        quantity,
        image_path: (product as any).image_path ?? null,
      }
      dispatch({ type: 'ADD_ITEM', payload: { item } })
    },

    setQuantity: (sku, quantity) =>
      dispatch({ type: 'SET_QTY', payload: { sku, quantity } }),

    removeItem: (sku) =>
      dispatch({ type: 'REMOVE_ITEM', payload: { sku } }),

    clear: () => dispatch({ type: 'CLEAR' }),
  }

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) {
    throw new Error('useCart must be used within CartProvider')
  }
  return ctx
}
