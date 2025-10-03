/**
 * Source API types - These represent the actual response structures from the HREP API
 * These types are based on the raw API responses and may have inconsistent or poorly-designed structures
 */

export interface BasicResponse<T> {
  status: number;
  success: boolean;
  data: T;
}

export interface PaginatedData<T> {
  pageCount: number;
  count: number;
  rows: T[];
}

export interface PaginatedResponse<T> {
  status: number;
  success: boolean;
  data: PaginatedData<T>;
}

/**
 * Congress reference item from GET /system-config/reference-congress
 * Note: Inconsistent field naming - some items have period_from/period_to, others have date_from/date_to
 */
export interface CongressReferenceItem {
  id: number;
  key: string;
  value: string;
  remarks: string;
  period_from?: string;
  period_to?: string;
  date_from?: string | null;
  date_to?: string | null;
}

export type CongressReferenceResponse = BasicResponse<CongressReferenceItem[]>;

