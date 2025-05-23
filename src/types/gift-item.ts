import { FieldValue } from 'firebase/firestore';

export interface GiftItem {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: 'available' | 'selected' | 'not_needed';
  selectedBy: string | null;
  selectionDate: string | FieldValue | null;
  createdAt: string | FieldValue | null;
  imageUrl: string | null;
  totalQuantity: number | null;
  selectedQuantity: number;
}
