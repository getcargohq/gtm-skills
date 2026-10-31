import {
  Button,
  Checkbox,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@cargo-ai/app-sdk";
import React from "react";

import { noFilters, type Filters } from "../lib/hot-accounts";

const isFiltered = (filters: Filters): boolean => {
  return (
    filters.search !== "" ||
    filters.tier !== "all" ||
    filters.stage !== "all" ||
    filters.withSignals
  );
};

export const FilterBar: React.FC<{
  filters: Filters;
  onChange: (filters: Filters) => void;
  shown: number;
  total: number;
}> = ({ filters, onChange, shown, total }) => {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 p-2">
      <Input
        value={filters.search}
        placeholder="Search a company"
        aria-label="Search a company"
        className="w-56 bg-background"
        onChange={(event) =>
          onChange({ ...filters, search: event.target.value })
        }
      />
      <Select
        value={filters.tier}
        onValueChange={(tier) => onChange({ ...filters, tier })}
      >
        <SelectTrigger aria-label="Fit tier" className="w-36 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any tier</SelectItem>
          <SelectItem value="A">Tier A</SelectItem>
          <SelectItem value="B">Tier B</SelectItem>
          <SelectItem value="C">Tier C</SelectItem>
          <SelectItem value="none">Not tiered</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={filters.stage}
        onValueChange={(stage) => onChange({ ...filters, stage })}
      >
        <SelectTrigger aria-label="Readiness" className="w-40 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any readiness</SelectItem>
          <SelectItem value="ready_now">Ready now</SelectItem>
          <SelectItem value="warming">Warming</SelectItem>
          <SelectItem value="none">Not scored</SelectItem>
        </SelectContent>
      </Select>
      <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 text-sm">
        <Checkbox
          checked={filters.withSignals}
          onCheckedChange={(checked) =>
            onChange({ ...filters, withSignals: checked === true })
          }
        />
        With signals
      </label>
      {isFiltered(filters) ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(noFilters)}>
          Clear filters
        </Button>
      ) : null}
      <span className="ml-auto pr-2 text-sm text-muted-foreground">
        {shown} of {total} companies
      </span>
    </div>
  );
};
