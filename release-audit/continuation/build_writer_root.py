"""Rebase the original Writer admission and static transport on actual Root221."""
import ast
import base64
import json
from pathlib import Path
import runpy
import zlib

from build_writer_phases import (BASE, HERE, OUT as MAINT, PHASES, PROJECT, ROOT221, SOURCE_HELPER,
    assign, checked, digest, dump, inputs, need, rename_input, statement, swap, value)

OLD_ROOT=BASE.parent/'paired-unissued'
OLD='r3_hall165_prepare05_v3_next.py'
NAME='r3_hall165_prepare05_catalog166_resume08.py'
DISPATCHER='admin_exec.HALL165-PREPARE05-CATALOG166-RESUME08-UNREGISTERED.py'
STAGE='r3-hall165-prepare05-resume-registration-20261119-08'
CACHE='r3-hall165-prepare05-resume-static-cache-20261119-08'
OLD_TOKEN='HALL165_PREPARE05_V3_NEXT'
TOKEN='HALL165_PREPARE05_CATALOG166_RESUME08'
POLICY_SLOT=TOKEN+'_POLICY_SHA256 = None'
CLASS='Hall165Prepare05Catalog166Resume07'
LIVE=PROJECT/'outputs/主控/20261119-r3-catalog166-maintenance-live-window-02'
CURRENT_ROOT='ROOT221'
OUT=HERE/'original-channel-static-local'
OLD_CHANNEL=HERE.parent/'next-five-phase-from-root203-local-01/original-channel-static-local'


def row(raw):
    return dict(bytes=len(raw),sha256=digest(raw))


def make_module(pair,rename,close,source):
    old=(OLD_ROOT/OLD).read_text()
    text=rename(old)
    basis=value(old,'BASIS')
    basis.update(jobs=pair['jobs'],firstIncomplete=pair['fixedScopes']['writer']['firstIncomplete'],
                 currentV3Execution=close['catalog']['after'])
    for key,obj in (('BASIS',basis),('JOBS',pair['jobs']),('EXPECTED_RULES',pair['rules']),
                    ('FIXED_SCOPES',pair['fixedScopes'])):
        text=(swap(text,statement(text,key),key+' = '+repr(obj)) if key=='JOBS'
              else assign(text,key,obj))
    helper=SOURCE_HELPER.read_text()
    fn=statement(helper,'verify',ast.FunctionDef).replace('def verify(','def verify_v3(')
    text=swap(text,statement(text,'verify_v3',ast.FunctionDef),fn)
    text=swap(text,statement(text,'V3_MARKER'),statement(helper,'SOURCE'))
    text=assign(text,'V3_RECEIPTS',dict(terminalSha256=source['terminalSha256'],rootResultSha256=source['markerSha256'],
                                      publicResultSha256=source['publicResultSha256']))
    text=swap(text,"    check(value == V3_MARKER, 'EXACT_ACTIVE_V3_MATERIALIZATION_REQUIRED')",
              "    check(value['sourceSetSha256']==SOURCE['physicalSourceSetSha256'], 'EXACT_ACTIVE_V3_MATERIALIZATION_REQUIRED')")
    gate=(HERE/'verify_catalog166_closeout.py.in').read_text()
    text=swap(text,'class Hall165Prepare05V3Next:',
              'CATALOG166_CLOSEOUT = '+repr(close)+'\n\n'+gate+'\n\nclass '+CLASS+':')
    anchor="        if phase=='apply':\n            require_parent_durable"
    text=swap(text,anchor,"        if phase=='apply':\n"
              "            require_catalog166_closed(lambda path, owner: self.core.read(path, root=owner==0), parent_command)\n"
              "            require_parent_durable")
    return text.encode()


