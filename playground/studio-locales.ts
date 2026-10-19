import { getSiteLocale } from './site-i18n.js';
import type { SiteLocale } from './site-i18n.js';
import type { MaterialShapeName } from '../src/core/shapes.js';
import type { AccessoryPreset } from '../src/core/design.js';

/** Explicit, complete four-language catalogs. Runtime/API identifiers never change. */
type Translation = readonly [ko: string, en: string, zhCN: string, ja: string];
const localeIndex: Record<SiteLocale, number> = { ko: 0, en: 1, 'zh-CN': 2, ja: 3 };
export const STUDIO_TEXT = {
  "나의 도우미": ["나의 도우미", "My companion", "我的小伙伴", "私の相棒"],
  "대기": ["대기", "Idle", "待机", "待機"],
  "생각 중": ["생각 중", "Thinking", "思考中", "考え中"],
  "듣는 중": ["듣는 중", "Listening", "聆听中", "聞き取り中"],
  "말하는 중": ["말하는 중", "Speaking", "说话中", "話し中"],
  "축하": ["축하", "Celebrating", "庆祝", "お祝い"],
  "정적": ["정적", "Still", "静止", "静止"],
  "정면": ["정면", "Front", "正面", "正面"],
  "사선 45°": ["사선 45°", "Three-quarter 45°", "斜侧面 45°", "斜め 45°"],
  "측면 90°": ["측면 90°", "Side 90°", "侧面 90°", "側面 90°"],
  "캐릭터 미리보기, 드래그로 몸체 방향 조절": ["캐릭터 미리보기, 드래그로 몸체 방향 조절", "Character preview; drag to rotate the body", "角色预览，拖动可调整身体方向", "キャラクターのプレビュー。ドラッグで体の向きを調整"],
  "몸체 색상": ["몸체 색상", "Body color", "身体颜色", "体の色"],
  "눈": ["눈", "Eyes", "眼睛", "目"],
  "눈 색상": ["눈 색상", "Eye color", "眼睛颜色", "目の色"],
  "눈의 비율과 간격은 도형에 자연스럽게 맞춰집니다. 표정은 애니메이션 탭에서 조절하세요.": ["눈의 비율과 간격은 도형에 자연스럽게 맞춰집니다. 표정은 애니메이션 탭에서 조절하세요.", "Eye proportions and spacing adapt to each shape. Adjust expressions in the Animation tab.", "眼睛的比例和间距会自动适应形状。请在“动画”选项卡中调整表情。", "目の比率と間隔は形に合わせて調整されます。表情は「アニメーション」タブで設定できます。"],
  "액세서리": ["액세서리", "Accessories", "配饰", "アクセサリー"],
  "슬롯마다 하나씩. 같은 항목을 다시 누르면 해제됩니다.": ["슬롯마다 하나씩. 같은 항목을 다시 누르면 해제됩니다.", "One per slot. Click the selected item again to remove it.", "每个位置可佩戴一件。再次点击已选配饰即可移除。", "各スロットに1つ装着できます。同じアイテムをもう一度押すと外れます。"],
  "비어 있음": ["비어 있음", "Empty", "空", "未装着"],
  "보타이와 스카프는 목 슬롯을 공유합니다. 왼쪽과 오른쪽 귀걸이는 각각 선택할 수 있습니다.": ["보타이와 스카프는 목 슬롯을 공유합니다. 왼쪽과 오른쪽 귀걸이는 각각 선택할 수 있습니다.", "Bow ties and scarves share the neck slot. Choose left and right earrings independently.", "领结与围巾共用颈部位置。左右耳饰可以分别选择。", "蝶ネクタイとマフラーは首のスロットを共有します。左右のイヤリングは個別に選べます。"],
  "움직임": ["움직임", "Movement", "动作", "動き"],
  "재생": ["재생", "Play", "播放", "再生"],
  "일시 정지": ["일시 정지", "Pause", "暂停", "一時停止"],
  "봇 상태": ["봇 상태", "Companion activity", "伙伴状态", "キャラクターの状態"],
  "마우스 시선 추적": ["마우스 시선 추적", "Cursor tracking", "鼠标视线跟踪", "マウス追視"],
  "마우스 시선 추적 모드": ["마우스 시선 추적 모드", "Cursor tracking mode", "鼠标视线跟踪模式", "マウス追視モード"],
  "꺼짐": ["꺼짐", "Off", "关闭", "オフ"],
  "눈만": ["눈만", "Eyes only", "仅眼睛", "目のみ"],
  "눈과 몸": ["눈과 몸", "Eyes and body", "眼睛和身体", "目と体"],
  "눈만 또는 눈과 몸이 페이지의 마우스를 따라봅니다. 몸 움직임은 기존 모션 위에 부드럽게 더해지며 몸체 방향을 바꾸지 않습니다. 장면 JSON에 저장됩니다.": ["눈만 또는 눈과 몸이 페이지의 마우스를 따라봅니다. 몸 움직임은 기존 모션 위에 부드럽게 더해지며 몸체 방향을 바꾸지 않습니다. 장면 JSON에 저장됩니다.", "Let the eyes, or eyes and body, follow the cursor. Body tracking blends smoothly with existing motion without changing body orientation. Saved in scene JSON.", "让眼睛或眼睛与身体跟随页面上的鼠标。身体跟踪会平滑叠加到现有动作上，不会改变身体方向。此设置会保存到场景 JSON。", "目のみ、または目と体でページ上のマウスを追います。体の動きは既存のモーションに自然に加わり、体の向きは変えません。設定はシーン JSON に保存されます。"],
  "왼쪽 보기": ["왼쪽 보기", "Look left", "看向左侧", "左を見る"],
  "정면 보기": ["정면 보기", "Look forward", "看向正面", "正面を見る"],
  "오른쪽 보기": ["오른쪽 보기", "Look right", "看向右侧", "右を見る"],
  "얼굴 이동": ["얼굴 이동", "Move face", "移动脸部", "顔を移動"],
  "도형 전환": ["도형 전환", "Shape transition", "形状过渡", "形の切り替え"],
  "전환 시간": ["전환 시간", "Duration", "过渡时长", "切り替え時間"],
  "전환 느낌": ["전환 느낌", "Easing", "缓动方式", "変化の仕方"],
  "부드럽게": ["부드럽게", "Smooth", "平滑", "なめらか"],
  "일정하게": ["일정하게", "Linear", "匀速", "一定速度"],
  "빠르게 다시 골라도 현재 윤곽에서 이어집니다. 모션 줄이기 설정에서는 즉시 적용합니다.": ["빠르게 다시 골라도 현재 윤곽에서 이어집니다. 모션 줄이기 설정에서는 즉시 적용합니다.", "Even rapid changes continue from the current outline. Reduced-motion settings apply changes instantly.", "即使快速切换，也会从当前轮廓继续过渡。启用减少动态效果时会立即应用。", "素早く選び直しても現在の輪郭から変化します。「視差効果を減らす」設定では即座に切り替わります。"],
  "표정 애니메이션": ["표정 애니메이션", "Expression animation", "表情动画", "表情アニメーション"],
  "외형과 별개인 애니메이션 상태입니다. 좌우 눈의 웃음과 감기 가중치를 독립적으로 조절하세요.": ["외형과 별개인 애니메이션 상태입니다. 좌우 눈의 웃음과 감기 가중치를 독립적으로 조절하세요.", "Expressions animate independently of appearance. Adjust smile and blink weights for each eye.", "表情动画独立于外观。可分别调整左右眼的微笑和闭眼权重。", "外見とは独立したアニメーションです。左右それぞれの目の笑顔と閉じ具合を調整できます。"],
  "왼쪽 눈": ["왼쪽 눈", "Left eye", "左眼", "左目"],
  "오른쪽 눈": ["오른쪽 눈", "Right eye", "右眼", "右目"],
  "가중치 프리셋": ["가중치 프리셋", "Weight preset", "权重预设", "ウェイトのプリセット"],
  "기본": ["기본", "Neutral", "默认", "通常"],
  "웃음": ["웃음", "Smile", "微笑", "笑顔"],
  "감기": ["감기", "Blink", "闭眼", "閉じる"],
  "직접 혼합": ["직접 혼합", "Custom blend", "自定义混合", "カスタム混合"],
  "웃음 가중치": ["웃음 가중치", "Smile weight", "微笑权重", "笑顔のウェイト"],
  "감기 가중치": ["감기 가중치", "Blink weight", "闭眼权重", "閉じるウェイト"],
  "몸체 방향": ["몸체 방향", "Body orientation", "身体方向", "体の向き"],
  "방향 초기화": ["방향 초기화", "Reset orientation", "重置方向", "向きをリセット"],
  "몸체 방향 프리셋": ["몸체 방향 프리셋", "Body orientation presets", "身体方向预设", "体の向きのプリセット"],
  "좌우 각도 · Yaw": ["좌우 각도 · Yaw", "Horizontal angle · Yaw", "水平角度 · Yaw", "左右の角度 · Yaw"],
  "상하 각도 · Pitch": ["상하 각도 · Pitch", "Vertical angle · Pitch", "垂直角度 · Pitch", "上下の角度 · Pitch"],
  "몸체 기울기 · Roll": ["몸체 기울기 · Roll", "Body tilt · Roll", "身体倾斜 · Roll", "体の傾き · Roll"],
  "확대": ["확대", "Zoom", "缩放", "ズーム"],
  "확대 초기화": ["확대 초기화", "Reset zoom", "重置缩放", "ズームをリセット"],
  "확대 · Zoom": ["확대 · Zoom", "Zoom", "缩放 · Zoom", "拡大率 · Zoom"],
  "드래그로 회전하고 휠·트랙패드 또는 두 손가락으로 확대하세요. 확대는 중앙 기준이며 높은 배율에서는 화면 밖이 잘릴 수 있습니다. PNG도 현재 보이는 부분을 저장합니다.": ["드래그로 회전하고 휠·트랙패드 또는 두 손가락으로 확대하세요. 확대는 중앙 기준이며 높은 배율에서는 화면 밖이 잘릴 수 있습니다. PNG도 현재 보이는 부분을 저장합니다.", "Drag to rotate; use the wheel, trackpad, or pinch to zoom. Zoom is centered and may crop the character at high magnification. PNG export saves the visible area.", "拖动可旋转，滚轮、触控板或双指手势可缩放。缩放以中心为基准，高倍率下可能裁切画面。PNG 也会保存当前可见区域。", "ドラッグで回転し、ホイール・トラックパッド・ピンチで拡大できます。中央を基準に拡大するため、高倍率では一部が画面外に切れます。PNG には表示中の範囲が保存されます。"],
  "선택된 코드를 직접 복사하세요.": ["선택된 코드를 직접 복사하세요.", "Copy the selected code manually.", "请手动复制已选中的代码。", "選択したコードを手動でコピーしてください。"],
  "JSON을 복사했습니다.": ["JSON을 복사했습니다.", "JSON copied.", "已复制 JSON。", "JSON をコピーしました。"],
  "선택된 JSON을 직접 복사하세요.": ["선택된 JSON을 직접 복사하세요.", "Copy the selected JSON manually.", "请手动复制已选中的 JSON。", "選択した JSON を手動でコピーしてください。"],
  "장면 JSON": ["장면 JSON", "Scene JSON", "场景 JSON", "シーン JSON"],
  "디자인·몸체 방향·시선·추적·모션 설정을 함께 저장합니다. 이전 디자인 JSON도 가져올 수 있습니다.": ["디자인·몸체 방향·시선·추적·모션 설정을 함께 저장합니다. 이전 디자인 JSON도 가져올 수 있습니다.", "Save design, body orientation, gaze, tracking, and motion together. Older design JSON can also be imported.", "同时保存设计、身体方向、视线、跟踪和动作设置。也可导入旧版设计 JSON。", "デザイン・体の向き・視線・追視・モーションをまとめて保存します。旧バージョンのデザイン JSON も読み込めます。"],
  "저장 원본을 보존했습니다": ["저장 원본을 보존했습니다", "Original saved data preserved", "已保留原始保存数据", "保存データの原本を保護しました"],
  "적용할 수 없는 저장 데이터를 아래에 열었습니다. 수정하거나 원본을 내려받으세요. 변경 전 원본 백업이 실패하면 자동 저장하지 않습니다.": ["적용할 수 없는 저장 데이터를 아래에 열었습니다. 수정하거나 원본을 내려받으세요. 변경 전 원본 백업이 실패하면 자동 저장하지 않습니다.", "Saved data that could not be applied is shown below. Edit it or download the original. Autosave is disabled if the original cannot be backed up first.", "下方显示了无法应用的保存数据。请修改或下载原始文件。如果无法先备份原始数据，则不会自动保存。", "適用できなかった保存データを下に表示しています。修正するか、原本をダウンロードしてください。変更前のバックアップに失敗した場合、自動保存は行いません。"],
  "장면 데이터": ["장면 데이터", "Scene data", "场景数据", "シーンデータ"],
  "JSON 파일 열기": ["JSON 파일 열기", "Open JSON file", "打开 JSON 文件", "JSON ファイルを開く"],
  "JSON 적용": ["JSON 적용", "Apply JSON", "应用 JSON", "JSON を適用"],
  "복사": ["복사", "Copy", "复制", "コピー"],
  "저장 원본 JSON을 내보냈습니다.": ["저장 원본 JSON을 내보냈습니다.", "Original saved JSON exported.", "已导出原始保存的 JSON。", "保存データの原本 JSON を書き出しました。"],
  "저장 원본": ["저장 원본", "Saved original", "保存的原始文件", "保存した原本"],
  "현재 장면을 코드로 사용하기": ["현재 장면을 코드로 사용하기", "Use this scene in code", "在代码中使用当前场景", "現在のシーンをコードで使う"],
  "몸체 방향·장비·표정·마우스 추적을 포함한 현재 설정입니다. 패키지를 설치한 번들러 프로젝트에서 사용하세요.": ["몸체 방향·장비·표정·마우스 추적을 포함한 현재 설정입니다. 패키지를 설치한 번들러 프로젝트에서 사용하세요.", "Includes current body orientation, accessories, expressions, and cursor tracking. Use in a bundler project with the package installed.", "包含当前身体方向、配饰、表情及鼠标跟踪设置。请在已安装此软件包的打包工具项目中使用。", "現在の体の向き・装備・表情・マウス追視を含みます。パッケージを導入済みのバンドラープロジェクトで使用してください。"],
  "설치 · 전체 속성 가이드": ["설치 · 전체 속성 가이드", "Installation and full property guide", "安装与完整属性指南", "インストール・全プロパティガイド"],
  "HTML · 웹컴포넌트": ["HTML · 웹컴포넌트", "HTML · Web component", "HTML · Web 组件", "HTML · Web コンポーネント"],
  "HTML 복사": ["HTML 복사", "Copy HTML", "复制 HTML", "HTML をコピー"],
  "React 복사": ["React 복사", "Copy React", "复制 React", "React をコピー"],
  "투명 PNG를 내보냈습니다.": ["투명 PNG를 내보냈습니다.", "Transparent PNG exported.", "已导出透明 PNG。", "透過 PNG を書き出しました。"],
  "Studio 파일 작업": ["Studio 파일 작업", "Studio file actions", "Studio 文件操作", "Studio ファイル操作"],
  "디자인 초기화": ["디자인 초기화", "Reset design", "重置设计", "デザインをリセット"],
  "초기화": ["초기화", "Reset", "重置", "リセット"],
  "PNG 저장": ["PNG 저장", "Save PNG", "保存 PNG", "PNG を保存"],
  "장면 JSON을 내보냈습니다.": ["장면 JSON을 내보냈습니다.", "Scene JSON exported.", "已导出场景 JSON。", "シーン JSON を書き出しました。"],
  "JSON 내보내기": ["JSON 내보내기", "Export JSON", "导出 JSON", "JSON を書き出す"],
  "고정 캐릭터 미리보기": ["고정 캐릭터 미리보기", "Pinned character preview", "固定角色预览", "固定キャラクタープレビュー"],
  "나만의 작은 동료.": ["나만의 작은 동료.", "Your own little companion.", "专属于你的小伙伴。", "あなただけの小さな相棒。"],
  "형태를 고르고, 개성을 더하세요.": ["형태를 고르고, 개성을 더하세요.", "Pick a shape and add personality.", "选择形状，赋予个性。", "形を選んで、個性をプラス。"],
  "API 체험": ["API 체험", "Try the API", "体验 API", "API を試す"],
  "미리보기 배경": ["미리보기 배경", "Preview background", "预览背景", "プレビューの背景"],
  "투명": ["투명", "Transparent", "透明", "透明"],
  "밝게": ["밝게", "Light", "浅色", "明るい"],
  "어둡게": ["어둡게", "Dark", "深色", "暗い"],
  "편집 화면": ["편집 화면", "Editor view", "编辑视图", "編集ビュー"],
  "캐릭터": ["캐릭터", "Character", "角色", "キャラクター"],
  "장면": ["장면", "Scene", "场景", "シーン"],
  "드래그 회전 · 휠/핀치 확대": ["드래그 회전 · 휠/핀치 확대", "Drag to rotate · Scroll/pinch to zoom", "拖动旋转 · 滚轮/双指缩放", "ドラッグで回転・ホイール/ピンチで拡大"],
  "캐릭터 디자인 설정": ["캐릭터 디자인 설정", "Character design settings", "角色设计设置", "キャラクターデザイン設定"],
  "디자인 항목": ["디자인 항목", "Design sections", "设计分类", "デザイン項目"],
  "외형": ["외형", "Appearance", "外观", "外見"],
  "애니메이션": ["애니메이션", "Animation", "动画", "アニメーション"],
  "이전 디자인을 v7으로 변환했습니다": ["이전 디자인을 v7으로 변환했습니다", "Older design converted to v7", "已将旧版设计转换为 v7", "旧デザインを v7 に変換しました"],
  "몸체 도형": ["몸체 도형", "Body shape", "身体形状", "体の形"],
  "35 Material shapes": ["35 Material shapes", "35 Material shapes", "35 种 Material 形状", "35 種類の Material シェイプ"],
  "도형 검색": ["도형 검색", "Search shapes", "搜索形状", "形を検索"],
  "도형 검색 · Star, 쿠키, 클로버…": ["도형 검색 · Star, 쿠키, 클로버…", "Search shapes · Star, cookie, clover…", "搜索形状 · 星星、饼干、三叶草…", "形を検索 · 星、クッキー、クローバー…"],
  "윤곽을 눌러 선택하세요. 방향키로 이동 · Enter로 선택": ["윤곽을 눌러 선택하세요. 방향키로 이동 · Enter로 선택", "Click an outline to select. Arrow keys to move · Enter to select", "点击轮廓即可选择。方向键移动 · Enter 选择", "輪郭を押して選択。矢印キーで移動・Enter で選択"],
  "머리": ["머리", "Head", "头部", "頭"],
  "입": ["입", "Mouth", "嘴部", "口"],
  "목": ["목", "Neck", "颈部", "首"],
  "왼쪽 귀": ["왼쪽 귀", "Left ear", "左耳", "左耳"],
  "오른쪽 귀": ["오른쪽 귀", "Right ear", "右耳", "右耳"],
  "색상": ["색상", "Color", "颜色", "色"],
  "저장된 설정을 읽을 수 없습니다. JSON에서 오류를 수정하거나 초기화하세요. 원본은 보존됩니다.": ["저장된 설정을 읽을 수 없습니다. JSON에서 오류를 수정하거나 초기화하세요. 원본은 보존됩니다.", "Saved settings could not be read. Fix the JSON or reset. The original is preserved.", "无法读取保存的设置。请修正 JSON 中的错误或重置。原始数据会保留。", "保存済みの設定を読み込めません。JSON を修正するかリセットしてください。原本は保護されます。"],
  "브라우저 저장소를 읽을 수 없습니다. JSON으로 내보내세요.": ["브라우저 저장소를 읽을 수 없습니다. JSON으로 내보내세요.", "Browser storage could not be read. Export your work as JSON.", "无法读取浏览器存储。请导出为 JSON。", "ブラウザーの保存領域を読み込めません。JSON で書き出してください。"],
  "디자인 변경은 이 브라우저에 저장됩니다.": ["디자인 변경은 이 브라우저에 저장됩니다.", "Design changes are saved in this browser.", "设计更改会保存在此浏览器中。", "デザインの変更はこのブラウザーに保存されます。"],
  "디자인이 이 브라우저에 저장되었습니다.": ["디자인이 이 브라우저에 저장되었습니다.", "Design saved in this browser.", "设计已保存在此浏览器中。", "デザインをこのブラウザーに保存しました。"],
  "저장 원본을 보호하기 위해 자동 저장하지 않았습니다. 수정한 디자인은 JSON으로 내보내세요.": ["저장 원본을 보호하기 위해 자동 저장하지 않았습니다. 수정한 디자인은 JSON으로 내보내세요.", "Autosave was skipped to protect the original. Export your edited design as JSON.", "为保护原始数据，未执行自动保存。请将修改后的设计导出为 JSON。", "原本を保護するため自動保存を行いませんでした。修正したデザインを JSON で書き出してください。"],
  "브라우저 저장소를 사용할 수 없습니다. JSON으로 내보내세요.": ["브라우저 저장소를 사용할 수 없습니다. JSON으로 내보내세요.", "Browser storage is unavailable. Export your work as JSON.", "浏览器存储不可用。请导出为 JSON。", "ブラウザーの保存領域を利用できません。JSON で書き出してください。"],
  "선택한 도형으로 부드럽게 전환합니다.": ["선택한 도형으로 부드럽게 전환합니다.", "Transitioning smoothly to the selected shape.", "正在平滑过渡到所选形状。", "選択した形へなめらかに切り替えます。"],
  "디자인 JSON을 가져왔습니다. 미리보기 설정은 기본값입니다.": ["디자인 JSON을 가져왔습니다. 미리보기 설정은 기본값입니다.", "Design JSON imported. Preview settings use defaults.", "已导入设计 JSON。预览设置使用默认值。", "デザイン JSON を読み込みました。プレビュー設定は初期値です。"],
  "장면 JSON과 미리보기 설정을 적용했습니다.": ["장면 JSON과 미리보기 설정을 적용했습니다.", "Scene JSON and preview settings applied.", "已应用场景 JSON 和预览设置。", "シーン JSON とプレビュー設定を適用しました。"],
  "장면 JSON 파일은 64 KiB 이하여야 합니다.": ["장면 JSON 파일은 64 KiB 이하여야 합니다.", "Scene JSON files must be 64 KiB or smaller.", "场景 JSON 文件不得超过 64 KiB。", "シーン JSON ファイルは 64 KiB 以下にしてください。"],
  "기본 디자인으로 초기화했습니다.": ["기본 디자인으로 초기화했습니다.", "Reset to the default design.", "已重置为默认设计。", "初期デザインにリセットしました。"],
  "미리보기가 아직 준비되지 않았습니다.": ["미리보기가 아직 준비되지 않았습니다.", "The preview is not ready yet.", "预览尚未就绪。", "プレビューはまだ準備できていません。"],
  "브라우저 저장소를 사용할 수 없어 기본 봇을 표시합니다.": ["브라우저 저장소를 사용할 수 없어 기본 봇을 표시합니다.", "Browser storage is unavailable, so the default companion is shown.", "浏览器存储不可用，正在显示默认伙伴。", "ブラウザーの保存領域を利用できないため、初期キャラクターを表示します。"],
  "Studio에서 설정한 봇입니다. 여기서 실행한 명령은 Studio 설정을 바꾸지 않습니다.": ["Studio에서 설정한 봇입니다. 여기서 실행한 명령은 Studio 설정을 바꾸지 않습니다.", "This is your Studio companion. Commands run here do not change Studio settings.", "这是你在 Studio 中设置的伙伴。在此执行的命令不会更改 Studio 设置。", "Studio で設定したキャラクターです。ここで実行したコマンドは Studio の設定を変更しません。"],
  "Studio에서 저장한 디자인입니다. 여기서 실행한 명령은 Studio 설정을 바꾸지 않습니다.": ["Studio에서 저장한 디자인입니다. 여기서 실행한 명령은 Studio 설정을 바꾸지 않습니다.", "This is your saved Studio design. Commands run here do not change Studio settings.", "这是你在 Studio 中保存的设计。在此执行的命令不会更改 Studio 设置。", "Studio で保存したデザインです。ここで実行したコマンドは Studio の設定を変更しません。"],
  "아직 저장된 Studio 설정이 없어 기본 봇을 표시합니다.": ["아직 저장된 Studio 설정이 없어 기본 봇을 표시합니다.", "No Studio settings are saved yet, so the default companion is shown.", "尚未保存 Studio 设置，正在显示默认伙伴。", "Studio の保存済み設定がないため、初期キャラクターを表示します。"],
  "브라우저 저장소를 읽을 수 없어 기본 봇을 표시합니다.": ["브라우저 저장소를 읽을 수 없어 기본 봇을 표시합니다.", "Browser storage could not be read, so the default companion is shown.", "无法读取浏览器存储，正在显示默认伙伴。", "ブラウザーの保存領域を読み込めないため、初期キャラクターを表示します。"],
  "저장된 Studio 설정을 읽을 수 없어 기본 봇을 표시합니다. 원본은 보존됩니다. Studio의 JSON 탭에서 수정하세요.": ["저장된 Studio 설정을 읽을 수 없어 기본 봇을 표시합니다. 원본은 보존됩니다. Studio의 JSON 탭에서 수정하세요.", "Saved Studio settings could not be read, so the default companion is shown. The original is preserved. Fix it in Studio’s JSON tab.", "无法读取保存的 Studio 设置，正在显示默认伙伴。原始数据会保留。请在 Studio 的 JSON 选项卡中修正。", "Studio の保存済み設定を読み込めないため、初期キャラクターを表示します。原本は保護されます。Studio の JSON タブで修正してください。"],
  "장면 미리보기": ["장면 미리보기", "Scene preview", "场景预览", "シーンのプレビュー"],
  "장면 렌더링 중…": ["장면 렌더링 중…", "Rendering scene…", "正在渲染场景…", "シーンを描画中…"],
  "정지 프레임": ["정지 프레임", "Still frame", "静止帧", "静止フレーム"],
  "PNG 생성 실패": ["PNG 생성 실패", "PNG generation failed", "PNG 生成失败", "PNG の生成に失敗しました"],
  "장면 구성": ["장면 구성", "Scene composition", "场景构图", "シーン構成"],
  "새 프레임": ["새 프레임", "New frame", "刷新画面", "新しいフレーム"],
  "캐릭터와 텍스트를 배치해 OG 이미지·카드를 만듭니다. 미리보기의 캐릭터나 텍스트를 드래그해 이동하세요. 미리보기는 현재 캐릭터의 정지 프레임이며 몸체 방향 탭에서 방향을 조절할 수 있습니다.": ["캐릭터와 텍스트를 배치해 OG 이미지·카드를 만듭니다. 미리보기의 캐릭터나 텍스트를 드래그해 이동하세요. 미리보기는 현재 캐릭터의 정지 프레임이며 몸체 방향 탭에서 방향을 조절할 수 있습니다.", "Arrange the character and text to create social images and cards. Drag them in the preview to move them. The preview is a still frame of the current character; adjust its orientation in the Body orientation tab.", "排列角色和文字，制作社交分享图片和卡片。在预览中拖动角色或文字即可移动。预览是当前角色的静止画面，可在“身体方向”选项卡中调整方向。", "キャラクターと文字を配置して OG 画像やカードを作ります。プレビュー内をドラッグして移動できます。プレビューは現在のキャラクターの静止画で、向きは「体の向き」タブで調整できます。"],
  "Sidekick OG 프리셋 적용": ["Sidekick OG 프리셋 적용", "Apply Sidekick OG preset", "应用 Sidekick OG 预设", "Sidekick OG プリセットを適用"],
  "프리셋은 캐릭터도 Ghostish · 안경 · 베레모 · 보타이 · 웃음으로 바꿉니다.": ["프리셋은 캐릭터도 Ghostish · 안경 · 베레모 · 보타이 · 웃음으로 바꿉니다.", "The preset also changes the character to Ghostish with glasses, a beret, a bow tie, and a smile.", "此预设还会将角色改为小幽灵，搭配眼镜、贝雷帽、领结和微笑。", "キャラクターもおばけ形に変わり、眼鏡・ベレー帽・蝶ネクタイ・笑顔を設定します。"],
  "캔버스 프리셋": ["캔버스 프리셋", "Canvas preset", "画布预设", "キャンバスのプリセット"],
  "정사각형 · 1080 × 1080": ["정사각형 · 1080 × 1080", "Square · 1080 × 1080", "正方形 · 1080 × 1080", "正方形 · 1080 × 1080"],
  "와이드 · 1920 × 1080": ["와이드 · 1920 × 1080", "Wide · 1920 × 1080", "宽屏 · 1920 × 1080", "ワイド · 1920 × 1080"],
  "너비": ["너비", "Width", "宽度", "幅"],
  "높이": ["높이", "Height", "高度", "高さ"],
  "장면 배경": ["장면 배경", "Scene background", "场景背景", "シーンの背景"],
  "캐릭터 배치": ["캐릭터 배치", "Character placement", "角色布局", "キャラクターの配置"],
  "가로 위치": ["가로 위치", "Horizontal position", "水平位置", "横位置"],
  "세로 위치": ["세로 위치", "Vertical position", "垂直位置", "縦位置"],
  "캐릭터 높이": ["캐릭터 높이", "Character height", "角色高度", "キャラクターの高さ"],
  "텍스트": ["텍스트", "Text", "文字", "テキスト"],
  "내용": ["내용", "Content", "内容", "内容"],
  "텍스트 가로 위치": ["텍스트 가로 위치", "Text horizontal position", "文字水平位置", "文字の横位置"],
  "텍스트 세로 위치": ["텍스트 세로 위치", "Text vertical position", "文字垂直位置", "文字の縦位置"],
  "글자 크기": ["글자 크기", "Font size", "字号", "文字サイズ"],
  "글꼴": ["글꼴", "Font", "字体", "フォント"],
  "글자 색상": ["글자 색상", "Text color", "文字颜色", "文字の色"],
  "고해상도 렌더링 중…": ["고해상도 렌더링 중…", "Rendering high resolution…", "正在高分辨率渲染…", "高解像度で描画中…"],
  "장면 PNG 저장": ["장면 PNG 저장", "Save scene PNG", "保存场景 PNG", "シーン PNG を保存"],
  "장면 JSON 저장": ["장면 JSON 저장", "Save scene JSON", "保存场景 JSON", "シーン JSON を保存"],
  "장면 JSON 열기": ["장면 JSON 열기", "Open scene JSON", "打开场景 JSON", "シーン JSON を開く"],
  "장면 PNG는 캔버스 전체를 저장합니다. 상단 PNG 저장은 기존처럼 캐릭터만 투명하게 잘라 저장합니다. JSON에는 배치와 캐릭터가 함께 포함됩니다.": ["장면 PNG는 캔버스 전체를 저장합니다. 상단 PNG 저장은 기존처럼 캐릭터만 투명하게 잘라 저장합니다. JSON에는 배치와 캐릭터가 함께 포함됩니다.", "Scene PNG saves the entire canvas. Save PNG in the top toolbar exports only the character on a transparent background. JSON includes both layout and character.", "场景 PNG 会保存整个画布。顶部的“保存 PNG”仅导出透明背景的角色。JSON 同时包含布局与角色。", "シーン PNG はキャンバス全体を保存します。上部の「PNG を保存」はキャラクターだけを透過画像として保存します。JSON には配置とキャラクターの両方が含まれます。"],
  "128 KiB 이하 파일을 선택하세요.": ["128 KiB 이하 파일을 선택하세요.", "Choose a file no larger than 128 KiB.", "请选择不超过 128 KiB 的文件。", "128 KiB 以下のファイルを選んでください。"],
  "쿠키": ["쿠키", "Cookie", "饼干", "クッキー"],
  "별 햇살": ["별 햇살", "Star sunshine", "星星 阳光", "星 太陽"],
  "별 방사형": ["별 방사형", "Star radial", "星星 放射状", "星 放射状"],
  "클로버 유기형": ["클로버 유기형", "Clover organic", "三叶草 有机形", "クローバー 有機的"],
  "꽃 유기형": ["꽃 유기형", "Flower organic", "花朵 有机形", "花 有機的"],
  "유기형": ["유기형", "Organic", "有机形", "有機的"],
  "픽셀 개성형": ["픽셀 개성형", "Pixel playful", "像素 趣味形", "ピクセル 個性的"],
  "개성형": ["개성형", "Playful", "趣味形", "個性的"],
  "기하학 기본형": ["기하학 기본형", "Basic geometric", "基础几何形", "基本の幾何学"],
  "검색 결과가 없습니다. 다른 이름이나 분류를 입력하세요.": ["검색 결과가 없습니다. 다른 이름이나 분류를 입력하세요.", "No matches. Try another name or category.", "没有搜索结果。请尝试其他名称或分类。", "該当する形がありません。別の名前や分類で検索してください。"],
  "현재: {shape}": ["현재: {shape}", "Current: {shape}", "当前：{shape}", "現在：{shape}"],
  "{count} / {total}개 도형": ["{count} / {total}개 도형", "{count} / {total} shapes", "{count} / {total} 个形状", "{count} / {total} 個の形"],
  "{shape} 몸체 도형": ["{shape} 몸체 도형", "{shape} body shape", "{shape}身体形状", "{shape}の体の形"],
  "{slot} 액세서리": ["{slot} 액세서리", "{slot} accessories", "{slot}配饰", "{slot}のアクセサリー"],
  "{slot} {accessory} 색상": ["{slot} {accessory} 색상", "{slot} {accessory} color", "{slot}{accessory}颜色", "{slot}の{accessory}の色"],
  "{kind} 코드를 복사했습니다.": ["{kind} 코드를 복사했습니다.", "{kind} code copied.", "已复制 {kind} 代码。", "{kind} コードをコピーしました。"],
  "{width} × {height} 장면, 캐릭터나 글자를 드래그해 이동": ["{width} × {height} 장면, 캐릭터나 글자를 드래그해 이동", "{width} × {height} scene; drag the character or text to move", "{width} × {height} 场景，拖动角色或文字即可移动", "{width} × {height} のシーン。キャラクターや文字をドラッグして移動"],
  "{width} × {height} 장면 PNG를 내보냈습니다.": ["{width} × {height} 장면 PNG를 내보냈습니다.", "{width} × {height} scene PNG exported.", "已导出 {width} × {height} 场景 PNG。", "{width} × {height} のシーン PNG を書き出しました。"],
  "Sans · Geist": ["Sans · Geist", "Sans · Geist", "无衬线 · Geist", "サンセリフ · Geist"],
  "Serif · Georgia": ["Serif · Georgia", "Serif · Georgia", "衬线 · Georgia", "セリフ · Georgia"],
  "Monospace": ["Monospace", "Monospace", "等宽", "等幅"],
  "Flat": ["Flat", "Flat", "平面", "フラット"],
  "장면 배치 객체가 필요합니다.": ["장면 배치 객체가 필요합니다.", "A scene composition object is required.", "需要场景布局对象。", "シーン構成のオブジェクトが必要です。"],
  "지원하지 않는 장면 배치 항목입니다.": ["지원하지 않는 장면 배치 항목입니다.", "Unsupported scene composition field.", "不支持的场景布局字段。", "未対応のシーン構成フィールドです。"],
  "텍스트는 200자 이하여야 합니다.": ["텍스트는 200자 이하여야 합니다.", "Text must be 200 characters or fewer.", "文字不得超过 200 个字符。", "テキストは 200 文字以内にしてください。"],
  "지원하지 않는 글꼴입니다.": ["지원하지 않는 글꼴입니다.", "Unsupported font.", "不支持的字体。", "未対応のフォントです。"],
  "정수 크기, 최대 8메가픽셀까지 지원합니다.": ["정수 크기, 최대 8메가픽셀까지 지원합니다.", "Dimensions must be whole numbers, up to 8 megapixels.", "尺寸必须为整数，最多支持 800 万像素。", "サイズは整数で指定してください。最大 800 万画素に対応しています。"],
  "장면 파일은 128 KiB 이하여야 합니다.": ["장면 파일은 128 KiB 이하여야 합니다.", "Scene files must be 128 KiB or smaller.", "场景文件不得超过 128 KiB。", "シーンファイルは 128 KiB 以下にしてください。"],
  "지원하지 않는 장면 파일입니다.": ["지원하지 않는 장면 파일입니다.", "Unsupported scene file.", "不支持的场景文件。", "未対応のシーンファイルです。"],
  "Canvas 2D를 사용할 수 없습니다.": ["Canvas 2D를 사용할 수 없습니다.", "Canvas 2D is unavailable.", "Canvas 2D 不可用。", "Canvas 2D を利用できません。"],
  "객체가 필요합니다.": ["객체가 필요합니다.", "An object is required.", "需要对象。", "オブジェクトが必要です。"],
  "일반 객체가 필요합니다.": ["일반 객체가 필요합니다.", "A plain object is required.", "需要普通对象。", "通常のオブジェクトが必要です。"],
  "지원하지 않는 항목입니다.": ["지원하지 않는 항목입니다.", "Unsupported field.", "不支持的字段。", "未対応のフィールドです。"],
  "일반 데이터 항목이 필요합니다.": ["일반 데이터 항목이 필요합니다.", "A plain data property is required.", "需要普通数据属性。", "通常のデータプロパティが必要です。"],
  "지원하지 않는 데이터입니다.": ["지원하지 않는 데이터입니다.", "Unsupported data.", "不支持的数据。", "未対応のデータです。"],
  "데이터가 너무 깊습니다.": ["데이터가 너무 깊습니다.", "The data is nested too deeply.", "数据嵌套层级过深。", "データの階層が深すぎます。"],
  "JSON 데이터가 필요합니다.": ["JSON 데이터가 필요합니다.", "JSON data is required.", "需要 JSON 数据。", "JSON データが必要です。"],
  "일반 배열이 필요합니다.": ["일반 배열이 필요합니다.", "A plain array is required.", "需要普通数组。", "通常の配列が必要です。"],
  "boolean이 필요합니다.": ["boolean이 필요합니다.", "A boolean is required.", "需要布尔值。", "真偽値が必要です。"],
  "장면 JSON은 64 KiB 이하여야 합니다.": ["장면 JSON은 64 KiB 이하여야 합니다.", "Scene JSON must be 64 KiB or smaller.", "场景 JSON 不得超过 64 KiB。", "シーン JSON は 64 KiB 以下にしてください。"],
  "기존 camera/view 키는 폐기되었습니다. sceneVersion 3의 bodyOrientation과 zoom을 사용하세요.": ["기존 camera/view 키는 폐기되었습니다. sceneVersion 3의 bodyOrientation과 zoom을 사용하세요.", "The camera/view keys have been removed. Use bodyOrientation and zoom in sceneVersion 3.", "旧版 camera/view 键已弃用。请使用 sceneVersion 3 中的 bodyOrientation 和 zoom。", "従来の camera/view キーは廃止されました。sceneVersion 3 の bodyOrientation と zoom を使用してください。"],
  "장면 버전 3이 필요합니다. 기존 camera 설정은 지원하지 않습니다.": ["장면 버전 3이 필요합니다. 기존 camera 설정은 지원하지 않습니다.", "Scene version 3 is required. Legacy camera settings are unsupported.", "需要场景版本 3。不支持旧版 camera 设置。", "シーンバージョン 3 が必要です。従来の camera 設定には対応していません。"],
  "필수 항목입니다.": ["필수 항목입니다.", "This field is required.", "必填字段。", "必須項目です。"],
  "지원하지 않는 활동입니다.": ["지원하지 않는 활동입니다.", "Unsupported activity.", "不支持的活动。", "未対応のアクティビティです。"],
  "none 또는 box가 필요합니다.": ["none 또는 box가 필요합니다.", "Expected none or box.", "需要 none 或 box。", "none または box が必要です。"],
  "flat이 필요합니다.": ["flat이 필요합니다.", "Expected flat.", "需要 flat。", "flat が必要です。"],
  "smooth 또는 linear가 필요합니다.": ["smooth 또는 linear가 필요합니다.", "Expected smooth or linear.", "需要 smooth 或 linear。", "smooth または linear が必要です。"],
  "#RRGGBB 형식이 필요합니다.": ["#RRGGBB 형식이 필요합니다.", "Use the #RRGGBB format.", "请使用 #RRGGBB 格式。", "#RRGGBB 形式で指定してください。"],
  "HEX 색상이 필요합니다.": ["HEX 색상이 필요합니다.", "A HEX color is required.", "需要 HEX 颜色。", "HEX 形式の色が必要です。"],
  "윤곽선이 유효하지 않습니다.": ["윤곽선이 유효하지 않습니다.", "The outline is invalid.", "轮廓无效。", "輪郭が無効です。"],
  "디자인 JSON은 64 KiB 이하여야 합니다.": ["디자인 JSON은 64 KiB 이하여야 합니다.", "Design JSON must be 64 KiB or smaller.", "设计 JSON 不得超过 64 KiB。", "デザイン JSON は 64 KiB 以下にしてください。"],
  "지원하는 디자인 버전은 1/2/3/4/5/6(가져오기), 7입니다.": ["지원하는 디자인 버전은 1/2/3/4/5/6(가져오기), 7입니다.", "Supported design versions are 1–6 for import and version 7.", "支持导入设计版本 1–6，以及版本 7。", "対応するデザインバージョンは 1〜6（読み込み）と 7 です。"],
  "눈의 장착 영역은 face여야 합니다.": ["눈의 장착 영역은 face여야 합니다.", "Eyes must use the face attachment region.", "眼睛的装配区域必须为 face。", "目の取り付け領域は face にしてください。"],
  "eyes.anchor.offset은 0이어야 합니다.": ["eyes.anchor.offset은 0이어야 합니다.", "eyes.anchor.offset must be 0.", "eyes.anchor.offset 必须为 0。", "eyes.anchor.offset は 0 にしてください。"],
  "액세서리 id는 중복 없는 영문 소문자/숫자/하이픈이어야 합니다.": ["액세서리 id는 중복 없는 영문 소문자/숫자/하이픈이어야 합니다.", "Accessory IDs must be unique and use lowercase letters, numbers, or hyphens.", "配饰 ID 必须唯一，且仅使用小写英文字母、数字或连字符。", "アクセサリー ID は重複不可です。英小文字・数字・ハイフンを使用してください。"],
  "잘못된 액세서리 id입니다.": ["잘못된 액세서리 id입니다.", "Invalid accessory ID.", "配饰 ID 无效。", "アクセサリー ID が無効です。"],
  "지원하지 않는 easing입니다.": ["지원하지 않는 easing입니다.", "Unsupported easing.", "不支持的缓动方式。", "未対応のイージングです。"],
  "잘못된 모션 벡터입니다.": ["잘못된 모션 벡터입니다.", "Invalid motion vector.", "动作向量无效。", "モーションベクトルが無効です。"],
  "잘못된 눈 방향입니다.": ["잘못된 눈 방향입니다.", "Invalid eye side.", "眼睛侧别无效。", "目の左右の指定が無効です。"],
  "expression/openness와 weights를 함께 사용할 수 없습니다.": ["expression/openness와 weights를 함께 사용할 수 없습니다.", "expression/openness and weights cannot be used together.", "expression/openness 不能与 weights 同时使用。", "expression/openness と weights は同時に指定できません。"],
  "지원하지 않는 bodyOrientation 설정입니다.": ["지원하지 않는 bodyOrientation 설정입니다.", "Unsupported bodyOrientation setting.", "不支持的 bodyOrientation 设置。", "未対応の bodyOrientation 設定です。"],
  "bodyOrientation preset은 front, three-quarter, side 중 하나여야 합니다.": ["bodyOrientation preset은 front, three-quarter, side 중 하나여야 합니다.", "bodyOrientation preset must be front, three-quarter, or side.", "bodyOrientation 预设必须为 front、three-quarter 或 side。", "bodyOrientation のプリセットは front、three-quarter、side のいずれかです。"],
  "trackingMode must be off, eyes, or eyes-and-body": ["trackingMode는 off, eyes, eyes-and-body 중 하나여야 합니다.", "trackingMode must be off, eyes, or eyes-and-body", "trackingMode 必须为 off、eyes 或 eyes-and-body。", "trackingMode は off、eyes、eyes-and-body のいずれかです。"],
  "아바타가 렌더링 준비 상태가 아닙니다.": ["아바타가 렌더링 준비 상태가 아닙니다.", "The avatar is not ready to render.", "角色尚未准备好渲染。", "キャラクターの描画準備ができていません。"],
  "Canvas readback is unavailable": ["Canvas 이미지를 읽을 수 없습니다.", "Canvas readback is unavailable", "无法读取 Canvas 图像。", "Canvas の画像を読み取れません。"],
  "Avatar disconnected": ["아바타 연결이 해제되었습니다.", "Avatar disconnected", "角色已断开连接。", "キャラクターの接続が解除されました。"],
  "JSON 문법을 확인하세요. 따옴표, 쉼표, 괄호가 올바른지 확인하세요.": ["JSON 문법을 확인하세요. 따옴표, 쉼표, 괄호가 올바른지 확인하세요.", "Invalid JSON syntax. Check quotation marks, commas, and brackets.", "JSON 语法无效。请检查引号、逗号和括号。", "JSON の構文が無効です。引用符、カンマ、括弧を確認してください。"],
  "{min}~{max}의 유한한 숫자가 필요합니다.": ["{min}~{max}의 유한한 숫자가 필요합니다.", "A finite number from {min} to {max} is required.", "需要 {min} 到 {max} 之间的有限数值。", "{min}〜{max} の有限の数値が必要です。"],
  "{min}–{max} 범위의 숫자가 필요합니다.": ["{min}–{max} 범위의 숫자가 필요합니다.", "A number from {min} to {max} is required.", "需要 {min} 到 {max} 范围内的数值。", "{min}〜{max} の範囲の数値が必要です。"],
  "{choices} 중 하나여야 합니다.": ["{choices} 중 하나여야 합니다.", "Must be one of: {choices}.", "必须为以下值之一：{choices}。", "次のいずれかを指定してください：{choices}。"],
  "길이가 {size}인 일반 배열이 필요합니다.": ["길이가 {size}인 일반 배열이 필요합니다.", "A plain array of length {size} is required.", "需要长度为 {size} 的普通数组。", "長さ {size} の通常の配列が必要です。"],
  "액세서리는 슬롯당 1개, 최대 {count}개입니다.": ["액세서리는 슬롯당 1개, 최대 {count}개입니다.", "Use one accessory per slot, up to {count} total.", "每个位置最多一件配饰，总计最多 {count} 件。", "アクセサリーは各スロットに 1 つ、合計 {count} 個までです。"],
  "액세서리 {id}가 없습니다.": ["액세서리 {id}가 없습니다.", "Accessory {id} does not exist.", "配饰 {id} 不存在。", "アクセサリー {id} がありません。"],
  "{slot} 슬롯에는 액세서리를 하나만 장착할 수 있습니다.": ["{slot} 슬롯에는 액세서리를 하나만 장착할 수 있습니다.", "Only one accessory can occupy the {slot} slot.", "{slot} 位置只能佩戴一件配饰。", "{slot} スロットに装着できるアクセサリーは 1 つだけです。"],
  "{preset}의 슬롯은 {slots} 중 하나여야 합니다.": ["{preset}의 슬롯은 {slots} 중 하나여야 합니다.", "The slot for {preset} must be one of: {slots}.", "{preset} 的位置必须为以下之一：{slots}。", "{preset} のスロットは {slots} のいずれかを指定してください。"],
  "{preset}의 슬롯은 leftEar 또는 rightEar로 명시해야 합니다.": ["{preset}의 슬롯은 leftEar 또는 rightEar로 명시해야 합니다.", "Specify leftEar or rightEar for the {preset} slot.", "请为 {preset} 明确指定 leftEar 或 rightEar 位置。", "{preset} のスロットは leftEar または rightEar を明示してください。"],
  "이전 v6 디자인을 v7으로 변환했습니다. face 장비 슬롯을 eyes로 바꾸고 도형, 색상, 장비 ID와 개별 표정 가중치를 보존했습니다.": ["이전 v6 디자인을 v7으로 변환했습니다. face 장비 슬롯을 eyes로 바꾸고 도형, 색상, 장비 ID와 개별 표정 가중치를 보존했습니다.", "Imported v6 as v7. Renamed the face equipment slot to eyes; preserved shape, colors, equipment IDs, and independent expression weights.", "已将 v6 设计导入为 v7。将 face 配饰位置更名为 eyes，保留了形状、颜色、配饰 ID 和独立表情权重。", "v6 を v7 として読み込みました。装備スロット face を eyes に変更し、形・色・装備 ID・独立した表情ウェイトを維持しました。"],
  "v{version} 디자인을 v7으로 변환하고 Material 도형 {shape}을 적용했습니다. 색상, 장비 ID와 개별 표정 가중치를 보존하고 face 슬롯을 eyes로 바꿨습니다. 눈 크기·앵커·간격·배율·표정 목표 형상, 몸체 프로필, 액세서리 앵커·배율·회전·추적값은 제거되어 기본 형상을 사용합니다.": ["v{version} 디자인을 v7으로 변환하고 Material 도형 {shape}을 적용했습니다. 색상, 장비 ID와 개별 표정 가중치를 보존하고 face 슬롯을 eyes로 바꿨습니다. 눈 크기·앵커·간격·배율·표정 목표 형상, 몸체 프로필, 액세서리 앵커·배율·회전·추적값은 제거되어 기본 형상을 사용합니다.", "Imported v{version} as v7 with Material shape {shape}. Preserved colors, equipment IDs, and independent expression weights; renamed face to eyes. Removed eye dimensions, anchors, spacing, scale, expression geometry, body profiles, and accessory anchors, scale, rotation, and follow; curated geometry now applies.", "已将 v{version} 设计导入为 v7，并应用 Material 形状 {shape}。保留了颜色、配饰 ID 和独立表情权重，将 face 更名为 eyes。已移除眼睛尺寸、锚点、间距、缩放、表情目标几何、身体轮廓，以及配饰的锚点、缩放、旋转和跟随设置，改用预设几何形状。", "v{version} を Material シェイプ {shape} の v7 として読み込みました。色・装備 ID・独立した表情ウェイトを維持し、face を eyes に変更しました。目の寸法・アンカー・間隔・スケール・表情形状、体のプロファイル、アクセサリーのアンカー・スケール・回転・追従は削除され、調整済みの形状が適用されます。"],
  "기존 비카탈로그 윤곽은 유사한 도형으로 바꿨으며 크기, 둥글기, 가늘어짐, 부풀기, 휘어짐은 더 이상 저장하지 않습니다.": ["기존 비카탈로그 윤곽은 유사한 도형으로 바꿨으며 크기, 둥글기, 가늘어짐, 부풀기, 휘어짐은 더 이상 저장하지 않습니다.", "Legacy non-catalog outlines were approximated; size, roundness, taper, bulge, and bend are no longer stored.", "旧版非目录轮廓已替换为近似形状；不再保存大小、圆润度、渐细、膨胀和弯曲参数。", "旧式のカタログ外の輪郭は近似形状に変換しました。サイズ・丸み・テーパー・膨らみ・曲がりは保存されなくなりました。"],
} as const satisfies Record<string, Translation>;
export const STUDIO_SHAPES = {
  "circle": [
    "원",
    "Circle",
    "圆形",
    "円"
  ],
  "square": [
    "정사각형",
    "Square",
    "正方形",
    "正方形"
  ],
  "slanted": [
    "기울어진 사각형",
    "Slanted",
    "斜四边形",
    "傾いた四角形"
  ],
  "arch": [
    "아치",
    "Arch",
    "拱形",
    "アーチ"
  ],
  "fan": [
    "부채",
    "Fan",
    "扇形",
    "扇形"
  ],
  "arrow": [
    "화살표",
    "Arrow",
    "箭头",
    "矢印"
  ],
  "semiCircle": [
    "반원",
    "Semi Circle",
    "半圆",
    "半円"
  ],
  "oval": [
    "타원",
    "Oval",
    "椭圆",
    "楕円"
  ],
  "pill": [
    "캡슐",
    "Pill",
    "胶囊",
    "カプセル"
  ],
  "triangle": [
    "삼각형",
    "Triangle",
    "三角形",
    "三角形"
  ],
  "diamond": [
    "마름모",
    "Diamond",
    "菱形",
    "ひし形"
  ],
  "clamShell": [
    "조개껍데기",
    "Clam Shell",
    "贝壳",
    "貝殻"
  ],
  "pentagon": [
    "오각형",
    "Pentagon",
    "五边形",
    "五角形"
  ],
  "gem": [
    "보석",
    "Gem",
    "宝石",
    "宝石"
  ],
  "verySunny": [
    "빛나는 태양",
    "Very Sunny",
    "灿烂阳光",
    "輝く太陽"
  ],
  "sunny": [
    "태양",
    "Sunny",
    "太阳",
    "太陽"
  ],
  "cookie4Sided": [
    "4면 쿠키",
    "4-sided cookie",
    "四瓣饼干",
    "4つ角のクッキー"
  ],
  "cookie6Sided": [
    "6면 쿠키",
    "6-sided cookie",
    "六瓣饼干",
    "6つ角のクッキー"
  ],
  "cookie7Sided": [
    "7면 쿠키",
    "7-sided cookie",
    "七瓣饼干",
    "7つ角のクッキー"
  ],
  "cookie9Sided": [
    "9면 쿠키",
    "9-sided cookie",
    "九瓣饼干",
    "9つ角のクッキー"
  ],
  "cookie12Sided": [
    "12면 쿠키",
    "12-sided cookie",
    "十二瓣饼干",
    "12個の角のクッキー"
  ],
  "ghostish": [
    "유령",
    "Ghostish",
    "小幽灵",
    "おばけ"
  ],
  "clover4Leaf": [
    "네잎클로버",
    "4-leaf clover",
    "四叶草",
    "四つ葉のクローバー"
  ],
  "clover8Leaf": [
    "여덟잎클로버",
    "8-leaf clover",
    "八叶草",
    "八つ葉のクローバー"
  ],
  "burst": [
    "방사형",
    "Burst",
    "放射形",
    "バースト"
  ],
  "softBurst": [
    "둥근 방사형",
    "Soft Burst",
    "圆润放射形",
    "丸いバースト"
  ],
  "boom": [
    "폭발형",
    "Boom",
    "爆炸形",
    "爆発形"
  ],
  "softBoom": [
    "둥근 폭발형",
    "Soft Boom",
    "圆润爆炸形",
    "丸い爆発形"
  ],
  "flower": [
    "꽃",
    "Flower",
    "花朵",
    "花"
  ],
  "puffy": [
    "몽글몽글",
    "Puffy",
    "蓬松形",
    "ふわふわ"
  ],
  "puffyDiamond": [
    "볼록 마름모",
    "Puffy Diamond",
    "蓬松菱形",
    "ふっくらしたひし形"
  ],
  "pixelCircle": [
    "픽셀 원",
    "Pixel Circle",
    "像素圆",
    "ピクセルの円"
  ],
  "pixelTriangle": [
    "픽셀 삼각형",
    "Pixel Triangle",
    "像素三角形",
    "ピクセルの三角形"
  ],
  "bun": [
    "번",
    "Bun",
    "面包",
    "パン"
  ],
  "heart": [
    "하트",
    "Heart",
    "爱心",
    "ハート"
  ]
} as const satisfies Record<MaterialShapeName, Translation>;
export const STUDIO_ACCESSORIES = {
  "beret": [
    "베레모",
    "Beret",
    "贝雷帽",
    "ベレー帽"
  ],
  "halo": [
    "후광",
    "Halo",
    "光环",
    "光輪"
  ],
  "crown": [
    "왕관",
    "Crown",
    "王冠",
    "王冠"
  ],
  "glasses": [
    "안경",
    "Glasses",
    "眼镜",
    "眼鏡"
  ],
  "sunglasses": [
    "선글라스",
    "Sunglasses",
    "太阳镜",
    "サングラス"
  ],
  "moustache": [
    "콧수염",
    "Moustache",
    "小胡子",
    "口ひげ"
  ],
  "goatee": [
    "턱수염",
    "Goatee",
    "山羊胡",
    "あごひげ"
  ],
  "bowTie": [
    "보타이",
    "Bow tie",
    "领结",
    "蝶ネクタイ"
  ],
  "scarf": [
    "스카프",
    "Scarf",
    "围巾",
    "マフラー"
  ],
  "necklace": [
    "목걸이",
    "Necklace",
    "项链",
    "ネックレス"
  ],
  "earring": [
    "드롭 귀걸이",
    "Drop earring",
    "垂坠耳饰",
    "ドロップイヤリング"
  ],
  "starEarring": [
    "별 귀걸이",
    "Star earring",
    "星形耳饰",
    "星のイヤリング"
  ]
} as const satisfies Record<AccessoryPreset, Translation>;

