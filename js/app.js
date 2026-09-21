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


  // 6. データ書き出しモーダルのセットアップ
  setupExportModal();

  // ゾーン凡例＆シート凡例（Legend）チップのタップ連動（諸室ハイライト＆詳細表示）
  document.querySelectorAll('.legend-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const zoneKey = chip.dataset.zone;
      const seatKey = chip.dataset.seat;
      const wasActive = chip.classList.contains('active');

      document.querySelectorAll('.legend-chip').forEach(c => c.classList.remove('active'));

      if (!wasActive) {
        chip.classList.add('active');
        let count = 0;

        if (zoneKey) {
          document.querySelectorAll('.room-pin').forEach(pin => {
            const room = VENUE_DATA.rooms.find(r => r.id === pin.dataset.id);
            if (room) {
              const desc = room.desc || '';
              const match = desc.includes('Zone: ' + zoneKey) || desc.includes('Zone: ' + zoneKey + ',') || desc.includes('Zone: ' + zoneKey + '+') || (zoneKey === 'BLUE' && (desc.includes('BLUE') || desc.includes('FOP')));
              pin.style.opacity = match ? '1' : '0.15';
              if (match) count++;
            }
          });

          const panel = document.getElementById('info-panel');
          if (panel) {
            const zoneNames = {
              'WHITE': 'WHITE (薄灰) - 西エントランス・外周 (※濃いグレーは利用しないSpace)',
              'RED': 'RED (赤) - 競技専用・セキュリティエリア',
              '2': 'Zone 2 (薄青) - 選手諸室・ウォーミングアップ・運営',
              'BLUE': 'BLUE (濃青) - メインプール・ダイビング・FOP',
              '4': 'Zone 4 (薄緑) - 報道・プレスエリア',
              '5': 'Zone 5 (濃緑) - 放送・中継・HBエリア',
              '6': 'Zone 6 (紫) - 大会要人・プロトコルエリア'
            };
            panel.innerHTML = `
              <div class="detail-card">
                <div class="detail-header">
                  <div class="detail-title">🗾 ゾーン区分: <b>${zoneNames[zoneKey] || zoneKey}</b></div>
                  <span class="badge" style="background:var(--accent-zone, #af52de); color:#fff; font-weight:800;">該当: ${count}室</span>
                </div>
                <div style="font-size:12px; color:var(--text-secondary); margin-top:4px; line-height:1.4;">
                  マップ上の対象諸室がハイライトされています。凡例をもう一度タップすると通常表示に戻ります。
                </div>
              </div>
            `;
          }
        } else if (seatKey) {
          const seatMeta = {
            'VIP': {
              name: 'Vipシート (Zone 6 連動・VIP/OCA席)',
              color: '#a855f7',
              zone: '6',
              dept: ['OFS', 'CER'],
              desc: 'Zone 6（大会要人・プロトコル）関係者が着席するVIP・OCAファミリー専用席です。'
            },
            'P': {
              name: 'Pシート (Zone 4 連動・Press記者席)',
              color: '#86efac',
              zone: '4',
              dept: ['PRS', 'BRS'],
              desc: 'Zone 4（報道・プレス）関係者のみが着席できる専用記者席（Press席）です。'
            },
            'B': {
              name: 'Bシート (Zone 5 連動・放送中継席)',
              color: '#22c55e',
              zone: '5',
              dept: ['BRS', 'PRS'],
              desc: 'Zone 5（放送・中継・HB）関係者が着席する実況解説コメンタリー専用席です。'
            },
            'A': {
              name: 'Aシート (Zone 2 連動・選手席)',
              color: '#38bdf8',
              zone: '2',
              dept: ['SPT', 'EVS'],
              desc: 'Zone 2（選手控室・諸室）の出場選手およびチーム役員が着席する選手専用席（SDA席）です。'
            }
          };

          const curSeat = seatMeta[seatKey] || { name: seatKey + 'シート', color: '#fbbf24', dept: [], desc: '指定シートエリア' };

          document.querySelectorAll('.room-pin').forEach(pin => {
            const room = VENUE_DATA.rooms.find(r => r.id === pin.dataset.id);
            if (room) {
              const desc = room.desc || '';
              const zoneMatch = curSeat.zone && (desc.includes('Zone: ' + curSeat.zone) || desc.includes('Zone: ' + curSeat.zone + ',') || desc.includes('Zone: ' + curSeat.zone + '+'));
              const deptMatch = curSeat.dept && curSeat.dept.includes(room.dept);
              const nameMatch = (room.name || '').includes(seatKey) || (room.desc || '').includes(seatKey);
              const match = zoneMatch || deptMatch || nameMatch;
              pin.style.opacity = match ? '1' : '0.15';
              if (match) count++;
            }
          });

          const panel = document.getElementById('info-panel');
          if (panel) {
            panel.innerHTML = `
              <div class="detail-card">
                <div class="detail-header">
                  <div class="detail-title">💺 シート区分: <b>${curSeat.name}</b></div>
                  <span class="badge" style="background:${curSeat.color}; color:#0f172a; font-weight:800; border:none; opacity:1;">Zone ${curSeat.zone} 連動: ${count}室</span>
                </div>
                <div style="font-size:12px; color:var(--text-primary); margin-top:4px; line-height:1.4;">
                  ${curSeat.desc}
                </div>
                <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
                  ※関連諸室がハイライトされています。凡例をもう一度タップすると通常表示に戻ります。
                </div>
              </div>
            `;
          }
        }
      } else {
        document.querySelectorAll('.room-pin').forEach(pin => {
          pin.style.opacity = '';
        });
      }
    });
  });

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
  // spot-type change listener
  document.querySelectorAll('input[name="spot-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isRoom = e.target.value === 'room';
      const roomSizeRow = document.querySelector('.room-size-row');
      const roomDeptGroup = document.querySelector('.room-dept-group');
      const acpOptionsGroup = document.querySelector('.acp-options-group');
      if (roomSizeRow) roomSizeRow.style.display = isRoom ? 'grid' : 'none';
      if (roomDeptGroup) roomDeptGroup.style.display = isRoom ? 'block' : 'none';
      if (acpOptionsGroup) acpOptionsGroup.style.display = isRoom ? 'none' : 'block';
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

    // 編集モード切替時に下書きピンの表示・非表示を即座に再描画
    MapEngine.renderAllFloors();

    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = MapEngine.isEditorMode
        ? '<div style="color:#f59e0b; font-weight:bold;">✏️ ピン移動・編集モード有効: マップ上のドットをドラッグ移動、クリックで編集できます。（※下書き・非表示のピンも点線で表示・編集可能）</div>'
        : '<div style="color:var(--text-secondary);">💡 編集モードを終了しました。（非表示・下書きピンは非表示に戻りました）</div>';
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

  // 有人/無人ラジオおよび重要度カラー選択の連動
  const mannedRadios = document.querySelectorAll('input[name="form-acp-manned"]');
  const acpColorInput = document.getElementById('form-acp-color');
  const acpColorPreset = document.getElementById('form-acp-color-preset');

  mannedRadios.forEach(r => {
    r.addEventListener('change', (e) => {
      if (e.target.value === 'manned') {
        if (acpColorInput && acpColorInput.value === '#06b6d4') {
          acpColorInput.value = '#f59e0b';
          if (acpColorPreset) acpColorPreset.value = '#f59e0b';
        }
      } else {
        if (acpColorInput && acpColorInput.value === '#f59e0b') {
          acpColorInput.value = '#06b6d4';
          if (acpColorPreset) acpColorPreset.value = '#06b6d4';
        }
      }
    });
  });

  acpColorPreset?.addEventListener('change', (e) => {
    if (e.target.value !== 'custom' && acpColorInput) {
      acpColorInput.value = e.target.value;
    }
  });

  acpColorInput?.addEventListener('input', (e) => {
    if (acpColorPreset) {
      const match = Array.from(acpColorPreset.options).find(opt => opt.value.toLowerCase() === e.target.value.toLowerCase());
      acpColorPreset.value = match ? match.value : 'custom';
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
    const isHidden = document.querySelector('input[name="form-visibility"]:checked')?.value === 'hidden';

    if (spotId) {
      // 既存データの更新
      let found = false;
      const roomIdx = VENUE_DATA.rooms.findIndex(r => r.id === spotId);
      if (roomIdx !== -1) {
        VENUE_DATA.rooms[roomIdx] = {
          ...VENUE_DATA.rooms[roomIdx],
          name, code, nameEn, dept, floor, x, y, w, h, acp, pdfUrl, desc,
          isHidden: isHidden
        };
        found = true;
      }
      const isManned = document.querySelector('input[name="form-acp-manned"]:checked')?.value === 'manned';
      const acpColorInput = document.getElementById('form-acp-color');
      const acpColor = (acpColorInput && acpColorInput.value) ? acpColorInput.value : (isManned ? '#f59e0b' : '#06b6d4');

      const acpIdx = VENUE_DATA.acps.findIndex(a => a.id === spotId);
      if (acpIdx !== -1) {
        VENUE_DATA.acps[acpIdx] = {
          ...VENUE_DATA.acps[acpIdx],
          name, code, floor, x, y, passLevel: acp, pdfUrl, desc,
          isManned: isManned,
          importance: isManned ? 'high' : 'normal',
          color: acpColor,
          isHidden: isHidden
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
          desc: desc,
          isHidden: isHidden
        });
      } else {
        const isManned = document.querySelector('input[name="form-acp-manned"]:checked')?.value === 'manned';
        const acpColorInput = document.getElementById('form-acp-color');
        const acpColor = (acpColorInput && acpColorInput.value) ? acpColorInput.value : (isManned ? '#f59e0b' : '#06b6d4');

        VENUE_DATA.acps.push({
          id: newId,
          code: code,
          name: name,
          floor: floor,
          x: x,
          y: y,
          passLevel: acp,
          pdfUrl: pdfUrl,
          desc: desc,
          isManned: isManned,
          importance: isManned ? 'high' : 'normal',
          color: acpColor
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

    // 表示・非表示（下書き）ステータスの反映
    const isHidden = spotItem.isHidden === true || spotItem.status === 'hidden' || spotItem.isDraft === true;
    const visRadio = document.querySelector(`input[name="form-visibility"][value="${isHidden ? 'hidden' : 'visible'}"]`);
    if (visRadio) visRadio.checked = true;

    // 表示切替
    const acpOptionsGroup = document.querySelector('.acp-options-group');
    if (roomSizeRow) roomSizeRow.style.display = isAcp ? 'none' : 'grid';
    if (roomDeptGroup) roomDeptGroup.style.display = isAcp ? 'none' : 'block';
    if (acpOptionsGroup) acpOptionsGroup.style.display = isAcp ? 'block' : 'none';

    if (isAcp) {
      const isManned = spotItem.isManned === true || spotItem.importance === 'high';
      const mannedRadio = document.querySelector(`input[name="form-acp-manned"][value="${isManned ? 'manned' : 'unmanned'}"]`);
      if (mannedRadio) mannedRadio.checked = true;

      const acpColorInput = document.getElementById('form-acp-color');
      const acpColorPreset = document.getElementById('form-acp-color-preset');
      const color = spotItem.color || (isManned ? '#f59e0b' : '#06b6d4');
      if (acpColorInput) acpColorInput.value = color;
      if (acpColorPreset) {
        const match = Array.from(acpColorPreset.options).find(opt => opt.value.toLowerCase() === color.toLowerCase());
        acpColorPreset.value = match ? match.value : 'custom';
      }
    }

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
    const acpOptionsGroup = document.querySelector('.acp-options-group');
    if (acpOptionsGroup) acpOptionsGroup.style.display = 'none';
    const acpColorInput = document.getElementById('form-acp-color');
    const acpColorPreset = document.getElementById('form-acp-color-preset');
    if (acpColorInput) acpColorInput.value = '#06b6d4';
    if (acpColorPreset) acpColorPreset.value = '#06b6d4';
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
  const copyBtn = document.getElementById('copy-datajs-btn');
  const resetBtn = document.getElementById('reset-default-data-btn');
  const statsDiv = document.getElementById('export-stats');
  const textarea = document.getElementById('export-textarea');
  const selectAllBtn = document.getElementById('select-all-text-btn');

  if (!exportModal || !exportBtn) return;

  const updateModalContent = () => {
    if (!window.VENUE_DATA) return;
    const roomCount = window.VENUE_DATA.rooms ? window.VENUE_DATA.rooms.length : 0;
    const acpCount = window.VENUE_DATA.acps ? window.VENUE_DATA.acps.length : 0;
    const acp2fCount = window.VENUE_DATA.acps ? window.VENUE_DATA.acps.filter(a => a.floor === '2f').length : 0;
    if (statsDiv) {
      statsDiv.innerHTML = '<strong>📊 現在の保持データ:</strong><br>' +
        '・部屋/諸室: ' + roomCount + '件<br>' +
        '・ACP (アクセスポイント): ' + acpCount + '件 (2階: ' + acp2fCount + '件)<br>' +
        '<span style="color:#10b981; font-weight:bold;">※ すべてブラウザに自動保存されています</span>';
    }

    if (textarea) {
      const jsText = (window.DataStorage && typeof window.DataStorage.generateDataJs === 'function')
        ? window.DataStorage.generateDataJs()
        : ('const VENUE_DATA = ' + JSON.stringify(window.VENUE_DATA, null, 2) + ';');
      textarea.value = jsText;
    }
  };

  exportBtn.addEventListener('click', () => {
    updateModalContent();
    exportModal.classList.add('open');
  });

  closeBtn?.addEventListener('click', () => exportModal.classList.remove('open'));

  downloadBtn?.addEventListener('click', () => {
    try {
      if (window.DataStorage && typeof window.DataStorage.exportDataJs === 'function') {
        window.DataStorage.exportDataJs();
        const origText = downloadBtn.innerHTML;
        downloadBtn.innerHTML = '✅ ダウンロードを開始しました！';
        downloadBtn.style.background = '#10b981';
        setTimeout(() => {
          downloadBtn.innerHTML = origText;
          downloadBtn.style.background = '';
        }, 2500);
      } else {
        alert('DataStorageが見つかりません');
      }
    } catch(err) {
      console.error(err);
      alert('ダウンロードに失敗しました: ' + err.message);
    }
  });

  copyBtn?.addEventListener('click', () => {
    try {
      const jsText = textarea ? textarea.value : (
        (window.DataStorage && typeof window.DataStorage.generateDataJs === 'function')
          ? window.DataStorage.generateDataJs()
          : ('const VENUE_DATA = ' + JSON.stringify(window.VENUE_DATA, null, 2) + ';')
      );

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(jsText).then(() => {
          const origText = copyBtn.innerHTML;
          copyBtn.innerHTML = '✅ クリップボードにコピー完了！';
          copyBtn.style.color = '#10b981';
          copyBtn.style.borderColor = '#10b981';
          setTimeout(() => {
            copyBtn.innerHTML = origText;
            copyBtn.style.color = '';
            copyBtn.style.borderColor = '';
          }, 2500);
        }).catch(() => {
          if (textarea) {
            textarea.select();
            document.execCommand('copy');
            alert('テキストを全選択してコピーしました！');
          }
        });
      } else if (textarea) {
        textarea.select();
        document.execCommand('copy');
        alert('テキストを全選択してコピーしました！');
      }
    } catch(e) {
      if (textarea) textarea.select();
    }
  });

  selectAllBtn?.addEventListener('click', () => {
    if (textarea) {
      textarea.select();
      textarea.setSelectionRange(0, textarea.value.length);
      try { document.execCommand('copy'); } catch(e){}
    }
  });

  resetBtn?.addEventListener('click', () => {
    if (confirm('ブラウザに保存された編集データを消去し、初期状態に戻しますか？')) {
      if (window.DataStorage) window.DataStorage.reset();
    }
  });
}


// 👁️ ワンクリックで表示・非表示（下書き）をトグル切り替え
window.toggleSpotVisibility = function(spotId) {
  const isRoom = VENUE_DATA.rooms.some(r => r.id === spotId);
  const spotItem = isRoom 
    ? VENUE_DATA.rooms.find(r => r.id === spotId) 
    : VENUE_DATA.acps.find(a => a.id === spotId);

  if (!spotItem) return;

  spotItem.isHidden = !spotItem.isHidden;
  DataStorage.save();
  MapEngine.renderAllFloors();

  const type = isRoom ? 'room' : 'acp';
  MapEngine.renderSpotInfo(type, spotItem, false);

  const panel = document.getElementById('info-panel');
  const toastMsg = spotItem.isHidden 
    ? `🙈 「${spotItem.name || spotItem.code}」を【非表示（下書き）】に設定しました。（通常モードでは非表示になります）`
    : `👁️ 「${spotItem.name || spotItem.code}」を【通常表示（設置確定）】に戻しました！`;

  // 一時通知トースト
  const notice = document.createElement('div');
  notice.style.cssText = 'color:#f59e0b; font-size:11px; font-weight:bold; margin-top:4px;';
  notice.textContent = toastMsg;
  const detailCard = panel?.querySelector('.detail-card');
  if (detailCard) detailCard.appendChild(notice);
};
