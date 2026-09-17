"""Local descriptive calibration helpers. No fitting or automatic rule approval."""
import hashlib
import json
import math
import sys
from scorer import label_outcome


def grouped_split(rows, seed="account-fit-v1", holdout_fraction=0.2):
    if not 0 < holdout_fraction < 1:
        raise ValueError("holdout fraction must be between zero and one")
    return {r["episode_id"]: ("holdout" if int(hashlib.sha256((seed + r["account_id"]).encode()).hexdigest()[:8], 16)/16**8 < holdout_fraction else "development") for r in rows}


def interval(success, count):
    if not count:
        return None
    z = 1.959963984540054
    p = success/count
    center = (p + z*z/(2*count))/(1+z*z/count)
    margin = z*math.sqrt(p*(1-p)/count+z*z/(4*count*count))/(1+z*z/count)
    return [max(0, center-margin), min(1, center+margin)]


def eligible(rows, mature_only=False):
    cohort = [r for r in rows if r["stage"] == "closed_won" and r["kind"] == "acquisition" and r["outcome_tier"] is not None and (not mature_only or r["outcome_mature"])]
    ids = [r["account_id"] for r in cohort]
    if len(set(ids)) != len(ids):
        raise ValueError("Choose a documented account-level observation; duplicate account analysis rows")
    return cohort


def lift_table(rows, feature, mature_only=False, target_outcome="Tier 1"):
    cohort = eligible(rows, mature_only)
    count = len(cohort)
    tier1 = sum(r["outcome_tier"] == target_outcome for r in cohort)
    baseline = tier1/count if count else None
    groups = {}
    missing_count = 0
    for row in cohort:
        observation = row["features"][feature]
        value = observation["value"] if observation["snapshot_quality"] in ("exact", "reconstructed") else None
        if value is None:
            missing_count += 1
        # No automatic buckets: caller applies only reviewed transformations.
        groups.setdefault(json.dumps(value, sort_keys=True), []).append(row)
    report = []
    for value, group in sorted(groups.items()):
        n = len(group); good = sum(r["outcome_tier"] == target_outcome for r in group)
        report.append(dict(value=json.loads(value), accounts=n,tier1_count=good,tier1_rate=good/n,
                           baseline_rate=baseline,lift=(good/n)/baseline if baseline else None,
                           rate_interval=interval(good,n),mature_count=sum(r["outcome_mature"] for r in group),
                           missingness=missing_count/count if count else None))
    return dict(accounts=count,tier1_count=tier1,baseline_rate=baseline,groups=report,
                limitation="Descriptive only; uncertainty is large for small support. Missing/proxy group is not a predictive rule.")


def validation_metrics(rows, top_tier="A", mature_only=False, target_outcome="Tier 1"):
    cohort = eligible(rows,mature_only)
    good = [r for r in cohort if r["outcome_tier"] == target_outcome]
    selected = [r for r in cohort if r.get("predicted_fit_tier") == top_tier]
    hits = sum(r["outcome_tier"] == target_outcome for r in selected)
    precision = hits/len(selected) if selected else None
    baseline = len(good)/len(cohort) if cohort else None
    return dict(accounts=len(cohort),top_tier_count=len(selected),tier1_count=len(good),
                precision=precision,precision_interval=interval(hits,len(selected)),
                lift=precision/baseline if precision is not None and baseline else None,
                tier1_recall=hits/len(good) if good else None,
                missed_good_customers=[r["account_id"] for r in good if r.get("predicted_fit_tier") != top_tier],
                false_positives=[r["account_id"] for r in selected if r["outcome_tier"] != target_outcome],
                unscored_count=sum(r.get("predicted_fit_tier") is None for r in cohort),
                all_accounts_baseline_precision=baseline)


def calibration_report(data):
    rows=[dict(r,**label_outcome(r,data["contract"])) for r in data["episodes"]]
    mode=data.get("analysis_mode","exploratory")
    if mode not in ("exploratory","holdout"):
        raise ValueError("unsupported analysis mode")
    if mode == "holdout":
        if data.get("discovery_scope") != "development":
            raise ValueError("held-out validation requires development-only discovery")
        account_splits={}
        for row in rows:
            split=row.get("split")
            if split not in ("development","holdout"):
                raise ValueError("assign splits before discovery")
            if row["account_id"] in account_splits and account_splits[row["account_id"]] != split:
                raise ValueError("account leakage across splits")
            account_splits[row["account_id"]]=split
        development=[r for r in rows if r["split"]=="development"]
        validation=[r for r in rows if r["split"]=="holdout"]
        if not development or not validation:
            raise ValueError("empty development or holdout population")
    else:
        development=validation=rows
    result={"validation_status":mode,"limitations":["No automatic fitting or feature selection; validation predictions must come from frozen development rules."]}
    for mature,key in [(False,"all_labeled"),(True,"mature_only")]:
        result[key]={"development_features":{f:lift_table(development,f,mature,data["contract"]["outcome"]["thresholds"][-1]["tier"]) for f in data["feature_names"]},
                     "validation":validation_metrics(validation,top_tier=data["contract"]["thresholds"][-1]["tier"],mature_only=mature,target_outcome=data["contract"]["outcome"]["thresholds"][-1]["tier"])}
    return result


if __name__ == "__main__":
    # Private JSON only. In holdout mode assign account splits BEFORE discovery.
    data=json.load(open(sys.argv[1]))
    print(json.dumps(calibration_report(data),indent=2,allow_nan=False))
