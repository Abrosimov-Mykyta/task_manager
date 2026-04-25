/**
 * Starter groups and tasks for new users (English labels).
 * Group names are unique per user (see Prisma @@unique [userId, name]).
 */

export const DEFAULT_GROUPS = [
  { name: "Work", color: "#60a5fa" },
  { name: "Sport & health", color: "#22c55e" },
  { name: "Home & routine", color: "#f97316" },
  { name: "Personal", color: "#a78bfa" },
];

/** Each task references a group by `group` name, or null for ungrouped */
export const DEFAULT_TASKS = [
  { title: "Focus block", minutes: 60, group: "Work", color: "#60a5fa" },
  { title: "Meetings", minutes: 45, group: "Work", color: "#60a5fa" },
  { title: "Email & messages", minutes: 25, group: "Work", color: "#60a5fa" },

  { title: "Workout", minutes: 45, group: "Sport & health", color: "#22c55e" },
  { title: "Walk", minutes: 30, group: "Sport & health", color: "#22c55e" },
  { title: "Stretch", minutes: 15, group: "Sport & health", color: "#22c55e" },

  { title: "Clean the dishes", minutes: 20, group: "Home & routine", color: "#f97316" },
  { title: "Laundry", minutes: 40, group: "Home & routine", color: "#f97316" },
  { title: "Tidy up", minutes: 30, group: "Home & routine", color: "#f97316" },
  { title: "Groceries", minutes: 45, group: "Home & routine", color: "#f97316" },

  { title: "Read or learn", minutes: 30, group: "Personal", color: "#a78bfa" },
  { title: "Call family or friends", minutes: 20, group: "Personal", color: "#a78bfa" },
  { title: "Wind down", minutes: 20, group: "Personal", color: "#a78bfa" },
];

/**
 * If the user has no groups and no tasks yet, create defaults. Idempotent.
 * @returns {Promise<boolean>} true if seeding ran
 */
export async function seedDefaultWorkspaceIfEmpty(prisma, userId) {
  const [groupCount, taskCount] = await Promise.all([
    prisma.taskGroup.count({ where: { userId } }),
    prisma.task.count({ where: { userId } }),
  ]);
  if (groupCount > 0 || taskCount > 0) return false;

  await prisma.$transaction(async (tx) => {
    const nameToId = new Map();
    for (const g of DEFAULT_GROUPS) {
      const row = await tx.taskGroup.create({
        data: { userId, name: g.name, color: g.color },
      });
      nameToId.set(g.name, row.id);
    }
    for (const t of DEFAULT_TASKS) {
      const groupId = t.group ? nameToId.get(t.group) ?? null : null;
      await tx.task.create({
        data: {
          userId,
          title: t.title,
          minutes: t.minutes,
          color: t.color,
          groupId,
        },
      });
    }
  });

  return true;
}
