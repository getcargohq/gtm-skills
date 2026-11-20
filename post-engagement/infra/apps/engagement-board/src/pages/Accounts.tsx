import {
  Badge,
  List,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@cargo-ai/app-sdk";
import React from "react";

import {
  type Account,
  downloadCsv,
  type Person,
  toCsv,
  useBoard,
} from "../data";
import {
  BoardState,
  defaultFilters,
  ExternalAnchor,
  FilterBar,
  PersonSheet,
  personMatches,
} from "../shared";

const SHOWN = 200;

export const Accounts: React.FC = () => {
  const { data, isLoading, error } = useBoard();
  const [filters, setFilters] = React.useState(defaultFilters);
  const [selected, setSelected] = React.useState<Person | undefined>(undefined);

  return (
    <List
      title="Accounts"
      description="Companies ranked by the summed score of their engagers. Several people from one company engaging is the strongest sign an account is paying attention."
    >
      <BoardState isLoading={isLoading} error={error} board={data}>
        {(board) => {
          const now = board.loadedAt;
          // An account is shown with the engagers that pass the filters, and scored on them alone.
          const rows: Account[] = board.accounts
            .map((account) => {
              const people = account.people.filter((person) =>
                personMatches(person, filters, now),
              );
              return {
                ...account,
                people,
                score: people.reduce((sum, person) => sum + person.score, 0),
                icpPeople: people.filter((person) => person.icp).length,
              };
            })
            .filter((account) => account.people.length > 0)
            .sort(
              (a, b) => b.people.length - a.people.length || b.score - a.score,
            );
          const exportRows = () =>
            downloadCsv(
              `accounts-${now.toISOString().slice(0, 10)}.csv`,
              toCsv(
                [
                  "score",
                  "company",
                  "company_linkedin",
                  "employees",
                  "industry",
                  "engagers",
                  "icp_engagers",
                  "people",
                  "last_seen",
                ],
                rows.map((account) => [
                  account.score.toFixed(2),
                  account.companyName,
                  account.companyUrl,
                  account.employeeRange,
                  account.industry,
                  account.people.length,
                  account.icpPeople,
                  account.people
                    .map((person) => `${person.name} (${person.title})`)
                    .join("; "),
                  account.lastSeen,
                ]),
              ),
            );
          return (
            <>
              <FilterBar
                filters={filters}
                onChange={setFilters}
                onExport={exportRows}
              />
              <div className="px-6 pb-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">Engagers</TableHead>
                      <TableHead className="w-16 text-right">Score</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>People</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, SHOWN).map((account) => (
                      <TableRow key={account.companyKey}>
                        <TableCell className="text-right font-medium tabular-nums">
                          {account.people.length}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {account.score.toFixed(1)}
                        </TableCell>
                        <TableCell className="max-w-xs">
                          {account.companyUrl.length > 0 ? (
                            <ExternalAnchor href={account.companyUrl}>
                              {account.companyName}
                            </ExternalAnchor>
                          ) : (
                            account.companyName
                          )}
                          <div className="truncate text-xs text-muted-foreground">
                            {account.employeeRange} · {account.industry}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {account.people.map((person) => (
                              <Badge
                                key={person.personUrl}
                                variant={person.icp ? "default" : "outline"}
                                className="cursor-pointer"
                                onClick={() => setSelected(person)}
                              >
                                {person.name}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {account.lastSeen}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-xs text-muted-foreground">
                  {rows.length > SHOWN
                    ? `Showing the top ${SHOWN} of ${rows.length}. The CSV has all of them.`
                    : `${rows.length} accounts.`}{" "}
                  Filled badges are ICP people. Click one for their engagements.
                </p>
              </div>
              <PersonSheet
                person={selected}
                onClose={() => setSelected(undefined)}
              />
            </>
          );
        }}
      </BoardState>
    </List>
  );
};
