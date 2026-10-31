import React from "react";

// A rep's own clicks, held in the browser until SQL catches up. A native write
// takes up to a minute or two to reach SQL, so without this a claimed account
// stays in Hot leads after the click and invites a second claim. One store
// for every page: a claim shows everywhere the moment it is clicked.

export type HeldClick = {
  status: "claimed" | "passed" | "released";
  accountName: string;
  heldAtMs: number;
};

const holdForMs = 15 * 60 * 1000;

type HeldClicks = {
  clicks: Map<string, HeldClick>;
  hold: (domain: string, click: Omit<HeldClick, "heldAtMs">) => void;
};

const HeldClicksContext = React.createContext<HeldClicks | undefined>(
  undefined,
);

export const HeldClicksProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [clicks, setClicks] = React.useState<Map<string, HeldClick>>(new Map());

  const hold = React.useCallback(
    (domain: string, click: Omit<HeldClick, "heldAtMs">) => {
      setClicks((previous) => {
        const next = new Map(previous);
        next.set(domain, { ...click, heldAtMs: Date.now() });
        return next;
      });
    },
    [],
  );

  return (
    <HeldClicksContext.Provider value={{ clicks, hold }}>
      {children}
    </HeldClicksContext.Provider>
  );
};

export const useHeldClicks = (): HeldClicks => {
  const context = React.useContext(HeldClicksContext);
  if (context === undefined) {
    throw new Error("useHeldClicks needs a HeldClicksProvider");
  }
  return context;
};

// The rep's own recent click on this domain, while it is still worth holding.
export const heldClickFor = (
  clicks: Map<string, HeldClick>,
  domain: string,
): HeldClick | undefined => {
  const click = clicks.get(domain);
  if (click === undefined) {
    return undefined;
  }
  if (Date.now() - click.heldAtMs > holdForMs) {
    return undefined;
  }
  return click;
};