export type StudioTextKey = keyof typeof STUDIO_TEXT;
export function studioText(key: StudioTextKey, locale: SiteLocale = getSiteLocale()): string {
  return STUDIO_TEXT[key][localeIndex[locale]]!;
}
export function studioFormat(key: StudioTextKey, values: Record<string, string | number>, locale: SiteLocale = getSiteLocale()): string {
  return studioText(key, locale).replace(/\{(\w+)\}/g, (token, name: string) => String(values[name] ?? token));
}
export function studioShapeLabel(name: MaterialShapeName, locale: SiteLocale = getSiteLocale()): string {
  return STUDIO_SHAPES[name][localeIndex[locale]]!;
}
export function studioAccessoryLabel(name: AccessoryPreset, locale: SiteLocale = getSiteLocale()): string {
  return STUDIO_ACCESSORIES[name][localeIndex[locale]]!;
}
/** Also understands already translated statuses, so changing language never leaves a stale toast. */
export function studioLabel(source: string, locale: SiteLocale = getSiteLocale()): string {
  const exact = Object.hasOwn(STUDIO_TEXT, source) ? (STUDIO_TEXT as Record<string, Translation>)[source] : undefined;
  if (exact) return exact[localeIndex[locale]]!;
  for (const catalog of [STUDIO_TEXT, STUDIO_SHAPES, STUDIO_ACCESSORIES]) {
    for (const labels of Object.values(catalog) as Translation[]) {
      if (labels.includes(source)) return labels[localeIndex[locale]]!;
    }
  }
  return source;
}

