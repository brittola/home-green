export type IsoDate = string;

export type Weekday = 1 | 2 | 3 | 4 | 5;

export interface PersonSummary {
  id: number;
  name: string;
  hasParkingCard: boolean;
}

export interface DayView {
  date: IsoDate;
  weekday: Weekday;
  limit: number;
  remote: PersonSummary[];
}

export interface WeekView {
  weekStart: IsoDate;
  today: IsoDate;
  currentWeekStart: IsoDate;
  minWeekStart: IsoDate;
  maxWeekStart: IsoDate;
  editable: boolean;
  days: DayView[];
  personDates: IsoDate[];
}
