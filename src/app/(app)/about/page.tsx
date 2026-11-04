"use client";

import { CalendarClock, ChartColumn, Nfc, Timer } from "lucide-react";
import { Wordmark } from "@/components/Brand";
import { PageHeader } from "@/components/Nav";
import { Card, SectionTitle } from "@/components/ui";

const FEATURES = [
  { icon: CalendarClock, title: "Keep track of deadlines", body: "Add your assignments, quizzes, projects and exams, and see what is due next." },
  { icon: Timer, title: "Study with focus", body: "Put your phone on the FocusDock stand and work in timed sessions with short breaks." },
  { icon: ChartColumn, title: "See your progress", body: "Check how much you studied and how many tasks you finished each week." },
];

export default function About() {
  return (
    <main className="mx-auto max-w-[480px] px-4">
      <PageHeader title="About ATHENTIV FocusDock" back="/profile" />

      <Card className="p-5 text-center">
        <Wordmark className="justify-center" />
        <p className="mt-3 text-[15px] text-ink-2">A study companion for students, made to work with the FocusDock phone stand.</p>
      </Card>

      <SectionTitle>What you can do</SectionTitle>
      <Card className="divide-y divide-line">
        {FEATURES.map(({ icon: Icon, title, body }) => (
          <div key={title} className="flex gap-3 px-4 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
              <Icon className="size-5" />
            </span>
            <div>
              <p className="font-semibold text-ink">{title}</p>
              <p className="text-sm text-muted">{body}</p>
            </div>
          </div>
        ))}
      </Card>

      <SectionTitle>The FocusDock stand</SectionTitle>
      <Card className="flex gap-3 p-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
          <Nfc className="size-5" />
        </span>
        <p className="text-sm text-ink-2">
          The stand holds your phone while you study. Tap your phone on it to start focus sessions. The app also works without a stand, with a Premium plan.
        </p>
      </Card>

      <p className="mt-8 text-center text-xs text-faint">ATHENTIV FocusDock · Version 1.0 · © 2026 ATHENTIV</p>
    </main>
  );
}
