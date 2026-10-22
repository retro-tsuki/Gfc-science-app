const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const CACHE_KEY = 'science_club_events_cache_v3'; 
const CHAT_CACHE_KEY = 'science_club_chat_cache_v1';

localStorage.removeItem('science_club_events_cache');

function showLoading(msg = '処理中…') {
  loadingText.textContent = msg;
  loadingOverlay.style.display = 'flex';
}

function hideLoading() {
  loadingOverlay.style.display = 'none';
}

const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbzVQBAkt6k3a0WJq7joAvtp0mFMuHZDjmgaRxmBS_gvRH5dTR-wc6TF_u-2-BBvt6Lpgw/exec";

async function fetchGasApi(options = {}, maxRetries = 2) {
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      attempt++;
      const url = options.url || GAS_WEB_APP_URL;
      const method = options.method || 'GET';
      
      let fetchOptions = {
        method: method,
        redirect: 'follow'
      };

      if (method === 'POST') {
        fetchOptions.body = JSON.stringify(options.body || {});
        fetchOptions.headers = { 'Content-Type': 'text/plain;charset=utf-8' };
      }

      const response = await fetch(url, fetchOptions);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const json = await response.json();
      
      if (json && json.error) {
        alert("エラーが発生しました:\n" + json.error);
        throw new Error(json.error);
      }

      return json;

    } catch (err) {
      console.warn(`通信試行 (${attempt}/${maxRetries}):`, err.message);

      if (attempt < maxRetries) {
        await new Promise(res => setTimeout(res, 1000));
      } else {
        hideLoading();
        throw err;
      }
    }
  }
}

function formatEvents(data) {
  if (!Array.isArray(data)) return [];
  return data.map(event => {
    let isAllDay = true;
    if (event.all_day !== undefined) {
      isAllDay = event.all_day;
    } else if (event.allDay !== undefined) {
      isAllDay = event.allDay;
    } else {
      isAllDay = !event.start || !event.start.includes('T');
    }

    return {
      id: event.id,
      title: event.title,
      start: event.start,
      end: event.end || null,
      allDay: isAllDay
    };
  });
}

// 📌 README.md の読み込み
async function loadReadmeVersion() {
  const versionContentEl = document.getElementById('versionContent');
  try {
    const readmePath = ['.', 'README.md'].join('/');
    const res = await fetch(`${readmePath}?v=${Date.now()}`);
    if (!res.ok) throw new Error("README.mdが見つかりませんでした");
    
    const markdownText = await res.text();
    const startTag = '<!-- AUTO-UPDATE:START -->';
    const endTag = '<!-- AUTO-UPDATE:END -->';
    
    const startIndex = markdownText.indexOf(startTag);
    const endIndex = markdownText.indexOf(endTag);
    
    if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
      const rawContent = markdownText.substring(startIndex + startTag.length, endIndex).trim();
      const lines = rawContent.split('\n').map(line => line.trim()).filter(line => line.startsWith('-'));
      
      if (lines.length > 0) {
        let htmlList = '<ul>';
        lines.forEach(line => {
          const itemText = line.replace(/^-/, '').trim();
          htmlList += `<li>${itemText}</li>`;
        });
        htmlList += '</ul>';
        versionContentEl.innerHTML = htmlList;
      } else {
        versionContentEl.textContent = rawContent;
      }
    } else {
      versionContentEl.textContent = "更新履歴が見つかりませんでした。";
    }
  } catch (e) {
    console.warn("バージョン情報の読み込みに失敗:", e);
    versionContentEl.textContent = "バージョン情報の取得に失敗しました。";
  }
}

