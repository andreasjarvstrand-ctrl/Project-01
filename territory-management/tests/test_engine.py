import pytest

from tm import engine as E


def C(f, op, v):
    return E.Condition(f, op, v)


FF = [E.FieldForce("HEM", "Hematology", (C("specialty", "eq", "Hematology"),)),
      E.FieldForce("ALL", "Everyone")]
TERR = [E.Territory("NAT", "National", "HEM"),
        E.Territory("KAM", "Key accounts", "HEM", "NAT"),
        E.Territory("EAST", "East", "HEM", "NAT"),
        E.Territory("EAST-1", "Stockholm city", "HEM", "EAST"),
        E.Territory("WEST", "West", "HEM", "NAT"),
        E.Territory("A1", "All 1", "ALL"),
        E.Territory("A2", "All 2", "ALL")]
ACCTS = [
    {"id": "x", "specialty": "Hematology", "segment": "COE", "postal_code": "171 64", "potential": 10},
    {"id": "y", "specialty": "Hematology", "segment": "High", "postal_code": "113 45", "potential": 5},
    {"id": "z", "specialty": "Cardiology", "segment": "High", "postal_code": "113 45", "potential": 1},
    {"id": "w", "specialty": "Hematology", "segment": "Low", "postal_code": "41345", "potential": 2},
]


def run(**kw):
    data = E.AlignmentInput(FF, TERR, ACCTS, **kw)
    return {(a.account, a.territory): a for a in E.run_alignment(data)}


def test_conditions():
    acct = {"a": "Foo", "n": "12", "none": None}
    assert C("a", "eq", "foo").matches(acct)
    assert C("a", "in", ["bar", "FOO"]).matches(acct)
    assert C("a", "not_in", ["bar"]).matches(acct)
    assert C("a", "starts_with", "f").matches(acct)
    assert C("a", "contains", "oo").matches(acct)
    assert C("n", "gte", 12).matches(acct) and not C("n", "lte", 11).matches(acct)
    assert not C("none", "gte", 0).matches(acct)
    assert not C("missing", "starts_with", "x").matches(acct)
    with pytest.raises(ValueError):
        C("a", "like", "x")
    with pytest.raises(ValueError):
        C("a", "in", "x")


def test_geo_longest_prefix_and_eligibility():
    r = run(geo_rules=[E.GeoRule(1, "EAST", "1"), E.GeoRule(2, "EAST-1", "113"), E.GeoRule(3, "WEST", "4")])
    assert r[("x", "EAST")].source == "geo_rule"
    assert ("y", "EAST-1") in r and ("y", "EAST") not in r   # longer prefix wins
    assert ("w", "WEST") in r                                # spaces ignored
    assert not any(k[0] == "z" for k in r)                   # cardiology not eligible for HEM


def test_account_rule_beats_geo_and_priority():
    r = run(account_rules=[E.AccountRule(1, "KAM", (C("segment", "eq", "COE"),), 10),
                           E.AccountRule(2, "WEST", (C("segment", "eq", "COE"),), 20)],
            geo_rules=[E.GeoRule(1, "EAST", "1")])
    assert r[("x", "KAM")].source == "account_rule"
    assert ("x", "EAST") not in r and ("x", "WEST") not in r
    assert ("y", "EAST") in r


def test_equal_priority_shares_account():
    r = run(account_rules=[E.AccountRule(1, "KAM", (C("segment", "eq", "COE"),), 10),
                           E.AccountRule(2, "WEST", (C("segment", "eq", "COE"),), 10)])
    assert ("x", "KAM") in r and ("x", "WEST") in r


def test_shared_geo_across_territories():
    r = run(geo_rules=[E.GeoRule(1, "A1", "1"), E.GeoRule(2, "A2", "1")])
    assert ("z", "A1") in r and ("z", "A2") in r


def test_manual_include_and_exclude():
    r = run(geo_rules=[E.GeoRule(1, "EAST", "1")],
            manual=[E.ManualAssignment(1, "z", "WEST", "include"),  # bypasses eligibility
                    E.ManualAssignment(2, "y", "EAST", "exclude")])
    assert r[("z", "WEST")].source == "manual"
    assert ("y", "EAST") not in r
    assert ("x", "EAST") in r


def test_rules_for_unknown_territory_ignored():
    r = run(geo_rules=[E.GeoRule(1, "GONE", "1")], manual=[E.ManualAssignment(1, "x", "GONE", "include")])
    assert not any(k[1] == "GONE" for k in r)


def test_diff():
    a = [E.Assignment("x", "HEM", "EAST", "geo_rule"), E.Assignment("y", "HEM", "EAST", "geo_rule")]
    b = [E.Assignment("x", "HEM", "WEST", "geo_rule"), E.Assignment("y", "HEM", "EAST", "geo_rule"),
         E.Assignment("z", "HEM", "EAST", "geo_rule")]
    changes = E.diff_alignments(a, b)
    assert [(c.account, c.before, c.after) for c in changes] == [("x", ("EAST",), ("WEST",)), ("z", (), ("EAST",))]


def test_metrics_roll_up():
    assigns = [E.Assignment("x", "HEM", "KAM", "account_rule"), E.Assignment("y", "HEM", "EAST-1", "geo_rule"),
               E.Assignment("x", "HEM", "EAST", "manual")]
    m = E.territory_metrics(TERR, assigns, ACCTS)
    assert m["EAST-1"] == {"accounts": 1, "direct_accounts": 1, "workload": 5.0}
    assert m["EAST"]["accounts"] == 2 and m["EAST"]["direct_accounts"] == 1
    assert m["NAT"] == {"accounts": 2, "direct_accounts": 0, "workload": 15.0}  # x counted once
