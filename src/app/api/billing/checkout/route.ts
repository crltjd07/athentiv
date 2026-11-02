import { ok, rateLimit, readJson, route } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { createCheckout } from "@/server/billing";
import { checkoutSchema } from "@/shared/schemas";

export const POST = route(async (req) => {
  const auth = await requireAuth();
  rateLimit(`checkout:${auth.user.id}`, 20, 60 * 60_000);
  const { plan } = await readJson(req, checkoutSchema);
  const checkout = createCheckout(auth.user.id, plan);
  return ok({ ...checkout, checkoutUrl: `/premium/checkout/${checkout.id}` }, { status: 201 });
});
