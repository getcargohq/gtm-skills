"""One deterministic rule engine, embedded verbatim in Cargo's native Python action.

Python >=3.9, standard library only. No network, filesystem, eval or fitting.
The caller supplies a snapshot and a reference; contracts are deployment assets.
"""
import hashlib
import json
import math
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP


def require(condition, message):
    if not condition:
        raise ValueError(message)


def number(value):
    return type(value) in (int, float) and math.isfinite(value)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


def instant(value):
    # HubSpot may return epoch milliseconds as a number or decimal string.
    if number(value) or (isinstance(value, str) and value.isdecimal()):
        try:
            return datetime.fromtimestamp(float(value) / 1000, timezone.utc)
        except (OverflowError, OSError) as error:
            raise ValueError("invalid epoch milliseconds") from error
    require(isinstance(value, str), "timestamp must be ISO or epoch milliseconds")
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    require(parsed.tzinfo is not None, "timestamp needs timezone")
    return parsed


def validate_scale(rule):
    require(rule["kind"] in ("number", "category"), "unsupported rule kind")
    require(number(rule["missing_points"]), "explicit missing contribution required")
    if rule["kind"] == "number":
        bands = rule["bands"]
        require(len(bands) > 0 and bands[0]["min"] is None and bands[-1]["max"] is None,
                "numeric bands must cover both tails")
        for i, band in enumerate(bands):
            lo, hi = band["min"], band["max"]
            require(lo is None or number(lo), "invalid lower boundary")
            require(hi is None or number(hi), "invalid upper boundary")
            require((lo is not None or i == 0) and (hi is not None or i == len(bands)-1),
                    "only outer boundaries may be unbounded")
            require(lo is None or hi is None or lo < hi, "empty band")
            require(number(band["points"]), "invalid points")
            if i:
                require(bands[i-1]["max"] == lo, "gapped or overlapping bands")
    else:
        require(len(rule["points"]) > 0 and all(number(v) for v in rule["points"].values()),
                "invalid categories")


def contribution(rule, value):
    if value is None:
        return rule["missing_points"]
    if rule["kind"] == "category":
        require(isinstance(value, str) and value in rule["points"], "unknown category")
        return rule["points"][value]
    return numeric_band(rule["bands"], value)["points"]


def numeric_band(bands, value):
    """One min-inclusive/max-exclusive transformation for scoring and analysis."""
    require(number(value), "numeric value required (booleans are not numbers)")
    for band in bands:
        if (band["min"] is None or value >= band["min"]) and (band["max"] is None or value < band["max"]):
            return band
    raise ValueError("uncovered value")


def tier_for(value, thresholds):
    return next(t["tier"] for t in reversed(thresholds) if value >= t["min"])


def validate_thresholds(thresholds, minimum, maximum):
    require(len(thresholds) > 0 and thresholds[0]["min"] == minimum, "tier floor mismatch")
    require(len({t["tier"] for t in thresholds}) == len(thresholds), "duplicate tier")
    require(all(isinstance(t["tier"], str) and t["tier"] and number(t["min"]) and
                minimum <= t["min"] <= maximum for t in thresholds), "invalid tier")
    require(all(a["min"] < b["min"] for a, b in zip(thresholds, thresholds[1:])), "unordered tiers")


def validate_conditions(rule, fields):
    require(rule["conditions"], "empty condition set")
    for condition in rule["conditions"]:
        require(condition["feature"] in fields, "unknown condition feature")
        require(condition["operator"] in ("eq", "gte", "lt"), "unsupported operator")
        field = fields[condition["feature"]]
        if field["type"] == "category":
            require(condition["operator"] == "eq" and condition["value"] in field["values"],
                    "invalid categorical condition")
        else:
            require(number(condition["value"]), "invalid numerical condition")


