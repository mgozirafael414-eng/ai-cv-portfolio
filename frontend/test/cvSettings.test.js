import assert from 'node:assert/strict'
import test from 'node:test'
import { CV_COLOR_PRESETS, CV_TEMPLATES, getColorPreset } from '../src/components/cv/cvSettings.js'

test('CV Builder offers the five requested template types', () => {
  assert.deepEqual(CV_TEMPLATES.map((template) => template.id), [
    'professional',
    'modern',
    'classic',
    'minimal',
    'creative',
  ])
})

test('CV color presets expose readable accent and secondary colors', () => {
  assert.deepEqual(CV_COLOR_PRESETS.map((preset) => preset.id), [
    'navy',
    'teal',
    'royal',
    'burgundy',
    'forest',
    'monochrome',
  ])
  for (const preset of CV_COLOR_PRESETS) {
    assert.match(preset.accent, /^#[0-9a-f]{6}$/i)
    assert.match(preset.secondary, /^#[0-9a-f]{6}$/i)
  }
  assert.equal(getColorPreset('not-a-preset').id, 'navy')
})
