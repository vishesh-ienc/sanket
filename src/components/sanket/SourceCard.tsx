import { useRef } from 'react';
import { FileAudio, Mic, MicOff, Pause, Play, RotateCcw, Upload, MessagesSquare, Square, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { usePipelineContext } from '@/app/PipelineContext';
import type { SourceKind } from '@/app/usePipeline';
import { scenarioInfo } from '@/app/scenarios';
import { Waveform } from './Waveform';
import { cn } from '@/lib/utils';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

const TONE_BG = {
  calm: 'bg-risk-normal/60',
  transition: 'bg-risk-elevated/70',
  distress: 'bg-risk-high/70',
} as const;

function ConversationPlayer() {
  const p = usePipelineContext();
  const conv = p.conversation;
  const status = p.file.playbackStatus;
  const duration = status.durationSec ?? conv?.durationSec ?? 1;
  const progress = Math.min(100, (status.currentTimeSec / duration) * 100);
  const loaded = conv && (status.state === 'READY' || status.state === 'PLAYING' || status.state === 'PAUSED' || status.state === 'ENDED');

  if (!conv || !loaded) {
    const first = p.library[0];
    return (
      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed p-4 sm:flex-row sm:items-center">
        <div className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          <MessagesSquare className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">{first?.title ?? 'Built-in conversation'}</p>
          <p className="text-xs text-muted-foreground">
            {first
              ? `${Math.round(first.durationSec)} s phone call · calm → distress + code phrase`
              : (p.libraryError ?? 'Loading demo library…')}
          </p>
        </div>
        <Button onClick={() => first && p.loadConversation(first)} disabled={!first || p.conversationLoading}>
          {p.conversationLoading ? <Spinner /> : <Play />}
          Play demo call
        </Button>
      </div>
    );
  }

  const caption = p.caption;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        {status.state === 'PLAYING' ? (
          <Button size="icon" variant="secondary" aria-label="Pause" onClick={p.file.pauseFile}>
            <Pause />
          </Button>
        ) : (
          <Button size="icon" aria-label="Play" onClick={p.file.playFile}>
            <Play />
          </Button>
        )}
        <Button size="icon" variant="ghost" aria-label="Restart" onClick={p.file.restartFile}>
          <RotateCcw />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{conv.title}</p>
          <p className="font-mono text-xs text-muted-foreground tabular">
            {fmtTime(status.currentTimeSec)} / {fmtTime(duration)}
          </p>
        </div>
        {conv.synthetic && <Badge variant="outline">Synthetic voices</Badge>}
      </div>

      <div className="relative">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {conv.timeline.map((seg) => (
            <div
              key={seg.label}
              className={cn('h-full', TONE_BG[seg.tone])}
              style={{ width: `${((seg.endSec - seg.startSec) / conv.durationSec) * 100}%` }}
              title={`${seg.label} — ${seg.expectation}`}
            />
          ))}
        </div>
        <div
          className="absolute -top-1 h-4 w-1 -translate-x-1/2 rounded-full bg-foreground shadow ring-2 ring-background transition-[left] duration-100 ease-linear"
          style={{ left: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        {conv.timeline.map((seg) => (
          <span
            key={seg.label}
            className={cn(status.currentTimeSec >= seg.startSec && status.currentTimeSec < seg.endSec && 'font-medium text-foreground')}
          >
            {seg.label}
          </span>
        ))}
      </div>

      <div className="min-h-[3.25rem] rounded-lg bg-muted/50 px-3 py-2 text-sm" aria-live="polite">
        {caption ? (
          <p>
            <span className={cn('mr-1.5 font-medium', caption.speaker === 'user' ? 'text-primary' : 'text-muted-foreground')}>
              {caption.speaker === 'user' ? 'Asha' : 'Friend'}:
            </span>
            {caption.text}
          </p>
        ) : (
          <p className="text-muted-foreground">Captions appear as the call plays.</p>
        )}
      </div>
    </div>
  );
}

function MicPanel() {
  const p = usePipelineContext();
  const requesting = p.mic.monitoringState === 'REQUESTING_PERMISSION';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {p.mic.isLive ? (
          <Button variant="destructive" onClick={p.mic.stop}>
            <Square /> Stop listening
          </Button>
        ) : (
          <Button onClick={p.mic.start} disabled={requesting}>
            {requesting ? <Spinner /> : <Mic />} Start microphone
          </Button>
        )}
        <span className="text-xs text-muted-foreground">
          {p.speech.mode === 'on-device'
            ? 'Code word listens on-device'
            : p.speech.mode === 'cloud'
              ? 'Code word via cloud speech (opted in)'
              : 'Code word: type it in Settings (no private speech engine)'}
        </span>
      </div>
      {p.mic.error && (
        <p className="flex items-start gap-2 rounded-lg bg-destructive/10 p-2.5 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {p.mic.error.userMessage}
        </p>
      )}
      {p.mic.isLive && p.speech.lastHeard && (
        <p className="truncate rounded-lg bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <span className="mr-1 text-xs font-medium tracking-wide uppercase">Heard</span> “{p.speech.lastHeard}”
        </p>
      )}
    </div>
  );
}

function UploadPanel() {
  const p = usePipelineContext();
  const input = useRef<HTMLInputElement>(null);
  const status = p.file.playbackStatus;
  const loaded = p.sourceKind === 'file' && ['READY', 'PLAYING', 'PAUSED', 'ENDED'].includes(status.state);
  return (
    <div className="flex flex-col gap-3">
      <input
        ref={input}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void p.loadUpload(f);
          e.target.value = '';
        }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={() => input.current?.click()}>
          <Upload /> Choose audio file
        </Button>
        {loaded && (
          <>
            {status.state === 'PLAYING' ? (
              <Button variant="secondary" onClick={p.file.pauseFile}>
                <Pause /> Pause
              </Button>
            ) : (
              <Button onClick={p.file.playFile}>
                <Play /> {status.state === 'ENDED' ? 'Replay' : 'Analyse'}
              </Button>
            )}
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
              <FileAudio className="size-3.5 shrink-0" />
              <span className="truncate">{status.fileName}</span>
            </span>
          </>
        )}
      </div>
      {status.state === 'LOADING' && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Decoding…
        </p>
      )}
      {status.state === 'ERROR' && <p className="text-sm text-destructive">{status.errorMessage}</p>}
      <p className="text-xs text-muted-foreground">
        WAV, MP3 or OGG — a phone recording, a VoIP export, anything. Decoded in your browser; never uploaded.
      </p>
    </div>
  );
}

