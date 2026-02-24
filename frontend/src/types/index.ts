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

export type Category =
  | 'LUNCH' | 'DINNER' | 'BEVERAGE' | 'ENTERTAINMENT'
  | 'PARKING' | 'TAXI' | 'RAIL' | 'TRANSPORT' | 'PURCHASE' | 'OTHER';

export const CATEGORY_LABELS: { [key in Category]: string } = {
  LUNCH: '중식',
  DINNER: '석식',
  BEVERAGE: '음료',
  ENTERTAINMENT: '접대비',
  PARKING: '주차비',
  TAXI: '택시',
  RAIL: '철도',
  TRANSPORT: '교통',
  PURCHASE: '구매',
  OTHER: '기타',
};

export const CATEGORY_ICONS: { [key in Category]: string } = {
  LUNCH: '🍱',
  DINNER: '🍽️',
  BEVERAGE: '☕',
  ENTERTAINMENT: '🤝',
  PARKING: '🅿️',
  TAXI: '🚕',
  RAIL: '🚆',
  TRANSPORT: '🚌',
  PURCHASE: '🛒',
  OTHER: '📋',
};

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