// ℹ️ info.md の読み込み＆ --- 区切りセクション分け描画
async function loadInfoContent() {
  const infoContainer = document.getElementById('infoContentContainer');
  try {
    const res = await fetch(`./info.md?v=${Date.now()}`);
    if (!res.ok) throw new Error("info.mdが見つかりませんでした");
    const text = await res.text();
    
    const sections = text.split(/---+/);
    let html = '';
    
    sections.forEach(sec => {
      const trimmed = sec.trim();
      if (!trimmed) return;
      
      html += '<div class="info-section">';
      const lines = trimmed.split('\n');
      lines.forEach(line => {
        const l = line.trim();
        if (l.startsWith('# ')) {
          html += `<h3 style="margin-top:0; color:#007bff;">${l.replace('# ', '')}</h3>`;
        } else if (l.startsWith('## ')) {
          html += `<h4 style="margin-top:10px; color:#333;">${l.replace('## ', '')}</h4>`;
        } else if (l.startsWith('- ')) {
          html += `<ul style="margin: 5px 0; padding-left: 20px;"><li>${l.replace('- ', '')}</li></ul>`;
        } else if (l !== '') {
          html += `<p style="margin: 5px 0;">${l}</p>`;
        }
      });
      html += '</div>';
    });
    
    infoContainer.innerHTML = html || '<div style="color:#666;">お知らせはありません。</div>';
  } catch (err) {
    console.warn("info.md読み込みエラー:", err);
    infoContainer.innerHTML = '<div style="color:#666;">お知らせ情報を読み込めませんでした。</div>';
  }
}

// 🚨 importance.txt の読み込み＆重要なお知らせ表示処理（独立・低速弾幕対応版）
async function loadImportance() {
  const importanceCard = document.getElementById('importanceCard');
  if (!importanceCard) return;

  try {
    const res = await fetch(`./importance.txt?v=${Date.now()}`);
    if (!res.ok) {
      importanceCard.style.display = 'none';
      return;
    }

    const text = await res.text();
    const trimmedText = text.trim();

    if (!trimmedText) {
      importanceCard.style.display = 'none';
      return;
    }

    let message = trimmedText;
    let isRed = false;

    if (message.startsWith('!')) {
      isRed = true;
      message = message.substring(1).trim();
    }

    if (!message) {
      importanceCard.style.display = 'none';
      return;
    }

    const safeMessage = escapeHtml(message);

    importanceCard.className = 'importance-card ' + (isRed ? 'importance-red' : 'importance-yellow');
    importanceCard.innerHTML = `
      <span>⚠️</span>
      <div class="importance-scroll-wrapper">
        <div class="importance-scroll-content">
          <span class="importance-text-block">${safeMessage}</span>
        </div>
      </div>
    `;
    importanceCard.style.display = 'flex';

    requestAnimationFrame(() => {
      const wrapper = importanceCard.querySelector('.importance-scroll-wrapper');
      const content = importanceCard.querySelector('.importance-scroll-content');
      const firstBlock = importanceCard.querySelector('.importance-text-block');

      if (wrapper && content && firstBlock) {
        if (firstBlock.offsetWidth > wrapper.clientWidth + 1) {
          firstBlock.innerHTML = safeMessage + '　　';

          let span2 = document.createElement('span');
          span2.className = 'importance-text-block';
          span2.innerHTML = safeMessage + '　　';
          content.appendChild(span2);

          importanceCard.classList.add('has-overflow');
        } else {
          importanceCard.classList.remove('has-overflow');
        }
      }
    });

  } catch (err) {
    console.warn("importance.txt読み込みエラー:", err);
    importanceCard.style.display = 'none';
  }
}

