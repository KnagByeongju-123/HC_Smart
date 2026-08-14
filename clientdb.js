/* ============================================================
   HC_Smart 업체DB (clientdb.js)
   - 업체 기본정보 · 담당자 · 계정(Google/Github/Supabase) 관리
   - 저장소: Supabase 테이블 hk_clients (서버 전용, 로컬 폴백 없음)
   - index.html 전역 사용: sb(), sbReady(), toast()
   ============================================================ */

var CDB_SQL = 'create table if not exists hk_clients (\n' +
'  id bigint generated always as identity primary key,\n' +
'  company text not null,\n' +
'  addr text default \'\',\n' +
'  tel text default \'\',\n' +
'  email text default \'\',\n' +
'  mgr_name text default \'\',\n' +
'  dept text default \'\',\n' +
'  mgr_title text default \'\',\n' +
'  mgr_phone text default \'\',\n' +
'  mgr_email text default \'\',\n' +
'  google_id text default \'\',\n' +
'  google_pw text default \'\',\n' +
'  github_id text default \'\',\n' +
'  github_pw text default \'\',\n' +
'  sb_id text default \'\',\n' +
'  sb_pw text default \'\',\n' +
'  sb_org text default \'\',\n' +
'  sb_project text default \'\',\n' +
'  sb_url text default \'\',\n' +
'  sb_anon text default \'\',\n' +
'  memo text default \'\',\n' +
'  created_at timestamptz default now(),\n' +
'  updated_at timestamptz default now()\n' +
');\n' +
'alter table hk_clients enable row level security;\n' +
'create policy "hk_clients_all" on hk_clients for all using (true) with check (true);';

/* 필드 정의: [키, 라벨, 그룹, 비밀여부, placeholder] */
var CDB_FIELDS = [
  ['company',   '회사명 *',        'base', 0, '예) 신우산업'],
  ['addr',      '주소',            'base', 0, '예) 경남 창원시 ...'],
  ['tel',       '대표전화',        'base', 0, '예) 055-000-0000'],
  ['email',     '대표메일',        'base', 0, '예) info@company.co.kr'],
  ['mgr_name',  '담당자명',        'mgr',  0, '예) 홍길동'],
  ['dept',      '부서',            'mgr',  0, '예) 생산관리팀'],
  ['mgr_title', '직책',            'mgr',  0, '예) 부장'],
  ['mgr_phone', '연락처',          'mgr',  0, '예) 010-0000-0000'],
  ['mgr_email', '메일',            'mgr',  0, '예) hong@company.co.kr'],
  ['google_id', 'Google ID',       'acc',  0, ''],
  ['google_pw', 'Google 비밀번호', 'acc',  1, ''],
  ['github_id', 'Github ID',       'acc',  0, ''],
  ['github_pw', 'Github 비밀번호', 'acc',  1, ''],
  ['sb_id',     'Supabase ID',     'acc',  0, ''],
  ['sb_pw',     'Supabase 비밀번호','acc', 1, ''],
  ['sb_org',    'Supabase Org.',   'sbp',  0, ''],
  ['sb_project','Project',         'sbp',  0, ''],
  ['sb_url',    'Project URL',     'sbp',  0, 'https://xxxx.supabase.co'],
  ['sb_anon',   'Anon Key',        'sbp',  1, 'sb_publishable_... / eyJhb...'],
  ['memo',      '메모',            'etc',  0, '기타 계정·특이사항 등']
];

var cdbCache = [], cdbEditId = null, cdbInit = false;

