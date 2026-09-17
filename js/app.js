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

  // 5. ゾーン多角形描画コントロールのセットアップ
  setupZoneDrawerControls();

  // 6. データ書き出しモーダルのセットアップ
  setupExportModal();
});

// ゾーン多角形ビジュアル描画ツールの動的制御
function setupZoneDrawerControls() {
  const toggleZoneBtn = document.getElementById('toggle-zone-drawer-btn');
  const undoBtn = document.getElementById('zone-undo-btn');
  const clearBtn = document.getElementById('zone-clear-btn');
  const saveBtn = document.getElementById('zone-save-btn');
  const cancelBtn = document.getElementById('zone-cancel-btn');
  const zoneLayerChk = document.getElementById('layer-zone');

  if (toggleZoneBtn) {
    toggleZoneBtn.addEventListener('click', () => {
      MapEngine.toggleZoneDrawingMode();
    });
  }

  if (zoneLayerChk) {
    zoneLayerChk.addEventListener('change', (e) => {
      if (!e.target.checked && MapEngine.isZoneDrawingMode) {
        MapEngine.toggleZoneDrawingMode(false);
      }
    });
  }

  // ゾーン選択切り替え時に名称フィールドを連動補完
  const zoneColorSelect = document.getElementById('zone-draw-color');
  const zoneNameInput = document.getElementById('zone-draw-name');

  zoneColorSelect?.addEventListener('change', () => {
    const opt = zoneColorSelect.options[zoneColorSelect.selectedIndex];
    if (opt && opt.dataset.name) {
      if (!zoneNameInput.value || zoneNameInput.dataset.auto === 'true') {
        zoneNameInput.value = `Zone ${opt.dataset.name}`;
        zoneNameInput.dataset.auto = 'true';
      }
    }
  });

  zoneNameInput?.addEventListener('input', () => {
    delete zoneNameInput.dataset.auto;
  });

  undoBtn?.addEventListener('click', () => MapEngine.undoZonePoint());
  clearBtn?.addEventListener('click', () => MapEngine.clearCurrentZoneDrawing());
  saveBtn?.addEventListener('click', () => MapEngine.saveCurrentZone());
  cancelBtn?.addEventListener('click', () => MapEngine.toggleZoneDrawingMode(false));

  // PowerPoint風 頂点編集バーのイベント
  document.getElementById('vertex-add-btn')?.addEventListener('click', () => MapEngine.addVertexToEditingZone());
  document.getElementById('vertex-del-btn')?.addEventListener('click', () => MapEngine.deleteSelectedVertex());
  document.getElementById('vertex-save-btn')?.addEventListener('click', () => MapEngine.saveEditingZoneVertices());
  document.getElementById('vertex-cancel-btn')?.addEventListener('click', () => MapEngine.exitVertexEditingMode());
}

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
  // spot-type change listener
  document.querySelectorAll('input[name="spot-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isRoom = e.target.value === 'room';
      const roomSizeRow = document.querySelector('.room-size-row');
      const roomDeptGroup = document.querySelector('.room-dept-group');
      if (roomSizeRow) roomSizeRow.style.display = isRoom ? 'grid' : 'none';
      if (roomDeptGroup) roomDeptGroup.style.display = isRoom ? 'block' : 'none';
    });
  });
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

    // 編集モード起動時：既存のレイヤー状態を維持（どちらも非表示の場合のみデフォルト設定）
    if (MapEngine.isEditorMode) {
      const roomChk = document.getElementById('layer-room');
      const acpChk = document.getElementById('layer-acp');
      if (!roomChk?.checked && !acpChk?.checked) {
        if (acpChk) acpChk.checked = true;
      }
    }

    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = MapEngine.isEditorMode
        ? '<div style="color:#f59e0b; font-weight:bold;">✏️ ピン移動・編集モード有効: マップ上のドットを掴んで好きな場所へドラッグ移動、またはクリックで名称編集ができます！</div>'
        : '<div style="color:var(--text-secondary);">💡 編集モードを終了しました。</div>';
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
    
    const nameEnEl = document.getElementById('form-name-en');
    const nameEn = nameEnEl ? nameEnEl.value.trim() : (code || name);
    
    const deptEl = document.getElementById('form-dept');
    const dept = deptEl ? deptEl.value : 'ALL';
    
    const floor = document.getElementById('form-floor').value;
    const x = parseFloat(document.getElementById('form-x').value);
    const y = parseFloat(document.getElementById('form-y').value);

    const wEl = document.getElementById('form-w');
    const hEl = document.getElementById('form-h');
    const w = wEl ? parseFloat(wEl.value) || 5.0 : 5.0;
    const h = hEl ? parseFloat(hEl.value) || 3.5 : 3.5;

    const acpSelect = document.getElementById('form-acp-select');
    const acpInput = document.getElementById('form-acp');
    const acp = (acpSelect && acpSelect.value === 'custom') ? acpInput.value.trim() : (acpSelect ? acpSelect.value : '');

    const pdfUrl = document.getElementById('form-pdf').value.trim();
    const desc = document.getElementById('form-desc').value.trim();

    if (spotId) {
      // 既存データの更新
      let found = false;
      const roomIdx = VENUE_DATA.rooms.findIndex(r => r.id === spotId);
      if (roomIdx !== -1) {
        VENUE_DATA.rooms[roomIdx] = {
          ...VENUE_DATA.rooms[roomIdx],
          name, code, nameEn, dept, floor, x, y, w, h, acp, pdfUrl, desc
        };
        found = true;
      }
      const acpIdx = VENUE_DATA.acps.findIndex(a => a.id === spotId);
      if (acpIdx !== -1) {
        VENUE_DATA.acps[acpIdx] = {
          ...VENUE_DATA.acps[acpIdx],
          name, code, floor, x, y, passLevel: acp, pdfUrl, desc
        };
        found = true;
      }
    } else {
      // 新規作成
      const newId = type === 'room' ? ('RM-USER-' + Date.now().toString().slice(-4)) : ('ACP-USER-' + Date.now().toString().slice(-4));
      if (type === 'room') {
        VENUE_DATA.rooms.push({
          id: newId,
          name: name,
          code: code,
          nameEn: nameEn,
          dept: dept,
          floor: floor,
          x: x,
          y: y,
          w: w,
          h: h,
          acp: acp,
          pdfUrl: pdfUrl,
          desc: desc
        });
      } else {
        VENUE_DATA.acps.push({
          id: newId,
          code: code,
          name: name,
          floor: floor,
          x: x,
          y: y,
          passLevel: acp,
          pdfUrl: pdfUrl,
          desc: desc
        });
      }
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
  const roomSizeRow = document.querySelector('.room-size-row');
  const roomDeptGroup = document.querySelector('.room-dept-group');

  if (!modal) return;

  if (spotItem) {
    // 既存データの編集
    const isAcp = VENUE_DATA.acps.some(a => a.id === spotItem.id);
    title.textContent = isAcp ? `🛡️ ACP「${spotItem.name || spotItem.code}」の編集` : `📍 部屋「${spotItem.name}」の編集`;
    idInput.value = spotItem.id;
    
    // 種別ラジオの自動設定
    const typeRadio = document.querySelector(`input[name="spot-type"][value="${isAcp ? 'acp' : 'room'}"]`);
    if (typeRadio) typeRadio.checked = true;

    document.getElementById('form-name').value = spotItem.name || '';
    document.getElementById('form-code').value = spotItem.code || '';
    
    const nameEnEl = document.getElementById('form-name-en');
    if (nameEnEl) nameEnEl.value = spotItem.nameEn || '';
    
    const deptEl = document.getElementById('form-dept');
    if (deptEl) deptEl.value = spotItem.dept || 'ALL';
    document.getElementById('form-floor').value = spotItem.floor || '1f';
    document.getElementById('form-x').value = spotItem.x;
    document.getElementById('form-y').value = spotItem.y;

    const wEl = document.getElementById('form-w');
    if (wEl) wEl.value = spotItem.w !== undefined ? spotItem.w : 5.0;
    const hEl = document.getElementById('form-h');
    if (hEl) hEl.value = spotItem.h !== undefined ? spotItem.h : 3.5;

    // 表示切替
    if (roomSizeRow) roomSizeRow.style.display = isAcp ? 'none' : 'grid';
    if (roomDeptGroup) roomDeptGroup.style.display = isAcp ? 'none' : 'block';

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
    title.textContent = `📍 新しい部屋・ACPの追加`;
    idInput.value = '';
    document.getElementById('spot-form').reset();
    if (floor) document.getElementById('form-floor').value = floor;
    if (x !== undefined) document.getElementById('form-x').value = typeof x === 'number' ? x.toFixed(1) : x;
    if (y !== undefined) document.getElementById('form-y').value = typeof y === 'number' ? y.toFixed(1) : y;
    
    const wEl = document.getElementById('form-w');
    if (wEl) wEl.value = '5.0';
    const hEl = document.getElementById('form-h');
    if (hEl) hEl.value = '3.5';

    if (deleteBtn) deleteBtn.style.display = 'none';
    if (roomSizeRow) roomSizeRow.style.display = 'grid';
    if (roomDeptGroup) roomDeptGroup.style.display = 'block';
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
