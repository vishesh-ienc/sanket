/**
 * Sanket — Audio File Input Service Unit Tests
 *
 * Deterministic unit tests covering:
 *   1. Initial state verification
 *   2. Subscriber registration, notification, and unsubscription
 *   3. File acceptance and successful decode
 *   4. Decode failure handling and error state
 *   5. AudioFrame production and contract compliance
 *   6. Frame production gating (null frame when not playing)
 *   7. Playback controls: play, pause, restart, and onended transition
 *   8. Resource disposal and teardown
 *   9. RMS calculation and speech activity thresholding
 *  10. Compatibility with AudioFrame consumer pipeline
 *
 * No browser, DOM, microphone, or network required.
 */

import { AudioFileInputService } from '../audioFileInput';
import type { FilePlaybackStatus } from '../audioFileInput';
import type { AudioFrame } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Test Harness
// ─────────────────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string): void {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

function printSection(label: string): void {
  console.log(`\n─── ${label} ───`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock Web Audio API Implementation
// ─────────────────────────────────────────────────────────────────────────────

class MockAnalyserNode {
  public fftSize = 2048;
  public smoothingTimeConstant = 0.8;
  public context: { sampleRate: number } = { sampleRate: 48000 };

  public getFloatTimeDomainData(destination: Float32Array): void {
    // Fill with simulated sine wave pattern
    for (let i = 0; i < destination.length; i++) {
      destination[i] = Math.sin((i / destination.length) * Math.PI * 4) * 0.15;
    }
  }

  public getFloatFrequencyData(destination: Float32Array): void {
    for (let i = 0; i < destination.length; i++) {
      destination[i] = -60 + (i / destination.length) * 20;
    }
  }

  public disconnect(): void {
    // mock disconnect
  }
}

class MockAudioBufferSourceNode {
  public buffer: AudioBuffer | null = null;
  public onended: (() => void) | null = null;
  public isStarted = false;
  public isStopped = false;

  public connect(_target: unknown): void {
    // mock connect
  }

  public disconnect(): void {
    // mock disconnect
  }

  public start(_when?: number, _offset?: number): void {
    this.isStarted = true;
  }

  public stop(): void {
    this.isStopped = true;
    if (this.onended) {
      this.onended();
    }
  }
}

function createMockAudioContext(options: { failDecode?: boolean } = {}) {
  const analyser = new MockAnalyserNode();
  let currentSourceNode: MockAudioBufferSourceNode | null = null;

  return {
    state: 'suspended' as AudioContextState,
    sampleRate: 48000,
    currentTime: 10.0,
    async resume(): Promise<void> {
      this.state = 'running';
    },
    async decodeAudioData(_buffer: ArrayBuffer): Promise<AudioBuffer> {
      if (options.failDecode) {
        throw new Error('Unsupported codec or corrupted bitstream');
      }
      return {
        duration: 30.0,
        length: 48000 * 30,
        numberOfChannels: 1,
        sampleRate: 48000,
        getChannelData: () => new Float32Array(48000),
        copyFromChannel: () => {},
        copyToChannel: () => {},
      } as unknown as AudioBuffer;
    },
    createAnalyser(): AnalyserNode {
      return analyser as unknown as AnalyserNode;
    },
    createBufferSource(): AudioBufferSourceNode {
      const source = new MockAudioBufferSourceNode();
      currentSourceNode = source;
      return source as unknown as AudioBufferSourceNode;
    },
    async close(): Promise<void> {
      this.state = 'closed';
    },
    _getCurrentSourceNode(): MockAudioBufferSourceNode | null {
      return currentSourceNode;
    },
    _analyser: analyser,
  } as unknown as AudioContext;
}

function createMockFile(name: string, content = 'fake-audio-bytes'): File {
  const blob = new Blob([content], { type: 'audio/wav' });
  return new File([blob], name, { type: 'audio/wav' });
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite Execution
// ─────────────────────────────────────────────────────────────────────────────

async function runTests() {
  printSection('Section 1: Initial State & Subscriber Lifecycle');
  {
    const service = new AudioFileInputService();
    const initialStatus = service.getStatus();

    assert(initialStatus.state === 'IDLE', 'Initial state is IDLE');
    assert(initialStatus.fileName === null, 'Initial fileName is null');
    assert(initialStatus.durationSec === null, 'Initial durationSec is null');
    assert(initialStatus.currentTimeSec === 0, 'Initial currentTimeSec is 0');
    assert(initialStatus.errorMessage === null, 'Initial errorMessage is null');
    assert(service.getIsRunning() === false, 'Service is not running initially');
    assert(service.getCurrentFrame() === null, 'Initial frame is null');
    assert(service.getAnalyserNode() === null, 'Initial AnalyserNode is null');

    // Subscription
    let receivedStatus: FilePlaybackStatus | null = null;
    const unsubscribe = service.subscribe((status) => {
      receivedStatus = status;
    });

    assert(receivedStatus !== null, 'Listener called immediately upon subscription');
    assert((receivedStatus as unknown as FilePlaybackStatus)?.state === 'IDLE', 'Subscribed status reports IDLE');

    unsubscribe();
    service.dispose();
  }

  printSection('Section 2: File Acceptance & Successful Decoding');
  {
    const mockContext = createMockAudioContext({ failDecode: false });
    const service = new AudioFileInputService(() => mockContext);

    const statesRecorded: string[] = [];
    service.subscribe((st) => statesRecorded.push(st.state));

    const testFile = createMockFile('test_call_recording.wav');
    await service.loadFile(testFile);

    const status = service.getStatus();
    assert(status.state === 'READY', 'State transitions to READY after decoding');
    assert(status.fileName === 'test_call_recording.wav', 'Status preserves loaded fileName');
    assert(status.durationSec === 30, 'Duration is correctly extracted (30s)');
    assert(status.errorMessage === null, 'Error message remains null on success');
    assert(statesRecorded.includes('LOADING'), 'Emitted LOADING transition state');
    assert(statesRecorded.includes('READY'), 'Emitted READY transition state');
    assert(service.getAnalyserNode() !== null, 'AnalyserNode is initialized and accessible');

    service.dispose();
  }

  printSection('Section 3: Decode Failure Handling');
  {
    const mockContext = createMockAudioContext({ failDecode: true });
    const service = new AudioFileInputService(() => mockContext);

    const testFile = createMockFile('corrupt_call_file.mp3');
    await service.loadFile(testFile);

    const status = service.getStatus();
    assert(status.state === 'ERROR', 'State transitions to ERROR on decode failure');
    assert(status.errorMessage !== null, 'Error message is populated');
    assert(
      status.errorMessage?.includes('Unsupported codec') ?? false,
      'Error message details failure reason'
    );
    assert(service.getCurrentFrame() === null, 'Frame is null during ERROR state');

    service.dispose();
  }

  printSection('Section 4: Playback Lifecycle (Play, Pause, Restart, Ended)');
  {
    const mockContext = createMockAudioContext({ failDecode: false });
    const service = new AudioFileInputService(() => mockContext);

    await service.loadFile(createMockFile('scenario_audio.wav'));

    // Start playback
    service.play();
    let status = service.getStatus();
    assert(status.state === 'PLAYING', 'play() sets state to PLAYING');
    assert(service.getIsRunning() === true, 'getIsRunning() returns true while playing');

    // Pause playback
    service.pause();
    status = service.getStatus();
    assert(status.state === 'PAUSED', 'pause() sets state to PAUSED');
    assert(service.getIsRunning() === false, 'getIsRunning() returns false when paused');

    // Restart playback
    service.restart();
    status = service.getStatus();
    assert(status.state === 'PLAYING', 'restart() returns state to PLAYING');

    // Trigger onended on the underlying source
    const rawContext = mockContext as unknown as { _getCurrentSourceNode(): MockAudioBufferSourceNode | null };
    const currentSource = rawContext._getCurrentSourceNode();
    assert(currentSource !== null, 'BufferSourceNode exists during playback');
    if (currentSource?.onended) {
      currentSource.onended();
    }

    status = service.getStatus();
    assert(status.state === 'ENDED', 'onended triggers ENDED state');
    assert(service.getIsRunning() === false, 'Service stops running when ENDED');

    service.dispose();
  }

  printSection('Section 5: AudioFrame Production & Contract Compliance');
  {
    const mockContext = createMockAudioContext({ failDecode: false });
    const service = new AudioFileInputService(() => mockContext);

    await service.loadFile(createMockFile('sample.wav'));
    service.play();

    const frame: AudioFrame | null = service.getCurrentFrame();
    assert(frame !== null, 'getCurrentFrame() returns an AudioFrame when PLAYING');

    if (frame) {
      assert(typeof frame.timestamp === 'number', 'frame.timestamp is numeric');
      assert(frame.sampleRate === 48000, 'frame.sampleRate is 48000');
      assert(frame.frameSize === 2048, 'frame.frameSize matches FFT size (2048)');
      assert(frame.timeDomainData instanceof Float32Array, 'timeDomainData is Float32Array');
      assert(frame.frequencyData instanceof Float32Array, 'frequencyData is Float32Array');
      assert(frame.timeDomainData.length === 2048, 'timeDomainData length is 2048');
      assert(frame.frequencyData.length === 1024, 'frequencyData length is 1024');
      assert(frame.rmsEnergy > 0, 'frame.rmsEnergy is computed and positive');
      assert(Number.isFinite(frame.rmsEnergy), 'frame.rmsEnergy is finite');
    }

    service.pause();
    assert(service.getCurrentFrame() === null, 'getCurrentFrame() returns null when PAUSED');

    service.dispose();
  }

  printSection('Section 6: Audio Activity & RMS Thresholding');
  {
    const service = new AudioFileInputService();

    assert(service.isAudioActive(0.02, 0.015) === true, 'RMS above 0.015 threshold is active');
    assert(service.isAudioActive(0.01, 0.015) === false, 'RMS below 0.015 threshold is inactive');
    assert(service.isAudioActive(0.015, 0.015) === true, 'RMS exactly at threshold is active');
    assert(service.isAudioActive(0, 0.015) === false, 'Zero RMS is inactive');

    service.dispose();
  }

  printSection('Section 7: Reset & Disposal Protection');
  {
    const mockContext = createMockAudioContext({ failDecode: false });
    const service = new AudioFileInputService(() => mockContext);

    await service.loadFile(createMockFile('temp.wav'));
    service.play();
    service.dispose();

    const status = service.getStatus();
    assert(status.state === 'IDLE', 'dispose() resets state to IDLE');
    assert(status.fileName === null, 'dispose() clears fileName');
    assert(status.durationSec === null, 'dispose() clears duration');
    assert(status.errorMessage === null, 'dispose() clears errorMessage');
    assert(service.getCurrentFrame() === null, 'Frame is null after dispose()');
    assert(service.getAnalyserNode() === null, 'AnalyserNode is null after dispose()');
  }

  printSection('Section 8: Source Switching & Pipeline Independence');
  {
    // Validate that switching between multiple files or instances preserves independent state
    const mockContextA = createMockAudioContext({ failDecode: false });
    const mockContextB = createMockAudioContext({ failDecode: false });

    const sourceA = new AudioFileInputService(() => mockContextA);
    const sourceB = new AudioFileInputService(() => mockContextB);

    await sourceA.loadFile(createMockFile('call_stream_1.wav'));
    await sourceB.loadFile(createMockFile('call_stream_2.wav'));

    sourceA.play();
    assert(sourceA.getIsRunning() === true, 'Source A is running');
    assert(sourceB.getIsRunning() === false, 'Source B remains idle while Source A plays');

    sourceA.pause();
    sourceB.play();
    assert(sourceA.getIsRunning() === false, 'Source A paused');
    assert(sourceB.getIsRunning() === true, 'Source B is running independently');

    sourceA.dispose();
    sourceB.dispose();
  }

  // Summary
  console.log('\n════════════════════════════════════════');
  console.log('  Sanket Audio File Adapter Unit Tests');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('════════════════════════════════════════\n');

  if (failed > 0) {
    process.exit(1);
  }
}

void runTests();
