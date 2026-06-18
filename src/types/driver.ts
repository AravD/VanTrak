/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  status: 'Active' | 'Probation' | 'W/C' | 'Inactive';
  van_number: string | null;
  notes: string | null;
  days_worked: number;
  sun: boolean;
  mon: boolean;
  tue: boolean;
  wed: boolean;
  thu: boolean;
  fri: boolean;
  sat: boolean;
  created_at: string;
}

export interface Assignment {
  id: string;
  date: string;
  driver_id: string;
  created_at: string;
}

export type DayOfWeek = 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat';

export interface RollCallDriver {
  driver_id: string;
  first_name: string;
  last_name: string;
  notes: string | null;
  schedule_assignment_id: string;
  station_id: string | null;
}

export interface RollCallRow {
  id?: string;
  report_date: string;
  station_id?: string | null;
  driver_id: string;
  schedule_assignment_id?: string | null;
  route_number: string;
  role: string;
  dvic_status: string;
  attendance_status: string;
  arrival_time: string;
  van_number: string;
  phone_assignment: string;
}

/** A single auto-derived alert row from the `daily_alerts` database view (read-only). */
export interface DailyAlert {
  report_date: string;
  driver_id: string | null;
  station_id: string | null;
  alert_type: string;
  label: string;
  detail: string | null;
}

export interface DailyIssue {
  id: string;
  issue_date: string;
  station_id: string | null;
  driver_id: string | null;
  issue_type: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export const ISSUE_TYPES = [
  'Van Damage',
  'Phone Issue',
  'Route Issue',
  'Package Issue',
  'Attendance Issue',
  'Customer Incident',
  'Safety Incident',
  'Other',
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];

export interface OperationsRow {
  id?: string;
  report_date: string;
  station_id?: string | null;
  driver_id: string;
  schedule_assignment_id?: string | null;
  route_number: string;
  stops_count: string;
  packages_count: string;
  route_status: string;
  rts_number: string;
  last_delivery_time: string;
  rescue_notes: string;
  paycom_logout_time: string;
  total_hours_worked: string;
  closeout_notes: string;
}