function cdbEsc(t){ return String(t == null ? '' : t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function cdbMask(t){ t = String(t||''); return t ? '•'.repeat(Math.min(t.length, 12)) : ''; }

/* ===== 진입 ===== */
function cdbOpen(){
  var warn = document.getElementById('cdb-dbwarn');
  var root = document.getElementById('cdb-root');
  if(!sbReady()){
    warn.style.display = '';
    root.innerHTML = '';
    return;
  }
  warn.style.display = 'none';
  if(!cdbInit){ cdbRenderShell(); cdbInit = true; }
  cdbLoad();
}

/* ===== 화면 골격 ===== */
function cdbRenderShell(){
  var root = document.getElementById('cdb-root');
  var grp = { base:'🏢 기본 정보', mgr:'👤 담당자', acc:'🔐 계정 (Google · Github · Supabase)', sbp:'🗄️ Supabase 프로젝트', etc:'📝 기타' };
  var order = ['base','mgr','acc','sbp','etc'];

  var formHtml = '';
  order.forEach(function(g){
    formHtml += '<div class="fl" style="margin-top:16px;font-size:13px;color:var(--gold)">' + grp[g] + '</div>';
    var fs = CDB_FIELDS.filter(function(f){ return f[2] === g; });
    for(var i = 0; i < fs.length; i += 2){
      var a = fs[i], b = fs[i+1];
      if(g === 'etc'){
        formHtml += '<textarea class="tin" id="cdb-f-' + a[0] + '" style="min-height:60px" placeholder="' + cdbEsc(a[4]) + '"></textarea>';
        continue;
      }
      formHtml += '<div class="frow" style="margin-top:8px">';
      [a, b].forEach(function(f){
        if(!f){ formHtml += '<div></div>'; return; }
        formHtml += '<div><div class="fl">' + f[1].replace(' *',' <b>*</b>') + '</div>' +
          '<input class="tin" id="cdb-f-' + f[0] + '" ' + (f[3] ? 'type="password" autocomplete="new-password"' : 'type="text"') +
          ' placeholder="' + cdbEsc(f[4]) + '"></div>';
      });
      formHtml += '</div>';
    }
  });

  root.innerHTML =
    /* 검색 + 신규 */
    '<div class="frow" style="margin-bottom:12px">' +
      '<input class="tin" id="cdb-search" placeholder="🔍 회사명·담당자 검색" oninput="cdbRenderList()">' +
      '<button class="copy-btn" style="white-space:nowrap" onclick="cdbNew()">＋ 신규 등록</button>' +
    '</div>' +
    /* 입력 폼 */
    '<div class="frm" id="cdb-form" style="display:none">' +
      '<div class="fl" id="cdb-form-title" style="font-size:14px;color:var(--gold)">✍ 업체 등록</div>' +
      formHtml +
      '<div style="font-size:11.5px;color:var(--sub);margin-top:12px;line-height:1.7">⚠️ 계정·비밀번호는 서버(Supabase)에 저장됩니다. 외부에 anon key가 노출되지 않도록 관리하세요.</div>' +
      '<div class="frow" style="margin-top:14px">' +
        '<button class="copy-btn" style="width:100%;background:var(--card);border:1.5px solid var(--line);color:var(--sub)" onclick="cdbCancel()">취소</button>' +
        '<button class="copy-btn" style="width:100%" id="cdb-save" onclick="cdbSave()">저장</button>' +
      '</div>' +
    '</div>' +
    /* 목록 + SQL */
    '<div class="hgroup">🗂️ 업체 목록 <button class="qdel" style="margin-left:8px;vertical-align:middle" onclick="cdbCopySql()">테이블 생성 SQL 복사</button></div>' +
    '<div id="cdb-list"><div class="qempty">불러오는 중...</div></div>';
}

/* ===== 목록 로드 ===== */
async function cdbLoad(){
  var box = document.getElementById('cdb-list');
  try{
    cdbCache = await sb('hk_clients?select=*&order=company.asc') || [];
    cdbRenderList();
  }catch(e){
    box.innerHTML = '<div class="qempty">불러오기 실패 — ' + cdbEsc(e.message) + '<br>테이블이 없다면 위의 <b>테이블 생성 SQL</b>을 Supabase SQL Editor에서 실행하세요.</div>';
  }
}

function cdbRenderList(){
  var box = document.getElementById('cdb-list');
  var q = (document.getElementById('cdb-search').value || '').trim().toLowerCase();
  var rows = cdbCache.filter(function(r){
    if(!q) return true;
    return (r.company||'').toLowerCase().indexOf(q) >= 0 || (r.mgr_name||'').toLowerCase().indexOf(q) >= 0;
  });
  if(!rows.length){
    box.innerHTML = '<div class="qempty">' + (q ? '검색 결과가 없습니다' : '등록된 업체가 없습니다 — 신규 등록으로 추가하세요') + '</div>';
    return;
  }
  box.innerHTML = rows.map(function(r){
    var sub = [r.mgr_name, r.mgr_title, r.mgr_phone].filter(Boolean).join(' · ');
    return '<div class="frm" style="padding:14px 16px;margin-bottom:10px">' +
      '<div style="display:flex;align-items:center;gap:10px;cursor:pointer" onclick="cdbToggle(' + r.id + ')">' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:800">' + cdbEsc(r.company) + '</div>' +
          '<div style="font-size:12px;color:var(--sub);margin-top:2px">' + cdbEsc(sub || r.tel || '') + '</div>' +
        '</div>' +
        '<button class="qdel" onclick="event.stopPropagation();cdbEdit(' + r.id + ')">수정</button>' +
        '<button class="qdel" onclick="event.stopPropagation();cdbDel(' + r.id + ')">삭제</button>' +
        '<span id="cdb-arrow-' + r.id + '" style="color:var(--sub)">▾</span>' +
      '</div>' +
      '<div id="cdb-detail-' + r.id + '" style="display:none;margin-top:12px;border-top:1px solid var(--line);padding-top:12px">' +
        cdbDetailHtml(r) +
      '</div>' +
    '</div>';
  }).join('');
}

/* ===== 상세 (비밀필드 마스킹 + 보기/복사) ===== */
function cdbDetailHtml(r){
  return CDB_FIELDS.map(function(f){
    var k = f[0], label = f[1].replace(' *',''), secret = f[3];
    var v = r[k];
    if(!v) return '';
    var vid = 'cdb-v-' + r.id + '-' + k;
    var shown = secret ? cdbMask(v) : cdbEsc(v);
    return '<div style="display:flex;align-items:center;gap:8px;padding:5px 0;font-size:12.8px">' +
      '<span style="width:120px;flex:none;color:var(--sub);font-weight:700">' + cdbEsc(label) + '</span>' +
      '<span id="' + vid + '" data-shown="0" style="flex:1;word-break:break-all;color:var(--txt,#e8eaf2)">' + shown + '</span>' +
      (secret ? '<button class="qdel" onclick="cdbReveal(' + r.id + ',\'' + k + '\')">👁</button>' : '') +
      '<button class="qdel" onclick="cdbCopyVal(' + r.id + ',\'' + k + '\')">📋</button>' +
    '</div>';
  }).join('') || '<div class="qempty">입력된 상세 정보가 없습니다</div>';
}

function cdbFind(id){ for(var i=0;i<cdbCache.length;i++) if(cdbCache[i].id === id) return cdbCache[i]; return null; }

function cdbToggle(id){
  var d = document.getElementById('cdb-detail-' + id);
  var a = document.getElementById('cdb-arrow-' + id);
  var on = d.style.display === 'none';
  d.style.display = on ? '' : 'none';
  a.textContent = on ? '▴' : '▾';
}

function cdbReveal(id, k){
  var r = cdbFind(id); if(!r) return;
  var el = document.getElementById('cdb-v-' + id + '-' + k);
  var shown = el.getAttribute('data-shown') === '1';
  el.textContent = shown ? cdbMask(r[k]) : r[k];
  el.setAttribute('data-shown', shown ? '0' : '1');
}

function cdbCopyVal(id, k){
  var r = cdbFind(id); if(!r) return;
  var v = String(r[k] || '');
  function done(){ toast('복사되었습니다'); }
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(v).then(done, function(){ cdbFallbackCopy(v); done(); });
  } else { cdbFallbackCopy(v); done(); }
}
function cdbFallbackCopy(t){
  var ta = document.createElement('textarea');
  ta.value = t; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); }catch(e){}
  document.body.removeChild(ta);
}

