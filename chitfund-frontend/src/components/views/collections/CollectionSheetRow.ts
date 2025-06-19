export interface CollectionSheetRow {
  id?: number; // Add id to track existing collection
  memberId: number;
  serialNo: number;
  memberName: string;
  installment: string;
  amount: string;
  installmentBalances: {
    [key: string]: number | { old: number; updated: number };
  };
}
