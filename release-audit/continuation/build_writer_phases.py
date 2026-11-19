"""Rebind only necessary Writer window carriers to Catalog166 and PREPARE05."""
import ast
from functools import cache
import json
from pathlib import Path
import re
import runpy
import sys

HERE=Path(__file__).resolve().parent
OBS=HERE.parent/'after-hall165-06-durable-readonly-local-01'
CAT=OBS/'CATALOG166-MAINTENANCE-LOCAL-01'
NEW=CAT/'CATALOG166-MAINTENANCE02-LOCAL-01'
sys.path[:0]=[str(CAT),str(NEW)]
from render_successor import OUT, PROJECT, assign, checked, digest, dump, need, statement, swap, value
sys.path.append(str(HERE.parent/'next-five-phase-from-root221-local-01'))
from read_slots_root221 import CLOSE, ROOT221

BASE=PROJECT/'outputs/D1/20261119-r3-hall165-root203-v3-five-phase-local-01/rendered-unissued/static-pair'
V3=PROJECT/'outputs/D1/20261119-r3-hall165-six-history-v3-wire-local-01'
PHASES=HERE/'static-pair'
SLOTS='02e7cc8ba9760364747a6554ab32750905c0c9720b186e5d528f2ded7525a885'
CATALOG_CLOSE='0eb19b37a74c27eaac903e9072a0bfa836968e87fd778e8f9914708002df4002'
SOURCE_CLOSE='234868230abea4bfbb415fabbfcae6d84b838acff04f9f91f0075698f542321b'
PROGRAM='FRESH35_FINAL_R3_EXECUTION_DESCRIPTION_V1'
ORDER=('apply','start','writer','stop','restore')
PINS=re.compile(r'(?<![a-f0-9])[a-f0-9]{64}(?![a-f0-9])')
SOURCE_HELPER=CAT/'maintenance166-wip/five-phases/upgrade/bundle/source211_material.py'
BASE_BINDINGS=CAT/'ROOT211-SOURCE-ONLY-LOCAL-02/BINDINGS.UNISSUED.json'


