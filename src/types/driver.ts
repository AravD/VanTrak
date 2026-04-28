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
