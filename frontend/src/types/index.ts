export interface User {
  user_id: string;
  name: string;
  role: 'admin' | 'user';
  department: string;
  favorite_partners?: string[];
  status?: 'active' | 'pending' | 'inactive';
}

export interface UserListItem {
  user_id: string;
  name: string;
  department: string;
  is_favorite: boolean;
}

export interface Participant {
  user_id: string;
  name: string;
  amount: number;
}

export interface OrderDetail {
  item: string;
  quantity: number;
  price: number;
}

// Category는 string으로 확장 — categories.json에 의해 동적으로 결정됨
export type Category = string;

export interface CategoryDef {
  id: string;
  label: string;
  icon: string;
  description: string;
  is_meal: boolean;
}

// 하위 호환성: 동적 카테고리 배열에서 레거시 맵 형태로 변환하는 헬퍼
export function buildCategoryMaps(cats: CategoryDef[]) {
  const labels: Record<string, string> = {};
  const icons: Record<string, string> = {};
  cats.forEach((c) => {
    labels[c.id] = c.label;
    icons[c.id] = c.icon;
  });
  return { labels, icons };
}

export interface ReceiptRecord {
  record_id: string;
  registered_by: string;
  registered_by_name: string;
  category: Category;
  approval_number?: string;
  store_name?: string;
  total_amount: number;
  transaction_date: string;
  order_details: OrderDetail[];
  image_key?: string;
  image_url?: string;
  participants: Participant[];
  memo?: string;
  card_last4?: string;
  created_at: string;
  year_month: string;
}

export interface Card {
  card_id: string;
  user_id: string;
  card_name: string;
  card_last4: string;
  monthly_limit: number;
  is_primary?: boolean;
}

export interface ExtractedReceipt {
  approval_number: string | null;
  store_name: string | null;
  total_amount: number | null;
  transaction_date: string | null;
  card_last4: string | null;
  receipt_type?: 'RECEIPT' | 'KIOSK' | 'TABLET' | 'SCREEN' | 'UNKNOWN';
  order_details: OrderDetail[];
  error?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}