const templateMatchers = Object.entries(STUDIO_TEXT).flatMap(([key, labels]) => labels.flatMap(label => {
  if (!label.includes('{')) return [];
  const names: string[] = [];
  const parts = label.split(/(\{\w+\})/g).map(part => {
    if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1, -1)); return '(.+?)'; }
    return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  });
  return [{ key: key as StudioTextKey, names, expression: new RegExp(`^${parts.join('')}$`) }];
}));

/** Presentation-layer translation keeps core validation and serialized documents unchanged. */
export function studioMessage(message: string, locale: SiteLocale = getSiteLocale()): string {
  if (!message) return '';
  const source = message.replace(/^(?:Error|TypeError|RangeError|SyntaxError): /, '');
  const direct = studioLabel(source, locale);
  if (direct !== source) return direct;
  for (const { key, names, expression } of templateMatchers) {
    const match = expression.exec(source);
    if (match) return studioFormat(key, Object.fromEntries(names.map((name, index) => [name, match[index + 1]!])), locale);
  }
  if (/^(?:Unexpected (?:token|end|non-whitespace)|Expected (?:property|double|','|':'|'\}')|Unterminated string|Bad (?:control|escaped)|JSON\.parse:)|is not valid JSON/.test(source)) {
    return studioText('JSON 문법을 확인하세요. 따옴표, 쉼표, 괄호가 올바른지 확인하세요.', locale);
  }
  const migration = /^Imported v([1-5]) as v7 with Material shape "([^"]+)"/.exec(source);
  if (migration) {
    const summary = studioFormat('v{version} 디자인을 v7으로 변환하고 Material 도형 {shape}을 적용했습니다. 색상, 장비 ID와 개별 표정 가중치를 보존하고 face 슬롯을 eyes로 바꿨습니다. 눈 크기·앵커·간격·배율·표정 목표 형상, 몸체 프로필, 액세서리 앵커·배율·회전·추적값은 제거되어 기본 형상을 사용합니다.', { version: migration[1]!, shape: migration[2]! }, locale);
    return summary + (source.includes('Legacy non-catalog') ? ` ${studioText('기존 비카탈로그 윤곽은 유사한 도형으로 바꿨으며 크기, 둥글기, 가늘어짐, 부풀기, 휘어짐은 더 이상 저장하지 않습니다.', locale)}` : '');
  }
  const separator = source.indexOf(': ');
  if (separator >= 0) return `${source.slice(0, separator)}: ${studioMessage(source.slice(separator + 2), locale)}`;
  return source;
}
