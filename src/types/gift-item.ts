import { FieldValue } from 'firebase/firestore';

export interface GiftItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy: string | null;
  selectionDate: string | FieldValue | null | undefined;
  createdAt: string | FieldValue | null | undefined;
  imageUrl: string | null;
  totalQuantity: number | null;
  selectedQuantity: number;
  priority?: number | null; // 0: Low, 1: Medium, 2: High
}
