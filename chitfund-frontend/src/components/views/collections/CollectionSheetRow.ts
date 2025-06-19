export interface CollectionSheetRow {
  memberId: number;
  serialNo: number;
  memberName: string;
  installment: string;
  amount: string;
  installmentBalances: {
    [key: string]: number | { old: number; updated: number };
  };
}