def validate_contract(features, contract):
    require(contract["feature_contract_version"] == features["version"], "feature version mismatch")
    require(contract["seller_id"] == features["seller_id"], "seller mismatch")
    require(features["features"] and contract["rules"], "empty feature contract")
    lo, hi = contract["score_range"]
    require(type(lo) is int and type(hi) is int and lo < hi, "integer score range required")
    require(number(contract["base_points"]) and contract["rounding"] == "half_up_integer", "invalid rounding/base")
    validate_thresholds(contract["thresholds"], lo, hi)
    fields = {f["name"]: f for f in features["features"]}
    names = set(fields)
    require(len(names) == len(features["features"]), "duplicate feature")
    rules = {r["feature"]: r for r in contract["rules"]}
    require(len(rules) == len(contract["rules"]) and names == set(rules), "feature/rule mismatch")
    outcome_names = {d["name"] for d in contract["outcome"]["dimensions"]}
    require(not names.intersection(outcome_names), "outcome leakage")
    for f in features["features"]:
        require(f["role"] == "structural_fit", "only structural fit predictors allowed")
        require(type(f["critical"]) is bool and f["unknown"] == "null", "missing policy required")
        require(number(f["refresh_days"]) and f["refresh_days"] > 0, "invalid evidence TTL")
        rule = rules[f["name"]]
        validate_scale(rule)
        require(rule["kind"] == f["type"], "feature type mismatch")
        if f["type"] == "category":
            require(set(f["values"]) == set(rule["points"]), "category coverage mismatch")
        else:
            require(number(f["minimum"]), "numeric domain needs a minimum")
    ids = [r["id"] for r in contract["rules"] + contract["gates"] + contract["interactions"]]
    require(len(ids) == len(set(ids)), "duplicate rule id")
    for gate in contract["gates"]:
        validate_conditions(gate, fields)
        require("points" not in gate, "gate cannot contribute interaction points")
        require(type(gate["cap"]) is int and lo <= gate["cap"] <= hi,
                "integer gate cap required")
        require(gate["basis"] in ("policy", "empirical"), "gate basis required")
    for interaction in contract["interactions"]:
        validate_conditions(interaction, fields)
        require("cap" not in interaction and "basis" not in interaction,
                "interaction cannot define a gate cap or basis")
        require(number(interaction["points"]), "invalid interaction")
    for dimension in contract["outcome"]["dimensions"]:
        validate_scale(dimension)
        require(dimension["missing_policy"] in ("unavailable", "neutral"), "outcome missing policy")
        require(number(dimension["mature_after_days"]) and dimension["mature_after_days"] >= 0,
                "invalid maturity window")
    outcome = contract["outcome"]
    require(outcome["tier_method"] == "absolute", "this engine requires approved absolute thresholds; freeze percentile cutoffs before use")
    require(outcome["dimensions"] and len(outcome_names) == len(outcome["dimensions"]), "invalid outcome dimensions")
    validate_thresholds(outcome["thresholds"], outcome["range"][0], outcome["range"][1])


def matches(conditions, values):
    for condition in conditions:
        value = values[condition["feature"]]
        if value is None:
            return False
        bound = condition["value"]
        op = condition["operator"]
        if not ((op == "eq" and value == bound) or (op == "gte" and value >= bound) or (op == "lt" and value < bound)):
            return False
    return True


def validate_observation(item, f, at):
    require(set(item) == {"value", "as_of", "source_or_evidence_reference", "snapshot_quality", "extraction_version"}, "invalid provenance shape")
    require(item["source_or_evidence_reference"] is None or isinstance(item["source_or_evidence_reference"], str), "invalid evidence reference")
    value, quality = item["value"], item["snapshot_quality"]
    require(quality in ("exact", "reconstructed", "current_proxy", "missing"), "invalid snapshot quality")
    require(item["extraction_version"] == f["extraction_version"], "extraction version mismatch")
    if value is None:
        require(quality == "missing" and item["as_of"] is None, "missing provenance mismatch")
        return
    require(quality != "missing" and isinstance(item["source_or_evidence_reference"], str) and item["source_or_evidence_reference"], "evidence required")
    require(instant(item["as_of"]) <= at, "evidence after snapshot")
    if f["type"] == "number":
        require(number(value) and value >= f["minimum"], "invalid number")
    else:
        require(isinstance(value, str) and value in f["values"], "unknown category; normalize unknown to null")


