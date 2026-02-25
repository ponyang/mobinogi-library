/* ============================================================
   에린의 작업대 — app.js
   GitHub Pages 정적 호스팅용 | Fuse.js 퍼지 검색
   ============================================================ */

let DB = [];          // 로드된 전체 아이템 데이터
let fuse = null;      // Fuse.js 인스턴스
let activeFilter = 'all';
let activeCardId = null;
let craftPlan = {};   // { itemId: { item, qty } }

// Fuse.js 옵션
const FUSE_OPTIONS = {
  keys: [
    { name: 'name', weight: 2 },   // 이름 매칭 가중치 높게
    { name: 'tags', weight: 1 },
  ],
  threshold: 0.4,      // 0.0 완전일치 ~ 1.0 전부허용. 0.4 = 오타 1~2자 허용
  distance: 100,
  includeScore: true,
  minMatchCharLength: 1,
};

// ── 초기화 ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadData();
  bindEvents();
});

async function loadData() {
  try {
    setLoading(true);
    const res  = await fetch('./items.json');
    const json = await res.json();
    DB = json.items || [];
    fuse = new Fuse(DB, FUSE_OPTIONS);  // Fuse.js 인스턴스 초기화
    setLoading(false);
    showEmpty('search');
  } catch (e) {
    setLoading(false);
    showError('데이터를 불러오지 못했습니다. (items.json 확인 필요)');
    console.error(e);
  }
}

// ── 이벤트 바인딩 ─────────────────────────────────────────
function bindEvents() {
  // 검색 입력
  document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') doSearch();
  });
  document.getElementById('searchInput').addEventListener('input', e => {
    if (e.target.value === '') showEmpty('search');
  });

  // 필터 칩
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.filter;
      doSearch();
    });
  });
}

// ── 검색 ──────────────────────────────────────────────────
function doSearch() {
  const q = document.getElementById('searchInput').value.trim();
  const results = filterData(q);
  renderResults(results, q);
}

function filterData(q) {
  // 후보 결정: 쿼리 있으면 Fuse 퍼지검색, 없으면 전체
  let candidates;
  if (q) {
    candidates = fuse.search(q).map(r => r.item);
  } else {
    candidates = DB;
  }

  // 카테고리 필터 적용
  return candidates.filter(item =>
    activeFilter === 'all'
    || item.type   === activeFilter
    || item.skill  === activeFilter
  );
}

// 검색어 하이라이트 헬퍼
function highlight(text, q) {
  if (!q || !text) return text;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:rgba(200,150,60,.3);color:var(--gold-light);border-radius:2px;">$1</mark>');
}

// ── 결과 렌더 ─────────────────────────────────────────────
function renderResults(items, q = '') {
  const list = document.getElementById('resultsList');

  document.getElementById('resultsCount').textContent =
    items.length ? `${items.length}건` : '';

  if (!items.length) {
    showEmpty(q ? 'noresult' : 'search');
    return;
  }

  list.innerHTML = items.map((item, i) => buildCard(item, i)).join('');
  bindCardEvents(list, items);
}

function buildCard(item, index) {
  const isCraftable = !!item.recipe;
  const typeTag = item.type === 'MATERIAL'
    ? `<span class="tag tag-material">재료</span>`
    : item.type === 'INTERMEDIATE'
      ? `<span class="tag tag-inter">중간재</span>`
      : `<span class="tag tag-product">완성품</span>`;

  const skillTag = item.skill
    ? `<span class="tag tag-category">${SKILL_LABELS[item.skill] || item.skill}</span>` : '';

  const sourcesHtml = (item.sources || []).length ? `
    <div class="item-sources">
      <p class="section-label">📍 획득처</p>
      ${item.sources.map(s => `
        <div class="source-row">
          <span class="source-dot dot-${s.dot}"></span>
          <span class="source-name">${s.name}</span>
          <span class="source-loc">${s.location}</span>
        </div>`).join('')}
    </div>` : '';

  const recipeHtml = item.recipe ? `
    <div class="recipe-section">
      <p class="section-label">⚒ 레시피 <span style="color:var(--text-muted);font-size:11px;">(스킬 레벨 ${item.recipe.level} 이상)</span></p>
      <div class="recipe-materials">
        ${item.recipe.materials.map(m => `
          <button class="mat-chip" data-name="${m.name}" title="${m.name} 검색하기">
            <span class="mat-icon">${m.emoji}</span>
            <div class="mat-info">
              <div class="mat-name">${m.name}</div>
              <div class="mat-qty">× ${m.qty}</div>
            </div>
          </button>`).join('')}
      </div>
    </div>` : '';

  const addBtn = isCraftable ? `
    <button class="add-craft-btn" data-id="${item.id}" title="제작 계획에 추가">
      + 추가
    </button>` : '';

  return `
    <div class="item-card" data-id="${item.id}" style="animation-delay:${index * 0.04}s">
      <div class="item-card-top">
        <div class="item-icon">${item.emoji || '📦'}</div>
        <div class="item-info">
          <div class="item-name">${item.name}</div>
          <div class="item-tags">${typeTag}${skillTag}</div>
        </div>
        ${addBtn}
      </div>
      ${sourcesHtml}
      ${recipeHtml}
    </div>`;
}

