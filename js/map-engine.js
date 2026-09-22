/**
 * オフライン会場マップ - マップエンジン モジュール (MapEngine)
 * 動的ピン描画、SVGゾーン描画、パン＆ズーム操作、経路描画、詳細パネル制御を統括
 */

const MapEngine = {

  getFloorDimensions() {
    const dims = {
      outdoor: { width: 1024, height: 585 },
      '1f': { width: 1024, height: 718 },
      '2f': { width: 1024, height: 678 }
    };
    return dims[this.activeFloor] || { width: 1024, height: 678 };
  },

  darkenColor(hex, percent) {
    try {
      let num = parseInt(hex.replace('#', ''), 16);
      if (isNaN(num)) return hex;
      let r = Math.min(255, Math.max(0, (num >> 16) - Math.round(255 * (percent / 100))));
      let g = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) - Math.round(255 * (percent / 100))));
      let b = Math.min(255, Math.max(0, (num & 0x0000ff) - Math.round(255 * (percent / 100))));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    } catch(e) {
      return hex;
    }
  },
  activeFloor: 'outdoor',
  activePinId: null,
  scale: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  isEditorMode: false,

    resetView() {
    const viewport = document.querySelector('.map-viewport');
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const dim = this.getFloorDimensions();
    
    // Fit within viewport with margin
    const scaleX = (rect.width * 0.92) / dim.width;
    const scaleY = (rect.height * 0.92) / dim.height;
    this.scale = Math.min(Math.max(Math.min(scaleX, scaleY), 0.5), 2.5);

    this.panX = (rect.width - dim.width * this.scale) / 2;
    this.panY = (rect.height - dim.height * this.scale) / 2;

    const container = document.querySelector('.map-container');
    if (container) {
      container.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  },

  init() {
    this.bindEvents();
    
    // 最後に表示していたフロアを復元（デフォルトは outdoor）
    const lastFloor = localStorage.getItem('OFFLINE_VENUE_MAP_LAST_FLOOR');
    if (lastFloor && ['outdoor', '1f', '2f'].includes(lastFloor)) {
      this.switchFloor(lastFloor);
    }


    this.renderAllFloors();
    this.setupPanZoom();
  },

  // 1. 各階のピン・ゾーン・SVGレイヤーの動的生成
    getToiletMeta(room) {
    if (!room) return null;
    const str = ((room.name || '') + ' ' + (room.nameEn || '') + ' ' + (room.code || '') + ' ' + (room.desc || '')).toLowerCase();
    const isToilet = /toilet|urinal|cubicle|restroom|wc|お手洗い|便所|便器|lavatory/.test(str);
    if (!isToilet) return null;

    if (/dog|介助犬/.test(str)) {
      return {
        type: 'dog',
        badge: '🐕',
        label: '介助犬トイレ',
        shortLabel: '🐕 介助犬',
        color: '#d97706',
        bg: 'rgba(217, 119, 6, 0.22)',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff"><path d="M19 8c-.6 0-1.1.2-1.5.5L16 6.8V5a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v1.5L9.6 8.2A1.5 1.5 0 0 0 8 8.3L5.7 9.5a1.5 1.5 0 0 0-.9 1.6L5.3 15a1 1 0 0 0 1 1h1.5v4a1 1 0 0 0 2 0v-4h2v4a1 1 0 0 0 2 0v-5.2l2.3-1.8c.4-.3.7-.8.7-1.3V9a1 1 0 0 0-1-1z"/></svg>'
      };
    }
    if (/accessible|wheelchair|多機能|車椅子|身障者/.test(str)) {
      return {
        type: 'accessible',
        badge: '♿',
        label: '多機能トイレ (車椅子対応)',
        shortLabel: '♿ 多機能',
        color: '#0284c7',
        bg: 'rgba(2, 132, 199, 0.22)',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff"><circle cx="14.5" cy="4.5" r="2.1"/><path d="M12 8h-3a1 1 0 0 0-1 1v4h2v-3h1.5l1.6 3.2A4.5 4.5 0 1 0 17 17.5h-2a2.5 2.5 0 1 1-2.5-2.5l.3-.6L14 11l-1.5-3z"/></svg>'
      };
    }
    if (/women|female|女子|女性/.test(str)) {
      return {
        type: 'women',
        badge: '🚺',
        label: '女子トイレ',
        shortLabel: '🚺 女子',
        color: '#e11d48',
        bg: 'rgba(225, 29, 72, 0.22)',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff"><circle cx="12" cy="4.5" r="2.3"/><path d="M10 8h4l2 6.5a0.8 0.8 0 0 1-.8 1H13.5v4.5a1 1 0 0 1-2 0V15.5h-1.7a0.8 0.8 0 0 1-.8-1L10 8z"/></svg>'
      };
    }
    if (/urinal|小便器/.test(str)) {
      return {
        type: 'men_urinal',
        badge: '🚹',
        label: '男子トイレ (小便器)',
        shortLabel: '🚹 小便器',
        color: '#2563eb',
        bg: 'rgba(37, 99, 235, 0.22)',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff"><circle cx="12" cy="4.5" r="2.3"/><path d="M9 8h6a1 1 0 0 1 1 1v6h-1.5v5a1 1 0 0 1-2 0v-5h-1v5a1 1 0 0 1-2 0v-5H8V9a1 1 0 0 1 1-1z"/></svg>'
      };
    }
    if (/men|male|男子|男性/.test(str)) {
      return {
        type: 'men_cubicle',
        badge: '🚹',
        label: '男子トイレ (個室)',
        shortLabel: '🚹 男子個室',
        color: '#1d4ed8',
        bg: 'rgba(29, 78, 216, 0.22)',
        svg: '<svg viewBox="0 0 24 24" width="14" height="14" fill="#ffffff"><circle cx="12" cy="4.5" r="2.3"/><path d="M9 8h6a1 1 0 0 1 1 1v6h-1.5v5a1 1 0 0 1-2 0v-5h-1v5a1 1 0 0 1-2 0v-5H8V9a1 1 0 0 1 1-1z"/></svg>'
      };
    }
    return {
      type: 'general',
      badge: '🚻',
      label: 'トイレ',
      shortLabel: '🚻 トイレ',
      color: '#4f46e5',
      bg: 'rgba(79, 70, 229, 0.22)',
      svg: '<svg viewBox="0 0 24 24" width="15" height="15" fill="#ffffff"><circle cx="7.5" cy="4.5" r="1.8"/><path d="M5.5 8h4a.8.8 0 0 1 .8.8v4.5H9v4.5a.8.8 0 0 1-1.6 0V13.3h-.8v4.5a.8.8 0 0 1-1.6 0V13.3H4.2V8.8A.8.8 0 0 1 5 8h.5z"/><circle cx="16.5" cy="4.5" r="1.8"/><path d="M15 8h3l1.4 4.8a.6.6 0 0 1-.6.7h-1v4.3a.8.8 0 0 1-1.6 0V13.5h-.4v4.3a.8.8 0 0 1-1.6 0V13.5h-1a.6.6 0 0 1-.6-.7L15 8z"/></svg>'
    };
  },

  renderAllFloors() {
    VENUE_DATA.floors.forEach(floor => {
      const mapEl = document.getElementById(`map-${floor.id}`);
      // 既存動的コンテンツのクリア（背景画像は残す）
      mapEl.querySelectorAll('.room-pin-container, .acp-pin-container, .route-layer-svg').forEach(el => el.remove());

      // 📍 部屋（ルーム）四角形枠コンテナの生成
      const roomContainer = document.createElement('div');
      roomContainer.className = 'room-pin-container';

      const floorRooms = VENUE_DATA.rooms.filter(r => r.floor === floor.id);
      floorRooms.forEach(room => {
        const isHidden = room.isHidden === true || room.status === 'hidden' || room.isDraft === true;
        // 通常モードでは非表示（下書き）ピンは描画しない
        if (isHidden && !this.isEditorMode) return;

        const pin = document.createElement('div');
        if (isHidden) {
          pin.classList.add('is-draft-hidden');
        }
        pin.className = 'room-pin';
        pin.dataset.id = room.id;

        // 部屋の四角形枠の幅・高さ (room.w, room.h があれば使用、デフォルト 5.0% x 3.5%)
        const rw = room.w !== undefined ? parseFloat(room.w) : 5.0;
        const rh = room.h !== undefined ? parseFloat(room.h) : 3.5;

        // 中心座標 (room.x%, room.y%) を基準に配置 (CSS: transform: translate(-50%, -50%))
        pin.style.left = `${parseFloat(room.x)}%`;
        pin.style.top = `${parseFloat(room.y)}%`;
        pin.style.width = `${rw}%`;
        pin.style.height = `${rh}%`;

// 部署カラー & トイレ判定
        const dept = VENUE_DATA.departments.find(d => d.code === room.dept) || { name: room.dept, color: '#007aff' };
        const toiletMeta = this.getToiletMeta(room);

        const pinColor = toiletMeta ? toiletMeta.color : (dept.color || '#007aff');
        const pinBg = toiletMeta ? toiletMeta.bg : (pinColor.startsWith('#') ? (pinColor + '22') : 'rgba(0, 122, 255, 0.15)');

        pin.style.borderColor = pinColor;
        pin.style.backgroundColor = pinBg;

        if (toiletMeta) {
          pin.classList.add('is-toilet', `toilet-${toiletMeta.type}`);
        }

        // 枠の中央アイコン（トイレは視認性抜群の専用ピクトグラムバッジ、通常諸室は📍ピン）
        const centerMarkHtml = toiletMeta ? `
          <div class="toilet-badge-mark" title="${toiletMeta.label}">
            ${toiletMeta.svg}
          </div>
        ` : `
          <svg class="room-pin-marker" viewBox="0 0 24 24" width="18" height="18" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.85)); display: block;">
            <path fill="${pinColor}" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
            <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
          </svg>
        `;

        const codeTextHtml = toiletMeta ? `
          <div class="room-pin-code-text is-toilet-code" style="border-left: 3px solid ${pinColor};">${toiletMeta.shortLabel} [${room.code || room.name}]</div>
        ` : `
          <div class="room-pin-code-text" style="border-left: 3px solid ${pinColor};">${room.code || room.name}</div>
        `;

        const tooltipTitleHtml = toiletMeta ? `
          <span class="dept-badge" style="background:${toiletMeta.color}">${toiletMeta.badge} ${toiletMeta.label}</span>
          ${room.name}
        ` : `
          <span class="dept-badge" style="background:${dept.color}">${room.dept}</span>
          ${room.name}
        `;

        pin.innerHTML = `
          <div class="room-pin-center-mark">
            ${centerMarkHtml}
          </div>
          ${codeTextHtml}
          <div class="room-resize-handle" title="ドラッグして四角形枠のサイズを変更"></div>
          <div class="pin-tooltip">
            <div class="pin-tooltip-title">
              ${tooltipTitleHtml}
            </div>
            <div class="pin-tooltip-sub">${room.code} ${room.nameEn ? '| ' + room.nameEn : ''}</div>
            ${toiletMeta ? `<div class="pin-tooltip-toilet-note">🚻 トイレ施設 (${dept.name})</div>` : ''}
            ${room.acp && room.acp !== 'なし' ? `<div class="pin-tooltip-acp-badge">🛡️ 最寄ACP: ${room.acp}</div>` : ''}
          </div>
        `;

        pin.addEventListener('mouseenter', () => {
          this.previewSpot('room', room);
        });

        pin.addEventListener('mouseleave', () => {
          this.clearSpotPreview();
        });

        // クリック時: 編集モードなら即座に編集ダイアログを開く、通常モードなら情報表示
        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isEditorMode) {
            // ドラッグ移動直後の場合はモーダルを開かない
            if (this.justDraggedPin) return;
            if (window.openSpotEditorById) window.openSpotEditorById(room.id);
            return;
          }
          this.selectSpot('room', room);
        });

        this.bindPinDragEvents(pin, 'room', room);
        this.bindRoomResizeEvents(pin, room);
        roomContainer.appendChild(pin);
      });
      mapEl.appendChild(roomContainer);

      // 🛡️ ACP (Access Control Point) ピンコンテナの生成
      const acpContainer = document.createElement('div');
      acpContainer.className = 'acp-pin-container';

      const floorAcps = VENUE_DATA.acps.filter(a => a.floor === floor.id);
      floorAcps.forEach(acp => {
        const isHidden = acp.isHidden === true || acp.status === 'hidden' || acp.isDraft === true;
        // 通常モードでは非表示（下書き）ピンは描画しない
        if (isHidden && !this.isEditorMode) return;

        const pin = document.createElement('div');
        if (isHidden) {
          pin.classList.add('is-draft-hidden');
        }
        const isManned = acp.isManned === true || acp.importance === 'high';
        const acpColor = acp.color || (isManned ? '#f59e0b' : '#06b6d4');

        pin.className = 'acp-pin' + (isManned ? ' is-manned' : '');
        pin.dataset.id = acp.id;
        pin.style.left = `${acp.x}%`;
        pin.style.top = `${acp.y}%`;
        pin.style.setProperty('--acp-bg', `radial-gradient(circle, ${acpColor} 0%, ${this.darkenColor(acpColor, 28)} 100%)`);
        pin.style.setProperty('--acp-glow', acpColor);

        pin.innerHTML = `
          <div class="pin-tooltip">
            <div class="pin-tooltip-title">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${acpColor}; margin-right:4px; vertical-align:middle; border:1px solid #fff;"></span>
              ${isManned ? '👤 [有人] ' : '🛡️ '}${acp.code} ${acp.name && acp.name !== acp.code ? '- ' + acp.name : ''}
            </div>
            <div class="pin-tooltip-sub">
              ${isManned ? '<span style="color:#f59e0b; font-weight:800;">★有人(スタッフ配置)</span> | ' : ''}Access: ${acp.passLevel}
            </div>
          </div>
        `;

        pin.addEventListener('mouseenter', () => {
          this.previewSpot('acp', acp);
        });

        pin.addEventListener('mouseleave', () => {
          this.clearSpotPreview();
        });

        // クリック時: 編集モードなら即座に編集ダイアログを開く、通常モードなら情報表示
        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isEditorMode) {
            // ドラッグ移動直後の場合はモーダルを開かない
            if (this.justDraggedPin) return;
            if (window.openSpotEditorById) window.openSpotEditorById(acp.id);
            return;
          }
          this.selectSpot('acp', acp);
        });

        this.bindPinDragEvents(pin, 'acp', acp);
        acpContainer.appendChild(pin);
      });
      mapEl.appendChild(acpContainer);


      // 〰️ ルート描画用 SVG レイヤー
      const routeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      routeSvg.setAttribute('class', 'route-layer-svg');
      routeSvg.style.pointerEvents = 'none';
      routeSvg.setAttribute('id', `route-svg-${floor.id}`);
      routeSvg.setAttribute('viewBox', '0 0 100 100');
      routeSvg.setAttribute('preserveAspectRatio', 'none');
      mapEl.appendChild(routeSvg);
    });
  },

  // ピンのドラッグ＆ドロップ移動イベント登録 (編集モード用)
  bindPinDragEvents(pinEl, type, item) {
    let startX = 0, startY = 0;
    let hasDragged = false;

    const onStart = (e) => {
      if (!this.isEditorMode) return;
      if (e.target.classList.contains('room-resize-handle')) return; // リサイズハンドルは除外
      e.stopPropagation();

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;
      hasDragged = false;
      this.isPinDragging = true;
      this.draggedSpotItem = item;
      this.draggedPinEl = pinEl;

      pinEl.classList.add('is-dragging');

      const onMove = (moveEvent) => {
        if (!this.isPinDragging) return;
        const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

        // 誤判定を防ぐため移動判定しきい値を 6px に設定
        if (Math.hypot(curX - startX, curY - startY) > 6) {
          hasDragged = true;
          this.justDraggedPin = true;
        }

        const viewport = document.querySelector('.map-viewport');
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();

        const dim = this.getFloorDimensions();
        const newX = Math.min(Math.max((((curX - rect.left - this.panX) / this.scale) / dim.width) * 100, 0), 100);
        const newY = Math.min(Math.max((((curY - rect.top - this.panY) / this.scale) / dim.height) * 100, 0), 100);

        pinEl.style.left = `${newX.toFixed(1)}%`;
        pinEl.style.top = `${newY.toFixed(1)}%`;
      };

      const onEnd = () => {
        pinEl.classList.remove('is-dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);

        if (hasDragged) {
          const finalX = parseFloat(pinEl.style.left);
          const finalY = parseFloat(pinEl.style.top);

          item.x = Math.round(finalX * 10) / 10;
          item.y = Math.round(finalY * 10) / 10;

          if (window.DataStorage) window.DataStorage.save();

          // 移動完了後はモーダルを開かず、350ms間クリックイベントを確実に抑止
          this.justDraggedPin = true;
          setTimeout(() => {
            this.justDraggedPin = false;
          }, 350);

          const panel = document.getElementById('info-panel');
          if (panel) {
            panel.innerHTML = `
              <div style="color:#34c759; font-weight:bold; font-size:12px; padding:4px 0;">
                ✅ 「${item.name || item.code}」を移動しました (X: ${item.x}%, Y: ${item.y}%)
              </div>
            `;
          }
        } else {
          // 移動しなかった（単なるクリック）場合のみ、編集ダイアログを開く
          if (this.isEditorMode && window.openSpotEditorById) {
            window.openSpotEditorById(item.id);
          }
        }

        this.isPinDragging = false;
        this.draggedSpotItem = null;
        this.draggedPinEl = null;
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };

    pinEl.addEventListener('mousedown', onStart);
    pinEl.addEventListener('touchstart', onStart, { passive: false });
  },

  // 部屋四角形枠のインタラクティブリサイズ処理 (編集モード時のみ動作)
  bindRoomResizeEvents(pinEl, room) {
    const handle = pinEl.querySelector('.room-resize-handle');
    if (!handle) return;

    const onStart = (e) => {
      if (!this.isEditorMode) return;
      e.stopPropagation();
      e.preventDefault();

      const startClientX = e.touches ? e.touches[0].clientX : e.clientX;
      const startClientY = e.touches ? e.touches[0].clientY : e.clientY;
      const startW = room.w !== undefined ? parseFloat(room.w) : 5.0;
      const startH = room.h !== undefined ? parseFloat(room.h) : 3.5;

      const dim = this.getFloorDimensions();

      const onMove = (moveEvent) => {
        const curX = moveEvent.touches ? moveEvent.touches[0].clientX : moveEvent.clientX;
        const curY = moveEvent.touches ? moveEvent.touches[0].clientY : moveEvent.clientY;

        // 中心からの両端拡縮
        const deltaXPercent = (((curX - startClientX) / this.scale) / dim.width) * 100 * 2;
        const deltaYPercent = (((curY - startClientY) / this.scale) / dim.height) * 100 * 2;

        const newW = Math.max(Math.round((startW + deltaXPercent) * 10) / 10, 1.5);
        const newH = Math.max(Math.round((startH + deltaYPercent) * 10) / 10, 1.5);

        pinEl.style.width = `${newW}%`;
        pinEl.style.height = `${newH}%`;
        room.w = newW;
        room.h = newH;
      };

      const onEnd = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);

        if (window.DataStorage) window.DataStorage.save();
        const panel = document.getElementById('info-panel');
        if (panel) {
          panel.innerHTML = `<div style="color:#34c759; font-weight:bold; font-size:13px; padding:6px 0;">✅ 「${room.name}」の枠サイズを保存しました！ (幅: ${room.w}%, 高さ: ${room.h}%)</div>`;
        }
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };

    handle.addEventListener('mousedown', onStart);
    handle.addEventListener('touchstart', onStart, { passive: false });
  },

  // 2. ピン/スポットタップ時の詳細情報パネル更新
  previewSpot(type, item) {
    this.renderSpotInfo(type, item, true);
  },

  clearSpotPreview() {
    if (this.activePinId) return; // 既に選択（クリック）されているピンがある場合はパネル内容を維持
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="detail-card">
        <div class="detail-header">
          <div class="detail-title">💡 オフライン会場マップ案内</div>
          <span class="badge badge-dept">OFFLINE ACTIVE</span>
        </div>
        <div style="font-size:13px; color:var(--text-secondary); line-height:1.5; margin-top:4px;">
          マップ上の <b>📍 部屋ピン</b> や <b>🛡️ ACP (アクセスポイント)</b> にカーソルを重ねると詳細情報が表示されます。
        </div>
      </div>
    `;
  },

  selectSpot(type, item) {
    this.activePinId = item.id;
    // 既存の選択ピンのハイライト＆番号表示を解除
    document.querySelectorAll('.room-pin.is-selected, .acp-pin.is-selected').forEach(el => {
      el.classList.remove('is-selected');
    });
    // 選択されたピンに .is-selected を付与（スマホでの番号表示＆強調枠）
    const selectedEl = document.querySelector(`[data-id="${item.id}"]`);
    if (selectedEl) {
      selectedEl.classList.add('is-selected');
    }
    this.renderSpotInfo(type, item, false);
  },

  renderSpotInfo(type, item, isPreview = false) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    if (type === 'room') {
      const dept = VENUE_DATA.departments.find(d => d.code === item.dept) || { name: item.dept, color: '#007aff' };
      const zone = VENUE_DATA.zones.find(z => z.id === item.zoneId) || { name: '指定なし' };
      const toiletMeta = this.getToiletMeta(item);

      const titleIconHtml = toiletMeta ? `
        <span class="toilet-badge-mark" style="width:20px; height:20px; background:${toiletMeta.color}; border:1.5px solid #fff; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; vertical-align:-3px; margin-right:5px; box-shadow:0 1px 3px rgba(0,0,0,0.5);">
          ${toiletMeta.svg}
        </span>
      ` : `
        <svg viewBox="0 0 24 24" width="15" height="15" style="vertical-align:-2px; margin-right:4px; display:inline-block; filter:drop-shadow(0 1px 2px rgba(0,0,0,0.5));">
          <path fill="${dept.color}" stroke="#ffffff" stroke-width="1.3" stroke-linejoin="round" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.8" fill="#ffffff"/>
        </svg>
      `;

      const titleNameHtml = toiletMeta ? `${toiletMeta.badge} ${toiletMeta.label} <span style="font-size:12px; font-weight:normal; opacity:0.85;">(${item.name})</span>` : item.name;

      panel.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <div>
              <div class="detail-title">
                ${titleIconHtml}${titleNameHtml} ${isPreview ? '<span style="font-size:10px; opacity:0.7;">(プレビュー)</span>' : ''}
              </div>
              <div class="detail-code">ID: ${item.id} | 英語: ${item.nameEn || '-'}</div>
            </div>
            <div style="display:flex; gap:5px; align-items:center;">
              <button onclick="window.openSpotEditorById('${item.id}')" class="btn-secondary" style="padding:3px 8px; font-size:10px; background:#f59e0b; color:#000; font-weight:bold; cursor:pointer;">✏️ 編集</button>
              ${toiletMeta ? `<span class="badge" style="background:${toiletMeta.color}; color:#fff; font-weight:bold;">${toiletMeta.badge} ${toiletMeta.label}</span>` : ''}
              <span class="badge badge-dept" style="background:${dept.color}">${dept.name}</span>
            </div>
          </div>
          <div class="detail-grid">
            ${toiletMeta ? `
              <div class="detail-item">
                <span class="label">施設種別</span>
                <span class="value" style="color:${toiletMeta.color}; font-weight:bold;">${toiletMeta.badge} ${toiletMeta.label}</span>
              </div>
            ` : ''}
            <div class="detail-item">
              <span class="label">担当部署</span>
              <span class="value">${item.dept} (${dept.name})</span>
            </div>
            <div class="detail-item">
              <span class="label">所属ゾーン</span>
              <span class="value">${zone.name}</span>
            </div>
            <div class="detail-item">
              <span class="label">最寄ACP</span>
              <span class="value">${item.acp !== 'なし' ? '🛡️ ' + item.acp : '制限なし'}</span>
            </div>
            <div class="detail-item">
              <span class="label">フロア / 座標</span>
              <span class="value">${item.floor.toUpperCase()} (${item.x}%, ${item.y}%)</span>
            </div>
          </div>
          <div class="detail-desc-line">
            <b>概要・備考:</b> ${item.desc || '特記事項なし'}
          </div>
          ${item.pdfUrl ? `
            <div style="margin-top:2px;">
              <a href="${item.pdfUrl}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:4px; text-decoration:none; padding:4px 8px; font-size:10px; background:#ef4444;">
                📄 関連PDF (${item.pdfUrl.split('/').pop()})
              </a>
            </div>
          ` : ''}
        </div>
      `;
    } else if (type === 'acp') {
      const isManned = item.isManned === true || item.importance === 'high';
      const acpColor = item.color || (isManned ? '#f59e0b' : '#06b6d4');
      const darkColor = this.darkenColor(acpColor, 28);

      panel.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <div>
              <div class="detail-title">
                <span style="display:inline-block; width:12px; height:12px; border-radius:50%; background:radial-gradient(circle, ${acpColor} 0%, ${darkColor} 100%); border:1.5px solid #fff; box-shadow:0 0 8px ${acpColor}; margin-right:5px; vertical-align:middle;"></span>
                ${isManned ? '👤 ' : '🛡️ '}${item.name} (${item.code}) ${isPreview ? '<span style="font-size:10px; opacity:0.7;">(プレビュー)</span>' : ''}
              </div>
              <div class="detail-code">ACP ID: ${item.id}</div>
            </div>
            <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
              <button onclick="window.openSpotEditorById('${item.id}')" class="btn-secondary" style="padding:3px 8px; font-size:10px; background:#f59e0b; color:#000; font-weight:bold; cursor:pointer;">✏️ 編集</button>
              <button onclick="window.toggleSpotVisibility('${item.id}')" class="btn-secondary" style="padding:3px 8px; font-size:10px; background:${item.isHidden ? '#10b981' : '#f59e0b'}; color:${item.isHidden ? '#fff' : '#0f172a'}; font-weight:bold; cursor:pointer;" title="表示・非表示（下書き）をワンクリック切り替え">${item.isHidden ? '👁️ 表示にする' : '🙈 非表示にする'}</button>
              ${item.isHidden ? '<span class="badge" style="background:#f59e0b; color:#0f172a; font-weight:800;">🙈 非表示 (下書き)</span>' : ''}
              <span class="badge" style="background:${acpColor}; color:#fff; font-weight:bold;">${isManned ? '👤 有人 (スタッフ)' : '無人'}</span>
              <span class="badge badge-acp" style="background:${acpColor}; color:#fff;">${item.passLevel}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">運用形態</span>
              <span class="value" style="color:${isManned ? '#f59e0b' : '#38bdf8'}; font-weight:bold;">
                ${isManned ? '👤 有人（人が立つ / スタッフ配置）' : '無人（人が立たない）'}
              </span>
            </div>
            <div class="detail-item">
              <span class="label">管理番号 / コード</span>
              <span class="value">${item.code}</span>
            </div>
            <div class="detail-item">
              <span class="label">アクセス権限</span>
              <span class="value">${item.passLevel}</span>
            </div>
            <div class="detail-item">
              <span class="label">設置フロア</span>
              <span class="value">${item.floor.toUpperCase()}</span>
            </div>
            <div class="detail-item">
              <span class="label">図面座標</span>
              <span class="value">(${item.x}%, ${item.y}%)</span>
            </div>
          </div>
          <div class="detail-desc-line">
            <b>運用詳細・設置場所:</b> ${item.desc || '特記事項なし'}
          </div>
        </div>
      `;
    }
  },

  // 3. パン＆ズーム物理エンジンのセットアップ
  setupPanZoom() {
    const viewport = document.querySelector('.map-viewport');
    const container = document.querySelector('.map-container');
    if (!viewport || !container) return;

    const updateTransform = () => {
      container.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    };

    let mapDragDistance = 0;
    let mouseStartClientX = 0, mouseStartClientY = 0;

    // マウスドラッグによる画面パン
    viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.zoom-controls, .modal-backdrop')) return;
      this.isDragging = true;
      mapDragDistance = 0;
      mouseStartClientX = e.clientX;
      mouseStartClientY = e.clientY;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      mapDragDistance = Math.hypot(e.clientX - mouseStartClientX, e.clientY - mouseStartClientY);
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // タッチによる画面ドラッグ（モバイル対応）
    let touchStartX = 0, touchStartY = 0;
    let touchStartClientX = 0, touchStartClientY = 0;
    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        mapDragDistance = 0;
        touchStartClientX = e.touches[0].clientX;
        touchStartClientY = e.touches[0].clientY;
        touchStartX = e.touches[0].clientX - this.panX;
        touchStartY = e.touches[0].clientY - this.panY;
      }
    });

    viewport.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        mapDragDistance = Math.hypot(e.touches[0].clientX - touchStartClientX, e.touches[0].clientY - touchStartClientY);
        this.panX = e.touches[0].clientX - touchStartX;
        this.panY = e.touches[0].clientY - touchStartY;
        updateTransform();
      }
    });

    viewport.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // マウスホイールズーム
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.7), 4.0);
      
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;
      updateTransform();
    }, { passive: false });

    // ビジュアルマップクリック (ゾーン頂点追加 または 新規ピン追加)
    viewport.addEventListener('click', (e) => {
      if (e.target.closest('.zoom-controls, .modal-backdrop, .room-pin, .acp-pin')) return;

      // 画面をドラッグ移動した直後、またはピン移動直後の誤タップは完全に無視（モーダルを開かない）
      if (mapDragDistance > 6 || this.justDraggedPin) {
        mapDragDistance = 0;
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const dim = this.getFloorDimensions();
      const x = (((e.clientX - rect.left - this.panX) / this.scale) / dim.width) * 100;
      const y = (((e.clientY - rect.top - this.panY) / this.scale) / dim.height) * 100;


      // 静止した状態で空白エリアをクリックした場合: 選択解除
      document.querySelectorAll('.room-pin.is-selected, .acp-pin.is-selected').forEach(el => {
        el.classList.remove('is-selected');
      });

      // 編集モードなら新規追加モーダルを開く
      if (this.isEditorMode) {
        if (window.openSpotEditor) {
          window.openSpotEditor({ x, y, floor: this.activeFloor });
        }
      }
    });

    // ズームボタン操作の登録
    document.getElementById('zoom-in')?.addEventListener('click', () => {
      this.scale = Math.min(this.scale * 1.25, 4.0);
      updateTransform();
    });

    document.getElementById('zoom-out')?.addEventListener('click', () => {
      this.scale = Math.max(this.scale * 0.8, 0.7);
      updateTransform();
    });

    document.getElementById('zoom-reset')?.addEventListener('click', () => {
      this.resetView();
    });
  },

  // 4. フロア切り替え
  switchFloor(floorId) {
    this.activeFloor = floorId;
    setTimeout(() => this.resetView(), 10); // auto-center floor
    const tabRadio = document.getElementById(`tab-${floorId}`);
    if (tabRadio) tabRadio.checked = true;

    try {
      localStorage.setItem('OFFLINE_VENUE_MAP_LAST_FLOOR', floorId);
    } catch (e) {
      console.warn('Failed to save last floor:', e);
    }

    // ズーム・位置をリセット
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    const container = document.querySelector('.map-container');
    if (container) container.style.transform = `translate(0px, 0px) scale(1)`;
  },

  // 5. 検索結果ピンのハイライト＆フォーカス
  focusPin(spotId) {
    const room = VENUE_DATA.rooms.find(r => r.id === spotId);
    const acp = VENUE_DATA.acps.find(a => a.id === spotId);
    const target = room || acp;

    if (!target) return;

    // フロア切り替え
    this.switchFloor(target.floor);

    // ピンのアクティブ化
    if (room) this.selectSpot('room', room);
    if (acp) this.selectSpot('acp', acp);

    // 画面中央へマップをスムーズにスライド
    const viewport = document.querySelector('.map-viewport');
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      this.scale = 1.6;
      const dim = this.getFloorDimensions();
      this.panX = (rect.width / 2) - (dim.width * (target.x / 100) * this.scale);
      this.panY = (rect.height / 2) - (dim.height * (target.y / 100) * this.scale);
      
      const container = document.querySelector('.map-container');
      if (container) container.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    }
  },

  // 6. オフライン導線（ルート）の描画
  drawRoute(startId, goalId) {
    const startSpot = VENUE_DATA.rooms.find(r => r.id === startId || r.code === startId) || VENUE_DATA.acps.find(a => a.id === startId || a.code === startId);
    const goalSpot = VENUE_DATA.rooms.find(r => r.id === goalId || r.code === goalId) || VENUE_DATA.acps.find(a => a.id === goalId || a.code === goalId);

    if (!startSpot || !goalSpot) return;

    // フロアをスタート地点に合わせる
    this.switchFloor(startSpot.floor);

    // 「ルート」レイヤーチェックボックスを自動ON
    const routeLayerChk = document.getElementById('layer-route');
    if (routeLayerChk) routeLayerChk.checked = true;

    const routeSvg = document.getElementById(`route-svg-${startSpot.floor}`);
    if (!routeSvg) return;

    // 既存ルート消去
    routeSvg.innerHTML = '';

    // 事前定義ルートがあるか検索、なければ直線/中間ウェイポイント生成
    const definedRoute = VENUE_DATA.routes.find(r => (r.startId === startSpot.id && r.goalId === goalSpot.id));
    let points = [];

    if (definedRoute) {
      points = definedRoute.pathPoints;
    } else {
      points = [[startSpot.x, startSpot.y], [(startSpot.x + goalSpot.x) / 2, (startSpot.y + goalSpot.y) / 2], [goalSpot.x, goalSpot.y]];
    }

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dStr = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt[0]} ${pt[1]}`).join(' ');
    pathEl.setAttribute('d', dStr);
    pathEl.setAttribute('class', 'route-path');
    pathEl.setAttribute('fill', 'none');
    routeSvg.appendChild(pathEl);

    // 情報パネルの更新
    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <div class="detail-title">〰️ ルート案内: ${startSpot.name} ➔ ${goalSpot.name}</div>
            <span class="badge" style="background:#00c7be">経路ナビゲーション</span>
          </div>
          <div style="margin-top:6px; font-size:12px; line-height:1.5;">
            ${definedRoute ? definedRoute.instructions : '青い点線に沿って通路を進んでください。'}
          </div>
        </div>
      `;
    }
  },

  bindEvents() {
    // フロアタブ選択時のイベント
    ['outdoor', '1f', '2f'].forEach(fl => {
      document.getElementById(`tab-${fl}`)?.addEventListener('change', (e) => {
        if (e.target.checked) this.switchFloor(fl);
      });
    });
  }
};

if (typeof window !== "undefined") { window.MapEngine = MapEngine; }
