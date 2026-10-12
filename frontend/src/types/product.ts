export interface Product {
  id: number;
  name: string;
  brand: string;
  price: number;
  unit: string;
  minQty: number;
  image: string;
  category: string;
  bestSeller: boolean;
  featured: boolean;
  stars: number;
  stock: number;
  flavors?: string[];
  active: boolean;
  description?: string;
  cost?: number;
}

export interface CartItem extends Product {
  qty: number;
  selectedFlavor?: string;
}
