export interface MaterialsForProductAdding {
    id: number
    name: string
    price_per_mm3: number
  }

 export interface Material {
    id: number
    name: string
    color: string
    price_per_mm3: number
    active: boolean
  }

  export interface Draft {
    name: string
    color: string
    price_per_mm3: string 
    active: boolean
  }