def inputs():
    slot=json.loads(checked(HERE.parent/'next-five-phase-from-root221-local-01'/'ACTUAL-ROOT221-SERVICE-52-53-LOCKED-READBACK.json',SLOTS))
    close=json.loads(checked(OUT/'ACTUAL-EXECUTION/RESULT.json',CATALOG_CLOSE))
    material=json.loads(checked(BASE_BINDINGS.parent/'ACTUAL-EXECUTION/RESULT.json',SOURCE_CLOSE))
    basis=json.loads(checked(BASE_BINDINGS,'45066e1f87ca52e5c875d51657961afb93ab9188f926bb830ac8f78e967ba18e'))
    loader=json.loads(checked(V3/'LOADER-READBACK.json','ef383ee1946083f010f47d238a4c77c534ebdde16cded8931fbf3f3536ade32f'))
    wire=checked(V3/'V3-WIRE-LEAF.mjs','34b240eb980aaaa8381ffb97010dcf1e5a59387975dc13b2562884ef7620f44b')
    source=runpy.run_path(str(SOURCE_HELPER),run_name='exact_root211_marker_scope')['SOURCE']
    plan=slot['planMetadata']
    b=plan['descriptors']['157']
    edge=dict(ordinal=b['ordinal'],firstStepOrdinal=b['first'],lastStepOrdinal=b['last'],
              descriptorSha256=b['descriptorSha256'],state='ABSENT')
    need(slot['dispatcherSha256']==close['actualRoot221']==ROOT221 and slot['preferredAvailable']=='52'
         and slot['candidates']['53']['classification']=='ABSENT_IN_ALL_CHECKED_SURFACES'
         and slot['originalRolesRestored'] and slot['originalPlanStat9Matched'] and plan['originalMetadataUnchanged']
         and slot['pgdataStopped'] and slot['originalHoldPreserved'] and close['writerSubmitted'] is False
         and (slot['committedGroups'],slot['committedSteps'],slot['auditRows'])==(157,1178,1178)
         and slot['committedCatalog']==close['catalog']['after'],'EXACT_ACTUAL_ROOT221_PREDECESSORS_REQUIRED')
    need(material['status']=='COMPLETED' and material['requestKey']==source['requestKey']
         and material['sourceFilesVerified']==416 and material['ordinaryUserReadableFiles']==415
         and material['markerSha256']==slot['materializationMarkerSha256']==source['markerSha256']
         and all(source[key]==material[key] for key in ('terminalSha256','publicResultSha256','physicalSourceSetSha256'))
         and basis['sourceProfile']['sourceRowsSha256']==source['sourceRowsSha256']
         and all(source['runtimeCatalog'][key]==pin for key,pin in slot['committedCatalog'].items()),
         'EXACT_416_V3_RUNTIME_AND_CATALOG_REQUIRED')
    rows=json.loads(checked(BASE_BINDINGS.parent/'bundle/source-rows.json',source['sourceRowsSha256']))
    pinned=next(row for row in rows if row['path']=='tools/unified-import/whole-host-session.mjs')
    need(pinned['sha256']==digest(wire) and len(rows)==416 and loader['resumeAcceptedThroughProtectedRootBoundary']
         and loader['callbacks']==loader['serverActions']==0,'REAL_V3_RESUME_TIMING_COMPATIBILITY_REQUIRED')
    need((b['ordinal'],b['first'],b['last'])==(157,1178,1278)
         and edge['descriptorSha256']==close['durablePrefix']['nextGroupDescriptorSha256'],
         'FIRST_REQUIRED_ORIGINAL_PREPARE05_DESCRIPTOR_REQUIRED')
    return slot,close,source,basis['sourceProfile'],edge,loader


def rename_input(pair, slot):
    jobs={phase:(slot['candidates']['53']['requestKey'] if phase=='start' else key[:-2]+'08')
          for phase,key in pair['jobs'].items()}
    oldcontainer=pair['fixedScopes']['start']['containerName']
    replacements=dict(zip((pair['jobs'][phase] for phase in ORDER),(jobs[phase] for phase in ORDER)))
    replacements.update({
        pair['proofLeaf']:pair['proofLeaf'].replace('-51.json','-53.json'),
        oldcontainer:slot['candidates']['53']['containerName'],
        pair['authCapture']:pair['authCapture'][:-2]+'08',
        pair['authCustody']:pair['authCustody'][:-2]+'08',
        pair['registrationLeaf']:pair['registrationLeaf'][:-2]+'08',
        'r3-service-51-worker-proof':'r3-service-53-worker-proof',
        'direct-hall165-resume-20261119-06.json':'direct-hall165-resume-20261119-08.json',
        'r3-hall165-prepare05-resume-static-cache-20261119-06':'r3-hall165-prepare05-resume-static-cache-20261119-08',
        'r3-hall165-prepare05-resume-cas-20261119-06':'r3-hall165-prepare05-resume-cas-20261119-08',
    })
    def rename(s):
        for a,b in replacements.items():
            s=s.replace(a,b)
        return s
    return jobs,rename


def walk(data, rename):
    if isinstance(data,dict):
        return {rename(k):walk(v,rename) for k,v in data.items()}
    if isinstance(data,list):
        return [walk(item,rename) for item in data]
    return rename(data) if isinstance(data,str) else data


def replace_function(source,name,line):
    return swap(source,statement(source,name,ast.FunctionDef),line.strip())


