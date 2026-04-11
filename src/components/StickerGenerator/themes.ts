/**
 * 贴纸模板主题配置
 * 预设样式：语录金句、职场分享、养生大字报等
 */

export type TemplateId = "quotes" | "workplace" | "health";

export interface ThemeConfig {
  id: TemplateId;
  name: string;
  description: string;
  // 整体背景
  background: string;
  // 文字主色
  primaryText: string;
  // 标题颜色
  titleColor: string;
  // 装饰元素
  accentColor: string;
  // 字体
  fontFamily: string;
  // 贴纸数量
  stickerCount: number;
  // 布局方向: vertical | horizontal
  layout: "vertical" | "horizontal";
}

export const TEMPLATES: Record<TemplateId, ThemeConfig> = {
  // 高饱和黄黑语录
  quotes: {
    id: "quotes",
    name: "语录金句",
    description: "高饱和黄黑配色，适合心灵鸡汤和励志语录",
    background: "#1a1a1a",
    primaryText: "#ffffff",
    titleColor: "#FFD700",
    accentColor: "#FF6B35",
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    stickerCount: 4,
    layout: "vertical",
  },
  // 职场金句
  workplace: {
    id: "workplace",
    name: "职场金句",
    description: "商务蓝白配色，适合职场干货和经验分享",
    background: "#f8fafc",
    primaryText: "#1e293b",
    titleColor: "#3b82f6",
    accentColor: "#60a5fa",
    fontFamily: "'Microsoft YaHei', 'PingFang SC', sans-serif",
    stickerCount: 3,
    layout: "vertical",
  },
  // 养生大字报
  health: {
    id: "health",
    name: "养生大字报",
    description: "清新绿白配色，适合健康养生内容",
    background: "#f0fdf4",
    primaryText: "#166534",
    titleColor: "#22c55e",
    accentColor: "#86efac",
    fontFamily: "'PingFang SC', 'Microsoft YaHei', sans-serif",
    stickerCount: 4,
    layout: "vertical",
  },
};

export const TEMPLATE_LIST = Object.values(TEMPLATES);

export const ASPECT_RATIOS = [
  { id: "1:1", name: "1:1 方形", ratio: 1 },
  { id: "3:4", name: "3:4 竖版", ratio: 4 / 3 },
] as const;

export type AspectRatioId = (typeof ASPECT_RATIOS)[number]["id"];

/**
 * 默认贴纸数据（对齐 backend StickerContent 接口）
 */
export const DEFAULT_STICKER_DATA = {
  title: "职场人必看的成长法则",
  caption: "评论区告诉我，你做到了几条？",
  slides: [
    {
      heading: "持续学习",
      content: "每天进步1%，一年后领先37倍",
    },
    {
      heading: "主动承担",
      content: "多走一步，才能多看一眼",
    },
    {
      heading: "复盘反思",
      content: "不做复盘的努力，都是白费",
    },
    {
      heading: "建立人脉",
      content: "你的收入是身边5个人的平均值",
    },
  ],
};
