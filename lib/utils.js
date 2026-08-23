import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const IST_TIMEZONE = "Asia/Kolkata";

function istParts(dateInput = new Date()) {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: IST_TIMEZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date);
    const get = (type) => parts.find((p) => p.type === type)?.value;
    return {
        year: Number(get("year")),
        month: Number(get("month")),
        day: Number(get("day")),
        hour: Number(get("hour")),
        minute: Number(get("minute")),
        second: Number(get("second")),
    };
}

/** Calendar date in IST as YYYY-MM-DD. Safe on both server (UTC) and browser. */
export function getISTDateKey(dateInput = new Date()) {
    const p = istParts(dateInput);
    if (!p) return "";
    return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function formatDateDDMMYYYY(dateInput) {
    if (!dateInput) return "—";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: IST_TIMEZONE,
    });
}

export function formatTimeIST(dateInput) {
    if (!dateInput) return "—";
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
        timeZone: IST_TIMEZONE,
    });
}

/** Inclusive IST calendar-day bounds as UTC Date objects. */
export function getISTDayBounds(dateInput = new Date()) {
    const key = getISTDateKey(dateInput);
    return {
        start: new Date(`${key}T00:00:00.000+05:30`),
        end: new Date(`${key}T23:59:59.999+05:30`),
    };
}

/** IST month bounds (month is 1–12). end is exclusive. */
export function getISTMonthBounds(year, month) {
    const start = new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00.000+05:30`);
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const end = new Date(`${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000+05:30`);
    return { start, end };
}

/** Attendance "today" starts at 03:00 IST. */
export function getISTAttendanceDayStart(dateInput = new Date()) {
    const p = istParts(dateInput);
    if (!p) return new Date();
    let key = `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
    if (p.hour < 3) {
        const prevNoon = new Date(`${key}T12:00:00.000+05:30`);
        key = getISTDateKey(new Date(prevNoon.getTime() - 24 * 60 * 60 * 1000));
    }
    return new Date(`${key}T03:00:00.000+05:30`);
}

export function getISTHour(dateInput = new Date()) {
    return istParts(dateInput)?.hour ?? 0;
}

export function getISTDateParts(dateInput = new Date()) {
    return istParts(dateInput);
}