export function SourceCard() {
  const p = usePipelineContext();

  const onSource = (value: string) => {
    if (!value) return;
    p.setSourceKind(value as SourceKind);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Audio source</CardTitle>
        <CardDescription>Any voice stream — phone, VoIP, mic or recording — runs through the same pipeline.</CardDescription>
        <CardAction>
          {p.isAudioLive ? <Badge className="bg-risk-normal/15 text-risk-normal">Streaming</Badge> : <Badge variant="outline">Idle</Badge>}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup type="single" variant="outline" value={p.sourceKind} onValueChange={onSource} className="w-full">
          <ToggleGroupItem value="conversation" className="flex-1">
            <MessagesSquare /> <span className="hidden sm:inline">Demo call</span>
            <span className="sm:hidden">Call</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="mic" className="flex-1">
            {p.mic.isLive ? <Mic /> : <MicOff />} <span>Mic</span>
          </ToggleGroupItem>
          <ToggleGroupItem value="file" className="flex-1">
            <Upload /> <span>Upload</span>
          </ToggleGroupItem>
        </ToggleGroup>

        {p.isSimulating && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-info/30 bg-info/8 p-3 text-sm">
            <span>
              Scenario <strong>{scenarioInfo(p.scenario)?.title}</strong> is driving the engine.
            </span>
            <Button size="sm" variant="outline" onClick={p.stopSimulation}>
              Stop
            </Button>
          </div>
        )}

        {p.sourceKind === 'conversation' && <ConversationPlayer />}
        {p.sourceKind === 'mic' && <MicPanel />}
        {p.sourceKind === 'file' && <UploadPanel />}

        <div className="overflow-hidden rounded-lg border bg-muted/30">
          <Waveform analyser={p.analyserNode} active={p.isAudioLive} />
        </div>
      </CardContent>
    </Card>
  );
}
