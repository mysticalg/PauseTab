import type { ScheduleWindow } from "./schema";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export const nowIso = () => new Date().toISOString();

export const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const getDayKey = (date = new Date()) => DAY_KEYS[date.getDay()];

export const getMinutesSinceMidnight = (date = new Date()) => date.getHours() * 60 + date.getMinutes();

export const isExpired = (value?: string, date = new Date()) => {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() <= date.getTime();
};

export const minutesUntilTomorrow = (date = new Date()) => {
  const tomorrow = new Date(date);
  tomorrow.setHours(24, 0, 0, 0);
  return Math.max(1, Math.ceil((tomorrow.getTime() - date.getTime()) / 60000));
};

export const isScheduleActive = (schedule: ScheduleWindow[] | undefined, date = new Date()) => {
  if (!schedule || schedule.length === 0) {
    return true;
  }

  const day = getDayKey(date);
  const minute = getMinutesSinceMidnight(date);

  return schedule.some((window) => {
    if (!window.days.includes(day)) {
      return false;
    }

    if (window.startMinute <= window.endMinute) {
      return minute >= window.startMinute && minute < window.endMinute;
    }

    return minute >= window.startMinute || minute < window.endMinute;
  });
};

export const formatDurationLabel = (minutes: number) => {
  if (minutes < 60) {
    return `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
};
