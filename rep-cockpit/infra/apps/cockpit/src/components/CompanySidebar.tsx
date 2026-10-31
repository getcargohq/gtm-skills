import { Badge, Card, CardContent } from "@cargo-ai/app-sdk";
import React from "react";

import { hasText, type HotLead } from "../lib/queries";
import { AccountSignals } from "./AccountSignals";
import { CompanyAbout } from "./CompanyAbout";

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
// and every signal on it. The people cards below only say why now for them.
export const CompanySidebar: React.FC<{
  domain: string;
  company: HotLead | undefined;
}> = ({ domain, company }) => {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-4">
        <Section title="About">
          <CompanyAbout domain={domain} />
        </Section>
        <Section title="Fit">
          {company !== undefined && hasText(company.tier) ? (
            <>
              <Badge variant="outline" className="w-fit">
                Tier {company.tier}
              </Badge>
              <p className="text-sm">{company.tier_reason}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not tiered yet. Account scoring has not judged this company.
            </p>
          )}
        </Section>
        <Section title="Signals">
          <AccountSignals domain={domain} />
        </Section>
      </CardContent>
    </Card>
  );
};
