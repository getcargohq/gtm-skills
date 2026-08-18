import type { Api } from "@cargo-ai/api";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CargoEmpty,
  CargoRefineApp,
  CargoSiderLayout,
  Input,
  useCargoApi,
} from "@cargo-ai/app-sdk";
import { Users } from "lucide-react";
import React from "react";
import { Route, Routes } from "react-router-dom";

// The cockpit reads what the other skills computed — cargo_score
// (account-scoring), territory (routing-engine), outreach_draft (ai-sdr) —
// and writes the rep's next action straight back onto the accounts model.
// The model uuid is baked into the build by defineApp's env (a deploy-time
// token), so the app needs no hardcoded ids.

const ACCOUNTS_MODEL_UUID = import.meta.env.VITE_ACCOUNTS_MODEL_UUID as string;

type AccountRow = {
  id: string;
  name: string;
  domain: string;
  cargo_score: number | null;
  territory: string | null;
  outreach_draft: string | null;
  next_action: string | null;
};

// PLACEHOLDER — the book query: your table/column names, the rep filter
// (territory/owner), and the tier threshold.
const BOOK_QUERY = `
  select id, name, domain, cargo_score, territory, outreach_draft, next_action
  from accounts
  where cargo_score > 69
  order by cargo_score desc
  limit 50
`;

const loadBook = async (api: Api): Promise<AccountRow[]> => {
  const result = await api.storage.query.execute({ query: BOOK_QUERY });
  return result.rows as AccountRow[];
};

const AccountCard: React.FC<{ account: AccountRow }> = ({ account }) => {
  const api = useCargoApi();
  const [nextAction, setNextAction] = React.useState(
    account.next_action === null ? "" : account.next_action,
  );

  const saveNextAction = async (): Promise<void> => {
    await api.storage.record.update({
      modelUuid: ACCOUNTS_MODEL_UUID,
      id: account.id,
      data: { next_action: nextAction },
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {account.name}{" "}
          <span className="font-normal text-muted-foreground">
            {account.domain}
          </span>
        </CardTitle>
        <div className="flex items-center gap-2">
          {account.territory === null ? null : (
            <Badge variant="outline">{account.territory}</Badge>
          )}
          <Badge>{account.cargo_score}</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {account.outreach_draft === null ? null : (
          <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">
            {account.outreach_draft}
          </blockquote>
        )}
        <Input
          value={nextAction}
          placeholder="Next action…"
          onChange={(event) => setNextAction(event.target.value)}
          onBlur={saveNextAction}
        />
      </CardContent>
    </Card>
  );
};

const Book: React.FC = () => {
  const api = useCargoApi();
  const [accounts, setAccounts] = React.useState<AccountRow[] | undefined>(
    undefined,
  );

  React.useEffect(() => {
    loadBook(api).then(setAccounts);
  }, [api]);

  if (accounts === undefined) {
    return <CargoEmpty title="Loading your book…" description="" />;
  }

  if (accounts.length === 0) {
    return (
      <CargoEmpty
        title="No scored accounts yet"
        description="Run the account-scoring play, then refresh — tier-A accounts land here."
      />
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {accounts.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
};

const resources = [
  {
    name: "book",
    list: "/",
    meta: { label: "My book", icon: <Users className="h-4 w-4" /> },
  },
];

export const App: React.FC = () => {
  return (
    <CargoRefineApp resources={resources}>
      <CargoSiderLayout title="Rep Cockpit">
        <Routes>
          <Route path="/" element={<Book />} />
        </Routes>
      </CargoSiderLayout>
    </CargoRefineApp>
  );
};
