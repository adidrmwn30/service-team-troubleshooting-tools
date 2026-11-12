import React, { useState, useMemo, useEffect } from 'react';
import {
  Volume2,
  Play,
  Square,
  Sliders,
  Copy,
  Check,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  MessageSquare,
  User,
  Headphones,
  SplitSquareVertical,
} from 'lucide-react';
import {
  calculateVoipQuality,
  CODEC_PROFILES,
  PRESET_SCENARIOS,
  PresetScenario,
} from './services/voiceQualityCalculator';
import { audioSimulator } from './services/audioSimulationEngine';

interface ConversationTurn {
  speaker: 'agent' | 'customer';
  speakerLabel: string;
  originalText: string;
  hasAudioSample?: boolean;
}

interface ConversationScenario {
  id: string;
  title: string;
  subtitle: string;
  dialogue: ConversationTurn[];
}

const CONVERSATION_SCENARIOS: ConversationScenario[] = [
  {
    id: 'support-inbound',
    title: 'Customer Support (Inbound Helpdesk)',
    subtitle: 'Identity verification & SIP Trunk provisioning check',
    dialogue: [
      {
        speaker: 'agent',
        speakerLabel: 'B3 Support Engineer',
        originalText:
          'Hello, thank you for calling B3 Networks technical support. How can I assist you today?',
        hasAudioSample: true,
      },
      {
        speaker: 'customer',
        speakerLabel: 'Customer (Caller)',
        originalText:
          'Our ticket reference is B3-99482 under Acme Enterprise. We need this expedited for our cutover.',
        hasAudioSample: true,
      },
      {
        speaker: 'agent',
        speakerLabel: 'B3 Support Engineer',
        originalText:
          'Understood. I can confirm your SIP Trunk registration has completed successfully and all RTP media paths are optimal.',
        hasAudioSample: false,
      },
      {
        speaker: 'customer',
        speakerLabel: 'Customer (Caller)',
        originalText:
          'Thank you for the quick confirmation. We will proceed with the production PBX cutover.',
        hasAudioSample: false,
      },
    ],
  },
  {
    id: 'sales-consultation',
    title: 'Enterprise Architecture Consultation',
    subtitle: 'Discussion on dual-region failover and SLA',
    dialogue: [
      {
        speaker: 'agent',
        speakerLabel: 'Solutions Architect',
        originalText:
          'Good morning Ms. Davis, thank you for joining our B3 Networks SIP Trunking consultation session.',
        hasAudioSample: true,
      },
      {
        speaker: 'customer',
        speakerLabel: 'Enterprise Client',
        originalText:
          'Good morning. We are interested in your active-active failover between Singapore and US regions.',
        hasAudioSample: true,
      },
      {
        speaker: 'agent',
        speakerLabel: 'Solutions Architect',
        originalText:
          'Our architecture guarantees 99.99% uptime with automated sub-50ms RTP rerouting in case of carrier degradation.',
        hasAudioSample: false,
      },
    ],
  },
];

