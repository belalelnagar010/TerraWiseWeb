import { Pipe, PipeTransform } from '@angular/core';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Converts a `windowStartDay` (day-of-November index from the time-machine
 * data) into a short display date, e.g. 14 → "Nov 14", 33 → "Dec 3".
 */
@Pipe({ name: 'windowDayToDate', standalone: true })
export class WindowDayToDatePipe implements PipeTransform {
  transform(day: number | null | undefined): string {
    if (day === null || day === undefined || isNaN(day)) return '—';
    // Anchor to 1 November, add (day - 1) days, roll into December if needed.
    const d = new Date(Date.UTC(2026, 10, 1));
    d.setUTCDate(d.getUTCDate() + Math.round(day) - 1);
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
}