def bind_workers(pair, slot, close, source, profile, edge, rename):
    old={f'{phase}/bundle/{leaf}':checked(BASE/phase/'bundle'/leaf,pin)
         for phase,rule in pair['rules'].items() for leaf,pin in rule['bundlePins'].items()}
    need(len(old)==69,'PRESERVED_69_PHASE_LEAVES_REQUIRED')
    observer='observers/read_writer_progress.py'
    old[observer]=(BASE/observer).read_bytes()
    new={path:rename(raw.decode()) if path.endswith(('.py','.mjs')) else raw.decode() for path,raw in old.items()}
    old_host=value(new['writer/bundle/final33_host.py'],'V3_RUNTIME_CATALOG')
    original_material=value(new['writer/bundle/source02_material.py'],'V3_MARKER')
    old_leaf=Path(original_material['sourceRoot']).parent.name
    old_material=value(new['writer/bundle/source02_material.py'],'V3_RECEIPTS')
    present=slot['committedCatalog']
    actual=close['phases']['upgrade']
    upgrade_pair=actual['results']['batched161-command-update-result.json']
    upstream=json.loads(checked(OUT/'ACTUAL-EXECUTION/upgrade/READ-ORIGINAL-1186046194401232198.json',
                               close['evidence']['upgrade']['sha256']))['results']['batched161-command-update-result.json']['value']
    authority=dict(key=actual['jobId'],terminalSha256=actual['terminalSha256'],
                   rootResultSha256=upgrade_pair['rootSha256'],publicResultSha256=upgrade_pair['publicSha256'],
                   completionSha256=close['catalog']['completionSha256'],service=upstream['service'])
    live_receipts=dict(terminalSha256=source['terminalSha256'],rootResultSha256=source['markerSha256'],
                       publicResultSha256=source['publicResultSha256'])
    locked_helper=SOURCE_HELPER.read_text()
    verifier=statement(locked_helper,'verify',ast.FunctionDef).replace('def verify(','def verify_v3(')
    for phase in ('start','writer'):
        stem=phase+'/bundle/'
        name=stem+'source02_material.py'
        text=new[name]
        text=swap(text,statement(text,'V3_MARKER'),statement(locked_helper,'SOURCE'))
        text=assign(text,'V3_RECEIPTS',live_receipts)
        text=replace_function(text,'verify_v3',verifier)
        new[name]=text
        name=stem+'final33-run.mjs'
        text=new[name].replace(old_leaf,source['leaf'])
        first=next(line for line in text.splitlines() if line.startswith('export const FIRST_INCOMPLETE='))
        text=swap(text,first,'export const FIRST_INCOMPLETE=Object.freeze('+json.dumps(edge,separators=(',',':'))+');')
        expected=next(line for line in text.splitlines() if line.startswith(' const expectedMaterial='))
        marker={key:original_material[key] for key in ('databaseWrites','nodeModulesChanged','ordinaryActorReadability','state')}
        marker['ordinaryActorReadability']=dict(marker['ordinaryActorReadability'],openedCodeFilesWithoutBodyRead=415)
        marker.update(operatorRuntimeSourceSetSha256=source['operatorRuntimeSourceSetSha256'],
                      requestKey=source['requestKey'],sourceDescriptionSha256=source['sourceProfileSha256'],sourceFiles=416,
                      sourceRoot=profile['outputDirectory']+'/operation',sourceRowsSha256=source['sourceRowsSha256'],
                      sourceSetSha256=source['physicalSourceSetSha256'])
        text=swap(text,expected,' const expectedMaterial='+json.dumps(marker,separators=(',',':'))+';')
        need('applyTiming:inputs.applyTiming' in text and 'guardedResumeKernel' in text,'V3_AND_ORIGINAL_RESUME_GUARD_REQUIRED')
        new[name]=text

    for leaf in ('final-execution-describe.mjs','start_owned_describe.py'):
        path='start/bundle/'+leaf
        text=new[path].replace(old_leaf,source['leaf'])
        for key in present:
            text=text.replace(old_host[key],present[key])
        text=text.replace(original_material['sourceSetSha256'],source['physicalSourceSetSha256'])
        text=text.replace(old_material['rootResultSha256'],source['markerSha256'])
        new[path]=text
    path='writer/bundle/final33_host.py'
    text=new[path]
    for name,item in (('OPERATOR',source['leaf']),('SOURCE_ROWS_SHA256',source['sourceRowsSha256']),
                      ('SOURCE_SET_SHA256',source['physicalSourceSetSha256']),('V3_RUNTIME_CATALOG',present)):
        text=assign(text,name,item)
    before=statement(text,'scope',ast.FunctionDef)
    after,n=re.subn(r'firstIncomplete=\{[^}]+\}', 'firstIncomplete='+repr(edge),before)
    need(n==1,'EXACT_FIRST_REQUIRED_SCOPE_ANCHOR')
    text=swap(text,before,after)
    begin=statement(text,'applied_catalog_successor',ast.FunctionDef)
    next_fn=begin.replace('HALL165_UPGRADE','CATALOG166_UPGRADE').replace('HALL165_CATALOG','V3_RUNTIME_CATALOG')
    next_fn=next_fn.replace('HALL165_CATALOG_APPLIED_AND_READ_BACK','CATALOG166_APPLIED_AND_READ_BACK')
    next_fn=next_fn.replace("'V3_RUNTIME_CATALOG_APPLIED_AND_READ_BACK'","'CATALOG166_APPLIED_AND_READ_BACK'")
    next_fn=next_fn.replace("  and result['connectionCleanup']=='CLOSED'", "  and result['originalDurablePrefixVerifiedBeforeAfterAndReadback'] is True\n  and result['connectionCleanup']=='CLOSED'")
    text=swap(text,begin,next_fn)
    text=swap(text,statement(text,'V3_RUNTIME_CATALOG'),statement(text,'V3_RUNTIME_CATALOG')+'\nCATALOG166_UPGRADE = '+repr(authority))
    raw_run=statement(text,'run',ast.FunctionDef)
    old_check="\n".join(raw_run.splitlines()[5:10])
    wanted_old = ''' pg=controller(a,apply)
 need(v['state']=='SOURCE_PHYSICALLY_MATERIALIZED_SQL_UPGRADE_NOT_PERFORMED'
  and v['sourceRoot']==str(HOST_STATE/OPERATOR/'operation')
  and v['sourceRowsSha256']==SOURCE_ROWS_SHA256 and v['sourceSetSha256']==SOURCE_SET_SHA256 and v['sourceFiles']==408,
  'FINAL33_EXACT_SOURCE_MATERIALIZATION_REQUIRED')'''
    need(old_check==wanted_old,'HISTORICAL_ACTIVE_MARKER_GUARD_ANCHOR_REQUIRED')
    contract=dict(state='SOURCE_PHYSICALLY_MATERIALIZED_SQL_UPGRADE_NOT_PERFORMED',
                  requestKey=source['requestKey'],sourceFiles=profile['sourceFiles'],
                  sourceRoot=profile['outputDirectory']+'/operation',sourceRowsSha256=source['sourceRowsSha256'],
                  sourceSetSha256=source['physicalSourceSetSha256'],sourceDescriptionSha256=source['sourceProfileSha256'],
                  operatorRuntimeSourceSetSha256=source['operatorRuntimeSourceSetSha256'])
    active_guard = '''
def verify_active_input(mark):
 expected=ACTIVE_SOURCE_MARKER_FIELDS
 need(type(mark) is dict and all(mark.get(key)==pin for key,pin in expected.items())
  and mark.get('runtimeCatalog')==ACTIVE_SOURCE_CATALOG
  and mark.get('ordinaryActorReadability',{}).get('openedCodeFilesWithoutBodyRead')==415,
  'FINAL33_EXACT_LIVE_416_MATERIALIZATION_REQUIRED')
'''
    text=swap(text,raw_run,'ACTIVE_SOURCE_MARKER_FIELDS = '+repr(contract)+'\nACTIVE_SOURCE_CATALOG = '+
              repr(source['runtimeCatalog'])+'\n'+active_guard+'\n'+
              swap(raw_run,wanted_old,' verify_active_input(v)\n pg=controller(a,apply)'))
    new[path]=text
    stop='stop/bundle/normal05_preserve_stop.py'
    terminal_keys=value(new[stop],'CURRENT_BATCH_OPERATIONS')
    new[stop]=assign(new[stop],'CURRENT_BATCH_OPERATIONS',tuple(dict.fromkeys(
        (*terminal_keys[:-1],pair['jobs']['writer'],actual['jobId'],terminal_keys[-1]))))
    prior_body={}
    for path,raw in old.items():
        prior_body.setdefault(digest(raw),[]).append(path)
    visiting=set()

    @cache
    def pinned(path):
        need(path not in visiting,'CIRCULAR_SOURCE_PINS '+path)
        visiting.add(path)
        def pin(match):
            key=match.group()
            if key not in prior_body:
                return key
            candidates={digest(pinned(name)) for name in prior_body[key]}
            need(len(candidates)==1,'DIVERGENT_SHARED_LEAF '+path)
            return candidates.pop()
        try:
            return PINS.sub(pin,new[path]).encode() if path.endswith(('.py','.mjs')) else old[path]
        finally:
            visiting.remove(path)

    results={path:pinned(path) for path in old}
    out=walk(pair,rename)
    out['fixedScopes']['writer'].update(firstIncomplete=edge,sourceRowsSha256=source['sourceRowsSha256'],
                                       operatorSourceSetSha256=source['physicalSourceSetSha256'])
    for phase,rule in out['rules'].items():
        rule['bundlePins']={leaf:digest(results[f'{phase}/bundle/{leaf}']) for leaf in rule['bundlePins']}
    return results,out,old,live_receipts


