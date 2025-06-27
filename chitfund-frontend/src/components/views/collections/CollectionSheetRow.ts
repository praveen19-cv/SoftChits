export interface CollectionSheetRow {
  id?: number; // Add id to track existing collection
  memberId: number;
  serialNo: number;
  memberName: string;
  installment: string; // Format: "1c,2,3" where 'c' indicates completed
  amount: string;
  installmentBalances?: {
    [key: string]: number | { old: number; updated: number };
  }; // Made optional since new components calculate this dynamically
}
