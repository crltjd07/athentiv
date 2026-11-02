import { Compass } from "lucide-react";
import { Wordmark } from "@/components/Brand";
import { ButtonLink } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6 text-center">
      <Wordmark className="mb-12" />
      <div className="grid size-20 place-items-center rounded-3xl bg-brand-50 text-brand-700">
        <Compass className="size-9" />
      </div>
      <h1 className="mt-6 text-2xl font-extrabold tracking-tight text-ink">Page not found</h1>
      <p className="mt-2 max-w-xs text-sm text-muted">The page you&apos;re looking for doesn&apos;t exist or has moved.</p>
      <ButtonLink href="/home" size="lg" className="mt-8 w-full max-w-xs">
        Go to Home
      </ButtonLink>
    </main>
  );
}