function cdbCopySql(){
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(CDB_SQL).then(function(){ toast('SQL이 복사되었습니다'); }, function(){ cdbFallbackCopy(CDB_SQL); toast('SQL이 복사되었습니다'); });
  } else { cdbFallbackCopy(CDB_SQL); toast('SQL이 복사되었습니다'); }
}

/* ===== 신규 / 수정 / 취소 ===== */
function cdbNew(){
  cdbEditId = null;
  CDB_FIELDS.forEach(function(f){ document.getElementById('cdb-f-' + f[0]).value = ''; });
  document.getElementById('cdb-form-title').textContent = '✍ 업체 등록';
  document.getElementById('cdb-save').textContent = '저장';
  document.getElementById('cdb-form').style.display = '';
  document.getElementById('cdb-form').scrollIntoView({behavior:'smooth', block:'start'});
}

function cdbEdit(id){
  var r = cdbFind(id); if(!r) return;
  cdbEditId = id;
  CDB_FIELDS.forEach(function(f){ document.getElementById('cdb-f-' + f[0]).value = r[f[0]] || ''; });
  document.getElementById('cdb-form-title').textContent = '✏️ 업체 수정 — ' + r.company;
  document.getElementById('cdb-save').textContent = '수정 저장';
  document.getElementById('cdb-form').style.display = '';
  document.getElementById('cdb-form').scrollIntoView({behavior:'smooth', block:'start'});
}

function cdbCancel(){
  cdbEditId = null;
  document.getElementById('cdb-form').style.display = 'none';
}

/* ===== 저장 ===== */
async function cdbSave(){
  if(!sbReady()){ toast('먼저 설정에서 서버를 연결하세요'); return; }
  var body = {};
  CDB_FIELDS.forEach(function(f){ body[f[0]] = document.getElementById('cdb-f-' + f[0]).value.trim(); });
  if(!body.company){ toast('회사명은 필수입니다'); return; }
  var btn = document.getElementById('cdb-save');
  btn.disabled = true;
  try{
    if(cdbEditId){
      body.updated_at = new Date().toISOString();
      await sb('hk_clients?id=eq.' + cdbEditId, { method:'PATCH', body: body });
      toast('수정되었습니다');
    }else{
      await sb('hk_clients', { method:'POST', body: body });
      toast('등록되었습니다');
    }
    cdbCancel();
    await cdbLoad();
  }catch(e){
    toast('저장 실패 — ' + e.message);
  }finally{
    btn.disabled = false;
  }
}

/* ===== 삭제 ===== */
async function cdbDel(id){
  var r = cdbFind(id); if(!r) return;
  if(!confirm('[' + r.company + '] 업체 정보를 삭제할까요?\n계정 정보를 포함한 모든 데이터가 서버에서 삭제됩니다.')) return;
  try{
    await sb('hk_clients?id=eq.' + id, { method:'DELETE', prefer:'return=minimal' });
    toast('삭제되었습니다');
    await cdbLoad();
  }catch(e){
    toast('삭제 실패 — ' + e.message);
  }
}
