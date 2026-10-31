import {
  Badge,
  Button,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@cargo-ai/app-sdk";
import React from "react";

import { passReasons, type PassReason } from "../config";
import { signalLabel, stageLabel, stageVariant } from "../lib/leads";
import { hasText, type HotLead, type Signal } from "../lib/queries";
import { CompanyAbout } from "./CompanyAbout";
import { CompanyLogo, LinkedinLink } from "./CompanyLogo";
import { FitSection } from "./FitSection";

type PreviewProps = {
  lead: HotLead | undefined;
  signals: Signal[];
  isBusy: boolean;
  onClose: () => void;
  onClaim: (lead: HotLead) => void;
  onPass: (lead: HotLead, reason: PassReason) => void;
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  );
};

// Everything the queue knows about one Hot lead, to decide before claiming:
// why it fits, why now, and what the company is.
export const AccountPreview: React.FC<PreviewProps> = ({
  lead,
  signals,
  isBusy,
  onClose,
  onClaim,
  onPass,
}) => {
  const [isPassing, setIsPassing] = React.useState(false);

  return (
    <Sheet
      open={lead !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIsPassing(false);
          onClose();
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">
        {lead === undefined ? null : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <CompanyLogo domain={lead.domain} name={lead.name} />
                <div className="text-left">
                  <SheetTitle>{lead.name}</SheetTitle>
                  <SheetDescription className="flex gap-3">
                    <a
                      href={`https://${lead.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline"
                    >
                      {lead.domain}
                    </a>
                    <LinkedinLink url={lead.linkedin_url} />
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <Section title="Fit">
              <FitSection company={lead} />
            </Section>
            <Section title="Readiness">
              {hasText(lead.readiness_stage) ? (
                <Badge
                  variant={stageVariant(lead.readiness_stage)}
                  className="w-fit"
                >
                  {stageLabel(lead.readiness_stage)}
                </Badge>
              ) : null}
              {signals.length > 0 ? (
                <ul className="flex flex-col gap-1 text-sm">
                  {signals.map((signal) => (
                    <li key={`${signal.signal}-${signal.occurred}`}>
                      {signalLabel(signal)}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No buying signal on file yet: no hire, funding, visit or
                  engagement has been recorded for this company.
                </p>
              )}
            </Section>
            <Section title="About">
              <CompanyAbout domain={lead.domain} />
            </Section>
            <SheetFooter className="mt-auto flex-col gap-2 sm:flex-col">
              {isPassing ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Why pass?
                  </span>
                  {passReasons.map((reason) => (
                    <Button
                      key={reason.slug}
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => onPass(lead, reason)}
                    >
                      {reason.label}
                    </Button>
                  ))}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsPassing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                <div className="flex justify-end gap-2">
                  <Button
                    variant="ghost"
                    disabled={isBusy}
                    onClick={() => setIsPassing(true)}
                  >
                    Pass
                  </Button>
                  <Button disabled={isBusy} onClick={() => onClaim(lead)}>
                    Claim
                  </Button>
                </div>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};