function bindCardEvents(list, items) {
  list.querySelectorAll('.item-card').forEach(card => {
    const id = parseInt(card.dataset.id);

    // 카드 토글
    card.addEventListener('click', e => {
      if (e.target.closest('.mat-chip') || e.target.closest('.add-craft-btn')) return;
      if (activeCardId === id) {
        card.classList.remove('active');
        activeCardId = null;
      } else {
        list.querySelectorAll('.item-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        activeCardId = id;
      }
    });

    // 재료 칩 → 해당 재료 검색
    card.querySelectorAll('.mat-chip').forEach(chip => {
      chip.addEventListener('click', e => {
        e.stopPropagation();
        document.getElementById('searchInput').value = chip.dataset.name;
        doSearch();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    });

    // 제작 계획 추가
    const addBtn = card.querySelector('.add-craft-btn');
    if (addBtn) {
      addBtn.addEventListener('click', e => {
        e.stopPropagation();
        const item = items.find(i => i.id === id);
        if (item) addToCraft(item);
        // 버튼 피드백
        addBtn.textContent = '✓ 추가됨';
        addBtn.style.color = 'var(--green)';
        addBtn.style.borderColor = 'var(--green)';
        setTimeout(() => {
          addBtn.textContent = '+ 추가';
          addBtn.style.color = '';
          addBtn.style.borderColor = '';
        }, 1000);
      });
    }
  });
}

// ── 제작 계획 ─────────────────────────────────────────────
function addToCraft(item) {
  if (craftPlan[item.id]) {
    craftPlan[item.id].qty++;
  } else {
    craftPlan[item.id] = { item, qty: 1 };
  }
  renderCraftPanel();
  // 사이드패널 하이라이트
  const panel = document.getElementById('craftPanel');
  panel.classList.add('highlight');
  setTimeout(() => panel.classList.remove('highlight'), 600);
}

function changeQty(id, delta) {
  if (!craftPlan[id]) return;
  const newQty = craftPlan[id].qty + delta;
  if (newQty <= 0) {
    delete craftPlan[id];
  } else {
    craftPlan[id].qty = newQty;
  }
  renderCraftPanel();
  renderTotals();
}

function clearCraft() {
  craftPlan = {};
  renderCraftPanel();
  document.getElementById('totalMatsPanel').style.display = 'none';
  document.getElementById('routePanel').style.display = 'none';
}

function renderCraftPanel() {
  const keys = Object.keys(craftPlan);
  document.getElementById('craftCount').textContent = keys.length;

  const list = document.getElementById('craftList');
  if (!keys.length) {
    list.innerHTML = `<p class="panel-empty">제작템을 검색 후 추가해보세요</p>`;
    return;
  }

  list.innerHTML = keys.map(id => {
    const { item, qty } = craftPlan[id];
    return `
      <div class="craft-item-row">
        <span class="craft-emoji">${item.emoji || '📦'}</span>
        <span class="craft-item-name">${item.name}</span>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${id}, -1)">−</button>
          <span class="qty-val">${qty}</span>
          <button class="qty-btn" onclick="changeQty(${id}, +1)">＋</button>
        </div>
      </div>`;
  }).join('');
}

// ── 전체 재료 합산 ────────────────────────────────────────
function calcTotal() {
  const keys = Object.keys(craftPlan);
  if (!keys.length) return;
  renderTotals();
}

function renderTotals() {
  const keys = Object.keys(craftPlan);
  if (!keys.length) {
    document.getElementById('totalMatsPanel').style.display = 'none';
    document.getElementById('routePanel').style.display = 'none';
    return;
  }

  // 재료 합산
  const totals = {};   // { 재료명: { qty, emoji, locations } }
  keys.forEach(id => {
    const { item, qty: craftQty } = craftPlan[id];
    if (!item.recipe) return;

    item.recipe.materials.forEach(m => {
      if (!totals[m.name]) {
        // DB에서 해당 재료 정보 조회
        const matItem = DB.find(d => d.name === m.name);
        totals[m.name] = {
          qty: 0,
          emoji: m.emoji,
          locations: matItem ? (matItem.sources || []).map(s => s.location) : [],
        };
      }
      totals[m.name].qty += m.qty * craftQty;
    });
  });

  // 전체 재료 패널
  const totalPanel = document.getElementById('totalMatsPanel');
  const totalList  = document.getElementById('totalMatsList');
  totalPanel.style.display = 'block';

  if (!Object.keys(totals).length) {
    totalList.innerHTML = `<p class="panel-empty">레시피 정보가 없습니다.</p>`;
    return;
  }

  totalList.innerHTML = Object.entries(totals)
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, info]) => `
      <div class="total-mat-row">
        <span class="total-mat-icon">${info.emoji}</span>
        <span class="total-mat-name">${name}</span>
        <span class="total-mat-qty">× ${info.qty}</span>
      </div>`).join('');

  // 동선: 지역별로 그룹핑
  const locMap = {};
  Object.entries(totals).forEach(([name, info]) => {
    (info.locations || []).forEach(loc => {
      if (!locMap[loc]) locMap[loc] = [];
      locMap[loc].push(`${info.emoji} ${name} ×${info.qty}`);
    });
  });

  const routePanel = document.getElementById('routePanel');
  const routeList  = document.getElementById('routeList');
  routePanel.style.display = 'block';

  if (!Object.keys(locMap).length) {
    routeList.innerHTML = `<p class="panel-empty">획득처 정보가 없습니다.</p>`;
    return;
  }

  routeList.innerHTML = Object.entries(locMap)
    .map(([loc, items], i) => `
      <div class="route-step">
        <div class="step-num">${i + 1}</div>
        <div class="step-info">
          <div class="step-loc">📍 ${loc}</div>
          <div class="step-items">${items.join(' · ')}</div>
        </div>
      </div>`).join('');
}

