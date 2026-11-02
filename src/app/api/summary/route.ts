import { z } from "zod";
import { err, ok, readQuery, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { premiumOf } from "@/server/access";
import { summary } from "@/server/stats";
import { isDayString } from "@/shared/day";

const day = z.string().refine(isDayString, "Use YYYY-MM-DD.");
const schema = z.object({ range: z.enum(["week", "month", "custom"]).default("week"), from: day.optional(), to: day.optional() });

export const GET = route(async (req) => {
  const auth = await requireAuth();
  const q = readQuery(req, schema);
  if (q.range !== "week" && !premiumOf(auth.user.id, auth.now).active) {
    throw err.forbidden("PREMIUM_REQUIRED", "Monthly and custom-range reports are Premium features.", { feature: "Detailed analytics" });
  }
  if (q.range === "custom" && (!q.from || !q.to)) throw err.badRequest("Choose a start and end date.");
  return ok(summary(auth, q));
});
