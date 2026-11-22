/* ==========================================================================
   awards-data.js — 대외수상 데이터 공통 모듈 (index.html, awards.html 함께 사용)

   1. data/awards.json 읽기                loadAwards()
   2. 수상 문자열 파싱                      parseAwardText()
   3. 통계 계산                             calcAwardStats()
   4. 수상 요약 렌더링 (통계 카드)         renderAwardSummary(넣을 위치, 데이터)
   5. 수상 배지 · 최근 수상                 renderPrizeBadges(), renderRecentAwards()

   - awards.js에서는 AwardsData.함수이름() 으로 씁니다.
   - data-award-summary 속성이 있는 요소에는 '전체 기간' 요약을 자동으로 그립니다. (index.html)
   - data-award-recent="3" 속성이 있는 요소에는 최근 수상 3건을 자동으로 그립니다. (index.html)
   ========================================================================== */
(function (global) {
  'use strict';

  /* --------------------------------------------------------------------------
     설정
     -------------------------------------------------------------------------- */
  const CONFIG = {
    url: 'data/awards.json',
    // 종류 표시 순서: 이 목록 → 1위, 2위, 3위 … → 그 밖의 상(가나다순)
    // (집계는 데이터에 나온 이름 그대로 하고, 이 목록은 순서에만 씁니다)
    medalOrder: ['대상', '금상', '은상', '동상', '장려상'],
    // 수상 학생 수 = 총 수상 수 × 이 숫자 (학생 명단이 없어 수상 1건당 평균 인원으로 추정)
    studentsPerAward: 3,
  };

  const MESSAGES = {
    loadError: '수상내역을 불러올 수 없습니다.',
  };

  /* --------------------------------------------------------------------------
     1. 데이터 읽기
     -------------------------------------------------------------------------- */

  /**
   * awards.json을 읽어 배열로 돌려줍니다.
   * cache: 'no-cache' → JSON을 고친 뒤 새로고침하면 바로 반영되도록 매번 서버에 확인합니다.
   * @returns {Promise<Array<Object>>}
   */
  async function loadAwards(url = CONFIG.url) {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`${url} — HTTP ${response.status}`);

    const data = await response.json();
    if (!Array.isArray(data)) throw new Error(`${url}의 내용은 [ … ] 배열이어야 합니다.`);
    return data;
  }

  /* --------------------------------------------------------------------------
     2. 수상 문자열 파싱
     -------------------------------------------------------------------------- */

  /**
   * 수상 항목 1개를 해석합니다.
   *   순위형     "1위"    → { kind: '1위',   count: 1 }   숫자는 순위 → 1개로 셈
   *   메달형     "금상3"  → { kind: '금상',  count: 3 }   숫자는 개수
   *   숫자 없음  "특별상" → { kind: '특별상', count: 1 }
   * @param {string} item 앞뒤 공백을 없앤 항목
   * @returns {{ kind: string, count: number }}
   */
  function parseAwardItem(item) {
    const rank = item.match(/^(\d+)\s*위$/);
    if (rank) return { kind: `${Number(rank[1])}위`, count: 1 };

    const medal = item.match(/^(.*\D)\s*(\d+)$/);
    if (medal) return { kind: medal[1].trim(), count: Number(medal[2]) };

    return { kind: item, count: 1 };
  }

  /**
   * 수상 문자열을 대회 하나의 결과로 바꿉니다.
   * 예) "대상1, 금상3, 은상1, 동상1, 1위, 2위"
   *   → { byKind: { 대상: 1, 금상: 3, 은상: 1, 동상: 1, '1위': 1, '2위': 1 }, total: 8 }
   * @param {string} text 수상 문자열 ("" 이면 수상 없음)
   * @returns {{ byKind: Object<string, number>, total: number }}
   */
  function parseAwardText(text) {
    const byKind = {};
    let total = 0;

    String(text ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter((item) => item !== '')
      .forEach((item) => {
        const { kind, count } = parseAwardItem(item);
        if (count < 1) return; // "금상0"처럼 0개인 항목은 세지 않음
        byKind[kind] = (byKind[kind] || 0) + count;
        total += count;
      });

    return { byKind, total };
  }

  /** 정렬 기준 [묶음, 묶음 안 순서]: 메달형 0 → 순위형 1 → 그 밖의 상 2 */
  function getKindOrder(kind) {
    const medalIndex = CONFIG.medalOrder.indexOf(kind);
    if (medalIndex !== -1) return [0, medalIndex];

    const rank = kind.match(/^(\d+)위$/);
    if (rank) return [1, Number(rank[1])];

    return [2, 0];
  }

  function compareKinds(a, b) {
    const [groupA, orderA] = getKindOrder(a);
    const [groupB, orderB] = getKindOrder(b);
    return groupA - groupB || orderA - orderB || a.localeCompare(b, 'ko');
  }

  /**
   * { 종류: 개수 } 객체를 표시 순서대로 정렬한 배열로 바꿉니다.
   * 대상 → 금상 → 은상 → 동상 → 장려상 → 1위 → 2위 → … → 그 밖의 상(가나다순)
   * @returns {Array<{ kind: string, count: number }>}
   */
  function sortAwardKinds(byKind) {
    return Object.keys(byKind)
      .sort(compareKinds)
      .map((kind) => ({ kind, count: byKind[kind] }));
  }

  /* --------------------------------------------------------------------------
     3. 통계 계산
     -------------------------------------------------------------------------- */

  /**
   * 대회 목록으로 통계를 계산합니다.
   * @param {Array<Object>} awards awards.json 항목 배열 (전체)
   * @returns {{
   *   awardedContests: number,  // 수상 대회 수 (수상 1개 이상인 대회)
   *   totalAwards: number,      // 총 수상 수
   *   awardedStudents: number   // 수상 학생 수 (총 수상 수 × CONFIG.studentsPerAward, 추정치)
   * }}
   */
  function calcAwardStats(awards) {
    let totalAwards = 0;
    let awardedContests = 0;

    awards.forEach((award) => {
      const result = parseAwardText(award['수상']);
      if (result.total > 0) awardedContests += 1;
      totalAwards += result.total;
    });

    return {
      awardedContests,
      totalAwards,
      awardedStudents: totalAwards * CONFIG.studentsPerAward,
    };
  }

  /* --------------------------------------------------------------------------
     표시 형식 · 연도 도우미
     -------------------------------------------------------------------------- */

  /** innerHTML에 넣기 전에 특수문자를 바꿉니다. (JSON에 <, & 등이 있어도 안전) */
  function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value ?? '').replace(/[&<>"']/g, (char) => map[char]);
  }

  /** 데이터에 있는 연도 목록 (최신 연도부터) 예) [2026, 2025] */
  function getAwardYears(awards) {
    const years = awards
      .map((award) => Number(award['연도']))
      .filter((year) => Number.isFinite(year));
    return [...new Set(years)].sort((a, b) => b - a);
  }

  /** 특정 연도의 대회만 고릅니다. year가 'all'이면 전체를 돌려줍니다. */
  function filterAwardsByYear(awards, year) {
    if (year === 'all') return awards.slice();
    return awards.filter((award) => Number(award['연도']) === Number(year));
  }

  /** 연도 내림차순 정렬 (같은 연도는 JSON에 적힌 순서 유지) */
  function sortAwardsByYearDesc(awards) {
    return awards.slice().sort((a, b) => (Number(b['연도']) || 0) - (Number(a['연도']) || 0));
  }

  /** 요약 기준 기간 문구 예) '2025~2026년', '2025년' */
  function getPeriodLabel(awards) {
    const years = getAwardYears(awards);
    if (years.length === 0) return '';
    const latest = years[0];
    const oldest = years[years.length - 1];
    return latest === oldest ? `${latest}년` : `${oldest}~${latest}년`;
  }

  /* --------------------------------------------------------------------------
     4. 수상 요약 렌더링
     -------------------------------------------------------------------------- */

  /**
   * 수상 요약(기간 + 통계 카드 3개)을 그립니다.
   * index.html과 awards.html이 같은 함수를 쓰고, 둘 다 전체 기간 데이터를 넘깁니다.
   * @param {HTMLElement} target 요약을 넣을 요소
   * @param {Array<Object>} awards awards.json 전체
   */
  function renderAwardSummary(target, awards) {
    if (!target) return;

    const stats = calcAwardStats(awards);
    const period = getPeriodLabel(awards);

    const cards = [
      { label: '수상 대회 수', value: stats.awardedContests, unit: '개' },
      { label: '총 수상 수', value: stats.totalAwards, unit: '개' },
      { label: '수상 학생 수', value: stats.awardedStudents, unit: '명+' },
    ];

    const periodHtml = period
      ? `<p class="award-summary__period">${period} 기준</p>`
      : '';

    const cardsHtml = cards.map((card) => `
        <div class="stat-card">
          <dt class="stat-card__label">${card.label}</dt>
          <dd class="stat-card__value">
            <span class="stat-card__number" data-count>${card.value}</span>
            <span class="stat-card__unit">${card.unit}</span>
          </dd>
        </div>`).join('');

    target.innerHTML = `
      ${periodHtml}
      <dl class="award-summary__stats">${cardsHtml}
      </dl>`;

    // 카운트업은 main.js의 공용 기능 (main.js가 없으면 최종 숫자가 그대로 보임)
    global.CountUp?.start(target);
  }

  /* --------------------------------------------------------------------------
     5. 수상 배지 · 최근 수상 (배지는 awards.html 목록과 index.html 최근 수상 공용)
     -------------------------------------------------------------------------- */

  /* 아이콘 모양 (색은 CSS의 badge--○○가 정함, 글자로 상 이름이 있으므로 장식용) */
  // 메달: 리본 두 줄 + 메달 — 대상·금·은·동, 1~3위
  const MEDAL_ICON = `<svg class="badge__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3.5 1h3l1.6 4.2H5.1zM9.5 1h3l-1.6 4.2H7.9z" fill="currentColor" opacity="0.55"/>
    <circle cx="8" cy="10.5" r="4.5" fill="currentColor"/>
    <circle cx="8" cy="10.5" r="2.6" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1"/>
  </svg>`;

  // 리본 휘장: 원 + 아래로 늘어진 꼬리 두 개 — 우수상·장려상·입상
  const ROSETTE_ICON = `<svg class="badge__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M5.3 9.2 4 15l4-1.9 4 1.9-1.3-5.8z" fill="currentColor" opacity="0.55"/>
    <circle cx="8" cy="6" r="4.8" fill="currentColor"/>
    <circle cx="8" cy="6" r="2.7" fill="none" stroke="#fff" stroke-opacity="0.7" stroke-width="1"/>
  </svg>`;

  /* 아이콘을 붙일 상 → [색 이름(badge--○○), 아이콘 모양] */
  const PRIZE_ICONS = {
    대상: ['grand', MEDAL_ICON],
    금상: ['gold', MEDAL_ICON],
    은상: ['silver', MEDAL_ICON],
    동상: ['bronze', MEDAL_ICON],
    '1위': ['gold', MEDAL_ICON],
    '2위': ['silver', MEDAL_ICON],
    '3위': ['bronze', MEDAL_ICON],
    우수상: ['merit', ROSETTE_ICON],
    장려상: ['entry', ROSETTE_ICON],
    입상: ['entry', ROSETTE_ICON],
  };

  /** 대회 하나의 수상 배지 (수상이 없으면 '-') */
  function renderPrizeBadges(text) {
    const kinds = sortAwardKinds(parseAwardText(text).byKind);

    if (kinds.length === 0) {
      return '<span aria-hidden="true">-</span><span class="visually-hidden">수상 없음</span>';
    }

    // 2개 이상일 때만 개수를 붙입니다: 대상, 금상 3, 1위 …
    const items = kinds.map(({ kind, count }) => {
      const [tier, icon] = PRIZE_ICONS[kind] || [];
      const tierClass = tier ? ` badge--${tier}` : '';
      const iconHtml = icon || '';
      const countHtml = count > 1 ? ` <strong class="badge__count">${count}</strong>` : '';
      return `<li class="badge${tierClass}">${iconHtml}${escapeHtml(kind)}${countHtml}</li>`;
    });
    return `<ul class="badge-list">${items.join('')}</ul>`;
  }

  /**
   * 최근 수상 목록을 그립니다. (index.html)
   * 연도 최신순, 같은 연도는 JSON에 적힌 순서. 수상이 없는 대회는 뺍니다.
   * @param {HTMLElement} target 목록을 넣을 요소
   * @param {Array<Object>} awards awards.json 전체
   * @param {number} count 보여 줄 대회 수
   */
  function renderRecentAwards(target, awards, count) {
    if (!target) return;

    const recent = sortAwardsByYearDesc(awards)
      .filter((award) => parseAwardText(award['수상']).total > 0)
      .slice(0, count);

    if (recent.length === 0) {
      renderAwardMessage(target, '등록된 수상내역이 없습니다.');
      return;
    }

    const itemsHtml = recent.map((award) => `
        <li class="recent-awards__item">
          <p class="recent-awards__year">${escapeHtml(award['연도'])}</p>
          <p class="recent-awards__name">${escapeHtml(award['대회'])}</p>
          <div class="recent-awards__prize"><span class="visually-hidden">수상: </span>${renderPrizeBadges(award['수상'])}</div>
        </li>`).join('');

    target.innerHTML = `<ul class="recent-awards">${itemsHtml}
      </ul>`;
  }

  /** 요약·목록 자리에 안내 문구를 표시합니다. (불러오기 실패, 데이터 없음 등) */
  function renderAwardMessage(target, message) {
    if (!target) return;
    target.innerHTML = `<p class="status-box">${escapeHtml(message)}</p>`;
  }

  /* --------------------------------------------------------------------------
     자동 요약: data-award-summary 속성이 있는 자리에 전체 기간 요약 (index.html)
     -------------------------------------------------------------------------- */
  /* data-award-recent="3" → 최근 수상 3건 (숫자를 바꾸면 보여 주는 개수가 바뀝니다) */
  async function initAutoSummaries() {
    const summaries = document.querySelectorAll('[data-award-summary]');
    const recents = document.querySelectorAll('[data-award-recent]');
    if (summaries.length === 0 && recents.length === 0) return;

    try {
      const awards = await loadAwards();
      summaries.forEach((target) => renderAwardSummary(target, awards));
      recents.forEach((target) => {
        renderRecentAwards(target, awards, Number(target.dataset.awardRecent) || 3);
      });
    } catch (error) {
      console.error('[awards-data.js] 수상 데이터를 불러오지 못했습니다.', error);
      [...summaries, ...recents].forEach((target) => renderAwardMessage(target, MESSAGES.loadError));
    }
  }

  /* --------------------------------------------------------------------------
     내보내기 — awards.js에서 AwardsData.함수이름() 으로 사용
     -------------------------------------------------------------------------- */
  global.AwardsData = {
    MESSAGES,
    loadAwards,
    escapeHtml,
    getAwardYears,
    filterAwardsByYear,
    sortAwardsByYearDesc,
    renderAwardSummary,
    renderPrizeBadges,
    renderAwardMessage,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoSummaries);
  } else {
    initAutoSummaries();
  }
})(window);
