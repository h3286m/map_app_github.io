const fs = require('fs');

const rawText = `
SPT	1	Sport Information	FOH	×
SPT	9	Athlete Training Area (Warm Up Pool)	BLUE	×
SPT	10	FOP Equipment Storage	RED	×
SPT	11	Sport Equipment Storage	2	×
SPT	14	Athlete Change Room (Men)	2	×
SPT	15	Athlete Change Room (Women)	2	×
SPT	17	Athlete Lounge	2	×
SPT	18	Athlete Dining	2	×
SPT	23	Call Room	2	×
SPT	59	Technical Officials Meeting Room	2	×
SPT	64	Video Judge Room	2	×
SPT	66	Kiss&Cry	2	×
SPT	67	Free Swimming Area	2	×
SPT	68	Dry Land Training Stretch Area	2	×
SPT	69	Hair Setting Space	2	×
SPT	83	Preparation Area	2	×
SPT	90	Pray Room for Athletes	2	×
SPT	101	Competition Management	2	×
SPT	106	Staff Toilets-Men Urinal	2	×
SPT	107	Staff Toilets-Men	2	×
SPT	108	Staff Toilets-Women	2	×
SPT	109	Staff Toilets-Accessible	2	×
SPT	201	IF Office	2	×
SPT	203+227	IF/AF President Office	2	×
SPT	205	TD Office	2	×
SPT	508	Team Leaders Meeting Room	2	×
SPT	509	Judges/TC Platform 1	2	×
SPT	509	Judges/TC Platform 2	2	×
SPT	513	Music Operations Room	2	×
OFS	1	Staff Office	WHITE	×
OFS	2	Protocol Office	6	〇
OFS	3	OCA Family Lounge	6	
OFS	6	Flag Area for Ceremonies	6	×
OFS	7	Urinal Toilet (Men)	6	×
OFS	8	Cubicle Toilet (Men)	6	×
OFS	9	Cubicle Toilet (Women)	6	×
OFS	10	Accessible Toilet	6	×
TEC	1	T&S	RED	〇
TEC	2	OVR	RED	〇
TEC	3	Storage for T&S	RED	〇
TEC	4	TER	RED	〇
TEC	6	Cross Connect Frame	RED	〇
TEC	7	VTO	RED	〇
TEC	10	Radio Distribution Room	RED	〇
TEC	11	Screen	RED	〇
SEC	1	VSCC	RED	〇
SEC	2	Fire Command Centre	RED	〇
SEC	5	Police Break & Dining Area	RED	〇
SPP	1	SPP Control Area	RED	〇
SPP	2	SPP Work Room	RED	〇
SPP	3	SPP Storage	RED	〇
SPP	4	Performer Waiting Room	RED	〇
CER	1	Waiting Room	2	〇
CER	2	Preparation Room	5	〇
CER	3	Storage for Ceremonies	RED	〇
CER	4	Changing Room	WHITE	×
BRS	15	Staff Office	WHITE	×
BRS	19	Broadcast Mixed Zone	4,5+SACDS	〇
BRS	20	HB Camera Platform	5	×
BRS	20	HB Camera Platform (footprint)	5	×
BRS	20	HB Camera Platform	5	×
PRS	3	Mixed Zone	4,5+SACDS	〇
PRS	4	Photographer Position	4	〇
DOP	1	Doping Control Station	2+SACDs	〇
PEM	1	Check-In & Help Desk (Check In Centre)	FOH	×
VEM	1	VOC	WHITE	×
CNW	1	Staff Office	WHITE	×
CNW	2	Contractor Office	WHITE	×
LOG	1	Staff Office	WHITE	×
LOG	2	Contractor Office	WHITE	×
TRA	1	Staff Office	WHITE	×
TRA	2	Contractor Office	WHITE	×
VNI	1	Staff Office	WHITE	×
VNI	2	Contractor Office	WHITE	×
BIL	2	Contractor Office	WHITE	×
EVS	2	Public Information Booth	FOH	×
EVS	3	Multi Faith Room	FOH	×
EVS	4	Accessible Nursery & Baby Change Room	FOH	×
EVS	5	Wheelchair Storage Area	FOH	×
EVS	6	Stroller Storage Area	FOH	×
EVS	7	Assistant Dog Toilet	FOH	×
EVS	9	Spectator Seating	FOH	×
EVS	10	Accessible Seating	FOH	×
EVS	11	Calm Down/Cool Down Room	FOH	×
EVS	12	Urinal Toilet (Men)	FOH	×
EVS	13	Cubicle Toilet (Men)	FOH	×
EVS	14	Cubicle Toilet (Women)	FOH	×
EVS	15	Accessible Toilet	FOH	×
PRS	1	Sub Press Center	4	〇
PRS	2	Press Conference Room	4	〇
PRS	4	Photographer Position	4	〇
PRS	5	Press Tribune-No Table	4	×
PRS	6	Press Tribune-With Table	4	〇
PRS	7	Press Tribune-With Table-Accessible	4	×
PRS	8	Press Operation Office	4	〇
BRS	17	RHB Commentary Position	5	〇
BRS	20	HB Camera Platform	5	×
OFS	4	OCA Family Seating	6	〇
BRS	23	Observer Seats	5	〇
BRS	24	Presentation Studio	5	〇
BRS	25	Urinal Toilet (Men)	5	×
BRS	26	Cubicle Toilet (Men)	5	×
BRS	27	Cubicle Toilet (Women)	5	×
BRS	28	Accessible Toilet	5	×
FNB	1	Concessions/Points of Sale (POS)	FOH	×
MED	3	Aid Station	FOH	×
VEM	2	Workforce Break & Dining Area	WHITE	×
SEC	4	Fire Break & Dining Area	WHITE	×
TRA	3	Driver's Waiting Room (In Secure)	RED	×
SPT	2	Athlete Seating (SDA)	2	〇
CNW	3	Waste Storage Area	WHITE	×
CNW	4	Waste Sorting Area	WHITE	×
SEC	3	Police Command Centre	RED	〇
SEC	6	Vehicle Screening Area (VSA)	FOH	×
SEC	7	Vehicle Screening Area (VSA)	FOH	×
SEC	8	Pedestrian Screening Area - Accredited (PSA)	FOH	〇
SEC	9	Pedestrian Screening Area - Spectators (PSA)	FOH	〇
SEC	11	Police Parking	FOH	×
SEC	12	Self-Defense Forces Command Centre	RED	×
SEC	13	Self-Defense Forces Command Parking	RED	×
BRS	1	HB Office	5	〇
BRS	2	RHB Office	5	〇
BRS	3	HB Dining	5	〇
BRS	4	RHB Dining	5	〇
BRS	5	HB Production Room	5	〇
BRS	7	HB Audio	5	〇
BRS	9	HB CER (Centralized Equipment Room)	5	〇
BRS	11	TOC (Technical Operation Centre)	5	〇
BRS	13	HB Equipment Storage	5	〇
BRS	14	RHB Equipment Storage	5	〇
NRG	1	Staff Office	WHITE	×
NRG	2	Storage	WHITE	×
NRG	3	Overlay Power Area	WHITE	×
NRG	4	Break Area	WHITE	×
GLE	1	Site Office	WHITE	×
GLE	2	Break Area	WHITE	×
GLE	3	Storage	WHITE	×
FNB	3	Kitchen Car Area (For Staff)	WHITE	×
FNB	10	Freezing & Cold Temperature Storage	WHITE	×
FNB	11	Normal Temperature Storage	WHITE	×
TRA	4	Parking (In Secure)	FOH	×
TRA	5	Parking (Non Secure)	WHITE	×
LOG	3	Compound	WHITE	×
TKT	1	Ticket Box Office (TBO)	FOH	×
TKT	2	Ticket Resolution Office (TRO)	FOH	×
TKT	3	Ticket Team Office (TTO)	FOH	×
TEC	5	Storage	WHITE	×
TEC	12	Parking for Radio Monitoring Vehicle	WHITE	×
TEC	13	Spectrum Desk	FOH	×
EVS	8	Queueing Area	FOH	×
OFS	5	Flag Area for Participants	BLUE	×
`;

