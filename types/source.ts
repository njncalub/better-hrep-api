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

/**
 * Bill item from principal_authored_bills array
 */
export interface PrincipalAuthoredBill {
  idx: number;
  no: number;
  id: number;
  congress: number;
  bill_no: string;
  author: string;
  auth_flag: boolean;
  final_flag: boolean;
  manual_flag: boolean;
  auth_source: string;
  date?: string;
  sequence_no: number;
  name: string;
  name_code: string;
  journal_no?: string;
  session_no?: string;
}

/**
 * House member item from POST /house-members/list
 */
export interface HouseMemberItem {
  id: number;
  type: string | null;
  district: string | null;
  author_id: string;
  fullname: string;
  last_name: string;
  first_name: string;
  middle_name: string;
  suffix: string | null;
  nick_name: string;
  email: string | null;
  website: string | null;
  room: string | null;
  local: string | null;
  directline: string | null;
  chief_of_staff: string | null;
  party_affilation: string | null;
  party_affilation_desc: string | null;
  remarks: string | null;
  current: boolean;
  photo: string | null;
  memberships: unknown | null;
  committee_membership: unknown | null;
  principal_authored_bills: PrincipalAuthoredBill[] | null;
  logs: unknown | null;
}

export type HouseMembersResponse = PaginatedResponse<HouseMemberItem>;

/**
 * Co-authored bill item from POST /house-members/co-author
 * Assuming similar structure to principal authored bills
 */
export interface CoAuthoredBillItem {
  idx: number;
  no: number;
  id: number;
  congress: number;
  bill_no: string;
  author: string;
  auth_flag: boolean;
  final_flag: boolean;
  manual_flag: boolean;
  auth_source: string;
  date?: string;
  sequence_no: number;
  name: string;
  name_code: string;
  journal_no?: string;
  session_no?: string;
}

export type CoAuthoredBillsResponse = PaginatedResponse<CoAuthoredBillItem>;

/**
 * Committee membership item from POST /house-members/committee-membership
 */
export interface CommitteeMembershipItem {
  no: string;
  congress: number;
  committee_code: string;
  name: string;
  author_id: string;
  representative: string;
  title: string;
  photo: {
    id: number;
    congress: number;
    module: string;
    name: string;
    size: number;
    type: string;
    main: boolean;
    deleted: boolean;
    parent_id: number;
    url: string;
  } | null;
  journal_no: string;
}

/**
 * Response structure for committee membership
 * Note: Not paginated, just has count and rows
 */
export interface CommitteeMembershipResponse {
  status: number;
  success: boolean;
  data: {
    count: number;
    rows: CommitteeMembershipItem[];
  };
}

