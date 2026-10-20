export function recordSettingChange(win: Window, properties: {
  site_page: string; site_section: string; setting_key: string; value_category: string;
  change_source: 'control' | 'preset';
}, options?: { debounce?: boolean }): boolean;

export function cancelSettingChange(win: Window, context: { site_page: string; site_section: string; setting_key: string }): void;
