export interface Product {
  ProductID: string;
  ProductName: string;
  Price: number;
  Unit: string;
}

export interface Transaction {
  TransactionID: string;
  Date: string; // ISO or YYYY-MM-DD
  ProductID: string;
  Quantity: number;
  PriceAtTime: number;
  TotalAmount: number;
  Member?: string; // Who logged / for whom
}

export interface Recharge {
  RechargeID: string;
  Date: string; // ISO or YYYY-MM-DD
  Amount: number;
  Member?: string; // Who recharged
}

export interface FamilyMember {
  Name: string;
}

export interface DashboardMetrics {
  currentBalance: number;
  monthlySpend: number;
  monthlyRecharges: number;
  totalSpend: number;
  totalRecharges: number;
}
