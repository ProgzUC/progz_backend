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

  // extract start time (10:00 AM)
  const [time, meridian] = classTiming.split(" - ")[0].split(" ");
  let [hours, minutes] = time.split(":").map(Number);

  if (meridian === "PM" && hours !== 12) hours += 12;
  if (meridian === "AM" && hours === 12) hours = 0;

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
