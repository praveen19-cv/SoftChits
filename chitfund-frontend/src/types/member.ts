export interface Member {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
} 