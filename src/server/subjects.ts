import { all, run } from "./db";

export type SubjectDTO = { id: number; name: string; color: string; icon: string; openTasks: number; totalTasks: number };

export async function listSubjects(userId: number): Promise<SubjectDTO[]> {
  return (await all<{ id: number; name: string; color: string; icon: string; open_: number; total: number }>(
    `SELECT s.id, s.name, s.color, s.icon,
            (SELECT COUNT(*) FROM tasks t WHERE t.subject_id = s.id AND t.status != 'completed') AS open_,
            (SELECT COUNT(*) FROM tasks t WHERE t.subject_id = s.id) AS total
       FROM subjects s WHERE s.user_id = ? ORDER BY s.name`,
    userId,
  )).map((s) => ({ id: s.id, name: s.name, color: s.color, icon: s.icon, openTasks: s.open_, totalTasks: s.total }));
}

/** Deletes a subject; its tasks are kept without a subject. */
export async function deleteSubject(userId: number, subjectId: number) {
  await run("UPDATE tasks SET subject_id = NULL WHERE subject_id = ? AND user_id = ?", subjectId, userId);
  await run("DELETE FROM subjects WHERE id = ? AND user_id = ?", subjectId, userId);
}
