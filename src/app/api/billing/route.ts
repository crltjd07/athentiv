import { ok, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { billingOverview } from "@/server/billing";

export const GET = route(async () => {
  const auth = await requireAuth();
  return ok({ ...billingOverview(auth.user.id), accountType: auth.user.account_type, trialGrantedAt: auth.user.trial_granted_at });
});
