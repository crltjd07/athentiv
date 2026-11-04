import { tx } from "@/server/db";
import { idParam, ok, readJson, route } from "@/server/http";
import { requireMember } from "@/server/auth";
import { changeStatus, getOwnedTask, serializeTask } from "@/server/tasks";
import { taskStatusSchema } from "@/shared/schemas";

type Ctx = { params: Promise<{ id: string }> };

/** Re-opening a completed task counts against the Freemium open-task limit. */
export const POST = route<Ctx>(async (req, ctx) => {
  const auth = await requireMember();
  const id = idParam((await ctx.params).id);
  const { status } = await readJson(req, taskStatusSchema);
  const task = await tx(async () => {
    await changeStatus(auth, await getOwnedTask(auth, id), status, "user");
    return getOwnedTask(auth, id);
  });
  return ok({ task: serializeTask(task, Date.now()) });
});
