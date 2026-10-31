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
import { signalLabel, stageLabel, stageVariant } from "../lib/hot-accounts";
import { hasText, type HotAccount, type Signal } from "../lib/queries";
import { CompanyAbout } from "./CompanyAbout";
import { CompanyLogo, LinkedinLink } from "./CompanyLogo";
import { FitSection } from "./FitSection";

type PreviewProps = {
  account: HotAccount | undefined;
  signals: Signal[];
  isBusy: boolean;
  onClose: () => void;
  onClaim: (account: HotAccount) => void;
  onPass: (account: HotAccount, reason: PassReason) => void;
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

// Everything the queue knows about one Hot account, to decide before claiming:
// why it fits, why now, and what the company is.
export const AccountPreview: React.FC<PreviewProps> = ({
  account,
  signals,
  isBusy,
  onClose,
  onClaim,
  onPass,
}) => {
  const [isPassing, setIsPassing] = React.useState(false);

  return (
    <Sheet
      open={account !== undefined}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          setIsPassing(false);
          onClose();
        }
      }}
    >
      <SheetContent className="flex w-full flex-col gap-6 overflow-y-auto sm:max-w-lg">
        {account === undefined ? null : (
          <>
            <SheetHeader>
              <div className="flex items-center gap-3">
                <CompanyLogo domain={account.domain} name={account.name} />
                <div className="text-left">
                  <SheetTitle>{account.name}</SheetTitle>
                  <SheetDescription className="flex gap-3">
                    <a
                      href={`https://${account.domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs underline"
                    >
                      {account.domain}
                    </a>
                    <LinkedinLink url={account.linkedin_url} />
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>
            <Section title="Fit">
              <FitSection company={account} />
            </Section>
            <Section title="Readiness">
              {hasText(account.readiness_stage) ? (
                <Badge
                  variant={stageVariant(account.readiness_stage)}
                  className="w-fit"
                >
                  {stageLabel(account.readiness_stage)}
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
              <CompanyAbout domain={account.domain} />
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
                      onClick={() => onPass(account, reason)}
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
                  <Button disabled={isBusy} onClick={() => onClaim(account)}>
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