def validate_snapshot(snapshot, features):
    require(set(snapshot) - {"data_quality_notes"} == {"account_id", "snapshot_at", "feature_contract_version", "features"}, "unexpected snapshot fields")
    require(isinstance(snapshot.get("data_quality_notes", []), list) and all(isinstance(n, str) for n in snapshot.get("data_quality_notes", [])), "invalid data quality notes")
    require(isinstance(snapshot["account_id"], str) and snapshot["account_id"], "account ID required")
    at = instant(snapshot["snapshot_at"])
    require(snapshot["feature_contract_version"] == features["version"], "snapshot feature version mismatch")
    require(set(snapshot["features"]) == {f["name"] for f in features["features"]}, "unexpected/missing feature keys")
    for f in features["features"]:
        validate_observation(snapshot["features"][f["name"]], f, at)


def score(snapshot, contract_ref, features, contract, allow_synthetic=False):
    """Contract is trusted build-time data; not an agent argument."""
    result = {"scoring_status": "error", "score": None, "tier": None,
              "scoring_version": contract.get("version"),
              "feature_contract_version": features.get("version"),
              "feature_snapshot_at": snapshot.get("snapshot_at"),
              "applied_gates": [], "rule_contributions": [], "missing_features": [],
              "data_quality_notes": [], "snapshot_hash": digest(snapshot)}
    try:
        validate_contract(features, contract)
        require(contract_ref == contract["version"], "unapproved contract reference")
        require(contract["approval"]["state"] == "approved" and features["approval"]["state"] == "approved", "contract is not approved")
        require(contract["approval"]["reference"] and features["approval"]["reference"], "approval evidence required")
        require(allow_synthetic or (not contract["synthetic"] and not features["synthetic"]), "synthetic contract cannot score live accounts")
        validate_snapshot(snapshot, features)
        result["data_quality_notes"].extend(snapshot.get("data_quality_notes", []))
        values, critical_missing = {}, []
        for f in features["features"]:
            item = snapshot["features"][f["name"]]
            age = (instant(snapshot["snapshot_at"]) - instant(item["as_of"])).total_seconds()/86400 if item["as_of"] else None
            unsupported = item["snapshot_quality"] == "current_proxy" or (f["live_extract"]["kind"] == "cached_evidence" and age is not None and age > f["refresh_days"])
            value = None if unsupported else item["value"]
            values[f["name"]] = value
            if value is None:
                result["missing_features"].append(f["name"])
                if f["critical"]:
                    critical_missing.append(f["name"])
            if unsupported or item["snapshot_quality"] != "exact":
                result["data_quality_notes"].append(f["name"] + ": " + ("stale_or_proxy" if unsupported else item["snapshot_quality"]))
        if critical_missing:
            result["scoring_status"] = "insufficient_data"
            return result
        total = Decimal(str(contract["base_points"]))
        for rule in contract["rules"]:
            points = contribution(rule, values[rule["feature"]])
            total += Decimal(str(points))
            result["rule_contributions"].append({"rule": rule["id"], "points": points})
        for rule in contract["interactions"]:
            if matches(rule["conditions"], values):
                total += Decimal(str(rule["points"]))
                result["rule_contributions"].append({"rule": rule["id"], "points": rule["points"]})
        # Gates cap the rounded, clamped index. No gate invents a missing value.
        lo, hi = contract["score_range"]
        total = min(Decimal(str(hi)), max(Decimal(str(lo)), total))
        for gate in contract["gates"]:
            if matches(gate["conditions"], values):
                total = min(total, Decimal(str(gate["cap"])))
                result["applied_gates"].append(gate["id"])
        result["score"] = int(total.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        result["tier"] = tier_for(result["score"], contract["thresholds"])
        result["scoring_status"] = "scored"
    except (ValueError, KeyError, TypeError, StopIteration) as error:
        result["data_quality_notes"].append(str(error))
    return result


def label_outcome(episode, contract):
    """Keep absent observations null; only approved policies assign contributions."""
    result = {"outcome_tier": None, "outcome_score": None, "outcome_mature": False,
              "outcome_status": "unavailable", "observations": episode["observations"], "contributions": []}
    if episode["stage"] != "closed_won" or episode["kind"] != "acquisition":
        return result
    require(contract["approval"]["state"] == "approved", "outcome approval required")
    require(number(episode["age_days"]) and episode["age_days"] >= 0, "impossible customer age")
    total, mature, missing = Decimal("0"), True, False
    for dimension in contract["outcome"]["dimensions"]:
        validate_scale(dimension)
        observation = episode["observations"][dimension["name"]]
        state, value = observation["state"], observation["value"]
        require(state in ("observed", "unobserved", "unavailable"), "invalid outcome observation")
        if state == "observed":
            require(value is not None, "observed outcome needs value")
            points = contribution(dimension, value)
        else:
            require(value is None, "missing observation must remain null")
            if state == "unobserved":
                require(episode["age_days"] < dimension["mature_after_days"], "mature observation cannot be unobserved")
                points, mature = dimension["immature_points"], False
            else:
                missing = missing or dimension["missing_policy"] == "unavailable"
                points, mature = dimension["missing_points"], False
        mature = mature and episode["age_days"] >= dimension["mature_after_days"]
        total += Decimal(str(points))
        result["contributions"].append({"dimension": dimension["name"], "points": points})
    result["outcome_mature"] = mature
    if not missing:
        low, high = contract["outcome"]["range"]
        total = min(Decimal(str(high)), max(Decimal(str(low)), total))
        result.update(outcome_score=float(total), outcome_tier=tier_for(float(total), contract["outcome"]["thresholds"]),
                      outcome_status="mature" if mature else "provisional")
    return result


def crm_id(row):
    ids = [str(row[key]) for key in ("id", "hs_object_id") if row.get(key) is not None and str(row[key])]
    require(ids and len(set(ids)) == 1, "CRM record ID missing or conflicting")
    return ids[0]


def normalize(row, features, now):
    """Observe the current CRM extract; cache refresh is a separate operation."""
    account_id = crm_id(row)
    at = instant(now)
    notes = []
    try:
        cached = json.loads(row.get("custom__fit_evidence") or "{}")
        require(isinstance(cached, dict), "cache must be an object")
    except (ValueError, TypeError) as error:
        cached = {}
        notes.append("cache discarded: " + str(error))
    # Identity corruption is different from a routine contract migration: fail closed.
    require(not cached or cached.get("account_id") == account_id, "evidence identity mismatch")
    if cached and cached.get("feature_contract_version") != features["version"]:
        notes.append("cache discarded: feature_contract_version mismatch; refresh required")
        cached = {}
    snapshot = {"account_id": account_id, "snapshot_at": now, "feature_contract_version": features["version"], "features": {}, "data_quality_notes": notes}
    for f in features["features"]:
        empty = {"value": None, "as_of": None, "source_or_evidence_reference": None, "snapshot_quality": "missing", "extraction_version": f["extraction_version"]}
        source = f["live_extract"]
        require(source["kind"] in ("crm", "cached_evidence"), "unimplemented extraction route")
        item = empty
        try:
            if source["kind"] == "crm":
                value = row.get(source["property"])
                if value is not None and value != "":
                    if f["type"] == "number":
                        require(type(value) is not bool, "boolean is not a count")
                        value = float(value)
                    # This dates our observation of the extract, not a property update.
                    item = {"value": value, "as_of": now, "source_or_evidence_reference": "hubspot:companies:" + account_id + ":" + source["property"], "snapshot_quality": "exact", "extraction_version": f["extraction_version"]}
            else:
                item = dict(cached.get("features", {}).get(f["name"], empty))
                if item.get("as_of") is not None:
                    item["as_of"] = instant(item["as_of"]).isoformat()
            validate_observation(item, f, at)
        except (ValueError, KeyError, TypeError, AttributeError, OverflowError, OSError) as error:
            item = empty
            notes.append(f["name"] + ": discarded evidence: " + str(error))
        snapshot["features"][f["name"]] = item
    validate_snapshot(snapshot, features)
    return snapshot
