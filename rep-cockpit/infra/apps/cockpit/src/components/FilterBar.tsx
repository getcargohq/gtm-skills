import { Button, Input } from "@cargo-ai/app-sdk";
import React from "react";

import { noFilters, type Filters } from "../lib/leads";

const selectClass =
  "h-9 rounded-md border border-input bg-background px-2 text-sm";

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
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={filters.search}
        placeholder="Search a company"
        aria-label="Search a company"
        className="w-56"
        onChange={(event) =>
          onChange({ ...filters, search: event.target.value })
        }
      />
      <select
        className={selectClass}
        aria-label="Fit tier"
        value={filters.tier}
        onChange={(event) => onChange({ ...filters, tier: event.target.value })}
      >
        <option value="all">Any tier</option>
        <option value="A">Tier A</option>
        <option value="B">Tier B</option>
        <option value="C">Tier C</option>
        <option value="none">Not tiered</option>
      </select>
      <select
        className={selectClass}
        aria-label="Readiness"
        value={filters.stage}
        onChange={(event) =>
          onChange({ ...filters, stage: event.target.value })
        }
      >
        <option value="all">Any readiness</option>
        <option value="ready_now">Ready now</option>
        <option value="warming">Warming</option>
      </select>
      <label className="flex h-9 items-center gap-2 rounded-md border border-input px-3 text-sm">
        <input
          type="checkbox"
          checked={filters.withSignals}
          onChange={(event) =>
            onChange({ ...filters, withSignals: event.target.checked })
          }
        />
        With signals
      </label>
      <span className="text-sm text-muted-foreground">
        {shown} of {total}
      </span>
      {isFiltered(filters) ? (
        <Button size="sm" variant="ghost" onClick={() => onChange(noFilters)}>
          Clear filters
        </Button>
      ) : null}
    </div>
  );
};
