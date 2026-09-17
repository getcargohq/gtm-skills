import copy
import json
import os
import sys
import unittest
from pathlib import Path

INFRA = Path(os.environ.get('ACCOUNT_SCORING_INFRA', Path(__file__).resolve().parents[1]/'infra'))
sys.path.insert(0, str(INFRA/'runtime'))
from scorer import score, validate_contract, label_outcome, contribution, normalize, tier_for
from calibration import grouped_split, lift_table, validation_metrics, calibration_report
FIXTURES=Path(__file__).parent/'fixtures'


def contracts(seller='developer-tools'):
    return [json.loads((FIXTURES/f'{seller}-{kind}.json').read_text()) for kind in ['features','scoring']]


def snapshot(features,values=None):
    defaults=dict(employee_count=100,engineering_count=35,deployment_architecture='cloud',store_count=20,inventory_system='centralized')
    defaults.update(values or {})
    return dict(account_id='synthetic-account',snapshot_at='2026-01-01T00:00:00Z',feature_contract_version=features['version'],features={f['name']:dict(value=defaults[f['name']],as_of='2026-01-01T00:00:00Z' if defaults[f['name']] is not None else None,source_or_evidence_reference='synthetic:evidence' if defaults[f['name']] is not None else None,snapshot_quality='exact' if defaults[f['name']] is not None else 'missing',extraction_version=f['extraction_version']) for f in features['features']})


