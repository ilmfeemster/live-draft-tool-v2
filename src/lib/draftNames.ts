const monthAbbreviations = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export function formatAutomaticDraftName(createdAt = new Date()): string {
  const month = monthAbbreviations[createdAt.getMonth()];
  const day = createdAt.getDate();
  const year = createdAt.getFullYear();
  const hours = createdAt.getHours();
  const minutes = createdAt.getMinutes().toString().padStart(2, "0");
  const meridiem = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 || 12;

  return `Draft - ${month} ${day}, ${year}, ${displayHour}:${minutes} ${meridiem}`;
}
