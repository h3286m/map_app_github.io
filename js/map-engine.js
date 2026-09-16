/**
 * オフライン会場マップ - マップエンジン モジュール (MapEngine)
 * 動的ピン描画、SVGゾーン描画、パン＆ズーム操作、経路描画、詳細パネル制御を統括
 */

const MapEngine = {
  activeFloor: 'outdoor',
  activePinId: null,
  scale: 1,
  panX: 0,
  panY: 0,
  isDragging: false,
  startX: 0,
  startY: 0,
  isEditorMode: false,

  init() {
    this.bindEvents();
    this.renderAllFloors();
    this.setupPanZoom();
  },

  // 1. 各階のピン・ゾーン・SVGレイヤーの動的生成
  renderAllFloors() {
    VENUE_DATA.floors.forEach(floor => {
      const mapEl = document.getElementById(`map-${floor.id}`);
      // 既存動的コンテンツのクリア（背景画像は残す）
      mapEl.querySelectorAll('.room-pin-container, .acp-pin-container, .zone-layer-svg, .route-layer-svg').forEach(el => el.remove());

      // 諸室ピンコンテナの生成
      const roomContainer = document.createElement('div');
      roomContainer.className = 'room-pin-container';

      const floorRooms = VENUE_DATA.rooms.filter(r => r.floor === floor.id);
      floorRooms.forEach(room => {
        const pin = document.createElement('div');
        pin.className = 'room-pin';
        pin.dataset.id = room.id;
        pin.style.left = `${room.x}%`;
        pin.style.top = `${room.y}%`;

        // 部署カラーを取得
        const dept = VENUE_DATA.departments.find(d => d.code === room.dept) || { color: '#007aff' };
        if (dept.color) pin.style.backgroundColor = dept.color;
        
        pin.innerHTML = `
          <div class="pin-tooltip">
            <div class="pin-tooltip-title">
              <span class="dept-badge" style="background:${dept.color}">${room.dept}</span>
              ${room.name}
            </div>
            <div class="pin-tooltip-sub">${room.code} ${room.nameEn ? '| ' + room.nameEn : ''}</div>
            ${room.acp && room.acp !== 'なし' ? `<div class="pin-tooltip-acp-badge">🛡️ ACP: ${room.acp}</div>` : ''}
          </div>
        `;

        pin.addEventListener('mouseenter', () => {
          this.previewSpot('room', room);
        });

        pin.addEventListener('mouseleave', () => {
          this.clearSpotPreview();
        });

        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isEditorMode) return;
          this.selectSpot('room', room);
        });

        this.bindPinDragEvents(pin, 'room', room);
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
          🛡
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

        pin.addEventListener('click', (e) => {
          e.stopPropagation();
          if (this.isEditorMode) return;
          this.selectSpot('acp', acp);
        });

        this.bindPinDragEvents(pin, 'acp', acp);
        acpContainer.appendChild(pin);
      });
      mapEl.appendChild(acpContainer);

      // 📐 ゾーン多角形 SVG レイヤーの生成
      const zoneSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      zoneSvg.setAttribute('class', 'zone-layer-svg');
      zoneSvg.setAttribute('viewBox', '0 0 100 100');
      zoneSvg.setAttribute('preserveAspectRatio', 'none');

      const floorZones = VENUE_DATA.zones.filter(z => z.floor === floor.id);
      floorZones.forEach(zone => {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const pointsStr = zone.points.map(pt => `${pt[0]},${pt[1]}`).join(' ');
        polygon.setAttribute('points', pointsStr);
        polygon.setAttribute('fill', zone.color || 'rgba(0,122,255,0.2)');
        polygon.setAttribute('stroke', zone.borderColor || '#007aff');
        polygon.setAttribute('stroke-width', '0.8');
        polygon.setAttribute('class', 'zone-polygon');

        // ゾーンタップ時の情報表示
        polygon.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectZone(zone);
        });

        zoneSvg.appendChild(polygon);
      });
      mapEl.appendChild(zoneSvg);

      // 〰️ ルート描画用 SVG レイヤー
      const routeSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      routeSvg.setAttribute('class', 'route-layer-svg');
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

        if (Math.hypot(curX - startX, curY - startY) > 3) {
          hasDragged = true;
        }

        const viewport = document.querySelector('.map-viewport');
        if (!viewport) return;
        const rect = viewport.getBoundingClientRect();

        const newX = Math.min(Math.max((((curX - rect.left - this.panX) / this.scale) / rect.width) * 100, 0), 100);
        const newY = Math.min(Math.max((((curY - rect.top - this.panY) / this.scale) / rect.height) * 100, 0), 100);

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

          const panel = document.getElementById('info-panel');
          if (panel) {
            panel.innerHTML = `
              <div style="color:#34c759; font-weight:bold; font-size:13px; padding:6px 0;">
                ✅ 「${item.name}」の位置をドラッグ移動し、自動保存しました！ (X: ${item.x}%, Y: ${item.y}%)
              </div>
            `;
          }
        } else {
          // ドラッグ移動しなかった場合（通常のクリック） ➔ 編集ダイアログを開く
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
          マップ上の <b>📍 諸室ピン</b> や <b>🛡️ ACP (アクセスポイント)</b> にカーソルを重ねると詳細情報が表示されます。
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

  selectZone(zone) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;

    panel.innerHTML = `
      <div class="detail-card">
        <div class="detail-header">
          <div>
            <div class="detail-title">📐 ゾーン: ${zone.name}</div>
            <div class="detail-code">Zone ID: ${zone.id} | ${zone.nameEn}</div>
          </div>
          <span class="badge" style="background:${zone.borderColor || '#007aff'}">${zone.floor.toUpperCase()} ゾーン</span>
        </div>
        <div style="margin-top:6px; font-size:12px; color:var(--text-secondary);">
          本エリアの区画内に含まれる諸室およびACPは、レイヤーメニューから個別に表示/非表示を切り替え可能です。
        </div>
      </div>
    `;
  },

  // 3. パン＆ズーム物理エンジンのセットアップ
  setupPanZoom() {
    const viewport = document.querySelector('.map-viewport');
    const container = document.querySelector('.map-container');
    if (!viewport || !container) return;

    const updateTransform = () => {
      container.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    };

    // マウスドラッグ
    viewport.addEventListener('mousedown', (e) => {
      if (e.target.closest('.zoom-controls')) return;
      this.isDragging = true;
      this.startX = e.clientX - this.panX;
      this.startY = e.clientY - this.panY;
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      this.panX = e.clientX - this.startX;
      this.panY = e.clientY - this.startY;
      updateTransform();
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    // マウスホイールズーム
    viewport.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      const newScale = Math.min(Math.max(this.scale * zoomFactor, 0.7), 4.0);
      
      // カーソル位置を中心にズーム調整
      const rect = viewport.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      this.panX = mouseX - (mouseX - this.panX) * (newScale / this.scale);
      this.panY = mouseY - (mouseY - this.panY) * (newScale / this.scale);
      this.scale = newScale;
      updateTransform();
    }, { passive: false });

    // タッチによるドラッグ（モバイル対応）
    let touchStartX = 0, touchStartY = 0;
    viewport.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        touchStartX = e.touches[0].clientX - this.panX;
        touchStartY = e.touches[0].clientY - this.panY;
      }
    });

    viewport.addEventListener('touchmove', (e) => {
      if (this.isDragging && e.touches.length === 1) {
        this.panX = e.touches[0].clientX - touchStartX;
        this.panY = e.touches[0].clientY - touchStartY;
        updateTransform();
      }
    });

    viewport.addEventListener('touchend', () => {
      this.isDragging = false;
    });

    // ビジュアルピン追加モーダル起動 (クリックした位置の%座標を自動入力)
    viewport.addEventListener('click', (e) => {
      if (!this.isEditorMode || e.target.closest('.room-pin, .acp-pin, .zoom-controls')) return;
      const rect = viewport.getBoundingClientRect();
      const x = (((e.clientX - rect.left - this.panX) / this.scale) / rect.width) * 100;
      const y = (((e.clientY - rect.top - this.panY) / this.scale) / rect.height) * 100;

      if (window.openSpotEditor) {
        window.openSpotEditor({ x, y, floor: this.activeFloor });
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
      this.scale = 1;
      this.panX = 0;
      this.panY = 0;
      updateTransform();
    });
  },

  // 4. フロア切り替え
  switchFloor(floorId) {
    this.activeFloor = floorId;
    const tabRadio = document.getElementById(`tab-${floorId}`);
    if (tabRadio) tabRadio.checked = true;

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
      this.panX = (rect.width / 2) - (rect.width * (target.x / 100) * this.scale);
      this.panY = (rect.height / 2) - (rect.height * (target.y / 100) * this.scale);
      
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
        if (e.target.checked) this.activeFloor = fl;
      });
    });
  }
};