def make_dispatcher(parent, module, jobs):
    keys=value(parent,'R3_ORIGINAL02_ABSENT_KEYS')
    need(len(keys)==len(set(keys))==221 and set(jobs.values()).isdisjoint(keys),'EXACT_PARENT_221_AND_NEW_KEYS_REQUIRED')
    constant=TOKEN+'_KEYS = '+repr(tuple(jobs.values()))+'\n'+TOKEN+'_MODULE_SHA256 = '+repr(digest(module))+'\n'+POLICY_SLOT+'\n\n'
    fn=statement(parent,'hall165_prepare05_v3_next_continuation',ast.FunctionDef)
    fn=(fn.replace('hall165_prepare05_v3_next','hall165_prepare05_catalog166_resume08')
          .replace(OLD_TOKEN,TOKEN).replace('Hall165Prepare05V3Next',CLASS))
    line="                    if job['jobId']==R3_05_EXECUTE_KEY:"
    branch=(f"                    if job['jobId'] in {TOKEN}_KEYS:\n"
            "                        hold = hall165_prepare05_catalog166_resume08_continuation(continuity, hold, cfg)\n")
    text=assign(parent,'R3_ORIGINAL02_ABSENT_KEYS',keys+list(jobs.values()))
    edits=(('\ndef check(value, code):','\n'+constant+'def check(value, code):'),
           ('\ndef fixed_install_code_member','\n'+fn+'\n\ndef fixed_install_code_member'),
           (line,branch+line))
    for a,b in edits:text=swap(text,a,b)
    restored=text
    for a,b in reversed(edits):restored=swap(restored,b,a)
    restored=swap(restored,statement(restored,'R3_ORIGINAL02_ABSENT_KEYS'),statement(parent,'R3_ORIGINAL02_ABSENT_KEYS'))
    need(restored==parent and text.count(POLICY_SLOT)==1,'PREEXISTING_221_DISPATCHER_BYTES_CHANGED')
    return text.encode(),keys


def make_cas(parent,keys,pair,module,dispatcher,close,source,rename):
    old=(OLD_ROOT/'register_cas.py').read_text()
    text=rename(old)
    text=(text.replace(OLD,NAME).replace('hall165_prepare05_v3_next_continuation','hall165_prepare05_catalog166_resume08_continuation')
          .replace(OLD_TOKEN,TOKEN).replace('.hall165-prepare05-v3-next-dispatcher.pending','.hall165-prepare05-catalog166-resume08.pending')
          .replace('ROOT203','ROOT221').replace('len(registry)==203','len(registry)==len(set(registry))==221')
          .replace('old203AndThreeGuardsPreserved=True,previousRegistryCount=203,registryCount=208',
                   'old221AndThreeGuardsPreserved=True,previousRegistryCount=221,registryCount=226')
          .replace('EXACT_HALL165_PREPARE05_V3_NEXT_FIVE_PHASE_ROOT_REGISTERED_NO_PHASE_OR_SQL_EXECUTED',
                   'EXACT_HALL165_PREPARE05_CATALOG166_RESUME08_FIVE_PHASE_ROOT_REGISTERED_NO_PHASE_OR_SQL_EXECUTED'))
    prev=runpy.run_path(str(MAINT/'register_cas.py'),run_name='actual_predecessor_exact_preserve_set')
    registered=json.loads((MAINT/'ACTUAL-EXECUTION/registration/ACTUAL-CAS.json').read_bytes())
    need(registered['dispatcherSha256']==close['actualRoot221']==ROOT221,'ROOT221_REGISTRATION_PAIR_REQUIRED')
    preserve=value(old,'PRESERVE')
    preserve.update(prev['PRESERVE'])
    base=prev['B'];control=prev['P'];state=Path('/release-review/location-eb2580ead4')
    for path,pin in ((control/'admin_exec.py',ROOT221),(prev['NEW_MODULE'],registered['moduleSha256']),
        (prev['NEW_POLICY'],registered['policySha256']),
        (state/'native-services/catalog166-auth-20261119-02/restored.json',close['custody']['privateSafeRestoreReceiptSha256'])):
        preserve[str(path)]=pin
    for phase in close['phases'].values():
        job=base/'jobs'/phase['jobId']
        preserve[str(job/'r3-outer-terminal.json')]=phase['terminalSha256']
        preserve.update({str(job/'results'/leaf):fact['rootSha256']
                         for leaf,fact in phase['results'].items() if leaf.endswith('.json')})
    text=assign(text,'PRESERVE',preserve)
    def resolver(source):
        return swap(source,"    material = admission.active_materialization(core,need)",
                    "    closed.update(admission.require_catalog166_closed(lambda path, owner: read(path,owner=owner)[0], admission.parent_command))\n"
                    "    material = admission.active_materialization(core,need)")
    original=statement(text,'quiet',ast.FunctionDef)
    text=swap(text,original,resolver(original))
    for key,item in (('EXPECTED_REGISTRY',keys),('EXPECTED_RULES',pair['rules']),('JOBS',pair['jobs']),
                     ('OLD',ROOT221),('MODULE_SHA',digest(module)),('TEMPLATE_SHA',digest(dispatcher))):
        text=(swap(text,statement(text,key),key+' = '+repr(item)) if key=='JOBS'
              else assign(text,key,item))
    return text.encode()