function escapeHtml(str) {
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// ☀️ 天気予報API連携処理（気象庁予報）
let jmaForecastCache = null;

async function loadWeatherData() {
  const forecastContainer = document.getElementById('weatherForecastContainer');
  const citySelect = document.getElementById('weatherCitySelect');

  try {
    if (!jmaForecastCache) {
      const res = await fetch('https://www.jma.go.jp/bosai/forecast/data/forecast/030000.json');
      if (!res.ok) throw new Error("天気予報の取得に失敗しました");
      jmaForecastCache = await res.json();
    }

    renderWeatherForecast(citySelect.value);

  } catch (err) {
    console.warn("天気予報取得失敗:", err);
    forecastContainer.innerHTML = '<div style="color: #dc3545;">天気予報データの取得に失敗しました。</div>';
  }
}

function renderWeatherForecast(selectedCityCode) {
  const forecastContainer = document.getElementById('weatherForecastContainer');
  if (!jmaForecastCache || !jmaForecastCache[0]) return;

  try {
    const timeSeries = jmaForecastCache[0].timeSeries;
    const weatherTimeSeries = timeSeries[0]; 
    const timeDefines = weatherTimeSeries.timeDefines;
    const areas = weatherTimeSeries.areas;

    let targetArea = areas.find(a => a.area.code === selectedCityCode) || areas[0];

    let html = '';
    for (let i = 0; i < timeDefines.length; i++) {
      const dateObj = new Date(timeDefines[i]);
      const dateStr = `${dateObj.getMonth() + 1}月${dateObj.getDate()}日`;
      const rawWeather = targetArea.weathers[i] || '情報なし';
      
      const formattedWeather = rawWeather.replace(/([雨晴曇雷])\s*([所由時])/g, '$1　$2').replace(/\s+/g, '　');

      html += `
        <div class="forecast-item">
          <div class="forecast-date">${dateStr}</div>
          <div class="forecast-text">${formattedWeather}</div>
        </div>
      `;
    }
    forecastContainer.innerHTML = html;
  } catch (e) {
    console.warn("天気予報レンダリングエラー:", e);
    forecastContainer.innerHTML = '<div style="color: #666;">予報データの解析に失敗しました。</div>';
  }
}

function formatTimeString(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

document.addEventListener('DOMContentLoaded', function() {
  loadReadmeVersion();
  loadInfoContent();
  loadImportance();

  // --- 🧭 タブ切り替えロジック ---
  const navTabs = document.querySelectorAll('.nav-tab');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-target');

      navTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      tabPanes.forEach(pane => {
        pane.classList.remove('active');
        if (pane.id === targetId) {
          pane.classList.add('active');
        }
      });

      if (targetId === 'weather-pane') {
        loadWeatherData();
      }

      if (targetId === 'home-pane' && window.calendar) {
        setTimeout(() => window.calendar.updateSize(), 50);
      }
    });
  });

  const weatherCitySelect = document.getElementById('weatherCitySelect');
  if (weatherCitySelect) {
    weatherCitySelect.addEventListener('change', (e) => {
      renderWeatherForecast(e.target.value);
    });
  }

  // --- チャット機能関連のロジック ---
  const openChatBtn = document.getElementById('openChatBtn');
  const closeChatBtn = document.getElementById('closeChatBtn');
  const chatModalOverlay = document.getElementById('chatModalOverlay');
  const chatMessagesArea = document.getElementById('chatMessagesArea');
  const chatNameInput = document.getElementById('chatNameInput');
  const chatTextInput = document.getElementById('chatTextInput');
  const chatSendBtn = document.getElementById('chatSendBtn');

  let chatInterval = null;

  const savedName = localStorage.getItem('science_club_chat_name');
  if (savedName) {
    chatNameInput.value = savedName;
  }

  async function loadChatMessages(scrollToBottom = false) {
    const cachedChat = localStorage.getItem(CHAT_CACHE_KEY);
    if (cachedChat) {
      try {
        const parsed = JSON.parse(cachedChat);
        const validMessages = parsed.filter(msg => msg && msg.message && typeof msg.message === 'string' && msg.message.trim() !== '');
        renderChatMessages(validMessages, scrollToBottom);
      } catch (e) {
        console.warn("チャットキャッシュパースエラー:", e);
      }
    }

    try {
      const rawData = await fetchGasApi({ url: `${GAS_WEB_APP_URL}?action=getChat` });
      if (Array.isArray(rawData)) {
        const messages = rawData.filter(msg => msg && msg.message && typeof msg.message === 'string' && msg.message.trim() !== '');
        localStorage.setItem(CHAT_CACHE_KEY, JSON.stringify(messages));
        renderChatMessages(messages, scrollToBottom);
      }
    } catch (err) {
      console.warn("チャット読み込み失敗:", err);
    }
  }

  function renderChatMessages(messages, scrollToBottom) {
    const currentName = chatNameInput.value.trim();
    chatMessagesArea.innerHTML = '';

    if (messages.length === 0) {
      chatMessagesArea.innerHTML = '<div style="text-align: center; color: #888; margin-top: 20px;">まだメッセージはありません。最初のメッセージを送ろう！</div>';
      return;
    }

    messages.forEach(msg => {
      const item = document.createElement('div');
      item.className = 'chat-message-item';
      if (currentName && msg.name === currentName) {
        item.classList.add('my-message');
      }

      const header = document.createElement('div');
      header.className = 'chat-msg-header';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'chat-msg-name';
      nameSpan.textContent = msg.name || '名無し';

      const timeSpan = document.createElement('span');
      if (msg.created_at) {
        const d = new Date(msg.created_at);
        timeSpan.textContent = `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
      }

      header.appendChild(nameSpan);
      header.appendChild(timeSpan);

      const body = document.createElement('div');
      body.className = 'chat-msg-body';
      body.textContent = msg.message;

      item.appendChild(header);
      item.appendChild(body);
      chatMessagesArea.appendChild(item);
    });

    if (scrollToBottom) {
      chatMessagesArea.scrollTop = chatMessagesArea.scrollHeight;
    }
  }

  openChatBtn.addEventListener('click', () => {
    chatModalOverlay.style.display = 'flex';
    loadChatMessages(true);
    if (!chatInterval) {
      chatInterval = setInterval(() => loadChatMessages(false), 5000);
    }
  });

  function closeChatModal() {
    chatModalOverlay.style.display = 'none';
    if (chatInterval) {
      clearInterval(chatInterval);
      chatInterval = null;
    }
  }

  closeChatBtn.addEventListener('click', closeChatModal);
  chatModalOverlay.addEventListener('click', (e) => {
    if (e.target === chatModalOverlay) closeChatModal();
  });

  async function sendChatMessage() {
    const name = chatNameInput.value.trim() || '名無し';
    const message = chatTextInput.value.trim();

    if (!message) return;

    localStorage.setItem('science_club_chat_name', name);
    chatTextInput.disabled = true;
    chatSendBtn.disabled = true;

    try {
      await fetchGasApi({
        method: 'POST',
        body: {
          action: 'insertChat',
          name: name,
          message: message
        }
      });

      chatTextInput.value = '';
      await loadChatMessages(true);
    } catch (err) {
      alert('メッセージの送信に失敗しました');
    } finally {
      chatTextInput.disabled = false;
      chatSendBtn.disabled = false;
      chatTextInput.focus();
    }
  }

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatTextInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // --- モーダル関連の処理 ---
  const openHelpBtn = document.getElementById('openHelpBtn');
  const closeHelpBtn = document.getElementById('closeHelpBtn');
  const helpModal = document.getElementById('helpModal');

  const openWeeklyBtn = document.getElementById('openWeeklyBtn');
  const openMonthlyBtn = document.getElementById('openMonthlyBtn');
  const openAnnualBtn = document.getElementById('openAnnualBtn');
  const closeScheduleBtn = document.getElementById('closeScheduleBtn');
  const scheduleModal = document.getElementById('scheduleModal');
  const scheduleTitle = document.getElementById('scheduleTitle');
  const pdfFrame = document.getElementById('pdfFrame');
  const pdfContainer = document.getElementById('pdfContainer');

  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');

  let currentScale = 1.0;

  function updateZoom(newScale) {
    currentScale = Math.max(0.5, Math.min(3.0, newScale));
    pdfFrame.style.width = `${(100 / currentScale)}%`;
    pdfFrame.style.height = `${(100 / currentScale)}%`;
    pdfFrame.style.transform = `scale(${currentScale})`;
    zoomResetBtn.textContent = `${Math.round(currentScale * 100)}%`;
  }

  zoomInBtn.addEventListener('click', () => updateZoom(currentScale + 0.25));
  zoomOutBtn.addEventListener('click', () => updateZoom(currentScale - 0.25));
  zoomResetBtn.addEventListener('click', () => updateZoom(1.0));

  fullscreenBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      if (pdfContainer.requestFullscreen) {
        pdfContainer.requestFullscreen();
      } else if (pdfContainer.webkitRequestFullscreen) {
        pdfContainer.webkitRequestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    }
  });

  document.addEventListener('fullscreenchange', () => {
    updateZoom(1.0);
  });

  openHelpBtn.addEventListener('click', () => helpModal.style.display = 'flex');
  closeHelpBtn.addEventListener('click', () => helpModal.style.display = 'none');
  helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) helpModal.style.display = 'none';
  });

  // 📋 週間行事予定表ボタンの処理
  openWeeklyBtn.addEventListener('click', async () => {
    updateZoom(1.0);
    const pdfUrl = ['.', 'weeklySchedule', 'schedule.pdf'].join('/');
    scheduleTitle.textContent = "📋 週間行事予定表（読み込み中…）";
    pdfFrame.src = pdfUrl;
    scheduleModal.style.display = 'flex';

    try {
      const res = await fetch(pdfUrl, { method: 'HEAD' });
      const lastModified = res.headers.get('Last-Modified');
      if (lastModified) {
        const fileDate = new Date(lastModified);
        const monthNum = fileDate.getMonth() + 1;
        const dayNum = fileDate.getDate();
        scheduleTitle.textContent = `📋 週間行事予定表（${monthNum}月${dayNum}日更新）`;
      } else {
        scheduleTitle.textContent = "📋 週間行事予定表";
      }
    } catch (e) {
      console.warn("最終更新日の取得に失敗しました:", e);
      scheduleTitle.textContent = "📋 週間行事予定表";
    }
  });

  // 📄 月間行事予定表ボタンの処理
  openMonthlyBtn.addEventListener('click', async () => {
    updateZoom(1.0);
    const pdfUrl = ['.', 'monthlySchedule', 'schedule.pdf'].join('/');
    scheduleTitle.textContent = "📄 月間行事予定表（読み込み中…）";
    pdfFrame.src = pdfUrl;
    scheduleModal.style.display = 'flex';

    try {
      const res = await fetch(pdfUrl, { method: 'HEAD' });
      const lastModified = res.headers.get('Last-Modified');
      if (lastModified) {
        const fileDate = new Date(lastModified);
        const monthNum = fileDate.getMonth() + 1;
        scheduleTitle.textContent = `📄 月間行事予定表（${monthNum}月）`;
      } else {
        scheduleTitle.textContent = "📄 月間行事予定表";
      }
    } catch (e) {
      console.warn("最終更新日の取得に失敗しました:", e);
      scheduleTitle.textContent = "📄 月間行事予定表";
    }
  });

  // 📅 年間行事予定表ボタンの処理
  openAnnualBtn.addEventListener('click', async () => {
    updateZoom(1.0);
    const pdfUrl = ['.', 'annualSchedule', 'schedule.pdf'].join('/');
    scheduleTitle.textContent = "📅 年間行事予定表（読み込み中…）";
    pdfFrame.src = pdfUrl;
    scheduleModal.style.display = 'flex';

    try {
      const res = await fetch(pdfUrl, { method: 'HEAD' });
      const lastModified = res.headers.get('Last-Modified');
      if (lastModified) {
        const fileDate = new Date(lastModified);
        const yearNum = fileDate.getFullYear();
        scheduleTitle.textContent = `📅 年間行事予定表（${yearNum}年）`;
      } else {
        scheduleTitle.textContent = "📅 年間行事予定表";
      }
    } catch (e) {
      console.warn("最終更新日の取得に失敗しました:", e);
      scheduleTitle.textContent = "📅 年間行事予定表";
    }
  });

  closeScheduleBtn.addEventListener('click', () => {
    scheduleModal.style.display = 'none';
    pdfFrame.src = "";
    if (document.fullscreenElement) document.exitFullscreen();
  });

  scheduleModal.addEventListener('click', (e) => {
    if (e.target === scheduleModal) {
      scheduleModal.style.display = 'none';
      pdfFrame.src = "";
      if (document.fullscreenElement) document.exitFullscreen();
    }
  });

  // --- フォーム関連の処理 ---
  const allDayCheck = document.getElementById('allDayCheck');
  const eventStartTime = document.getElementById('eventStartTime');
  const eventEndTime = document.getElementById('eventEndTime');
  const eventStartDate = document.getElementById('eventStartDate');
  const eventEndDate = document.getElementById('eventEndDate');

  allDayCheck.addEventListener('change', function() {
    const isAllDay = this.checked;
    eventStartTime.disabled = isAllDay;
    eventEndTime.disabled = isAllDay;
    if (isAllDay) {
      eventStartTime.value = '';
      eventEndTime.value = '';
    }
  });

  eventStartDate.addEventListener('change', function() {
    if (!eventEndDate.value) {
      eventEndDate.value = this.value;
    }
  });

  var calendarEl = document.getElementById('calendar');
  var eventTitleInput = document.getElementById('eventTitle');
  var addBtn = document.getElementById('addBtn');

  var calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    locale: 'ja',
    displayEventTime: true,
    displayEventEnd: true,
    
    headerToolbar: {
      left: 'prev,next',
      center: 'title',
      right: 'today'
    },

    eventContent: function(arg) {
      let nodes = [];

      if (!arg.event.allDay) {
        let dot = document.createElement('div');
        dot.className = 'fc-daygrid-event-dot';
        nodes.push(dot);
      }

      let rawTitle = arg.event.title || '';
      let displayTitle = rawTitle.startsWith('*') ? rawTitle.slice(1) : rawTitle;

      let timeText = '';
      if (!arg.event.allDay && arg.event.start) {
        const startStr = formatTimeString(arg.event.start);
        const endStr = formatTimeString(arg.event.end);
        if (startStr && endStr) {
          timeText = `${startStr}〜${endStr} `;
        } else if (startStr) {
          timeText = `${startStr} `;
        }
      }

      let baseText = timeText + displayTitle;

      let wrapper = document.createElement('div');
      wrapper.className = 'fc-event-scroll-wrapper';

      let content = document.createElement('div');
      content.className = 'fc-event-scroll-content';

      let span1 = document.createElement('span');
      span1.className = 'fc-event-text-block';
      span1.innerText = baseText;

      content.appendChild(span1);
      wrapper.appendChild(content);
      nodes.push(wrapper);

      return { domNodes: nodes };
    },

    eventDidMount: function(arg) {
      const el = arg.el;
      const rawTitle = arg.event.title || '';

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      const eventTargetDate = arg.event.end ? new Date(arg.event.end) : new Date(arg.event.start);
      if (arg.event.allDay && arg.event.end) {
        eventTargetDate.setTime(eventTargetDate.getTime() - 1);
      }

      if (eventTargetDate < now) {
        el.classList.add('is-past');
      } else if (rawTitle.startsWith('*')) {
        el.classList.add('is-holiday');
      }

      requestAnimationFrame(() => {
        const wrapper = el.querySelector('.fc-event-scroll-wrapper');
        const content = el.querySelector('.fc-event-scroll-content');
        const firstBlock = el.querySelector('.fc-event-text-block');
        
        if (wrapper && firstBlock && content) {
          if (firstBlock.offsetWidth > wrapper.clientWidth + 1) {
            let displayTitle = rawTitle.startsWith('*') ? rawTitle.slice(1) : rawTitle;
            
            let timeText = '';
            if (!arg.event.allDay && arg.event.start) {
              const startStr = formatTimeString(arg.event.start);
              const endStr = formatTimeString(arg.event.end);
              if (startStr && endStr) {
                timeText = `${startStr}〜${endStr} `;
              } else if (startStr) {
                timeText = `${startStr} `;
              }
            }

            let baseText = timeText + displayTitle;

            firstBlock.innerText = baseText + '　　';

            const existingBlocks = content.querySelectorAll('.fc-event-text-block');
            if (existingBlocks.length > 1) {
              existingBlocks[1].remove();
            }

            let span2 = document.createElement('span');
            span2.className = 'fc-event-text-block';
            span2.innerText = baseText + '　　';
            content.appendChild(span2);

            el.classList.add('has-overflow');
          } else {
            el.classList.remove('has-overflow');
            const existingBlocks = content.querySelectorAll('.fc-event-text-block');
            if (existingBlocks.length > 1) {
              existingBlocks[1].remove();
            }
          }
        }
      });
    },

    events: async function(fetchInfo, successCallback, failureCallback) {
      const cachedData = localStorage.getItem(CACHE_KEY);
      if (cachedData) {
        try {
          const parsedCache = JSON.parse(cachedData);
          successCallback(formatEvents(parsedCache));
        } catch (e) {
          console.warn("キャッシュパースエラー:", e);
        }
      }

      try {
        const freshData = await fetchGasApi();
        if (Array.isArray(freshData)) {
          localStorage.setItem(CACHE_KEY, JSON.stringify(freshData));
          
          if (!cachedData) {
            successCallback(formatEvents(freshData));
          }
        }
      } catch (err) {
        if (!cachedData) {
          failureCallback(err);
        }
      }
    },

    eventClick: async function(info) {
      let displayTitle = info.event.title.startsWith('*') ? info.event.title.slice(1) : info.event.title;
      if (confirm('「' + displayTitle + '」を削除しますか？')) {
        showLoading('削除中…');
        try {
          await fetchGasApi({
            method: 'POST',
            body: { action: 'delete', id: info.event.id }
          });

          const cachedData = localStorage.getItem(CACHE_KEY);
          if (cachedData) {
            const parsed = JSON.parse(cachedData).filter(item => String(item.id) !== String(info.event.id));
            localStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
          }

          calendar.refetchEvents();

        } catch (err) {
          alert('削除に失敗しました');
        } finally {
          hideLoading();
        }
      }
    }
  });

  calendar.render();
  window.calendar = calendar;

  addBtn.addEventListener('click', async function() {
    var title = eventTitleInput.value.trim();
    var startDate = eventStartDate.value;
    var endDate = eventEndDate.value || startDate;
    var isAllDay = allDayCheck.checked;
    var startTime = eventStartTime.value;
    var endTime = eventEndTime.value;

    if (!title || !startDate) {
      alert('予定の名前と開始日を入力してください');
      return;
    }

    let startIso = '';
    let endIso = '';

    if (isAllDay) {
      startIso = startDate;
      let endD = new Date(endDate);
      endD.setDate(endD.getDate() + 1);
      endIso = endD.toISOString().split('T')[0];
    } else {
      if (!startTime) {
        alert('開始時間を入力してください');
        return;
      }
      startIso = `${startDate}T${startTime}:00+09:00`;
      if (endTime) {
        endIso = `${endDate}T${endTime}:00+09:00`;
      } else {
        let [sh, sm] = startTime.split(':').map(Number);
        let eh = (sh + 1) % 24;
        let emStr = sm.toString().padStart(2, '0');
        let ehStr = eh.toString().padStart(2, '0');
        endIso = `${endDate}T${ehStr}:${emStr}:00+09:00`;
      }
    }

    const newEventPayload = {
      title: title, 
      start: startIso, 
      end: endIso, 
      all_day: isAllDay
    };

    showLoading('追加中…');
    try {
      const res = await fetchGasApi({
        method: 'POST',
        body: {
          action: 'insert',
          data: [newEventPayload]
        }
      });

      if (res) {
        const insertedItem = Array.isArray(res) ? res[0] : res;
        const createdEvent = {
          id: insertedItem.id || Date.now(),
          title: title,
          start: startIso,
          end: endIso,
          allDay: isAllDay
        };

        const cachedData = localStorage.getItem(CACHE_KEY);
        let currentCache = cachedData ? JSON.parse(cachedData) : [];
        currentCache.push(insertedItem.id ? insertedItem : createdEvent);
        localStorage.setItem(CACHE_KEY, JSON.stringify(currentCache));

        calendar.refetchEvents();

        eventTitleInput.value = '';
        eventStartDate.value = '';
        eventEndDate.value = '';
        eventStartTime.value = '';
        eventEndTime.value = '';
        allDayCheck.checked = true;
        eventStartTime.disabled = true;
        eventEndTime.disabled = true;
      }

    } catch (err) {
      alert('予定の追加に失敗しました');
    } finally {
      hideLoading();
    }
  });
});
