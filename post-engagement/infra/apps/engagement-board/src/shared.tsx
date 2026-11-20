import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Input,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  Spinner,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@cargo-ai/app-sdk";
import { Download, ExternalLink } from "lucide-react";
import React from "react";

import {
  ADJACENT_LABEL,
  type Board,
  HAS_ADJACENT,
  daysAgo,
  type Person,
  SCORING,
} from "./data";

export type Window = "7" | "30" | "all";
export type Source = "all" | "ours" | "adjacent";

export type Filters = {
  window: Window;
  source: Source;
  icpOnly: boolean;
  search: string;
};

export const defaultFilters: Filters = {
  window: "30",
  source: "ours",
  icpOnly: true,
  search: "",
};

export function inWindow(date: string, window: Window, now: Date): boolean {
  return window === "all" || daysAgo(date, now) <= Number(window);
}

export function personMatches(
  person: Person,
  filters: Filters,
  now: Date,
): boolean {
  if (filters.icpOnly && !person.icp) return false;
  if (filters.source === "ours" && person.ourPosts === 0) return false;
  if (filters.source === "adjacent" && person.adjacentPosts === 0) return false;
  if (!inWindow(person.lastSeen, filters.window, now)) return false;
  const needle = filters.search.trim().toLowerCase();
  if (needle.length === 0) return true;
  return `${person.name} ${person.title} ${person.companyName} ${person.industry}`
    .toLowerCase()
    .includes(needle);
}

export const FilterBar: React.FC<{
  filters: Filters;
  onChange: (filters: Filters) => void;
  onExport: () => void;
  showSource?: boolean;
}> = ({ filters, onChange, onExport, showSource = true }) => (
  <div className="flex flex-wrap items-center gap-3 px-6 pb-4">
    <Input
      className="w-64"
      placeholder="Search name, title, company"
      value={filters.search}
      onChange={(event) => onChange({ ...filters, search: event.target.value })}
    />
    <ToggleGroup
      type="single"
      size="sm"
      variant="outline"
      value={filters.window}
      onValueChange={(value) => {
        if (value !== "") onChange({ ...filters, window: value as Window });
      }}
    >
      <ToggleGroupItem value="7">7 days</ToggleGroupItem>
      <ToggleGroupItem value="30">30 days</ToggleGroupItem>
      <ToggleGroupItem value="all">All</ToggleGroupItem>
    </ToggleGroup>
    {showSource && HAS_ADJACENT ? (
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={filters.source}
        onValueChange={(value) => {
          if (value !== "") onChange({ ...filters, source: value as Source });
        }}
      >
        <ToggleGroupItem value="ours">Our posts</ToggleGroupItem>
        <ToggleGroupItem value="adjacent">Adjacent</ToggleGroupItem>
        <ToggleGroupItem value="all">Both</ToggleGroupItem>
      </ToggleGroup>
    ) : null}
    <label className="flex items-center gap-2 text-sm">
      <Switch
        checked={filters.icpOnly}
        onCheckedChange={(checked) =>
          onChange({ ...filters, icpOnly: checked })
        }
      />
      ICP only
    </label>
    <Button variant="outline" size="sm" className="ml-auto" onClick={onExport}>
      <Download className="mr-2 h-4 w-4" />
      CSV
    </Button>
  </div>
);

export const Kpis: React.FC<{
  items: { label: string; value: number | string; hint: string }[];
}> = ({ items }) => (
  <div className="grid gap-4 px-6 pb-4 sm:grid-cols-2 lg:grid-cols-4">
    {items.map((item) => (
      <Card key={item.label}>
        <CardHeader className="pb-2">
          <CardDescription>{item.label}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-semibold tabular-nums">
            {item.value}
          </div>
          <p className="text-xs text-muted-foreground">{item.hint}</p>
        </CardContent>
      </Card>
    ))}
  </div>
);

export const BoardState: React.FC<{
  isLoading: boolean;
  error: unknown;
  board: Board | undefined;
  children: (board: Board) => React.ReactNode;
}> = ({ isLoading, error, board, children }) => {
  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }
  if (error !== null && error !== undefined) {
    return (
      <Alert variant="destructive" className="mx-6">
        <AlertTitle>Could not load engagement</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : String(error)}
        </AlertDescription>
      </Alert>
    );
  }
  if (board === undefined) return null;
  return (
    <>
      {board.warnings.map((warning) => (
        <Alert key={warning} variant="destructive" className="mx-6 mb-4 w-auto">
          <AlertTitle>Incomplete data</AlertTitle>
          <AlertDescription>{warning}</AlertDescription>
        </Alert>
      ))}
      {children(board)}
    </>
  );
};

export const scoreHelp = `Score: a comment is ${SCORING.comment} points, a reaction ${SCORING.reaction}. Engagement on posts by ${ADJACENT_LABEL} counts ${SCORING.adjacentFactor}x. Points halve every ${SCORING.halfLifeDays} days, so repeat engagers rise and one-off likes fade.`;

export const ExternalAnchor: React.FC<{
  href: string;
  children: React.ReactNode;
}> = ({ href, children }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 hover:underline"
    onClick={(event) => event.stopPropagation()}
  >
    {children}
    <ExternalLink className="h-3 w-3 opacity-50" />
  </a>
);

export const IcpBadge: React.FC<{ icp: boolean }> = ({ icp }) =>
  icp ? <Badge>ICP</Badge> : <Badge variant="outline">Not ICP</Badge>;

export const PersonSheet: React.FC<{
  person: Person | undefined;
  onClose: () => void;
}> = ({ person, onClose }) => (
  <Sheet
    open={person !== undefined}
    onOpenChange={(open) => (open ? undefined : onClose())}
  >
    <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
      {person !== undefined ? (
        <>
          <SheetHeader>
            <SheetTitle>
              <ExternalAnchor href={person.personUrl}>
                {person.name}
              </ExternalAnchor>
            </SheetTitle>
            <SheetDescription>{person.title}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            <IcpBadge icp={person.icp} />
            <Badge variant="secondary">Score {person.score.toFixed(1)}</Badge>
            <Badge variant="secondary">{person.ourPosts} of our posts</Badge>
            {person.adjacentPosts > 0 ? (
              <Badge variant="secondary">
                {person.adjacentPosts} adjacent posts
              </Badge>
            ) : null}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            {person.companyUrl.length > 0 ? (
              <ExternalAnchor href={person.companyUrl}>
                {person.companyName}
              </ExternalAnchor>
            ) : (
              person.companyName
            )}
            {` · ${person.employeeRange} · ${person.industry}`}
          </p>
          <div className="mt-6 space-y-4">
            {person.events.map((event) => (
              <div key={event.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">
                    {event.kind === "comment" ? "Commented on" : "Reacted to"}{" "}
                    {event.author.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    seen {event.detected}
                  </span>
                </div>
                {event.comment.length > 0 && event.kind === "comment" ? (
                  <blockquote className="mt-2 border-l-2 pl-3 italic">
                    {event.comment}
                  </blockquote>
                ) : null}
                <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                  {event.postExcerpt}
                </p>
                <div className="mt-2 text-xs">
                  <ExternalAnchor href={event.postUrl}>
                    Post of {event.postDate}
                  </ExternalAnchor>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </SheetContent>
  </Sheet>
);
