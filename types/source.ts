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

/**
 * House member DDL reference item from GET /house-members/ddl-reference
 * This is used for dropdown lists and contains membership congress numbers
 */
export interface HouseMemberDDLItem {
  id: number;
  author_id: string;
  fullname: string;
  nick_name: string;
  membership: number[];
}

export type HouseMemberDDLResponse = BasicResponse<HouseMemberDDLItem[]>;

/**
 * Bill search item from POST /bills/search
 */
export interface BillSearchItem {
  id: number;
  congress: number;
  bill_no: string;
  // ... other fields exist but we only need congress and bill_no
}

export type BillsSearchResponse = PaginatedResponse<BillSearchItem>;

/**
 * Committee item from POST /committee/list
 */
export interface CommitteeListItem {
  id: number;
  code: string;
  name: string;
  jurisdiction: string | null;
  location: string | null;
  phone: string | null;
  committee_secretary: string | null;
  members: string | null;
  profile_data: string | null;
  email: string | null;
  type: number;
  type_desc: string;
  chairperson: string | null;
}

export type CommitteeListResponse = PaginatedResponse<CommitteeListItem>;

/**
 * Author/Co-author item from bills response
 */
export interface BillAuthor {
  id: number;
  date?: string;
  sequence_no: number;
  name: string;
  name_code: string;
  journal_no?: string;
  session_no?: string;
}

/**
 * Reading item (first_reading, second_reading, third_reading)
 */
export interface BillReading {
  id: number;
  congress: number;
  bill_no: string;
  report?: string;
  comm_act?: string;
  referral?: string;
  ref_name?: string;
  sub_name?: string;
  recomm?: string;
  remarks?: string;
  date_read?: string;
}

/**
 * Referral item
 */
export interface BillReferral {
  id: number;
  congress: number;
  bill_no: string;
  referral: string;
  ref_flag: number;
  newres_flag: boolean;
  submit_flag: boolean;
  change_flag: boolean;
  orig_ref: string;
  journal_no: string;
  sequence_no: string;
  committee: string;
}

/**
 * Bill/Document item from POST /bills/list
 */
export interface BillListItem {
  id: number;
  congress: number;
  bill_no: string;
  bill_no_f: string;
  session_no: string;
  significance: number;
  manual_status: string;
  manual_status_order: string;
  nature: string | null;
  author: string;
  mother_bill_no: string;
  mother_flag: string | null;
  mother_status: string;
  title_full: string;
  title_short: string;
  abstract: string;
  alias_name: string;
  date_filed: string;
  urgent: boolean;
  urgent_date: string | null;
  admin_bill: boolean;
  admin_date: string | null;
  archive_date: string | null;
  archive_transmitted_date: string | null;
  withdrawn_date: string | null;
  retro_stat: string | null;
  retro_order: string | null;
  status: string;
  status_order: string;
  mstat_order: string;
  senate_report_no: string;
  senate_bill: string;
  senate_urgent: boolean;
  senate_urgent_date: string | null;
  senate_adopted_date: string | null;
  house_date_transmitted: string | null;
  house_date_record: string | null;
  remarks: string;
  file: string;
  size: number;
  congress_desc: string;
  significance_desc: string;
  nature_desc: string | null;
  text_as_filed: string;
  url: string;
  folder: string;
  authors: BillAuthor[] | null;
  coauthors: BillAuthor[] | null;
  coauthors_journal: BillAuthor[] | null;
  authors_final: unknown | null;
  authors_final_list: { code: string }[] | null;
  authors_committee_report: unknown | null;
  first_reading: BillReading | null;
  second_reading: BillReading | null;
  third_reading: BillReading | null;
  republic_acts: unknown | null;
  votes: unknown | null;
  deliberation: unknown | null;
  deliberation_committee: unknown | null;
  republic_act: unknown | null;
  committee_action: unknown | null;
  withdrawal: unknown | null;
  consolidated_bills: unknown | null;
  substituted_bills: unknown | null;
  principal_referral: BillReferral[] | null;
  secondary_referral: BillReferral[] | null;
  previous_referral: BillReferral[] | null;
  referrals: BillReferral[] | null;
  mother_bills: unknown | null;
  concom_members: unknown | null;
  bill_type: string;
}

export type BillsListResponse = PaginatedResponse<BillListItem>;

