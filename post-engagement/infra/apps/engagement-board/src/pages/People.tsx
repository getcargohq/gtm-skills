import {
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
  ADJACENT_LABEL,
  daysAgo,
  HAS_ADJACENT,
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
  IcpBadge,
  Kpis,
  PersonSheet,
  personMatches,
  scoreHelp,
} from "../shared";

const SHOWN = 300;

export const People: React.FC = () => {
  const { data, isLoading, error } = useBoard();
  const [filters, setFilters] = React.useState(defaultFilters);
  const [selected, setSelected] = React.useState<Person | undefined>(undefined);

  return (
    <List
      title="People"
      description={`Everyone who engaged, ranked. ${scoreHelp}`}
    >
      <BoardState isLoading={isLoading} error={error} board={data}>
        {(board) => {
          const now = board.loadedAt;
          const icp = board.people.filter(
            (person) => person.icp && person.ourPosts > 0,
          );
          const accountsWithTwo = board.accounts.filter(
            (account) =>
              account.people.filter((person) => person.ourPosts > 0).length >=
              2,
          );
          const rows = board.people.filter((person) =>
            personMatches(person, filters, now),
          );
          const exportRows = () =>
            downloadCsv(
              `engagers-${now.toISOString().slice(0, 10)}.csv`,
              toCsv(
                [
                  "score",
                  "name",
                  "linkedin",
                  "title",
                  "company",
                  "company_linkedin",
                  "employees",
                  "industry",
                  "icp",
                  "our_posts",
                  "adjacent_posts",
                  "comments",
                  "first_seen",
                  "last_seen",
                ],
                rows.map((person) => [
                  person.score.toFixed(2),
                  person.name,
                  person.personUrl,
                  person.title,
                  person.companyName,
                  person.companyUrl,
                  person.employeeRange,
                  person.industry,
                  person.icp ? "yes" : "no",
                  person.ourPosts,
                  person.adjacentPosts,
                  person.comments,
                  person.firstSeen,
                  person.lastSeen,
                ]),
              ),
            );
          return (
            <>
              <Kpis
                items={[
                  {
                    label: "New ICP engagers, 7 days",
                    value: icp.filter(
                      (person) => daysAgo(person.firstSeen, now) <= 7,
                    ).length,
                    hint: `${icp.length} ICP people have engaged with our posts in all`,
                  },
                  {
                    label: "Repeat ICP engagers",
                    value: icp.filter((person) => person.ourPosts >= 2).length,
                    hint: "ICP people on 2 or more of our posts",
                  },
                  ...(HAS_ADJACENT
                    ? [
                        {
                          label: `ICP who also engage with ${ADJACENT_LABEL}`,
                          value: icp.filter(
                            (person) => person.adjacentPosts > 0,
                          ).length,
                          hint: "Know us and are shopping the category",
                        },
                      ]
                    : []),
                  {
                    label: "Accounts with 2+ engagers",
                    value: accountsWithTwo.length,
                    hint: `${accountsWithTwo.filter((account) => account.icp).length} of them with an ICP engager`,
                  },
                ]}
              />
              <FilterBar
                filters={filters}
                onChange={setFilters}
                onExport={exportRows}
              />
              <div className="px-6 pb-6">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 text-right">Score</TableHead>
                      <TableHead>Person</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>ICP</TableHead>
                      <TableHead className="text-right">Our posts</TableHead>
                      <TableHead className="text-right">Adjacent</TableHead>
                      <TableHead className="text-right">Comments</TableHead>
                      <TableHead>Last seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, SHOWN).map((person) => (
                      <TableRow
                        key={person.personUrl}
                        className="cursor-pointer"
                        onClick={() => setSelected(person)}
                      >
                        <TableCell className="text-right font-medium tabular-nums">
                          {person.score.toFixed(1)}
                        </TableCell>
                        <TableCell className="max-w-sm">
                          <ExternalAnchor href={person.personUrl}>
                            {person.name}
                          </ExternalAnchor>
                          <div className="truncate text-xs text-muted-foreground">
                            {person.title}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <div className="truncate">{person.companyName}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {person.employeeRange} · {person.industry}
                          </div>
                        </TableCell>
                        <TableCell>
                          <IcpBadge icp={person.icp} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {person.ourPosts}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {person.adjacentPosts}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {person.comments}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-sm">
                          {person.lastSeen}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="mt-3 text-xs text-muted-foreground">
                  {rows.length > SHOWN
                    ? `Showing the top ${SHOWN} of ${rows.length}. The CSV has all of them.`
                    : `${rows.length} people.`}{" "}
                  Loaded {now.toLocaleString()} from {board.engagements.length}{" "}
                  engagements.
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