// ── 유틸 ─────────────────────────────────────────────────
function setLoading(on) {
  document.getElementById('resultsList').innerHTML = on ? `
    <div class="empty-state">
      <div class="empty-icon" style="animation: spin 1s linear infinite; display:inline-block;">⚙️</div>
      <p class="empty-text">데이터 로딩 중...</p>
    </div>` : '';
}

function showEmpty(type) {
  const msgs = {
    search:   { icon: '🌿', title: '에린의 재료를 찾아보세요', sub: '이름으로 검색하거나 카테고리를 선택하세요' },
    noresult: { icon: '🔎', title: '검색 결과가 없습니다',     sub: '다른 키워드로 검색해보세요' },
  };
  const m = msgs[type] || msgs.search;
  document.getElementById('resultsList').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">${m.icon}</div>
      <p class="empty-text">${m.title}</p>
      <p class="empty-sub">${m.sub}</p>
    </div>`;
  document.getElementById('resultsCount').textContent = '';
}

function showError(msg) {
  document.getElementById('resultsList').innerHTML = `
    <div class="empty-state">
      <div class="empty-icon">⚠️</div>
      <p class="empty-text" style="color:var(--red);">${msg}</p>
    </div>`;
}

const SKILL_LABELS = {
  COOKING: '요리', BLACKSMITH: '대장장이', SMELT: '제련',
  TAILORING: '재봉', LEATHERWORK: '가죽', ALCHEMY: '연금술',
  ENCHANT: '마법부여', WOODWORK: '목공', HANDICRAFT: '핸디크래프트',
  MAGIC_CRAFT: '매직 크래프트',
};

// spin keyframe (로딩용)
const style = document.createElement('style');
style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
document.head.appendChild(style);
