import { Card, CardContent } from "@cargo-ai/app-sdk";
import React from "react";

import type { HotAccount } from "../lib/queries";
import { AccountSignals } from "./AccountSignals";
import { CompanyAbout } from "./CompanyAbout";
import { FitSection } from "./FitSection";
import { ReadinessScore } from "./ReadinessScore";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  return (
    <section className="flex flex-col gap-2 border-b pb-4 last:border-b-0 last:pb-0">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
};

// The company, read once at the top of the account: what it does, why it fits
// how ready it is and every signal on it. The people cards below only give the angle for each person.
export const CompanySidebar: React.FC<{
  domain: string;
  company: HotAccount | undefined;
}> = ({ domain, company }) => {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <Section title="About">
          <CompanyAbout domain={domain} />
        </Section>
        <Section title="Fit">
          <FitSection company={company} />
        </Section>
        <Section title="Readiness">
          <ReadinessScore
            stage={company?.readiness_stage}
            score={company?.readiness_score}
            explain
          />
        </Section>
        <Section title="Signals">
          <AccountSignals domain={domain} />
        </Section>
      </CardContent>
    </Card>
  );
};
