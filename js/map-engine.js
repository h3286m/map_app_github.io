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

    const zoneChk = document.getElementById('layer-zone');
    if (zoneChk) zoneChk.checked = true;

    this.renderAllFloors();
    this.setupPanZoom();
  },

  // 1. 各階のピン・ゾーン・SVGレイヤーの動的生成
  renderAllFloors() {
    VENUE_DATA.floors.forEach(floor => {
      const mapEl = document.getElementById(`map-${floor.id}`);
      // 既存動的コンテンツのクリア（背景画像は残す）
      mapEl.querySelectorAll('.room-pin-container, .acp-pin-container, .zone-layer-svg, .zone-badge-container, .route-layer-svg').forEach(el => el.remove());

      // 📍 部屋（ルーム）四角形枠コンテナの生成
      const roomContainer = document.createElement('div');
      roomContainer.className = 'room-pin-container';

      const floorRooms = VENUE_DATA.rooms.filter(r => r.floor === floor.id);
      floorRooms.forEach(room => {
        const pin = document.createElement('div');
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

        // 部署カラー
        const dept = VENUE_DATA.departments.find(d => d.code === room.dept) || { name: room.dept, color: '#007aff' };
        pin.style.borderColor = dept.color;
        pin.style.backgroundColor = dept.color.startsWith('#') ? (dept.color + '22') : 'rgba(0, 122, 255, 0.15)';

        // 枠の中央に 📍 ピンと部屋コード、右下にサイズ調整用リサイズハンドル
        pin.innerHTML = `
          <div class="room-pin-center-mark">
            <span>📍</span>
          </div>
          <div class="room-pin-code-text">${room.code || room.name}</div>
          <div class="room-resize-handle" title="ドラッグして四角形枠のサイズを変更"></div>
          <div class="pin-tooltip">
            <div class="pin-tooltip-title">
              <span class="dept-badge" style="background:${dept.color}">${room.dept}</span>
              ${room.name}
            </div>
            <div class="pin-tooltip-sub">${room.code} ${room.nameEn ? '| ' + room.nameEn : ''}</div>
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
        const pin = document.createElement('div');
        pin.className = 'acp-pin';
        pin.dataset.id = acp.id;
        pin.style.left = `${acp.x}%`;
        pin.style.top = `${acp.y}%`;

        pin.innerHTML = `
          <div class="pin-tooltip">
            <div class="pin-tooltip-title">🛡️ ${acp.code} ${acp.name && acp.name !== acp.code ? '- ' + acp.name : ''}</div>
            <div class="pin-tooltip-sub">Access Pass: ${acp.passLevel}</div>
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

      // 📐 ゾーン多角形 SVG レイヤー ＆ HTML バッジコンテナの生成
      const zoneSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      zoneSvg.setAttribute('class', 'zone-layer-svg');
      zoneSvg.setAttribute('viewBox', '0 0 100 100');
      zoneSvg.setAttribute('preserveAspectRatio', 'none');

      const zoneBadgeContainer = document.createElement('div');
      zoneBadgeContainer.className = 'zone-badge-container';

      const floorZones = VENUE_DATA.zones.filter(z => z.floor === floor.id);
      floorZones.forEach(zone => {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = zone.points.map(pt => `${pt[0]},${pt[1]}`).join(' ');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', zone.color || 'rgba(0,122,255,0.25)');
        polygon.setAttribute('stroke', zone.borderColor || '#007aff');
        polygon.setAttribute('vector-effect', 'non-scaling-stroke');
        polygon.setAttribute('data-id', zone.id);
        polygon.setAttribute('class', 'zone-polygon');

        // ホバー時のゾーンプレビュー
        polygon.addEventListener('mouseenter', () => {
          this.previewZone(zone);
        });

        polygon.addEventListener('mouseleave', () => {
          this.clearZonePreview();
        });

        // ゾーンタップ時の情報表示
        polygon.addEventListener('click', (e) => {
          if (this.isZoneDrawingMode || this.isVertexEditingMode) return;
          e.stopPropagation();
          this.selectZone(zone);
        });

        zoneSvg.appendChild(polygon);

        // ゾーンの中央位置に歪まないHTMLバッジ（部屋/ACPと同等のフォントサイズ）を生成
        if (zone.points && zone.points.length > 0) {
          const cx = Math.round((zone.points.reduce((sum, p) => sum + p[0], 0) / zone.points.length) * 10) / 10;
          const cy = Math.round((zone.points.reduce((sum, p) => sum + p[1], 0) / zone.points.length) * 10) / 10;

          const badge = document.createElement('div');
          badge.className = 'zone-center-badge';
          badge.style.left = `${cx}%`;
          badge.style.top = `${cy}%`;
          badge.style.borderColor = zone.borderColor || '#007aff';
          badge.innerHTML = `<span class="zone-badge-dot" style="background:${zone.borderColor || '#007aff'}"></span>${zone.name || zone.id}`;
          
          zoneBadgeContainer.appendChild(badge);
        }
      });
      mapEl.appendChild(zoneSvg);
      mapEl.appendChild(zoneBadgeContainer);

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
    this.renderSpotInfo(type, item, false);
  },

  renderSpotInfo(type, item, isPreview = false) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    if (type === 'room') {
      const dept = VENUE_DATA.departments.find(d => d.code === item.dept) || { name: item.dept, color: '#007aff' };
      const zone = VENUE_DATA.zones.find(z => z.id === item.zoneId) || { name: '指定なし' };

      panel.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <div>
              <div class="detail-title">📍 ${item.name} ${isPreview ? '<span style="font-size:11px; opacity:0.7;">(プレビュー)</span>' : ''}</div>
              <div class="detail-code">ID: ${item.id} | 英語表記: ${item.nameEn}</div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button onclick="window.openSpotEditorById('${item.id}')" class="btn-secondary" style="padding:4px 10px; font-size:11px; background:#f59e0b; color:#000; font-weight:bold; cursor:pointer;">✏️ 編集</button>
              <span class="badge badge-dept" style="background:${dept.color}">${dept.name}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">担当部署コード</span>
              <span class="value">${item.dept} (${dept.name})</span>
            </div>
            <div class="detail-item">
              <span class="label">所属ゾーン</span>
              <span class="value">${zone.name}</span>
            </div>
            <div class="detail-item">
              <span class="label">最寄ACP (パス要件)</span>
              <span class="value">${item.acp !== 'なし' ? '🛡️ ' + item.acp : '制限なし'}</span>
            </div>
            <div class="detail-item">
              <span class="label">所在フロア / 座標</span>
              <span class="value">${item.floor.toUpperCase()} (${item.x}%, ${item.y}%)</span>
            </div>
          </div>
          <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:12px; color:var(--text-secondary);">
              <b>概要・備考:</b> ${item.desc || '特記事項なし'}
            </div>
            ${item.pdfUrl ? `
              <div style="margin-top:4px;">
                <a href="${item.pdfUrl}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:6px; text-decoration:none; padding:6px 12px; font-size:12px; background:#ef4444;">
                  📄 関連PDF資料・マニュアルを開く (${item.pdfUrl.split('/').pop()})
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    } else if (type === 'acp') {
      panel.innerHTML = `
        <div class="detail-card">
          <div class="detail-header">
            <div>
              <div class="detail-title">🛡️ ${item.name} (${item.code}) ${isPreview ? '<span style="font-size:11px; opacity:0.7;">(プレビュー)</span>' : ''}</div>
              <div class="detail-code">アクセスポイント ID: ${item.id}</div>
            </div>
            <div style="display:flex; gap:6px; align-items:center;">
              <button onclick="window.openSpotEditorById('${item.id}')" class="btn-secondary" style="padding:4px 10px; font-size:11px; background:#f59e0b; color:#000; font-weight:bold; cursor:pointer;">✏️ 編集</button>
              <span class="badge badge-acp">${item.passLevel}</span>
            </div>
          </div>
          <div class="detail-grid">
            <div class="detail-item">
              <span class="label">ACPコード</span>
              <span class="value">${item.code}</span>
            </div>
            <div class="detail-item">
              <span class="label">通行許可レベル</span>
              <span class="value">${item.passLevel}</span>
            </div>
            <div class="detail-item">
              <span class="label">設置階</span>
              <span class="value">${item.floor.toUpperCase()}</span>
            </div>
          </div>
          <div style="margin-top:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="font-size:12px; color:var(--text-secondary);">
              <b>保安運用仕様:</b> ${item.desc}
            </div>
            ${item.pdfUrl ? `
              <div style="margin-top:4px;">
                <a href="${item.pdfUrl}" target="_blank" class="btn-primary" style="display:inline-flex; align-items:center; gap:6px; text-decoration:none; padding:6px 12px; font-size:12px; background:#ef4444;">
                  📄 関連PDF資料・警備要領を開く (${item.pdfUrl.split('/').pop()})
                </a>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }
  },

  previewZone(zone) {
    if (this.isZoneDrawingMode || this.isVertexEditingMode || this.activePinId) return;
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <div class="detail-title">📐 ゾーン: ${zone.name} <span style="font-size:11px; opacity:0.7;">(プレビュー)</span></div>
            <div class="detail-code">Zone ID: ${zone.id} | フロア: ${zone.floor.toUpperCase()}</div>
          </div>
          <span class="badge" style="background:${zone.borderColor || '#007aff'}; color:#fff;">${zone.name}</span>
        </div>
        <div style="margin-top:6px; font-size:12px; color:var(--text-secondary);">
          ゾーン区分: <b>${zone.name}</b> (${zone.points ? zone.points.length : 0}頂点)。クリックで詳細情報・頂点編集を開きます。
        </div>
      </div>
    `;
  },

  clearZonePreview() {
    if (!this.activePinId) this.clearSpotPreview();
  },

  // ゾーン選択時の詳細表示
  selectZone(zone) {
    this.activePinId = zone.id;
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <div class="detail-title">📐 ゾーン区分: ${zone.name}</div>
            <div class="detail-code">Zone ID: ${zone.id} | 設置フロア: ${zone.floor.toUpperCase()}</div>
          </div>
          <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <button onclick="MapEngine.startEditingZoneVerticesById('${zone.id}')" class="btn-secondary" style="padding:4px 10px; font-size:11px; background:#f59e0b; color:#000; font-weight:bold; cursor:pointer;">📍 頂点を編集</button>
            <button onclick="MapEngine.openZoneEditor('${zone.id}')" class="btn-secondary" style="padding:4px 10px; font-size:11px; background:#007aff; color:#fff; font-weight:bold; cursor:pointer;">✏️ 名称変更</button>
            <button onclick="MapEngine.deleteZone('${zone.id}')" class="btn-secondary" style="padding:4px 10px; font-size:11px; background:#ef4444; color:#fff; font-weight:bold; cursor:pointer;">🗑️ 削除</button>
            <span class="badge" style="background:${zone.borderColor || '#007aff'}; color:#fff; font-weight:800;">${zone.name}</span>
          </div>
        </div>
        <div style="margin-top:6px; font-size:12px; color:var(--text-secondary); display:flex; align-items:center; gap:8px;">
          <span>頂点数: <b>${zone.points ? zone.points.length : 0} 点</b> の多角形区画</span>
          <span>•</span>
          <span>表示カラー: <span style="display:inline-block; width:14px; height:14px; background:${zone.color}; border:2px solid ${zone.borderColor || '#007aff'}; vertical-align:middle; border-radius:3px;"></span> (${zone.borderColor})</span>
        </div>
      </div>
    `;
  },

  openZoneEditor(zoneId) {
    const zone = VENUE_DATA.zones.find(z => z.id === zoneId);
    if (!zone) return;

    const newName = prompt('ゾーン名称を変更:', zone.name);
    if (newName === null) return;

    if (newName.trim()) {
      zone.name = newName.trim();
      zone.nameEn = newName.trim();

      if (window.DataStorage) window.DataStorage.save();
      this.renderAllFloors();
      this.selectZone(zone);
    }
  },

  // ゾーン頂点編集モード (PowerPoint風 「頂点の編集」)
  startEditingZoneVerticesById(zoneId) {
    const zone = VENUE_DATA.zones.find(z => z.id === zoneId);
    if (zone) this.startEditingZoneVertices(zone);
  },

  startEditingZoneVertices(zone) {
    if (this.isZoneDrawingMode) this.toggleZoneDrawingMode(false);

    this.editingZone = zone;
    this.editingZonePoints = zone.points.map(pt => [...pt]);
    this.selectedVertexIndex = null;
    this.isVertexEditingMode = true;

    document.body.classList.add('vertex-editing-active');

    const zoneChk = document.getElementById('layer-zone');
    if (zoneChk) zoneChk.checked = true;

    this.renderVertexEditUI();
  },

  renderVertexEditUI() {
    if (!this.editingZone || !this.editingZonePoints) return;

    if (this.activeFloor !== this.editingZone.floor) {
      this.switchFloor(this.editingZone.floor);
    }

    const mapEl = document.getElementById(`map-${this.editingZone.floor}`);
    if (!mapEl) return;

    mapEl.querySelectorAll('.zone-edit-handle').forEach(el => el.remove());

    const bar = document.getElementById('vertex-editor-bar');
    if (bar) {
      bar.style.display = 'block';
      const nameEl = document.getElementById('vertex-edit-name');
      if (nameEl) nameEl.textContent = `📍 ゾーン: ${this.editingZone.name}`;
      const countEl = document.getElementById('vertex-count-badge');
      if (countEl) countEl.textContent = `頂点数: ${this.editingZonePoints.length}`;
    }

    const zoneSvg = mapEl.querySelector('.zone-layer-svg');
    if (zoneSvg) {
      let polyEl = zoneSvg.querySelector(`.temp-editing-polygon`);
      if (!polyEl) {
        polyEl = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polyEl.setAttribute('class', 'temp-editing-polygon');
        polyEl.setAttribute('fill', this.editingZone.color || 'rgba(0,122,255,0.3)');
        polyEl.setAttribute('stroke', '#f59e0b');
        polyEl.setAttribute('stroke-width', '2');
        polyEl.setAttribute('stroke-dasharray', '4 2');
        polyEl.setAttribute('vector-effect', 'non-scaling-stroke');
        polyEl.style.pointerEvents = 'none';
        zoneSvg.appendChild(polyEl);
      }
      const pointsStr = this.editingZonePoints.map(pt => `${pt[0]},${pt[1]}`).join(' ');
      polyEl.setAttribute('points', pointsStr);
    }

    this.editingZonePoints.forEach((pt, index) => {
      const handle = document.createElement('div');
      handle.className = `zone-edit-handle ${this.selectedVertexIndex === index ? 'is-selected' : ''}`;
      handle.style.left = `${pt[0]}%`;
      handle.style.top = `${pt[1]}%`;
      handle.title = `頂点 #${index + 1} (${pt[0]}%, ${pt[1]}%) - ドラッグで移動`;
      handle.innerHTML = `<span style="font-size:9px; font-weight:bold; color:#000;">${index + 1}</span>`;

      this.bindVertexHandleDrag(handle, index);
      mapEl.appendChild(handle);
    });
  },

  bindVertexHandleDrag(handleEl, index) {
    let startX = 0, startY = 0;

    const onStart = (e) => {
      e.stopPropagation();
      this.selectedVertexIndex = index;

      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;

      startX = clientX;
      startY = clientY;
      handleEl.classList.add('is-dragging');

      const onMove = (moveEvt) => {
        const curX = moveEvt.touches ? moveEvt.touches[0].clientX : moveEvt.clientX;
        const curY = moveEvt.touches ? moveEvt.touches[0].clientY : moveEvt.clientY;

        const viewport = document.querySelector('.map-viewport');
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();

        const dim = this.getFloorDimensions();
        const newX = Math.min(Math.max((((curX - rect.left - this.panX) / this.scale) / dim.width) * 100, 0), 100);
        const newY = Math.min(Math.max((((curY - rect.top - this.panY) / this.scale) / dim.height) * 100, 0), 100);

        const roundX = Math.round(newX * 10) / 10;
        const roundY = Math.round(newY * 10) / 10;

        this.editingZonePoints[index] = [roundX, roundY];

        handleEl.style.left = `${roundX}%`;
        handleEl.style.top = `${roundY}%`;

        const mapEl = document.getElementById(`map-${this.editingZone.floor}`);
        if (mapEl) {
          const polyEl = mapEl.querySelector('.temp-editing-polygon');
          if (polyEl) {
            const pointsStr = this.editingZonePoints.map(p => `${p[0]},${p[1]}`).join(' ');
            polyEl.setAttribute('points', pointsStr);
          }
        }
      };

      const onEnd = () => {
        handleEl.classList.remove('is-dragging');
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);

        this.renderVertexEditUI();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('touchend', onEnd);
    };

    handleEl.addEventListener('mousedown', onStart);
    handleEl.addEventListener('touchstart', onStart, { passive: false });
  },

  addVertexToEditingZone() {
    if (!this.editingZonePoints || this.editingZonePoints.length < 2) return;
    
    let maxDist = 0;
    let insertIdx = 0;
    let newPt = [50, 50];

    for (let i = 0; i < this.editingZonePoints.length; i++) {
      const p1 = this.editingZonePoints[i];
      const p2 = this.editingZonePoints[(i + 1) % this.editingZonePoints.length];
      const dist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (dist > maxDist) {
        maxDist = dist;
        insertIdx = i + 1;
        newPt = [
          Math.round(((p1[0] + p2[0]) / 2) * 10) / 10,
          Math.round(((p1[1] + p2[1]) / 2) * 10) / 10
        ];
      }
    }

    this.editingZonePoints.splice(insertIdx, 0, newPt);
    this.selectedVertexIndex = insertIdx;
    this.renderVertexEditUI();
  },

  deleteSelectedVertex() {
    if (!this.editingZonePoints || this.editingZonePoints.length <= 3) {
      alert('多角形を維持するには最低3個の頂点が必要です。');
      return;
    }
    const idx = this.selectedVertexIndex !== null ? this.selectedVertexIndex : this.editingZonePoints.length - 1;
    this.editingZonePoints.splice(idx, 1);
    this.selectedVertexIndex = Math.min(idx, this.editingZonePoints.length - 1);
    this.renderVertexEditUI();
  },

  saveEditingZoneVertices() {
    if (!this.editingZone || !this.editingZonePoints || this.editingZonePoints.length < 3) return;

    this.editingZone.points = [...this.editingZonePoints.map(pt => [...pt])];
    
    if (window.DataStorage) window.DataStorage.save();

    const savedZone = this.editingZone;
    this.exitVertexEditingMode();
    this.renderAllFloors();
    this.selectZone(savedZone);

    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="color:#f59e0b; font-weight:bold; font-size:13px; padding:6px 0;">
          ✅ ゾーン「${savedZone.name}」の頂点位置を保存・反映しました！ (${savedZone.points.length}頂点)
        </div>
      `;
    }
  },

  exitVertexEditingMode() {
    this.isVertexEditingMode = false;
    this.editingZone = null;
    this.editingZonePoints = null;
    this.selectedVertexIndex = null;

    document.body.classList.remove('vertex-editing-active');

    const bar = document.getElementById('vertex-editor-bar');
    if (bar) bar.style.display = 'none';

    document.querySelectorAll('.zone-edit-handle, .temp-editing-polygon').forEach(el => el.remove());
  },

  // ゾーン描画モードの起動・終了
  toggleZoneDrawingMode(enable) {
    const targetEnable = enable !== undefined ? enable : !this.isZoneDrawingMode;

    // 描画モードを終了しようとした時、未保存の頂点（3点以上）がある場合は保存確認プロンプトを出す
    if (!targetEnable && this.isZoneDrawingMode && this.currentZonePoints && this.currentZonePoints.length >= 3) {
      if (confirm('描画中のゾーンがまだ保存されていません。「OK」を押してゾーンを自動保存して終了しますか？\n（キャンセルを押すと保存せずに破棄します）')) {
        this.saveCurrentZone();
        return;
      }
    }

    this.isZoneDrawingMode = targetEnable;
    document.body.classList.toggle('zone-drawing-active', this.isZoneDrawingMode);

    // ゾーンレイヤーを自動ON
    const zoneChk = document.getElementById('layer-zone');
    if (this.isZoneDrawingMode && zoneChk) zoneChk.checked = true;

    if (!this.isZoneDrawingMode) {
      this.clearCurrentZoneDrawing();
    }
  },

  // クリックでゾーンの頂点ポイントを追加
  addZonePoint(x, y) {
    if (!this.isZoneDrawingMode) return;
    if (!this.currentZonePoints) this.currentZonePoints = [];
    this.currentZonePoints.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    this.updateZoneDrawingPreview();
  },

  // 1点戻す
  undoZonePoint() {
    if (this.currentZonePoints && this.currentZonePoints.length > 0) {
      this.currentZonePoints.pop();
      this.updateZoneDrawingPreview();
    }
  },

  // 全消去
  clearCurrentZoneDrawing() {
    this.currentZonePoints = [];
    const mapEl = document.getElementById(`map-${this.activeFloor}`);
    if (mapEl) {
      mapEl.querySelectorAll('.zone-vertex-dot, .temp-zone-preview-polygon').forEach(el => el.remove());
    }
    const countEl = document.getElementById('zone-point-count');
    if (countEl) countEl.textContent = '点数: 0';
  },

  // ライブプレビュー更新
  updateZoneDrawingPreview() {
    const mapEl = document.getElementById(`map-${this.activeFloor}`);
    if (!mapEl) return;

    // 既存プレビュー消去
    mapEl.querySelectorAll('.zone-vertex-dot, .temp-zone-preview-polygon').forEach(el => el.remove());

    const countEl = document.getElementById('zone-point-count');
    if (countEl) countEl.textContent = `点数: ${this.currentZonePoints ? this.currentZonePoints.length : 0}`;

    if (!this.currentZonePoints || this.currentZonePoints.length === 0) return;

    // 頂点ドットの描画
    this.currentZonePoints.forEach(pt => {
      const dot = document.createElement('div');
      dot.className = 'zone-vertex-dot';
      dot.style.left = `${pt[0]}%`;
      dot.style.top = `${pt[1]}%`;
      mapEl.appendChild(dot);
    });

    // 多角形SVGプレビュー
    if (this.currentZonePoints.length >= 2) {
      const zoneSvg = mapEl.querySelector('.zone-layer-svg');
      if (zoneSvg) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = this.currentZonePoints.map(pt => `${pt[0]},${pt[1]}`).join(' ');
        const color = document.getElementById('zone-draw-color')?.value || 'rgba(175,82,222,0.35)';

        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', color);
        polygon.setAttribute('stroke', '#af52de');
        polygon.setAttribute('stroke-width', '1.2');
        polygon.setAttribute('stroke-dasharray', '2 2');
        polygon.setAttribute('class', 'temp-zone-preview-polygon');
        polygon.style.pointerEvents = 'none'; // クリックイベント干渉を防止

        zoneSvg.appendChild(polygon);
      }
    }
  },

  // ゾーンを完成・保存
  saveCurrentZone() {
    if (!this.currentZonePoints || this.currentZonePoints.length < 3) {
      alert('ゾーンを形成するには最低3箇所の点（角）をクリックしてください。');
      return;
    }

    const selectEl = document.getElementById('zone-draw-color');
    const selectedOpt = selectEl ? selectEl.options[selectEl.selectedIndex] : null;

    const color = selectEl?.value || 'rgba(0,122,255,0.25)';
    const borderColor = selectedOpt?.dataset.border || '#007aff';
    const catName = selectedOpt?.dataset.name || 'Zone';

    const nameInput = document.getElementById('zone-draw-name');
    const name = nameInput?.value.trim() || `Zone ${catName}`;

    const newZone = {
      id: `ZONE-${Date.now()}`,
      name: name,
      nameEn: name,
      floor: this.activeFloor,
      points: [...this.currentZonePoints],
      color: color,
      borderColor: borderColor
    };

    VENUE_DATA.zones.push(newZone);

    if (window.DataStorage) window.DataStorage.save();

    // 描画中ポイントを作業用リストからクリアしてから描画モードを終了
    this.currentZonePoints = [];
    this.toggleZoneDrawingMode(false);
    this.renderAllFloors();
    this.selectZone(newZone);

    const panel = document.getElementById('info-panel');
    if (panel) {
      panel.innerHTML = `
        <div style="color:#007aff; font-weight:bold; font-size:13px; padding:6px 0;">
          📐 新しいゾーン「${name}」を作成・保存しました！ (${newZone.points.length}頂点)
        </div>
      `;
    }
  },

  deleteZone(zoneId) {
    if (confirm('このゾーンを削除しますか？')) {
      VENUE_DATA.zones = VENUE_DATA.zones.filter(z => z.id !== zoneId);
      if (window.DataStorage) window.DataStorage.save();
      this.renderAllFloors();
      this.clearSpotPreview();
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
      if (e.target.closest('.zoom-controls, .zone-drawer-bar, .modal-backdrop')) return;
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
      if (e.target.closest('.zoom-controls, .zone-drawer-bar, .modal-backdrop, .room-pin, .acp-pin')) return;

      // 画面をドラッグ移動した直後、またはピン移動直後の誤タップは完全に無視（モーダルを開かない）
      if (mapDragDistance > 6 || this.justDraggedPin) {
        mapDragDistance = 0;
        return;
      }

      const rect = viewport.getBoundingClientRect();
      const dim = this.getFloorDimensions();
      const x = (((e.clientX - rect.left - this.panX) / this.scale) / dim.width) * 100;
      const y = (((e.clientY - rect.top - this.panY) / this.scale) / dim.height) * 100;

      if (this.isZoneDrawingMode) {
        this.addZonePoint(x, y);
        return;
      }

      // 静止した状態で空白エリアをクリックした場合のみ、新規追加モーダルを開く
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
