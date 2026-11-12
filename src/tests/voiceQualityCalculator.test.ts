import {
  calculateVoipQuality,
  CODEC_PROFILES,
  PRESET_SCENARIOS,
} from '../modules/voice-simulator/services/voiceQualityCalculator';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log('\n=============================================================');
console.log('🚀 RUNNING VOICE QUALITY & MOS SIMULATOR TEST SUITE');
console.log('=============================================================\n');

// 1. Pristine Network Test
const pristine = calculateVoipQuality(0.0, 3, 15, 'g711u');
assert(pristine.mos >= 4.15, `Pristine fiber network achieves MOS >= 4.15 (got ${pristine.mos})`);
assert(pristine.ratingLabel === 'EXCELLENT', `Pristine network rated EXCELLENT (got ${pristine.ratingLabel})`);
assert(pristine.rFactor >= 85, `Pristine R-factor >= 85 (got ${pristine.rFactor})`);
assert(pristine.customerExplanationEn.includes('OPTIMAL'), 'Customer English explanation includes OPTIMAL status');

// 2. High Packet Loss Test
const packetLossScenario = calculateVoipQuality(4.5, 10, 30, 'g711u');
assert(packetLossScenario.mos < 3.5, `4.5% packet loss degrades MOS < 3.5 (got ${packetLossScenario.mos})`);
assert(
  packetLossScenario.ratingLabel === 'POOR' || packetLossScenario.ratingLabel === 'FAIR',
  `High packet loss flags POOR or FAIR (got ${packetLossScenario.ratingLabel})`
);
assert(
  Boolean(packetLossScenario.culpritFactor?.includes('Packet Loss')),
  `Primary culprit identified as Packet Loss (got ${packetLossScenario.culpritFactor})`
);
assert(
  packetLossScenario.customerExplanationEn.includes('4.5% packet loss'),
  'Customer explanation explicitly mentions 4.5% packet loss'
);
assert(
  packetLossScenario.customerExplanationEn.includes('Ethernet connection'),
  'Customer explanation recommends wired Ethernet connection'
);

// 3. High Jitter Test
const jitterScenario = calculateVoipQuality(0.2, 75, 40, 'g711u');
assert(
  Boolean(jitterScenario.culpritFactor?.includes('Jitter')),
  `Culprit identified as High Jitter (got ${jitterScenario.culpritFactor})`
);
assert(
  jitterScenario.customerExplanationEn.includes('75ms'),
  'English customer explanation mentions 75ms jitter'
);
assert(
  jitterScenario.customerExplanationEn.includes('jitter buffer overflow'),
  'English explanation notes jitter buffer overflow'
);

// 4. Codec Comparison: Opus FEC vs G.711 under loss
const g711WithLoss = calculateVoipQuality(3.0, 15, 30, 'g711u');
const opusWithLoss = calculateVoipQuality(3.0, 15, 30, 'opus');
assert(
  opusWithLoss.mos > g711WithLoss.mos,
  `Opus with FEC maintains higher MOS (${opusWithLoss.mos}) than G.711 (${g711WithLoss.mos}) under 3% packet loss`
);

// 5. Bandwidth Calculation Test
assert(
  pristine.singleCallBandwidthKbps === 160,
  `G.711 single call duplex bandwidth is 160 kbps (got ${pristine.singleCallBandwidthKbps})`
);
const g729Eval = calculateVoipQuality(0.0, 5, 20, 'g729');
assert(
  g729Eval.singleCallBandwidthKbps === 48,
  `G.729 single call duplex bandwidth is 48 kbps (got ${g729Eval.singleCallBandwidthKbps})`
);

// 6. Presets Validation
assert(PRESET_SCENARIOS.length === 5, 'Contains 5 predefined field presets');
for (const preset of PRESET_SCENARIOS) {
  const presetEval = calculateVoipQuality(preset.packetLoss, preset.jitter, preset.latency, preset.codec);
  assert(presetEval.mos >= 1.0 && presetEval.mos <= 4.5, `Preset ${preset.name} evaluates to valid MOS (${presetEval.mos})`);
  assert(presetEval.customerExplanationEn.length > 50, `Preset ${preset.name} has non-empty EN explanation`);
}

console.log('\n=============================================================');
console.log('🎉 ALL VOICE QUALITY SIMULATOR TESTS PASSED SUCCESSFULLY!');
console.log('=============================================================\n');
