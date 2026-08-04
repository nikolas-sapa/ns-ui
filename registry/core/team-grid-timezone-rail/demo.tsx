"use client";

import { TeamGridTimezoneRail, type TeamMember } from "./component";

const TEAM: TeamMember[] = [
  { id: "marcus", name: "Marcus Hale", role: "Staff Engineer", initials: "MH", utcOffset: -5 },
  { id: "ana", name: "Ana Reyes", role: "Design Lead", initials: "AR", utcOffset: -3 },
  { id: "joana", name: "Joana Duarte", role: "Support Lead", initials: "JD", utcOffset: 0 },
  { id: "lukas", name: "Lukas Brandt", role: "Infrastructure", initials: "LB", utcOffset: 1 },
  { id: "wanjiru", name: "Wanjiru Kimani", role: "Data Science", initials: "WK", utcOffset: 3 },
  { id: "darya", name: "Darya Sadeghi", role: "QA Engineer", initials: "DS", utcOffset: 3.5 },
];

/** core hours, and the viewer sitting in Berlin — fixed so the demo is stable */
const CORE_HOURS: [number, number] = [8, 20];
const VIEWER_OFFSET = 1;

export default function TeamGridTimezoneRailDemo() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-7 px-6 py-16">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted">
        ns-ui / team-grid-timezone-rail
      </p>

      <TeamGridTimezoneRail
        members={TEAM}
        workingHours={CORE_HOURS}
        viewerOffset={VIEWER_OFFSET}
        className="max-w-[880px]"
      />

      <p className="max-w-[52ch] text-center text-xs text-muted">
        Six people, six timezones. The inked run on the UTC rail is the only window in which everyone
        is inside their own working hours at once — four hours, 13:00 to 17:00 UTC. Hover one person
        and the rail opens out to the hours just you two share; press to pin it.
      </p>
    </div>
  );
}
