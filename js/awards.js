/* ==========================================================================
   awards.js — awards.html 전용
   1. 수상 요약(숫자 카드): 전체 기간 기준으로 한 번만 그림
   2. 연도 선택 버튼 자동 생성: [전체] [2026] [2025] …
   3. 버튼을 누르면 수상내역 목록만 그 연도로 다시 그림 (요약은 그대로)
   4. 선택한 연도를 URL 해시(awards.html#2025)와 맞춤

   ※ awards-data.js를 먼저 불러와야 합니다. (AwardsData 사용)
   ========================================================================== */
(function () {
  'use strict';

  const Awards = window.AwardsData;
  if (!Awards) {
    console.error('[awards.js] awards-data.js를 먼저 불러와 주세요.');
    return;
  }

  const ALL = 'all'; // '전체' 버튼의 값

  const els = {
    filter: document.getElementById('year-filter'),
    summary: document.getElementById('award-summary'),
    meta: document.getElementById('award-list-meta'),
    list: document.getElementById('award-list'),
  };

  const state = {
    awards: [],    // awards.json 전체
    years: [],     // ['2026', '2025', …] 최신순
    selected: ALL, // 선택한 연도
  };

  /* --------------------------------------------------------------------------
     URL 해시 ↔ 선택 연도
     -------------------------------------------------------------------------- */

  /**
   * 해시에서 연도를 읽습니다.
   *   없음 또는 #all          → 'all' (전체)
   *   #2025 (데이터에 있는 연도) → '2025'
   *   그 밖        → null (연도와 상관없는 해시이므로 무시)
   */
  function readHashYear() {
    const hash = window.location.hash.slice(1);
    if (hash === '' || hash === ALL) return ALL;
    return state.years.includes(hash) ? hash : null;
  }

  /** 선택한 연도를 주소에 반영합니다. (방문 기록은 늘리지 않음) */
  function writeHashYear(year) {
    const url = year === ALL
      ? window.location.pathname + window.location.search
      : `#${year}`;
    history.replaceState(null, '', url);
  }

  /* --------------------------------------------------------------------------
     연도 선택 버튼
     -------------------------------------------------------------------------- */
  function renderYearButtons() {
    const options = [{ value: ALL, label: '전체' }]
      .concat(state.years.map((year) => ({ value: year, label: year })));

    els.filter.innerHTML = options.map((option) => `
      <button type="button" class="year-filter__btn" data-year="${Awards.escapeHtml(option.value)}" aria-pressed="false">${Awards.escapeHtml(option.label)}</button>`).join('');
  }

  function updateYearButtons() {
    els.filter.querySelectorAll('.year-filter__btn').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.year === state.selected));
    });
  }

  /* --------------------------------------------------------------------------
     수상내역 목록 — PC는 표, 모바일은 카드 (둘 다 그리고 CSS로 하나만 보여 줌)
     -------------------------------------------------------------------------- */

  /** 빈 값은 '-'로 표시 */
  function textOrDash(value) {
    const text = String(value ?? '').trim();
    return text === '' ? '-' : Awards.escapeHtml(text);
  }

  /**
   * 주관 글자: 여러 기관이면 쉼표로 이어 붙임
   * JSON에는 ["기관1", "기관2"] 배열로 적습니다. (기관이 하나면 "기관1" 문자열도 됩니다)
   */
  function hostText(value) {
    return (Array.isArray(value) ? value : [value])
      .map((host) => String(host ?? '').trim())
      .filter((host) => host !== '')
      .join(', ');
  }

  /**
   * 분야 표시: 여러 개면 한 줄에 하나씩
   * JSON에는 ["분야1", "분야2"] 배열로 적습니다. (분야가 하나면 "분야1" 문자열도 됩니다)
   */
  function renderFields(value) {
    const fields = (Array.isArray(value) ? value : [value])
      .map((field) => String(field ?? '').trim())
      .filter((field) => field !== '');
    return fields.length ? fields.map(Awards.escapeHtml).join('<br>') : '-';
  }

  /** PC 표의 한 줄 — 대회·주관 칸은 두 줄 (첫 줄 대회명, 둘째 줄 주관) */
  function renderTableRow(award) {
    const host = hostText(award['주관']);
    const hostHtml = host
      ? `<span class="award-table__host"><span class="visually-hidden">주관 </span>${Awards.escapeHtml(host)}</span>`
      : '';

    return `
            <tr>
              <td>${textOrDash(award['연도'])}</td>
              <th scope="row" class="data-table__cell--start">
                <span class="award-table__name">${textOrDash(award['대회'])}</span>${hostHtml}
              </th>
              <td class="award-table__field">${renderFields(award['분야'])}</td>
              <td class="data-table__cell--start">${Awards.renderPrizeBadges(award['수상'])}</td>
            </tr>`;
  }

  /** 모바일 카드 하나 */
  function renderCard(award) {
    return `
        <li class="award-card">
          <p class="award-card__year">${textOrDash(award['연도'])}</p>
          <h3 class="award-card__title">${textOrDash(award['대회'])}</h3>
          <dl class="award-card__info">
            <div class="award-card__row">
              <dt class="award-card__label">주관</dt>
              <dd>${textOrDash(hostText(award['주관']))}</dd>
            </div>
            <div class="award-card__row">
              <dt class="award-card__label">분야</dt>
              <dd>${renderFields(award['분야'])}</dd>
            </div>
            <div class="award-card__row">
              <dt class="award-card__label">수상</dt>
              <dd>${Awards.renderPrizeBadges(award['수상'])}</dd>
            </div>
          </dl>
        </li>`;
  }

  function renderList(awards) {
    const yearLabel = state.selected === ALL ? '전체' : `${state.selected}년`;
    if (els.meta) els.meta.textContent = `${yearLabel} 수상내역 ${awards.length}건`;

    if (awards.length === 0) {
      Awards.renderAwardMessage(els.list, state.selected === ALL
        ? '등록된 수상내역이 없습니다.'
        : '해당 연도의 수상내역이 없습니다.');
      return;
    }

    const sorted = Awards.sortAwardsByYearDesc(awards);

    els.list.innerHTML = `
      <div class="award-table">
        <table class="data-table data-table--plain">
          <caption class="visually-hidden">${yearLabel} 대외 수상내역</caption>
          <colgroup>
            <col class="award-table__col--year">
            <col class="award-table__col--name">
            <col class="award-table__col--field">
            <col>
          </colgroup>
          <thead>
            <tr>
              <th scope="col">연도</th>
              <th scope="col" class="data-table__cell--start">대회·주관</th>
              <th scope="col">분야</th>
              <th scope="col" class="data-table__cell--start">수상</th>
            </tr>
          </thead>
          <tbody>${sorted.map(renderTableRow).join('')}
          </tbody>
        </table>
      </div>
      <ul class="award-cards">${sorted.map(renderCard).join('')}
      </ul>`;
  }

  /* --------------------------------------------------------------------------
     연도 선택 → 목록만 갱신
     -------------------------------------------------------------------------- */
  function selectYear(year, { updateHash = true } = {}) {
    state.selected = year;

    updateYearButtons();
    renderList(Awards.filterAwardsByYear(state.awards, year));

    if (updateHash) writeHashYear(year);
  }

  function handleFilterClick(event) {
    const button = event.target.closest('.year-filter__btn');
    if (!button || button.dataset.year === state.selected) return;
    selectYear(button.dataset.year);
  }

  /** 주소창에서 해시를 직접 바꾸거나, 해시가 다른 링크로 들어왔을 때 */
  function handleHashChange() {
    const year = readHashYear();
    if (year !== null && year !== state.selected) selectYear(year, { updateHash: false });
  }

  /* --------------------------------------------------------------------------
     불러오기 실패
     -------------------------------------------------------------------------- */
  function showLoadError(error) {
    console.error('[awards.js] 수상 데이터를 불러오지 못했습니다.', error);
    els.filter.hidden = true;
    if (els.meta) els.meta.textContent = '';
    Awards.renderAwardMessage(els.summary, Awards.MESSAGES.loadError);
    Awards.renderAwardMessage(els.list, Awards.MESSAGES.loadError);
  }

  /* --------------------------------------------------------------------------
     시작
     -------------------------------------------------------------------------- */
  async function init() {
    if (!els.filter || !els.summary || !els.list) return;

    try {
      state.awards = await Awards.loadAwards();
    } catch (error) {
      showLoadError(error);
      return;
    }

    // 요약은 전체 기간으로 한 번만 (awards-data.js 공용 함수)
    Awards.renderAwardSummary(els.summary, state.awards);

    state.years = Awards.getAwardYears(state.awards).map(String);
    renderYearButtons();

    els.filter.addEventListener('click', handleFilterClick);
    window.addEventListener('hashchange', handleHashChange);

    // 주소에 #2025 같은 해시가 있으면 그 연도로 시작 (없거나 모르는 값이면 전체)
    selectYear(readHashYear() ?? ALL, { updateHash: false });

    // 메인에서 awards.html#award-history 처럼 위치를 지정해 들어온 경우:
    // 처음엔 목록이 비어 있어 브라우저가 그 위치까지 못 내려가므로, 다 그린 뒤 다시 이동
    const target = document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    if (target) target.scrollIntoView();
  }

  init();
})();