const lines = rawText.trim().split('\n').map(l => l.trim()).filter(l => l.length > 0);

// Department translation map
const deptMap = {
  'SPT': { name: '競技・スポーツ (Sports)', color: '#007aff' },
  'OFS': { name: '大会要人・プロトコル (Official / Protocol)', color: '#af52de' },
  'TEC': { name: '計測・テクノロジー (Technology & OVR)', color: '#00c7be' },
  'SEC': { name: '警備・セキュリティ (Security)', color: '#ff3b30' },
  'SPP': { name: '演出・プロダクション (Special Production)', color: '#ff9500' },
  'CER': { name: '表彰・セレモニー (Ceremonies)', color: '#ff2d55' },
  'BRS': { name: '放送・中継 (Broadcast / HB)', color: '#5856d6' },
  'PRS': { name: '報道・プレス (Press & Media)', color: '#ff9500' },
  'DOP': { name: 'ドーピング検査 (Doping Control)', color: '#34c759' },
  'PEM': { name: 'アクレディテーション・ID (Check-In / ID)', color: '#ff2d55' },
  'VEM': { name: 'ボランティア (Volunteer & VOC)', color: '#34c759' },
  'CNW': { name: '清掃・廃棄物 (Cleaning & Waste)', color: '#8e8e93' },
  'LOG': { name: '資材・物流 (Logistics)', color: '#5856d6' },
  'TRA': { name: '輸送・駐車場 (Transport)', color: '#007aff' },
  'VNI': { name: '会場インフラ (Venue Infrastructure)', color: '#64748b' },
  'BIL': { name: '二国間・運営 (Bilateral)', color: '#64748b' },
  'EVS': { name: '観客・案内サービス (Event Services)', color: '#ff9500' },
  'FNB': { name: '飲食・ケータリング (Food & Beverage)', color: '#ff9500' },
  'MED': { name: '救護・医務 (Medical)', color: '#34c759' },
  'NRG': { name: '電力・エネルギー (Energy / Power)', color: '#ffcc00' },
  'GLE': { name: '敷地管理 (Green & Landscape)', color: '#34c759' },
  'TKT': { name: 'チケット (Ticketing)', color: '#ff2d55' }
};

