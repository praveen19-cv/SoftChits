export interface CollectionSheetRow {
  id?: number; // Add id to track existing collection
  memberId: number;
  serialNo: number;
  memberName: string;
  installment: string; // Format: "1c,2,3" where 'c' indicates completed, or "3:3400,4:5500" for specific amounts
  amount: string; // Total amount or individual amounts (e.g., "8900" or "3400,5500")
  installmentBalances?: {
    [key: string]: number | { old: number; updated: number };
  }; // Made optional since new components calculate this dynamically
  installmentAmounts?: {
    [key: number]: number; // Map of installment number to specific amount
  }; // For storing installment-specific amounts
  isAdditionalRow?: boolean; // True if this is an additional row for the same member
  parentMemberId?: number; // The original member ID if this is an additional row
  rowIndex?: number; // Unique index for this row (useful for additional rows)
}