def main():
    slot,close,source,profile,edge,loader=inputs()
    frozen=(BASE/'PHASE-PAIR.UNISSUED.json').read_bytes()
    pair=json.loads(frozen)
    jobs,rename=rename_input(pair,slot)
    bodies,updated,old,material=bind_workers(pair,slot,close,source,profile,edge,rename)
    need(updated['jobs']==jobs and set(jobs.values()).isdisjoint(pair['jobs'].values()),'NEW_FIXED_FIVE_PHASE_KEYS_REQUIRED')
    PHASES.mkdir()
    for name,raw in bodies.items():
        if name.endswith('.py'):
            compile(raw,name,'exec')
        dst=PHASES/name
        dst.parent.mkdir(parents=True,exist_ok=True)
        dst.write_bytes(raw)
    (PHASES/'PHASE-PAIR.UNISSUED.json').write_text(json.dumps(updated,ensure_ascii=False,indent=2)+'\n')
    dump(HERE/'LOCAL-WRITER-BASIS.json',dict(state='LOCAL_ACTIVE_CATALOG166_V3_WRITER_WORKER_DELTA_UNISSUED',
        currentRoot=ROOT221,actualRootCloseoutSha256=CLOSE,root221SlotsObservationSha256=SLOTS,jobs=jobs,
        materialization=material,source=source,nextDescriptor=edge,requiredOriginalTransactionState='ABSENT',
        actualCatalog=slot['committedCatalog'],sourcePairBeforeSha256=digest(frozen),
        sourcePairSha256=digest((PHASES/'PHASE-PAIR.UNISSUED.json').read_bytes()),v3LoaderAlreadyVerified=loader,
        leaves={name:dict(before=digest(old[name]),after=digest(raw)) for name,raw in bodies.items() if raw!=old[name]},
        staticMembers=69,serverActions=0,PGConnections=0,issued=False,registered=False))
    print(HERE/'LOCAL-WRITER-BASIS.json')


if __name__=='__main__':
    main()