export const VoiceSimulatorView: React.FC = () => {
  // Slider states
  const [packetLoss, setPacketLoss] = useState<number>(0.0);
  const [jitter, setJitter] = useState<number>(5);
  const [latency, setLatency] = useState<number>(25);
  const [selectedCodecId, setSelectedCodecId] = useState<string>('g711u');
  const [activePreset, setActivePreset] = useState<string | null>('pristine-fiber');

  // Conversation Sample states
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('support-inbound');
  const [conversationViewMode, setConversationViewMode] = useState<'simulated' | 'comparison'>('simulated');
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [activePlayingSpeaker, setActivePlayingSpeaker] = useState<'agent' | 'customer' | null>(null);

  // Stop audio simulation on component unmount
  useEffect(() => {
    return () => {
      audioSimulator.stop();
    };
  }, []);

  // Calculate MOS & VoIP Quality
  const evaluation = useMemo(() => {
    return calculateVoipQuality(packetLoss, jitter, latency, selectedCodecId);
  }, [packetLoss, jitter, latency, selectedCodecId]);

  const activeCodec = useMemo(() => {
    return CODEC_PROFILES.find((c) => c.id === selectedCodecId) || CODEC_PROFILES[0];
  }, [selectedCodecId]);

  const currentScenario = useMemo(() => {
    return (
      CONVERSATION_SCENARIOS.find((s) => s.id === selectedScenarioId) ||
      CONVERSATION_SCENARIOS[0]
    );
  }, [selectedScenarioId]);

  // Handle Preset Selection
  const applyPreset = (preset: PresetScenario) => {
    if (isPlayingAudio) {
      audioSimulator.stop();
      setIsPlayingAudio(false);
      setActivePlayingSpeaker(null);
    }
    setActivePreset(preset.id);
    setPacketLoss(preset.packetLoss);
    setJitter(preset.jitter);
    setLatency(preset.latency);
    setSelectedCodecId(preset.codec);
  };

  const handleSliderChange = (
    setter: React.Dispatch<React.SetStateAction<number>>,
    val: number
  ) => {
    if (isPlayingAudio) {
      audioSimulator.stop();
      setIsPlayingAudio(false);
      setActivePlayingSpeaker(null);
    }
    setActivePreset(null);
    setter(val);
  };

  const handleReset = () => {
    if (isPlayingAudio) {
      audioSimulator.stop();
      setIsPlayingAudio(false);
      setActivePlayingSpeaker(null);
    }
    applyPreset(PRESET_SCENARIOS[0]);
  };

  // Audio Playback handler
  const handleToggleAudio = async (speaker: 'agent' | 'customer' = 'agent') => {
    if (isPlayingAudio && activePlayingSpeaker === speaker) {
      audioSimulator.stop();
      setIsPlayingAudio(false);
      setActivePlayingSpeaker(null);
    } else {
      audioSimulator.stop();
      setIsPlayingAudio(true);
      setActivePlayingSpeaker(speaker);

      await audioSimulator.playSimulation(
        packetLoss,
        jitter,
        latency,
        selectedCodecId,
        speaker,
        () => {
          setIsPlayingAudio(false);
          setActivePlayingSpeaker(null);
        }
      );
    }
  };

  // Helper function to synthesize degraded speech text based on packet loss & jitter
  const degradeText = (originalText: string, pLoss: number, jMs: number, latMs: number) => {
    const words = originalText.split(' ');
    const renderedElements: React.ReactNode[] = [];

    words.forEach((word, idx) => {
      // Deterministic pseudo-random seed per word position
      const seed = (idx * 19 + 31) % 100;

      // Packet loss check
      if (pLoss > 0.5 && seed < pLoss * 6.0) {
        if (pLoss >= 5.0 || seed % 2 === 0) {
          renderedElements.push(
            <span
              key={idx}
              className="bg-red-500/20 text-red-300 px-1 py-0.5 rounded font-mono text-[11px] border border-red-500/40 line-through decoration-red-400 mx-0.5"
              title={`RTP packet dropped (${pLoss.toFixed(1)}% loss)`}
            >
              [..]
            </span>
          );
        } else {
          // Truncated syllable
          const cutPoint = Math.max(1, Math.floor(word.length / 2));
          const truncated = word.substring(0, cutPoint) + '[..]';
          renderedElements.push(
            <span
              key={idx}
              className="text-red-400 font-semibold bg-red-950/40 px-0.5 rounded mx-0.5"
              title="Syllable truncated by packet loss"
            >
              {truncated}
            </span>
          );
        }
      } else if (jMs > 30 && seed < (jMs - 20) * 0.85) {
        // Jitter buffer underflow stutter
        const stutterPrefix = word.length > 3 ? word.substring(0, 2) : word.substring(0, 1);
        const stutter = `${stutterPrefix}-${word}`;
        renderedElements.push(
          <span
            key={idx}
            className="text-amber-300 font-medium bg-amber-950/40 px-0.5 rounded italic mx-0.5"
            title={`Jitter buffer underflow stutter (${jMs}ms)`}
          >
            {stutter}
          </span>
        );
      } else {
        renderedElements.push(
          <span key={idx} className="mx-0.5">
            {word}
          </span>
        );
      }
    });

    // High latency conversational overlap warning
    if (latMs >= 220) {
      renderedElements.push(
        <span
          key="latency-collision"
          className="block mt-1 text-[10px] text-blue-300/80 font-mono italic bg-blue-950/30 px-2 py-0.5 rounded border border-blue-500/20"
        >
          ⏱️ [Propagation delay ~{latMs}ms: Talk-over collision / awkward pause]
        </span>
      );
    }

    return renderedElements;
  };

  // Copy Full Conversation Transcript
  const handleCopyTranscript = () => {
    const transcript = currentScenario.dialogue
      .map((d) => `${d.speakerLabel}: ${d.originalText}`)
      .join('\n\n');
    navigator.clipboard.writeText(transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2500);
  };

  return (
    <div className="flex flex-col min-h-full bg-navy-950 text-slate-100 p-6 md:p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-surface-border pb-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-wide flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-purple-400" />
            <span>Voice Quality Simulator & MOS Calculator</span>
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Interactive ITU-T G.107 E-Model simulation with authentic human speech audio playback, real-time packet loss chopping, and side-by-side conversation analysis.
          </p>
        </div>

        <button
          onClick={handleReset}
          className="self-start md:self-auto px-3 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-slate-300 border border-surface-border text-xs flex items-center gap-1.5 transition"
        >
          <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
          <span>Reset to Defaults</span>
        </button>
      </div>

      {/* Preset Scenarios Chips */}
      <div className="space-y-2">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-purple-400" />
          <span>Quick Network Presets:</span>
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {PRESET_SCENARIOS.map((p) => {
            const isSelected = activePreset === p.id;
            return (
              <button
                key={p.id}
                onClick={() => applyPreset(p)}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500/50 text-purple-200 shadow-md ring-1 ring-purple-500/30'
                    : 'bg-navy-900/80 border-surface-border hover:bg-navy-850 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-white truncate">{p.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                      p.badge === 'Optimal'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {p.badge}
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 line-clamp-1">{p.description}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Controls vs Results */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Sliders & Controls (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border shadow-lg space-y-5">
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Sliders className="w-4 h-4 text-purple-400" />
                <span>Network Transmission Parameters</span>
              </h3>
              <span className="text-[11px] font-mono text-slate-400">
                Adjust sliders for real-time recalculation
              </span>
            </div>

            {/* Slider 1: Packet Loss */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  <label className="text-xs font-medium text-slate-200">
                    Packet Loss Ratio (%)
                  </label>
                  <span className="text-[10px] text-slate-400">(VoIP tolerance &lt; 1.0%)</span>
                </div>
                <span
                  className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                    packetLoss === 0
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : packetLoss < 2
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-red-400 bg-red-500/10'
                  }`}
                >
                  {packetLoss.toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="15"
                step="0.1"
                value={packetLoss}
                onChange={(e) =>
                  handleSliderChange(setPacketLoss, parseFloat(e.target.value))
                }
                className="w-full accent-purple-500 cursor-pointer bg-navy-950 h-2 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0% (Pristine Fiber)</span>
                <span>2% (Wi-Fi Dropout)</span>
                <span>5% (Choppy Audio)</span>
                <span>15% (Severe Gaps)</span>
              </div>
            </div>

            {/* Slider 2: Jitter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <label className="text-xs font-medium text-slate-200">
                    Jitter Variance (ms)
                  </label>
                  <span className="text-[10px] text-slate-400">(Normal tolerance &lt; 20ms)</span>
                </div>
                <span
                  className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                    jitter < 20
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : jitter < 40
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-red-400 bg-red-500/10'
                  }`}
                >
                  {Math.round(jitter)} ms
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="120"
                step="1"
                value={jitter}
                onChange={(e) =>
                  handleSliderChange(setJitter, parseInt(e.target.value, 10))
                }
                className="w-full accent-amber-500 cursor-pointer bg-navy-950 h-2 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>0 ms (Ideal)</span>
                <span>20 ms (Safe Threshold)</span>
                <span>50 ms (Buffer Stretch)</span>
                <span>120 ms (Severe Stutter)</span>
              </div>
            </div>

            {/* Slider 3: One-Way Latency */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  <label className="text-xs font-medium text-slate-200">
                    One-Way Latency / RTT (ms)
                  </label>
                  <span className="text-[10px] text-slate-400">(ITU-T target &lt; 150ms)</span>
                </div>
                <span
                  className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                    latency < 100
                      ? 'text-emerald-400 bg-emerald-500/10'
                      : latency < 180
                      ? 'text-amber-400 bg-amber-500/10'
                      : 'text-red-400 bg-red-500/10'
                  }`}
                >
                  {Math.round(latency)} ms
                </span>
              </div>
              <input
                type="range"
                min="10"
                max="400"
                step="5"
                value={latency}
                onChange={(e) =>
                  handleSliderChange(setLatency, parseInt(e.target.value, 10))
                }
                className="w-full accent-blue-500 cursor-pointer bg-navy-950 h-2 rounded-lg"
              />
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>10 ms (Local SG)</span>
                <span>80 ms (Regional SG-ID)</span>
                <span>220 ms (Trans-oceanic US/EU)</span>
                <span>400 ms (Severe Interactive Lag)</span>
              </div>
            </div>

            {/* Codec Selection */}
            <div className="space-y-2 pt-2 border-t border-surface-border/60">
              <label className="text-xs font-medium text-slate-200 flex items-center justify-between">
                <span>VoIP Audio Codec:</span>
                <span className="text-[11px] font-mono text-purple-300">
                  {activeCodec.bitrateKbps} kbps • {activeCodec.standard}
                </span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CODEC_PROFILES.map((codec) => {
                  const isCodecSelected = selectedCodecId === codec.id;
                  return (
                    <button
                      key={codec.id}
                      onClick={() => {
                        if (isPlayingAudio) {
                          audioSimulator.stop();
                          setIsPlayingAudio(false);
                          setActivePlayingSpeaker(null);
                        }
                        setActivePreset(null);
                        setSelectedCodecId(codec.id);
                      }}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isCodecSelected
                          ? 'bg-purple-600/30 border-purple-500 text-white font-medium'
                          : 'bg-navy-950/60 border-surface-border hover:bg-navy-800 text-slate-400'
                      }`}
                    >
                      <span className="text-xs block font-semibold">{codec.name}</span>
                      <span className="text-[10px] text-slate-400 block">{codec.bitrateKbps} kbps</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[11px] text-slate-400 mt-1 italic">
                {activeCodec.description}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column: MOS Gauge & Results (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Main MOS Card */}
          <div className="p-5 rounded-xl bg-navy-900/90 border border-surface-border shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Voice Quality Score
              </span>
              <span
                className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded border ${
                  evaluation.ratingLabel === 'EXCELLENT' || evaluation.ratingLabel === 'GOOD'
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                    : evaluation.ratingLabel === 'FAIR'
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    : 'bg-red-500/10 text-red-400 border-red-500/30'
                }`}
              >
                {evaluation.ratingLabel}
              </span>
            </div>

            {/* Big MOS Number */}
            <div className="flex items-baseline gap-3">
              <span className={`text-5xl font-extrabold font-mono tracking-tight ${evaluation.ratingTextColor}`}>
                {evaluation.mos.toFixed(2)}
              </span>
              <span className="text-slate-500 font-mono text-sm">/ 5.00 MOS</span>
              <span className="text-xs font-mono text-slate-400 ml-auto bg-navy-950 px-2 py-1 rounded border border-surface-border">
                R-Factor: {evaluation.rFactor}
              </span>
            </div>

            {/* MOS Gauge Bar */}
            <div className="space-y-1.5">
              <div className="h-3 w-full bg-navy-950 rounded-full overflow-hidden flex border border-surface-border/50 p-0.5">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${evaluation.ratingColor}`}
                  style={{ width: `${Math.max(5, ((evaluation.mos - 1.0) / 3.5) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-slate-500">
                <span>1.0 (Unusable)</span>
                <span>3.5 (Acceptable)</span>
                <span>4.0 (Standard)</span>
                <span>4.5 (Pristine)</span>
              </div>
            </div>

            {/* Primary Culprit */}
            <div className="p-3 rounded-lg bg-navy-950/70 border border-surface-border text-xs flex items-center justify-between">
              <span className="text-slate-400">Primary Degradation Factor:</span>
              <span className="font-semibold text-white flex items-center gap-1 font-mono">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                {evaluation.culpritFactor}
              </span>
            </div>

            {/* User Experience Description */}
            <div className="space-y-2 pt-2 border-t border-surface-border/50 text-xs">
              <span className="text-[11px] font-semibold text-slate-300 block">
                Audible Human Perception:
              </span>
              <div className="p-3.5 rounded-lg bg-purple-950/20 border border-purple-500/20 text-purple-200 text-xs leading-relaxed">
                <p className="text-slate-200 font-medium">{evaluation.userExperienceEn}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Realistic Conversation Sample & Web Audio Playback Simulator */}
      <div className="p-5 rounded-xl bg-navy-900/90 border border-purple-500/30 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-surface-border/70 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                CONVERSATION SAMPLE
              </span>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <span>Simulated Speech & Real-Voice Audio Player</span>
              </h3>
            </div>
            <p className="text-[11px] text-slate-400">
              Listen to realistic human voice audio degraded in real-time by current packet loss, jitter, and latency settings.
            </p>
          </div>

          {/* Action Buttons: Play Audio & Transcript Copy */}
          <div className="flex items-center gap-2.5 self-start sm:self-auto">
            <button
              onClick={() => handleToggleAudio('agent')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-md ${
                isPlayingAudio && activePlayingSpeaker === 'agent'
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {isPlayingAudio && activePlayingSpeaker === 'agent' ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Agent Audio</span>
                </>
              )}
            </button>

            <button
              onClick={() => handleToggleAudio('customer')}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-2 transition shadow-md ${
                isPlayingAudio && activePlayingSpeaker === 'customer'
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-purple-600 hover:bg-purple-500 text-white'
              }`}
            >
              {isPlayingAudio && activePlayingSpeaker === 'customer' ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Stop Audio</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Play Customer Audio</span>
                </>
              )}
            </button>

            <button
              onClick={handleCopyTranscript}
              className="px-3 py-2 rounded-lg bg-navy-950 hover:bg-navy-800 border border-surface-border text-slate-300 text-xs flex items-center gap-1.5 transition"
              title="Copy dialogue transcript"
            >
              {copiedTranscript ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy Script</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Live Audio Status Banner (When Audio is Playing) */}
        {isPlayingAudio && (
          <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center gap-1 h-3">
                <span className="w-1 h-3 bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1 h-4 bg-emerald-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1 h-2 bg-emerald-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="w-1 h-4 bg-emerald-400 animate-bounce" style={{ animationDelay: '100ms' }} />
              </div>
              <span className="text-emerald-300 font-medium">
                Playing {activePlayingSpeaker === 'agent' ? 'Agent' : 'Customer'} voice with {packetLoss === 0 ? 'pristine 0% loss' : `${packetLoss.toFixed(1)}% packet loss`}, {jitter}ms jitter, {latency}ms latency via {activeCodec.name}
              </span>
            </div>
            <span className="text-[10px] text-emerald-400/80 font-mono">Real-Time RTP Frame Slicing</span>
          </div>
        )}

        {/* Control Bar: Scenario Select & View Mode Toggle */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
          {/* Scenario Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[11px] text-slate-400 font-medium whitespace-nowrap">Dialogue Scenario:</span>
            {CONVERSATION_SCENARIOS.map((scen) => (
              <button
                key={scen.id}
                onClick={() => setSelectedScenarioId(scen.id)}
                className={`px-3 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                  selectedScenarioId === scen.id
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'bg-navy-950 text-slate-400 hover:text-slate-200 border border-surface-border'
                }`}
              >
                {scen.title}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex bg-navy-950 p-1 rounded-lg border border-surface-border self-start sm:self-auto">
            <button
              onClick={() => setConversationViewMode('simulated')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition ${
                conversationViewMode === 'simulated'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Simulated Audio
            </button>
            <button
              onClick={() => setConversationViewMode('comparison')}
              className={`px-3 py-1 text-xs rounded-md font-medium flex items-center gap-1.5 transition ${
                conversationViewMode === 'comparison'
                  ? 'bg-purple-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SplitSquareVertical className="w-3.5 h-3.5" />
              <span>Side-by-Side</span>
            </button>
          </div>
        </div>

        {/* Customer Frustration Indicator (if MOS is degraded) */}
        {evaluation.mos < 3.8 && (
          <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-300">
                Customer Ticket Verbatim Expectation:
              </p>
              <p className="text-slate-300 text-[11px] mt-0.5 italic">
                {packetLoss >= 2.0
                  ? '“The audio cuts out every second like a helicopter blade, missing words randomly: hello? hello? Can you hear me?”'
                  : jitter >= 35
                  ? '“The other party sounds robotic and stuttery, making it impossible to transcribe phone numbers accurately!”'
                  : '“There is a large delay on the line, causing both of us to continuously talk over each other.”'}
              </p>
            </div>
          </div>
        )}

        {/* Conversation Dialog Box */}
        <div className="space-y-3 pt-2">
          {currentScenario.dialogue.map((turn, idx) => {
            const isAgent = turn.speaker === 'agent';
            const isThisTurnPlaying = isPlayingAudio && activePlayingSpeaker === turn.speaker;

            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border transition-all ${
                  isAgent
                    ? 'bg-navy-950/80 border-surface-border'
                    : 'bg-purple-950/15 border-purple-500/20'
                }`}
              >
                {/* Speaker Identity Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                        isAgent
                          ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30'
                          : 'bg-purple-600/20 text-purple-400 border border-purple-500/30'
                      }`}
                    >
                      {isAgent ? <Headphones className="w-3.5 h-3.5" /> : <User className="w-3.5 h-3.5" />}
                    </div>
                    <span className="text-xs font-semibold text-white">
                      {turn.speakerLabel}
                    </span>

                    {/* Quick Voice Play Button next to turn */}
                    {turn.hasAudioSample && (
                      <button
                        onClick={() => handleToggleAudio(turn.speaker)}
                        className={`ml-2 px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 transition ${
                          isThisTurnPlaying
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : 'bg-navy-900 hover:bg-navy-800 text-slate-300 border border-surface-border'
                        }`}
                      >
                        {isThisTurnPlaying ? (
                          <>
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>Play Voice</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  <span className="text-[10px] font-mono text-slate-500">
                    Turn #{idx + 1}
                  </span>
                </div>

                {/* Body Text */}
                {conversationViewMode === 'simulated' ? (
                  /* Single Simulated View */
                  <div className="text-xs leading-relaxed text-slate-200 pl-8">
                    {degradeText(turn.originalText, packetLoss, jitter, latency)}
                  </div>
                ) : (
                  /* Side-by-Side Comparison View */
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-8 text-xs pt-1">
                    <div className="p-2.5 rounded-lg bg-navy-900 border border-surface-border">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                        Original Spoken Text:
                      </span>
                      <p className="text-slate-300 leading-relaxed font-sans">
                        {turn.originalText}
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-navy-900/90 border border-purple-500/30">
                      <span className="text-[10px] font-semibold text-purple-300 block mb-1 uppercase tracking-wider flex items-center justify-between">
                        <span>Heard by Other Party:</span>
                        <span className="text-red-400 font-mono text-[9px]">
                          {packetLoss > 0 ? `-${packetLoss.toFixed(1)}% loss` : 'clean'}
                        </span>
                      </span>
                      <p className="text-slate-200 leading-relaxed font-sans">
                        {degradeText(turn.originalText, packetLoss, jitter, latency)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
