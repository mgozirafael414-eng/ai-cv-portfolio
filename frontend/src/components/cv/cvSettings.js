export const CV_TEMPLATES = [
  { id: 'professional', label: 'Professional', description: 'ATS-friendly and single-column', preview: 'professional' },
  { id: 'modern', label: 'Modern', description: 'Two-column with a dark sidebar', preview: 'modern' },
  { id: 'classic', label: 'Classic', description: 'Formal corporate hierarchy', preview: 'classic' },
  { id: 'minimal', label: 'Minimalist', description: 'Quiet, white, and focused', preview: 'minimal' },
  { id: 'creative', label: 'Creative / Tech', description: 'A confident technology accent', preview: 'creative' },
]

export const CV_COLOR_PRESETS = [
  { id: 'navy', label: 'Navy Blue', accent: '#17324d', secondary: '#526579' },
  { id: 'teal', label: 'Teal', accent: '#176b67', secondary: '#4f7772' },
  { id: 'royal', label: 'Royal Blue', accent: '#2855a6', secondary: '#5d7094' },
  { id: 'burgundy', label: 'Burgundy', accent: '#7a2e3a', secondary: '#8a6268' },
  { id: 'forest', label: 'Forest Green', accent: '#2f5d46', secondary: '#647a6d' },
  { id: 'monochrome', label: 'Black & White', accent: '#222222', secondary: '#666666' },
]

export function getColorPreset(id) {
  return CV_COLOR_PRESETS.find((preset) => preset.id === id) || CV_COLOR_PRESETS[0]
}
