import { err, idParam, ok, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getTransaction, settleSandbox } from "@/server/billing";
import { premiumOf } from "@/server/access";
import { sandboxPaySchema } from "@/shared/schemas";

type Ctx = { params: Promise<{ id: string }> };

const dto = (t: ReturnType<typeof getTransaction>) => ({
  id: t.id, plan: t.plan_code, planName: t.plan_name, amountCentavos: t.amount_centavos, currency: t.currency,
  status: t.status, isTest: !!t.is_test, ref: t.provider_ref, createdAt: t.created_at, paidAt: t.paid_at,
});

export const GET = route<Ctx>(async (_req, ctx) => {
  const auth = await requireAuth();
  return ok({ transaction: dto(getTransaction(auth.user.id, idParam((await ctx.params).id))), premium: premiumOf(auth.user.id) });
});

/** Sandbox-only: simulates the payment provider's result. Disabled when PAYMENTS_SANDBOX=off. */
export const POST = route<Ctx>(async (req, ctx) => {
  if (process.env.PAYMENTS_SANDBOX === "off") throw err.forbidden("SANDBOX_DISABLED", "Sandbox payments are disabled on this server.");
  const auth = await requireAuth();
  const { outcome } = await readJson(req, sandboxPaySchema);
  const t = settleSandbox(auth.user.id, idParam((await ctx.params).id), outcome);
  return ok({ transaction: dto(t), premium: premiumOf(auth.user.id) });
});