def main():
    slot,close,source,_,edge,_=inputs()
    pair_raw=(PHASES/'PHASE-PAIR.UNISSUED.json').read_bytes()
    pair=json.loads(pair_raw)
    baseline=json.loads((BASE/'PHASE-PAIR.UNISSUED.json').read_bytes())
    new_jobs,rename=rename_input(baseline,slot)
    need(new_jobs==pair['jobs'],'EXACT_NEXT_FIXED_PHASE_PAIR_REQUIRED')
    parent=checked(LIVE/'admin_exec.ISSUED.py',ROOT221).decode()
    module=make_module(pair,rename,close,source)
    dispatcher,keys=make_dispatcher(parent,module,new_jobs)
    cas=make_cas(parent,keys,pair,module,dispatcher,close,source,rename)
    basis=assign((OLD_ROOT/'read_registration_basis.py').read_text(),'CAS_SHA256',digest(cas))
    basis=(basis.replace('READONLY_HALL165_PREPARE05_V3_NEXT_ROOT203_BASIS','READONLY_HALL165_PREPARE05_CATALOG166_RESUME08_ROOT221_BASIS')
           .replace('actualRegistryCount=203, candidateRegistryCount=208','actualRegistryCount=221, candidateRegistryCount=226'))
    observer=(PHASES/'observers/read_writer_progress.py').read_bytes()
    roots={DISPATCHER:dispatcher,NAME:module,'register_cas.py':cas,'read_registration_basis.py':basis.encode(),
           'read_writer_progress.py':observer}
    members={}
    parts=[]
    for phase,key in sorted(new_jobs.items()):
        members[key]={}
        for leaf,pin in sorted(pair['rules'][phase]['bundlePins'].items()):
            raw=checked(PHASES/phase/'bundle'/leaf,pin)
            members[key][leaf]=row(raw)
            parts.append(raw)
    plain=b''.join(parts)
    wire=zlib.compress(plain,9)
    static=dict(row(wire),plainBytes=len(plain),plainSha256=digest(plain),phaseKeys=new_jobs,jobs=members)
    stop_text=(PHASES/'stop/bundle/normal05_preserve_stop.py').read_text()
    worker_pin=digest((HERE/'LOCAL-WRITER-BASIS.json').read_bytes())
    ready='EXACT_HALL165_PREPARE05_CATALOG166_RESUME08_STATIC_READY_NO_REQUEST'
    fixed=dict(sources={name:digest(raw) for name,raw in roots.items()},static=static,
               cacheContract=dict(state=ready,d1SourcePinsSha256=worker_pin,phasePairSha256=digest(pair_raw),jobs=members),
               proofLeaf=pair['proofLeaf'],stopCurrentOperations=value(stop_text,'CURRENT_BATCH_OPERATIONS'))
    old_host=(OLD_CHANNEL/'STATIC-HOST.FIXED.py').read_text()
    host=rename(old_host)
    host=(host.replace(OLD,NAME).replace(OLD_TOKEN,TOKEN).replace('admin_exec.HALL165-PREPARE05-V3-NEXT-UNREGISTERED.py',DISPATCHER)
          .replace('EXACT_ROOT203_WITHOUT_RESUME06_REQUIRED','EXACT_ROOT221_WITHOUT_RESUME08_REQUIRED')
          .replace('EXACT_HALL165_PREPARE05_V3_RESUME06_STATIC_AND_ROOT08_HISTORY_READBACK',
                   'EXACT_HALL165_PREPARE05_CATALOG166_RESUME08_STATIC_AND_ROOT08_HISTORY_READBACK'))
    host=assign(host,'FIXED',fixed)
    roots['static_host.py']=host.encode()
    stage=assign(rename((OLD_CHANNEL/'STAGE-ROOT-SOURCE.py').read_text()),'PINS',
                 {leaf:digest(raw) for leaf,raw in roots.items()})
    need(all(0<len(raw)<=131072 for raw in roots.values()),'ORIGINAL_BOUNDED_CODE_TRANSPORT_REQUIRED')
    for name,raw in roots.items():compile(raw,name,'exec')
    compile(stage,'STAGE-ROOT-SOURCE.py','exec')
    static_host={'__name__':'inert_original_host','__file__':str(OUT/'static_host.py')}
    exec(compile(host,'static_host.py','exec'),static_host)
    readback=static_host['decode_packet'](wire,static)
    need({key:{leaf:row(raw) for leaf,raw in docs.items()} for key,docs in readback.items()}==members,
         'EXACT_STATIC_CARRIER_ROUNDTRIP_REQUIRED')
    cas_ns={'__name__':'inert_root221_cas'}
    exec(compile(cas,'register_cas.py','exec'),cas_ns)
    need(cas_ns['OLD']==ROOT221 and cas_ns['EXPECTED_REGISTRY']==keys
         and str(cas_ns['NEW_MODULE']) not in cas_ns['PRESERVE'] and str(cas_ns['NEW_POLICY']) not in cas_ns['PRESERVE']
         and str(MAINT) not in str(cas_ns['ENTRY']),'PRESERVE_ACTUAL_221_NOT_FUTURE_226_REQUIRED')
    need(static_host['STAGE']==cas_ns['ENTRY'].parent and static_host['CACHE'].name==CACHE,
         'EXACT_STATIC_PATHS_BOUND_TO_ORIGINAL_CHANNEL_REQUIRED')
    OUT.mkdir()
    for name,raw in roots.items():(OUT/name).write_bytes(raw)
    (OUT/'STATIC-HOST.FIXED.py').write_bytes(roots['static_host.py'])
    (OUT/'STAGE-ROOT-SOURCE.py').write_text(stage)
    (OUT/'CODE-STAGE-PACKET.json').write_bytes((json.dumps({n:base64.b64encode(raw).decode()
                                                         for n,raw in roots.items()},sort_keys=True)+'\n').encode())
    (OUT/'STATIC-FIVE-PHASES.zlib').write_bytes(wire)
    summary=dict(state='ROOT221_SERVICE53_CATALOG166_RESUME08_STATIC_PREPARATION_UNISSUED',actualParent=ROOT221,
         oldCount=221,newCount=226,jobs=new_jobs,currentCatalog=close['catalog']['after'],firstIncomplete=edge,
         originalSource=source,originalRoutingGuards={name:digest(statement(parent,name,ast.FunctionDef).encode())
          for name in ('gate_check','d0_admit','r3_continuity')},phasePairSha256=digest(pair_raw),localWorkerBasisSha256=worker_pin,
         rootFiles={name:row(raw) for name,raw in roots.items()},static=static,staticMembers=69,
         originalPreservedFiles=len(cas_ns['PRESERVE']),staged=False,registered=False,issued=False,PGConnections=0,serverActions=0)
    dump(OUT/'STATIC-CHANNEL-INDEX.json',summary)
    print(OUT/'STATIC-CHANNEL-INDEX.json')


if __name__=='__main__':
    main()
