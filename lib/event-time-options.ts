/** The half-hour start/end choices offered when an administrator creates an event shift. */
export const EVENT_TIME_OPTIONS = Array.from({ length: 33 }, (_, index) => {
  const total = 6 * 60 + index * 30;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
});
