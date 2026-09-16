/**
 * オフライン会場マップ - アプリケーション本体 (App)
 * イベントバインディング、ブラウザ内編集モーダル、データ保存処理統括
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. マップエンジンの初期化
  MapEngine.init();

  // 2. 検索バーとプルダウンの動的構築
  setupSearchAndFilters();

  // 3. テーマ切替 (ダーク/ライト)
  const themeBtn = document.getElementById('toggle-theme-btn');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      document.body.classList.toggle('light-theme');
      themeBtn.textContent = document.body.classList.contains('light-theme') ? '🌙 ダーク' : '☀️ ライト';
    });
  }

  // 4. ピン編集モーダルのセットアップ
  setupEditorModal();

  // 5. データ書き出しモーダルのセットアップ
  setupExportModal();
});

// 検索と部署フィルターの動的制御
function setupSearchAndFilters() {
  const searchInput = document.getElementById('search-input');
  const deptSelect = document.getElementById('dept-select');
  const datalist = document.getElementById('search-suggestions');

  if (!searchInput || !deptSelect) return;

  // 部署プルダウンの動的登録
  deptSelect.innerHTML = VENUE_DATA.departments.map(d => `<option value="${d.code}">${d.name}</option>`).join('');
  const formDept = document.getElementById('form-dept');
  if (formDept) {
    formDept.innerHTML = VENUE_DATA.departments.filter(d => d.code !== 'ALL').map(d => `<option value="${d.code}">${d.name}</option>`).join('');
  }

  // 検索サジェストリストの登録
  if (datalist) {
    const allItems = [...VENUE_DATA.rooms, ...VENUE_DATA.acps];
    datalist.innerHTML = allItems.map(item => `<option value="${item.name}">${item.code} - ${item.nameEn || ''}</option>`).join('');
  }

  // リアルタイム検索フィルター
  const applyFilter = () => {
    const query = searchInput.value.toLowerCase().trim();
    const dept = deptSelect.value;

    document.querySelectorAll('.room-pin').forEach(pin => {
      const room = VENUE_DATA.rooms.find(r => r.id === pin.dataset.id);
      if (!room) return;

      const matchesQuery = !query || room.name.toLowerCase().includes(query) || room.code.toLowerCase().includes(query) || room.nameEn.toLowerCase().includes(query);
      const matchesDept = (dept === 'ALL' || room.dept === dept);

      pin.style.display = (matchesQuery && matchesDept) ? 'block' : 'none';

      if (query && (room.name.toLowerCase() === query || room.code.toLowerCase() === query)) {
        MapEngine.focusPin(room.id);
      }
    });
  };

  searchInput.addEventListener('input', applyFilter);
  deptSelect.addEventListener('change', applyFilter);
}

// ブラウザ内ピン編集モーダルの制御
function setupEditorModal() {
  const editorModal = document.getElementById('spot-editor-modal');
  const toggleEditorBtn = document.getElementById('toggle-editor-btn');
  const closeBtn = document.getElementById('modal-close-btn');
  const cancelBtn = document.getElementById('form-cancel-btn');
  const deleteBtn = document.getElementById('form-delete-btn');
  const spotForm = document.getElementById('spot-form');

  if (!editorModal || !toggleEditorBtn || !spotForm) return;

  // モード切替ボタン
  toggleEditorBtn.addEventListener('click', () => {
    MapEngine.isEditorMode = !MapEngine.isEditorMode;
    document.body.classList.toggle('editor-active', MapEngine.isEditorMode);
    toggleEditorBtn.style.background = MapEngine.isEditorMode ? '#ef4444' : '#f59e0b';
    toggleEditorBtn.style.color = '#fff';
    toggleEditorBtn.textContent = MapEngine.isEditorMode ? '✕ 編集を終了' : '✏️ ピン追加・編集';

    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = MapEngine.isEditorMode
        ? '<div style="color:#f59e0b; font-weight:bold;">✏️ ピン追加モード有効: マップ上の好きな場所をクリックすると、新しい諸室・ACPを画面上で直接追加できます！</div>'
        : '<div style="color:var(--text-secondary);">💡 ピン追加モードを終了しました。</div>';
    }
  });

  const closeModal = () => editorModal.classList.remove('open');
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);

  // ACP通行レベル選択プルダウンとカスタム入力の連動
  const acpSelect = document.getElementById('form-acp-select');
  const acpInput = document.getElementById('form-acp');

  acpSelect?.addEventListener('change', () => {
    if (acpSelect.value === 'custom') {
      acpInput.style.display = 'block';
      acpInput.value = '';
      acpInput.focus();
    } else {
      acpInput.style.display = 'none';
      acpInput.value = acpSelect.value;
    }
  });

  // フォーム送信（新規追加・更新）
  spotForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const spotId = document.getElementById('edit-spot-id').value;
    const type = document.querySelector('input[name="spot-type"]:checked').value;
    const name = document.getElementById('form-name').value.trim();
    const code = document.getElementById('form-code').value.trim() || name;
    const nameEn = document.getElementById('form-name-en').value.trim() || code;
    const dept = document.getElementById('form-dept').value;
    const floor = document.getElementById('form-floor').value;
    const x = parseFloat(document.getElementById('form-x').value);
    const y = parseFloat(document.getElementById('form-y').value);

    const acpSelVal = acpSelect ? acpSelect.value : '';
    const acpInpVal = acpInput ? acpInput.value.trim() : '';
    const acp = (acpSelVal === 'custom' ? acpInpVal : acpSelVal) || 'Level 6 (大会運営・スタッフエリア)';

    const pdfUrl = document.getElementById('form-pdf').value.trim();
    const desc = document.getElementById('form-desc').value.trim();

    // 既存IDがある場合は一度両リストから除外（カテゴリ変更・更新のクリーン化）
    if (spotId) {
      VENUE_DATA.rooms = VENUE_DATA.rooms.filter(r => r.id !== spotId);
      VENUE_DATA.acps = VENUE_DATA.acps.filter(a => a.id !== spotId);
    }

    if (type === 'room') {
      VENUE_DATA.rooms.push({
        id: spotId || `RM-USER-${Date.now()}`,
        code: code,
        name: name,
        nameEn: nameEn,
        dept: dept,
        floor: floor,
        x: x,
        y: y,
        acp: acp,
        pdfUrl: pdfUrl,
        desc: desc
      });
    } else {
      VENUE_DATA.acps.push({
        id: spotId || `ACP-USER-${Date.now()}`,
        code: code,
        name: name,
        floor: floor,
        x: x,
        y: y,
        passLevel: acp || 'Level A (標準パス)',
        pdfUrl: pdfUrl,
        desc: desc
      });
    }

    // 自動保存＆マップ更新
    DataStorage.save();
    MapEngine.renderAllFloors();
    setupSearchAndFilters();
    closeModal();

    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = `<div style="color:#34c759; font-weight:bold;">✅ 「${name}」をブラウザ内に保存・反映しました！</div>`;
    }
  });

  // 削除ボタン
  deleteBtn?.addEventListener('click', () => {
    const spotId = document.getElementById('edit-spot-id').value;
    if (!spotId) return;

    if (confirm('このピンを削除しますか？')) {
      VENUE_DATA.rooms = VENUE_DATA.rooms.filter(r => r.id !== spotId);
      VENUE_DATA.acps = VENUE_DATA.acps.filter(a => a.id !== spotId);

      DataStorage.save();
      MapEngine.renderAllFloors();
      setupSearchAndFilters();
      closeModal();
    }
  });
}

// 編集モーダルを開くグローバルヘルパー
window.openSpotEditorById = function(spotId) {
  const spotItem = VENUE_DATA.rooms.find(r => r.id === spotId) || VENUE_DATA.acps.find(a => a.id === spotId);
  if (spotItem) {
    window.openSpotEditor({ spotItem: spotItem });
  }
};

window.openSpotEditor = function({ spotItem, x, y, floor }) {
  const modal = document.getElementById('spot-editor-modal');
  const title = document.getElementById('modal-title');
  const idInput = document.getElementById('edit-spot-id');
  const deleteBtn = document.getElementById('form-delete-btn');

  if (!modal) return;

  if (spotItem) {
    // 既存データの編集
    const isAcp = VENUE_DATA.acps.some(a => a.id === spotItem.id);
    title.textContent = `✏️ 「${spotItem.name}」の編集`;
    idInput.value = spotItem.id;
    
    // 種別ラジオの自動設定
    const typeRadio = document.querySelector(`input[name="spot-type"][value="${isAcp ? 'acp' : 'room'}"]`);
    if (typeRadio) typeRadio.checked = true;

    document.getElementById('form-name').value = spotItem.name || '';
    document.getElementById('form-code').value = spotItem.code || '';
    document.getElementById('form-name-en').value = spotItem.nameEn || '';
    document.getElementById('form-dept').value = spotItem.dept || 'ADM';
    document.getElementById('form-floor').value = spotItem.floor || '1f';
    document.getElementById('form-x').value = spotItem.x;
    document.getElementById('form-y').value = spotItem.y;

    const acpVal = spotItem.acp || spotItem.passLevel || '';
    const acpSelect = document.getElementById('form-acp-select');
    const acpInput = document.getElementById('form-acp');

    if (acpSelect) {
      const matchOpt = Array.from(acpSelect.options).find(opt => opt.value === acpVal);
      if (matchOpt) {
        acpSelect.value = acpVal;
        if (acpInput) acpInput.style.display = 'none';
      } else {
        acpSelect.value = 'custom';
        if (acpInput) {
          acpInput.style.display = 'block';
          acpInput.value = acpVal;
        }
      }
    }

    document.getElementById('form-pdf').value = spotItem.pdfUrl || '';
    document.getElementById('form-desc').value = spotItem.desc || '';
    if (deleteBtn) deleteBtn.style.display = 'block';
  } else {
    // 新規追加
    title.textContent = `📍 新しい諸室・ACPの追加`;
    idInput.value = '';
    document.getElementById('spot-form').reset();
    if (floor) document.getElementById('form-floor').value = floor;
    if (x !== undefined) document.getElementById('form-x').value = x.toFixed(1);
    if (y !== undefined) document.getElementById('form-y').value = y.toFixed(1);
    if (deleteBtn) deleteBtn.style.display = 'none';
  }

  modal.classList.add('open');
};

// データ保存・書き出しモーダルの制御
function setupExportModal() {
  const exportModal = document.getElementById('export-modal');
  const exportBtn = document.getElementById('export-data-btn');
  const closeBtn = document.getElementById('export-close-btn');
  const downloadBtn = document.getElementById('download-datajs-btn');
  const resetBtn = document.getElementById('reset-default-data-btn');

  if (!exportModal || !exportBtn) return;

  exportBtn.addEventListener('click', () => exportModal.classList.add('open'));
  closeBtn?.addEventListener('click', () => exportModal.classList.remove('open'));

  downloadBtn?.addEventListener('click', () => {
    DataStorage.exportDataJs();
  });

  resetBtn?.addEventListener('click', () => {
    if (confirm('ブラウザに保存された編集データを消去し、初期状態に戻しますか？')) {
      DataStorage.reset();
    }
  });
}
