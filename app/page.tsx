import { redirect } from 'next/navigation'

// Демо открывается сразу на странице усадьбы
export default function Home() {
  redirect('/u/butsevichi')
}
