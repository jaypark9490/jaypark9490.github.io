/* ==========================================================================
   main.js — 모든 페이지 공통
   1. header.html, footer.html을 불러와 넣기
   2. (헤더를 넣은 다음) 모바일 메뉴 열기/닫기 연결
   3. (헤더를 넣은 다음) 현재 페이지 메뉴에 active 클래스 붙이기
   4. (헤더를 넣은 다음) 스크롤하면 헤더에 site-header--scrolled 클래스 (고정 헤더 진한 배경용)
   5. 푸터 저작권 연도 자동 표시
   6. 다른 페이지의 일부를 그대로 가져와 넣기 (index.html의 연혁, 교육과정 숫자)
      <div data-include-from="about.html" data-include-select=".timeline"></div>
      → about.html에서 .timeline 부분을 찾아 이 자리에 넣습니다. 내용은 원래 페이지에서만 고치면 됩니다.
   7. 숫자 카운트업: <span data-count>22.4</span> 처럼 적힌 숫자가 화면에 보이면 0부터 올라감 (소수점 가능)
      - 스크립트가 나중에 그리는 숫자는 그 스크립트에서 window.CountUp.start(넣은 자리)를 호출

   ※ fetch()는 file:// 주소에서 막힙니다. 로컬 서버로 여세요. (README.md의 실행 방법 참고)
   ========================================================================== */
