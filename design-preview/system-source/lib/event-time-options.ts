/** Quarter-hour choices across the existing 06:00–22:00 operating range. */
export const EVENT_TIME_OPTIONS = Array.from({ length: 65 }, (_, index) => {
  // Both endpoints are included: index 0 is 06:00 and index 64 is 22:00.
  // These are form choices, not the WMS API's time validation rules.
  const total = 6 * 60 + index * 15;
  return `${Math.floor(total / 60).toString().padStart(2, "0")}:${(total % 60).toString().padStart(2, "0")}`;
});
