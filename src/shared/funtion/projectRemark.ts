/** Present older project expense remarks in the current activity-only format. */
export function projectRemark(note: string): string {
  return note.split("\n").map(line => line.replace(/^โครงการ: .*? · (?=กิจกรรม: )/, "")).join("\n");
}
