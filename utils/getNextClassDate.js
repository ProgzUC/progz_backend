const DAY_INDEX = {
  Sunday: 0,
  Monday: 1,
  Tuesday: 2,
  Wednesday: 3,
  Thursday: 4,
  Friday: 5,
  Saturday: 6,
};

export function getNextClassDate(daysOfWeek, classTiming) {
  const now = new Date();
  const today = now.getDay();

  // extract start time (e.g. "10:00")
  const { startTime } = classTiming;
  let [hours, minutes] = startTime.split(":").map(Number);
  // startTime is expected to be in 24-hour format or we handle AM/PM if it was "10:00 AM" but the model comment says "10:00" usually implies 24h or raw input.
  // However, looking at the previous code:
  // const [time, meridian] = classTiming.split(" - ")[0].split(" ");
  // it was parsing "10:00 AM - 12:00 PM".
  // The new model comment says // "10:00" and // "12:00".
  // If we assume 24-hour format "HH:mm", then no meridian check is needed.
  // If inputs are "10:00 AM", we might need split.
  // Let's assume standard "HH:mm" 24-hour time or just parse what's there.
  // Since the user example comments were "10:00" and "12:00", I'll assume 24-hour or at least the start is clean.
  // But to be safe if they send "10:00 AM", I'll check for space.

  if (startTime.includes(" ")) {
    const [time, meridian] = startTime.split(" ");
    [hours, minutes] = time.split(":").map(Number);
    if (meridian === "PM" && hours !== 12) hours += 12;
    if (meridian === "AM" && hours === 12) hours = 0;
  }

  for (let i = 0; i < 7; i++) {
    const dayIndex = (today + i) % 7;

    const dayName = Object.keys(DAY_INDEX).find(
      key => DAY_INDEX[key] === dayIndex
    );

    if (daysOfWeek.includes(dayName)) {
      const nextDate = new Date(now);
      nextDate.setDate(now.getDate() + i);
      nextDate.setHours(hours, minutes, 0, 0);

      if (nextDate > now) {
        return nextDate;
      }
    }
  }

  return null;
}
