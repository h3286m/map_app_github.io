const fs = require('fs');

const parsed = JSON.parse(fs.readFileSync('./scratch/parsed_data.json', 'utf8'));

const departments = [
  { code: 'ALL', name: '全部署 (All Departments)' },
  { code: 'SPT', name: '競技・スポーツ (Sports)', color: '#007aff' },
  { code: 'OFS', name: '大会要人・プロトコル (Official / Protocol)', color: '#af52de' },
  { code: 'TEC', name: '計測・テクノロジー (Technology & OVR)', color: '#00c7be' },
  { code: 'SEC', name: '警備・セキュリティ (Security / VSCC)', color: '#ff3b30' },
  { code: 'SPP', name: '演出・プロダクション (Special Production)', color: '#ff9500' },
  { code: 'CER', name: '表彰・セレモニー (Ceremonies)', color: '#ff2d55' },
  { code: 'BRS', name: '放送・中継 (Broadcast / HB)', color: '#5856d6' },
  { code: 'PRS', name: '報道・プレス (Press & Media)', color: '#ff9500' },
  { code: 'DOP', name: 'ドーピング検査 (Doping Control)', color: '#34c759' },
  { code: 'PEM', name: 'アクレディ・ID (Check-In)', color: '#ff2d55' },
  { code: 'VEM', name: 'ボランティア (Volunteer & VOC)', color: '#34c759' },
  { code: 'CNW', name: '清掃・廃棄物 (Cleaning & Waste)', color: '#8e8e93' },
  { code: 'LOG', name: '資材・物流 (Logistics)', color: '#5856d6' },
  { code: 'TRA', name: '輸送・駐車場 (Transport)', color: '#007aff' },
  { code: 'VNI', name: '会場インフラ (Infrastructure)', color: '#64748b' },
  { code: 'BIL', name: '二国間・運営 (Bilateral)', color: '#64748b' },
  { code: 'EVS', name: '観客・案内サービス (Event Services)', color: '#ff9500' },
  { code: 'FNB', name: '飲食・ケータリング (Food & Beverage)', color: '#ff9500' },
  { code: 'MED', name: '救護・医務 (Medical)', color: '#34c759' },
  { code: 'NRG', name: '電力・エネルギー (Energy / Power)', color: '#ffcc00' },
  { code: 'GLE', name: '敷地管理 (Green & Landscape)', color: '#34c759' },
  { code: 'TKT', name: 'チケット (Ticketing)', color: '#ff2d55' }
];

const floors = [
  { id: 'outdoor', name: '屋外', nameEn: 'Outdoor Site Plan', mapBg: 'assets/outdoor.png' },
  { id: '1f', name: '1階', nameEn: '1st Floor (Pools & Field Operations)', mapBg: 'assets/floor1.png' },
  { id: '2f', name: '2階', nameEn: '2nd Floor (VIP, Press & Commentary)', mapBg: 'assets/floor2.png' }
];

const zones = [
  {
    id: 'ZONE_1F_MAIN',
    floor: '1f',
    name: '1階アリーナ・競技運営エリア',
    nameEn: '1F Field & Operations Area',
    color: 'rgba(0, 122, 255, 0.2)',
    borderColor: '#007aff',
    points: [[20, 20], [85, 20], [85, 85], [20, 85]]
  },
  {
    id: 'ZONE_2F_MAIN',
    floor: '2f',
    name: '2階メディア・プロトコル観覧エリア',
    nameEn: '2F Media & Protocol Level',
    color: 'rgba(175, 82, 222, 0.2)',
    borderColor: '#af52de',
    points: [[15, 15], [88, 15], [88, 80], [15, 80]]
  },
  {
    id: 'ZONE_OUTDOOR_MAIN',
    floor: 'outdoor',
    name: '屋外配置・駐車場・スクリーニングエリア',
    nameEn: 'Outdoor Site & Screening Area',
    color: 'rgba(52, 199, 89, 0.2)',
    borderColor: '#34c759',
    points: [[10, 10], [90, 10], [90, 90], [10, 90]]
  }
];

const dataJsContent = `/**
 * オフライン会場マップ - データ管理モジュール (VENUE_DATA)
 * ユーザー様提供のエクセルデータ (HSC Venue Cluster 6) に基いて全件自動生成
 */

const VENUE_DATA = {
  floors: ${JSON.stringify(floors, null, 2)},
  departments: ${JSON.stringify(departments, null, 2)},
  zones: ${JSON.stringify(zones, null, 2)},
  rooms: ${JSON.stringify(parsed.rooms, null, 2)},
  acps: ${JSON.stringify(parsed.acps, null, 2)}
};

// データ永続化 (LocalStorage) & 自動保存ヘルパー
const DataStorage = {
  STORAGE_KEY: 'OFFLINE_VENUE_MAP_DATA_V2',

  init() {
    const saved = localStorage.getItem(this.STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.rooms && parsed.acps) {
          VENUE_DATA.rooms = parsed.rooms;
          VENUE_DATA.acps = parsed.acps;
          if (parsed.zones) VENUE_DATA.zones = parsed.zones;
        }
      } catch (e) {
        console.warn('Failed to parse saved venue data:', e);
      }
    }
  },

  save() {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
      rooms: VENUE_DATA.rooms,
      acps: VENUE_DATA.acps,
      zones: VENUE_DATA.zones
    }));
  },

  reset() {
    localStorage.removeItem(this.STORAGE_KEY);
    location.reload();
  },

  exportDataJs() {
    const jsContent = \`/**
 * オフライン会場マップ - データ管理モジュール (VENUE_DATA)
 * 最新編集データ
 */

const VENUE_DATA = \${JSON.stringify(VENUE_DATA, null, 2)};
\`;
    const blob = new Blob([jsContent], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'data.js';
    a.click();
    URL.revokeObjectURL(url);
  }
};

DataStorage.init();
`;

fs.writeFileSync('./js/data.js', dataJsContent);
console.log('js/data.js successfully updated with user dataset!');