class ScoringTests(unittest.TestCase):
    def setUp(self):
        self.f,self.c=contracts()

    def compute(self,s=None,c=None,f=None):
        f=f or self.f;c=c or self.c
        return score(s or snapshot(f),c['version'],f,c,allow_synthetic=True)

    def test_two_sellers_same_engine_different_features_and_outcomes(self):
        other_f,other_c=contracts('store-operations')
        self.assertEqual(self.compute()['score'],100)
        self.assertEqual(self.compute(f=other_f,c=other_c)['score'],85)
        self.assertNotEqual({f['name'] for f in self.f['features']},{f['name'] for f in other_f['features']})
        self.assertNotEqual(self.c['outcome'],other_c['outcome'])
        for fc,sc in [(self.f,self.c),(other_f,other_c)]:
            validate_contract(fc,sc)

    def test_every_numeric_boundary_and_unknown(self):
        for seller in ['developer-tools','store-operations']:
            f,c=contracts(seller)
            for r in c['rules']+c['outcome']['dimensions']:
                self.assertEqual(contribution(r,None),r['missing_points'])
                if r['kind']=='category':
                    for value,points in r['points'].items():self.assertEqual(contribution(r,value),points)
                    with self.assertRaises(ValueError):contribution(r,'not_a_category')
                    continue
                for i,band in enumerate(r['bands']):
                    if band['min'] is not None:
                        self.assertEqual(contribution(r,band['min']),band['points'])
                        self.assertEqual(contribution(r,band['min']-0.0001),r['bands'][i-1]['points'])
                    if band['max'] is not None:self.assertEqual(contribution(r,band['max']-0.0001),band['points'])
            for t in c['thresholds']:
                self.assertEqual(tier_for(t['min'],c['thresholds']),t['tier'])
            for a,b in zip(c['thresholds'],c['thresholds'][1:]):self.assertEqual(tier_for(b['min']-1,c['thresholds']),a['tier'])

    def test_gates_interactions_and_totals(self):
        r=self.compute(snapshot(self.f,{'deployment_architecture':'on_prem'}))
        self.assertEqual((r['score'],r['tier']),(20,'C'))
        self.assertEqual(r['applied_gates'],['on-prem-policy'])
        self.assertNotIn('engineering-cloud',[x['rule'] for x in r['rule_contributions']])
        for count,expected in [(29,80),(30,100)]:
            self.assertEqual(self.compute(snapshot(self.f,{'engineering_count':count}))['score'],expected)
        c=copy.deepcopy(self.c);c['base_points']=0.5;c['interactions']=[]
        self.assertEqual(self.compute(snapshot(self.f,{'engineering_count':29}),c)['score'],81)
        c['base_points']=200
        self.assertEqual(self.compute(c=c)['score'],100)
        c['base_points']=-200
        self.assertEqual(self.compute(c=c)['score'],0)

    def test_critical_missing_is_not_low_fit(self):
        r=self.compute(snapshot(self.f,{'employee_count':None}))
        self.assertEqual((r['scoring_status'],r['score'],r['tier']),('insufficient_data',None,None))
        r=self.compute(snapshot(self.f,{'engineering_count':None}))
        self.assertEqual((r['scoring_status'],r['score']),('scored',65))

    def test_malformed_and_leaking_inputs_fail_closed(self):
        for value in [True,-1,'100',float('inf')]:
            s=snapshot(self.f,{'employee_count':value})
            if value==float('inf'):
                with self.assertRaises(ValueError):self.compute(s)
            else:self.assertEqual(self.compute(s)['scoring_status'],'error')
        s=snapshot(self.f);s['outcome_tier']='Tier 1'
        self.assertEqual(self.compute(s)['scoring_status'],'error')
        s=snapshot(self.f,{'deployment_architecture':'unknown'})
        self.assertEqual(self.compute(s)['scoring_status'],'error')
        s=snapshot(self.f);s['features']['employee_count']['as_of']='2027-01-01T00:00:00Z'
        self.assertEqual(self.compute(s)['scoring_status'],'error')

    def test_stale_proxy_and_version_drift(self):
        for field,value in [('snapshot_quality','current_proxy'),('as_of','2020-01-01T00:00:00Z')]:
            s=snapshot(self.f);s['features']['deployment_architecture'][field]=value
            self.assertEqual(self.compute(s)['scoring_status'],'insufficient_data')
        s=snapshot(self.f);s['feature_contract_version']='wrong'
        self.assertEqual(self.compute(s)['scoring_status'],'error')
        self.assertEqual(score(snapshot(self.f),'wrong',self.f,self.c,True)['scoring_status'],'error')

    def test_drafts_synthetic_and_invalid_contracts_cannot_go_live(self):
        self.assertEqual(score(snapshot(self.f),self.c['version'],self.f,self.c)['scoring_status'],'error')
        c=copy.deepcopy(self.c);c['approval']['state']='draft'
        self.assertEqual(self.compute(c=c)['scoring_status'],'error')
        c=copy.deepcopy(self.c);c['rules'][0]['bands'][1]['min']=51
        self.assertEqual(self.compute(c=c)['scoring_status'],'error')
        f=copy.deepcopy(self.f);f['features'][0]['role']='readiness'
        self.assertEqual(self.compute(f=f)['scoring_status'],'error')

    def test_repeated_inputs_identical(self):
        s=snapshot(self.f)
        self.assertEqual(self.compute(s),self.compute(copy.deepcopy(s)))

    def test_baseline_and_custom_normalization_same_contract(self):
        row={'id':'synthetic-account','numberofemployees':'100','hs_lastmodifieddate':'2026-01-01T00:00:00Z','custom__fit_evidence':json.dumps(snapshot(self.f))}
        s=normalize(row,self.f,'2026-01-01T00:00:00Z')
        self.assertEqual(s['features']['employee_count']['value'],100)
        self.assertEqual(self.compute(s)['score'],100)
        row['id']='another'
        with self.assertRaises(ValueError):normalize(row,self.f,'2026-01-01T00:00:00Z')

    def test_outcomes_lost_immature_failed_unavailable(self):
        for seller in ['developer-tools','store-operations']:
            f,c=contracts(seller)
            dims=c['outcome']['dimensions']
            observations={d['name']:{'state':'observed','value':50000} for d in dims}
            episode=dict(stage='closed_won',kind='acquisition',age_days=200,observations=observations)
            r=label_outcome(episode,c);self.assertTrue(r['outcome_mature']);self.assertEqual(r['outcome_tier'],'Tier 1')
            lost=dict(episode,stage='closed_lost')
            self.assertIsNone(label_outcome(lost,c)['outcome_tier'])
            immature=copy.deepcopy(episode);immature['age_days']=2
            immature['observations'][dims[1]['name']]={'state':'unobserved','value':None}
            r=label_outcome(immature,c);self.assertEqual(r['outcome_tier'],'Tier 1');self.assertFalse(r['outcome_mature'])
            self.assertIsNone(r['observations'][dims[1]['name']]['value'])
            missing=copy.deepcopy(episode);missing['observations'][dims[0]['name']]={'state':'unavailable','value':None}
            self.assertIsNone(label_outcome(missing,c)['outcome_tier'])
            failed=copy.deepcopy(episode)
            for v in failed['observations'].values():v['value']=0
            self.assertEqual(label_outcome(failed,c)['outcome_tier'],'Tier 3')

    def test_holdout_uses_frozen_scorer_and_development_bands(self):
        observations={d['name']:{'state':'observed','value':50000} for d in self.c['outcome']['dimensions']}
        rows=[]
        for i in range(2):
            snap=snapshot(self.f, {'employee_count':100 if i==0 else 600, 'deployment_architecture':'cloud' if i==0 else 'on_prem'})
            snap['account_id']=str(i)
            rows.append(dict(account_id=str(i),episode_id=str(i),kind='acquisition',stage='closed_won',age_days=200,observations=observations,split='development' if i==0 else 'holdout',snapshot=snap,fit_snapshot_at=snap['snapshot_at'],predicted_fit_tier='A'))
        data=dict(feature_contract=self.f,contract=self.c,episodes=rows,feature_names=['employee_count'],analysis_mode='holdout',discovery_scope='development')
        report=calibration_report(data,allow_synthetic=True)
        groups=report['all_labeled']['development_features']['employee_count']['groups']
        self.assertEqual([g['value'] for g in groups],[{'min':50,'max':500}])
        metrics=report['all_labeled']['validation']
        self.assertEqual(metrics['accounts'],1)
        self.assertEqual(metrics['top_tier_count'],0)  # supplied "A" cannot override Python's C
        self.assertEqual(report['predictions'][1]['fit_result']['tier'],'C')
        with self.assertRaises(ValueError):calibration_report(data)  # synthetic is test-only
        data['discovery_scope']='all'
        with self.assertRaises(ValueError):calibration_report(data,True)
        data['discovery_scope']='development';rows[1]['account_id']='0';rows[1]['snapshot']['account_id']='0'
        with self.assertRaises(ValueError):calibration_report(data,True)
        rows[1]['snapshot']['account_id']='wrong'
        with self.assertRaisesRegex(ValueError,'account mismatch'):calibration_report(data,True)

    def test_numeric_lift_uses_scoring_boundaries_and_null_group(self):
        rule=self.c['rules'][0]
        rows=[dict(account_id=str(i),kind='acquisition',stage='closed_won',outcome_tier='Tier 1' if i<2 else 'Tier 3',outcome_mature=True,features={'employee_count':dict(value=value,snapshot_quality='exact')}) for i,value in enumerate([49,50,499,500,None])]
        table=lift_table(rows,'employee_count',bands=rule['bands'])
        groups={json.dumps(g['value'],sort_keys=True):g for g in table['groups']}
        self.assertEqual(groups[json.dumps({'min':50,'max':500},sort_keys=True)]['accounts'],2)
        self.assertEqual(groups['null']['accounts'],1)
        for group in table['groups']:self.assertEqual(group['missingness'],1/5)
        bad=copy.deepcopy(rule['bands']);bad[1]['min']=51
        with self.assertRaises(ValueError):lift_table(rows,'employee_count',bands=bad)

    def test_crm_observation_ignores_record_modification_date(self):
        row={'hs_object_id':'synthetic-account','numberofemployees':'100','custom__fit_evidence':json.dumps(snapshot(self.f))}
        for modified in [None,'2000-01-01T00:00:00Z','2026-01-01T00:00:00Z',1767225600000]:
            row['hs_lastmodifieddate']=modified
            s=normalize(row,self.f,'2026-01-01T00:00:00Z')
            self.assertEqual(s['features']['employee_count']['as_of'],s['snapshot_at'])
            self.assertEqual(self.compute(s)['score'],100)
        row['id']='conflicting-id'
        with self.assertRaisesRegex(ValueError,'conflicting'):normalize(row,self.f,'2026-01-01T00:00:00Z')

    def test_cache_migrations_missing_evidence_and_epoch_timestamps(self):
        row={'id':'synthetic-account','numberofemployees':'100'}
        cached=snapshot(self.f)
        cached['feature_contract_version']='previous'
        row['custom__fit_evidence']=json.dumps(cached)
        r=self.compute(normalize(row,self.f,'2026-01-01T00:00:00Z'))
        self.assertEqual(r['scoring_status'],'insufficient_data')
        self.assertTrue(any('feature_contract_version' in n for n in r['data_quality_notes']))
        for key,value,reason in [('extraction_version','previous','extraction version'),('as_of','bad-date','discarded evidence'),('as_of','9'*40,'discarded evidence'),('value','unknown','unknown category')]:
            cached=snapshot(self.f);cached['features']['deployment_architecture'][key]=value
            row['custom__fit_evidence']=json.dumps(cached)
            r=self.compute(normalize(row,self.f,'2026-01-01T00:00:00Z'))
            self.assertEqual(r['scoring_status'],'insufficient_data')
            self.assertTrue(any(reason in n for n in r['data_quality_notes']))
        for timestamp in [1767225600000,'1767225600000']:
            cached=snapshot(self.f);cached['features']['deployment_architecture']['as_of']=timestamp
            row['custom__fit_evidence']=json.dumps(cached)
            self.assertEqual(self.compute(normalize(row,self.f,'2026-01-01T00:00:00Z'))['score'],100)
        row['custom__fit_evidence']='invalid JSON'
        self.assertEqual(self.compute(normalize(row,self.f,'2026-01-01T00:00:00Z'))['scoring_status'],'insufficient_data')

    def test_grouped_splits_and_lift_denominator(self):
        split=grouped_split([dict(account_id='a',episode_id='a1'),dict(account_id='a',episode_id='a2')])
        self.assertEqual(split['a1'],split['a2'])
        rows=[dict(account_id=str(i),kind='acquisition',stage='closed_won' if i<4 else 'closed_lost',outcome_tier='Tier 1' if i<2 else 'Tier 3',outcome_mature=i!=1,features={'test':dict(value='x' if i<2 else 'y',snapshot_quality='exact')},predicted_fit_tier='A' if i<3 else 'C') for i in range(7)]
        report=lift_table(rows,'test')
        self.assertEqual(report['accounts'],4)
        self.assertEqual(report['groups'][0]['lift'],2)
        self.assertEqual(report['baseline_rate'],0.5)
        self.assertEqual(lift_table(rows,'test',True)['accounts'],3)
        metrics=validation_metrics(rows)
        self.assertEqual(metrics['precision'],2/3);self.assertEqual(metrics['tier1_recall'],1)
        self.assertEqual(metrics['false_positives'],['2'])
        with self.assertRaises(ValueError):lift_table(rows+[rows[0]],'test')


if __name__=='__main__':unittest.main()