(function () {
  'use strict';

  /* 모바일 기준 — style.css의 @media (max-width: 768px)와 같은 값 */
  const MOBILE_QUERY = '(max-width: 768px)';

  /* 카운트업 시간 (ms) */
  const COUNT_DURATION = 1200;

  /* --------------------------------------------------------------------------
     숫자 카운트업 — 화면에 보이면 0 → 목표 숫자
     -------------------------------------------------------------------------- */

  /** '22.4' → 1, '74' → 0 (목표 숫자의 소수 자릿수만큼 보여 줌) */
  function getDecimals(value) {
    const match = String(value).match(/\.(\d+)$/);
    return match ? match[1].length : 0;
  }

  function formatCount(value, decimals) {
    return value.toLocaleString('ko-KR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  }

  /** 숫자 하나를 0부터 목표값까지 올립니다. */
  function animateCount(el) {
    const end = Number(el.dataset.count) || 0;
    const decimals = getDecimals(el.dataset.count);
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / COUNT_DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // 끝으로 갈수록 천천히 (easeOutCubic)
      el.textContent = formatCount(end * eased, decimals);
      if (progress < 1) requestAnimationFrame(tick);
    }

    requestAnimationFrame(tick);
  }

  /**
   * container 안의 [data-count] 숫자가 화면에 보이면 카운트업을 시작합니다.
   * 목표 숫자는 요소에 적힌 글자입니다. 같은 숫자에 두 번 불려도 한 번만 실행됩니다.
   * @param {ParentNode} container 찾을 범위 (document 또는 요소)
   */
  function startCountUp(container) {
    const numbers = [...container.querySelectorAll('[data-count]:not([data-count-started])')];
    if (numbers.length === 0) return;

    numbers.forEach((el) => {
      el.dataset.countStarted = '';
      el.dataset.count = el.textContent.trim().replace(/,/g, '');

      // 화면낭독기는 올라가는 숫자 대신 최종 숫자를 읽도록
      const finalText = document.createElement('span');
      finalText.className = 'visually-hidden';
      finalText.textContent = el.textContent;
      el.setAttribute('aria-hidden', 'true');
      el.after(finalText);

      el.textContent = formatCount(0, getDecimals(el.dataset.count));
    });

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        animateCount(entry.target);
      });
    }, { threshold: 0.6 });

    numbers.forEach((el) => observer.observe(el));
  }

  // 다른 스크립트(awards-data.js)에서 쓸 수 있게 내보냄
  window.CountUp = { start: startCountUp };

  /**
   * 비율 막대·연혁 선: 화면에 처음 보이면 한 번만 차오르게 합니다.
   * data-grow를 붙이면 CSS가 비워 두고, 보이면 is-grown을 붙여 채웁니다. (JS가 없으면 처음부터 채워진 채)
   * @param {ParentNode} container 찾을 범위 (document 또는 요소)
   */
  function startGrow(container) {
    const items = [...container.querySelectorAll('.stat-card__bar-fill:not([data-grow]), .timeline__item:not([data-grow])')];
    if (items.length === 0) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        entry.target.classList.add('is-grown');
      });
    }, { threshold: 0.6 });

    items.forEach((el) => {
      el.dataset.grow = '';
      observer.observe(el);
    });
  }

  /**
   * HTML 조각 파일을 불러와 자리 요소 안에 넣습니다.
   * @param {string} selector 넣을 자리 (예: '#header')
   * @param {string} url      불러올 파일 (예: 'header.html')
   * @returns {Promise<HTMLElement|null>} 내용을 넣은 자리 요소 (실패하면 null)
   */
  async function loadPartial(selector, url) {
    const target = document.querySelector(selector);
    if (!target) return null;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      target.innerHTML = await response.text();
      return target;
    } catch (error) {
      console.error(`[main.js] ${url} 파일을 불러오지 못했습니다.`, error);
      return null;
    }
  }

  /**
   * 경로에서 페이지 이름만 뽑습니다. (확장자 제외)
   * 'about.html' → 'about',  '/site/awards.html' → 'awards',  '/' → 'index'
   */
  function getPageName(path) {
    const fileName = path.split(/[?#]/)[0].split('/').pop();
    return fileName.replace(/\.html?$/i, '') || 'index';
  }

  /** 현재 페이지와 같은 메뉴에 active 클래스(+ aria-current)를 붙입니다. */
  function setActiveMenu(root) {
    const currentPage = getPageName(window.location.pathname);

    root.querySelectorAll('.site-nav__link').forEach((link) => {
      if (getPageName(link.getAttribute('href')) === currentPage) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      }
    });
  }

  /** 모바일 메뉴 버튼: 열기/닫기 + aria-expanded 갱신 */
  function initMobileMenu(root) {
    const header = root.querySelector('.site-header');
    const toggle = root.querySelector('.site-header__toggle');
    const nav = root.querySelector('.site-nav');
    if (!header || !toggle || !nav) return;

    const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

    const setOpen = (open) => {
      toggle.setAttribute('aria-expanded', String(open));
      header.classList.toggle('site-header--open', open);
    };

    // 버튼을 누르면 열기/닫기
    toggle.addEventListener('click', () => setOpen(!isOpen()));

    // 메뉴 링크를 누르면 닫기
    nav.addEventListener('click', (event) => {
      if (event.target.closest('a')) setOpen(false);
    });

    // Esc 키로 닫고, 초점을 메뉴 버튼으로 돌려주기
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false);
        toggle.focus();
      }
    });

    // 헤더 바깥을 누르면 닫기
    document.addEventListener('click', (event) => {
      if (isOpen() && !header.contains(event.target)) setOpen(false);
    });

    // PC 크기로 넓어지면 닫힌 상태로 되돌리기
    window.matchMedia(MOBILE_QUERY).addEventListener('change', (event) => {
      if (!event.matches) setOpen(false);
    });
  }

  /**
   * 페이지를 조금이라도 내리면 헤더에 site-header--scrolled를 붙입니다.
   * 고정된 헤더가 흰 본문 위로 올라갈 때 진한 배경으로 바꿉니다. (높이·로고 크기는 그대로)
   */
  function initScrolledHeader(root) {
    const header = root.querySelector('.site-header');
    if (!header) return;

    const update = () => header.classList.toggle('site-header--scrolled', window.scrollY > 0);
    window.addEventListener('scroll', update, { passive: true });
    update(); // 새로고침해서 중간 위치로 열렸을 때
  }

  /** 푸터의 [data-current-year] 자리에 현재 연도를 넣습니다. */
  function setCurrentYear(root) {
    const year = String(new Date().getFullYear());
    root.querySelectorAll('[data-current-year]').forEach((el) => {
      el.textContent = year;
    });
  }

  /**
   * data-include-from 페이지에서 data-include-select 부분을 찾아 자리 요소 안에 넣습니다.
   * 실패하면 안내 문구를 보여 줍니다.
   * @param {HTMLElement} target data-include-from, data-include-select 속성이 있는 자리
   */
  async function loadInclude(target) {
    const url = target.dataset.includeFrom;
    const selector = target.dataset.includeSelect;

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
      const source = doc.querySelector(selector);
      if (!source) throw new Error(`${selector} 부분이 없습니다.`);

      target.replaceChildren(document.importNode(source, true));
      startCountUp(target); // 가져온 부분에 숫자 카드가 있으면 카운트업 (index.html의 교육과정 숫자)
      startGrow(target);    // 가져온 부분의 비율 막대·연혁 선 (index.html)
    } catch (error) {
      console.error(`[main.js] ${url}의 ${selector} 부분을 불러오지 못했습니다.`, error);
      target.innerHTML = '<p class="status-box">내용을 불러올 수 없습니다.</p>';
    }
  }

  async function init() {
    if (window.location.protocol === 'file:') {
      console.warn('[main.js] file:// 주소에서는 fetch()가 막혀 헤더·푸터·수상내역이 표시되지 않습니다. 로컬 서버로 열어 주세요. (README.md의 실행 방법 참고)');
    }

    // HTML에 직접 쓴 숫자 카드 카운트업 (curriculum.html)
    startCountUp(document);
    startGrow(document);

    // 다른 페이지에서 가져오는 부분 (헤더·푸터를 기다리지 않고 함께 불러옴)
    document.querySelectorAll('[data-include-from][data-include-select]').forEach(loadInclude);

    const [headerRoot, footerRoot] = await Promise.all([
      loadPartial('#header', 'header.html'),
      loadPartial('#footer', 'footer.html'),
    ]);

    // 헤더를 넣은 "다음에" 메뉴 기능을 연결합니다.
    if (headerRoot) {
      initMobileMenu(headerRoot);
      setActiveMenu(headerRoot);
      initScrolledHeader(headerRoot);
    }
    if (footerRoot) setCurrentYear(footerRoot);
  }

  init();
})();