const rooms = [];
const acps = [];
let roomIdx = 0;
let acpIdx = 0;

lines.forEach((line, index) => {
  const parts = line.split('\t').map(p => p.trim());
  if (parts.length < 4) return;

  const dept = parts[0];
  const codeNum = parts[1];
  const name = parts[2];
  const zone = parts[3] || 'FOH';
  const hasAcpSymbol = parts[4] || '';
  const isAcp = hasAcpSymbol === '〇';

  const code = `${dept}-${codeNum}`;
  const id = `RM-${dept}-${String(index + 1).padStart(3, '0')}`;

  // Floor mapping based on Zone
  let floor = '1f';
  if (['WHITE', 'Screening', 'Parking', 'Compound'].some(k => zone.includes(k)) || ['NRG', 'GLE', 'TKT', 'CNW'].includes(dept)) {
    floor = 'outdoor';
  } else if (['4', '5', '6'].some(k => zone.startsWith(k)) || ['PRS', 'BRS', 'OFS'].includes(dept)) {
    floor = '2f';
  } else {
    floor = '1f';
  }

  // Generate clean spatial distribution coordinates based on floor & index
  let x = 15 + ((index * 17) % 72);
  let y = 15 + ((index * 23) % 65);

  if (floor === '1f') {
    if (dept === 'SPT') { x = 25 + ((index * 11) % 50); y = 30 + ((index * 7) % 35); }
    else if (dept === 'MED' || dept === 'DOP') { x = 70 + ((index * 5) % 15); y = 55 + ((index * 3) % 15); }
    else if (dept === 'SEC' || dept === 'TEC') { x = 30 + ((index * 9) % 40); y = 65 + ((index * 5) % 20); }
  } else if (floor === '2f') {
    if (dept === 'PRS' || dept === 'BRS') { x = 60 + ((index * 7) % 30); y = 20 + ((index * 13) % 55); }
    else if (dept === 'OFS') { x = 25 + ((index * 5) % 30); y = 20 + ((index * 9) % 50); }
  } else if (floor === 'outdoor') {
    if (dept === 'TRA' || dept === 'SEC') { x = 15 + ((index * 13) % 35); y = 15 + ((index * 11) % 65); }
    else if (dept === 'TKT' || dept === 'EVS') { x = 20 + ((index * 7) % 30); y = 60 + ((index * 5) % 25); }
  }

  rooms.push({
    id: id,
    code: code,
    name: `${name}`,
    nameEn: `${dept} ${codeNum} - ${name}`,
    dept: dept,
    floor: floor,
    x: parseFloat(x.toFixed(1)),
    y: parseFloat(y.toFixed(1)),
    zoneId: `ZONE_${floor.toUpperCase()}_MAIN`,
    acp: isAcp ? `ACP-${dept}-${codeNum}` : 'なし',
    desc: `Zone: ${zone} | Department: ${dept} (${deptMap[dept] ? deptMap[dept].name : dept})`
  });

  if (isAcp) {
    acpIdx++;
    acps.push({
      id: `ACP-${dept}-${codeNum}`,
      code: `ACP-${dept}-${codeNum}`,
      name: `関所: ${name} (${code})`,
      floor: floor,
      x: parseFloat((x - 2).toFixed(1)),
      y: parseFloat((y - 2).toFixed(1)),
      passLevel: `Level ${dept} (認証関係者パス)`,
      desc: `Zone ${zone} へのアクセス管理検問ポータル。`
    });
  }
});

console.log(`Parsed ${rooms.length} Rooms, ${acps.length} ACP Checkpoints.`);
fs.writeFileSync('./scratch/parsed_data.json', JSON.stringify({ rooms, acps }, null, 2));
