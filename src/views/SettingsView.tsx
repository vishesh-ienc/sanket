import { useState } from 'react';
import { useTheme, type Theme } from '@/components/theme/theme-context';
import {
  AlertTriangle,
  Check,
  Cloud,
  Download,
  KeyRound,
  Mail,
  MessageSquare,
  Mic,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  UserPlus,
  UserRound,
} from 'lucide-react';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { usePipelineContext } from '@/app/PipelineContext';
import { MAX_TRUSTED_CONTACTS, maskAddress, type ContactChannel } from '@/services/trustedContacts';
import { cn } from '@/lib/utils';

function BaselineCard() {
  const p = usePipelineContext();
  const { calibrationState: cs } = p.calibration;
  const profile = cs.profile;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserRound className="size-4 text-primary" /> Personal voice baseline
        </CardTitle>
        <CardDescription>Speak normally for ~30 s so deviations are measured against your own voice, not a generic one.</CardDescription>
        <CardAction>
          {cs.status === 'COMPLETE' ? (
            <Badge className="bg-risk-normal/15 text-risk-normal">Calibrated</Badge>
          ) : (
            <Badge variant="outline">Default</Badge>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {cs.status === 'CALIBRATING' && (
          <div className="flex flex-col gap-2">
            <Progress value={cs.progress * 100} />
            <p className="text-xs text-muted-foreground">
              {cs.voicedFrames} / {cs.minVoicedFrames} voiced frames · keep talking naturally
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={p.calibration.finalizeCalibration} disabled={cs.voicedFrames < cs.minVoicedFrames}>
                <Check /> Finish now
              </Button>
              <Button size="sm" variant="ghost" onClick={p.calibration.cancelCalibration}>
                Cancel
              </Button>
            </div>
          </div>
        )}
        {cs.status === 'COMPLETE' && profile && (
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ['Pitch', `${Math.round(profile.pitchMean)} Hz`],
              ['Variation', `±${profile.pitchStdDev.toFixed(0)} Hz`],
              ['Loudness', `${(profile.energyMean * 100).toFixed(1)}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border p-2">
                <dt className="text-[11px] text-muted-foreground">{k}</dt>
                <dd className="font-mono text-sm font-semibold tabular">{v}</dd>
              </div>
            ))}
          </dl>
        )}
        {cs.status === 'ERROR' && <p className="text-sm text-destructive">{cs.errorMessage}</p>}
        {cs.status !== 'CALIBRATING' && (
          <div className="flex flex-wrap gap-2">
            <Button onClick={p.calibration.startCalibration} disabled={!p.mic.isLive}>
              <Mic /> {cs.status === 'COMPLETE' ? 'Recalibrate' : 'Calibrate with microphone'}
            </Button>
            {cs.status !== 'COMPLETE' && (
              <Button variant="outline" onClick={() => p.calibration.loadPresetProfile()}>
                Use demo profile
              </Button>
            )}
            {cs.status === 'COMPLETE' && (
              <Button variant="ghost" onClick={p.calibration.clearBaseline}>
                Reset to default
              </Button>
            )}
          </div>
        )}
        {!p.mic.isLive && cs.status !== 'CALIBRATING' && (
          <p className="text-xs text-muted-foreground">Start the microphone on Monitor to calibrate with your own voice.</p>
        )}
      </CardContent>
    </Card>
  );
}

function CodeWordCard() {
  const p = usePipelineContext();
  const cw = p.codeWord;
  const [phrase, setPhrase] = useState(cw.config.phrase);
  const [test, setTest] = useState('');
  const [result, setResult] = useState<null | boolean>(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-primary" /> Covert code word
        </CardTitle>
        <CardDescription>A phrase you can slip into a normal sentence. It adds context — it never alerts on its own.</CardDescription>
        <CardAction>
          <Switch checked={cw.config.enabled} onCheckedChange={() => cw.toggleEnabled()} aria-label="Arm code word" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (phrase.trim()) cw.updatePhrase(phrase.trim());
          }}
        >
          <Label htmlFor="cw-phrase">Phrase</Label>
          <div className="flex gap-2">
            <Input id="cw-phrase" value={phrase} onChange={(e) => setPhrase(e.target.value)} placeholder="e.g. Remember to feed the cat" />
            <Button type="submit" disabled={!phrase.trim() || phrase.trim() === cw.config.phrase}>
              Save
            </Button>
          </div>
        </form>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!test.trim()) return;
            const r = cw.processTranscript(test, Date.now(), 'manual-test');
            setResult(r.detected);
          }}
        >
          <Label htmlFor="cw-test">Try a sentence</Label>
          <div className="flex gap-2">
            <Input
              id="cw-test"
              value={test}
              onChange={(e) => {
                setTest(e.target.value);
                setResult(null);
              }}
              placeholder="Type what someone might say…"
            />
            <Button type="submit" variant="outline" disabled={!test.trim()}>
              Test
            </Button>
          </div>
          {result !== null && (
            <p className={cn('text-sm', result ? 'text-risk-suspicious' : 'text-muted-foreground')}>
              {result ? 'Matched — context added to the live engine.' : 'No match (or within the 5 s repeat cooldown).'}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

function LiveSpeechCard() {
  const { speech } = usePipelineContext();
  const onDevice = speech.support?.onDevice;
  const api = speech.support?.apiAvailable;

  const status = !speech.support
    ? { label: 'Checking…', cls: 'bg-muted text-muted-foreground' }
    : !api
      ? { label: 'Not supported', cls: 'bg-muted text-muted-foreground' }
      : speech.mode === 'on-device'
        ? { label: 'On-device', cls: 'bg-risk-normal/15 text-risk-normal' }
        : speech.mode === 'cloud'
          ? { label: 'Cloud (opted in)', cls: 'bg-risk-elevated/15 text-risk-elevated' }
          : { label: 'Off — private engine needed', cls: 'bg-muted text-muted-foreground' };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mic className="size-4 text-primary" /> Live code-word listening
        </CardTitle>
        <CardDescription>Turns speech into text only to check for your phrase. Text is discarded immediately.</CardDescription>
        <CardAction>
          <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', status.cls)}>{status.label}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="speech-enabled" className="flex flex-col items-start gap-0.5">
            <span>Listen while the microphone is on</span>
            <span className="text-xs font-normal text-muted-foreground">Status: {speech.status.toLowerCase()}</span>
          </Label>
          <Switch id="speech-enabled" checked={speech.enabled} onCheckedChange={speech.setEnabled} />
        </div>

        {api && (onDevice === 'downloadable' || onDevice === 'downloading') && (
          <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm sm:flex-row sm:items-center">
            <ShieldCheck className="size-4 shrink-0 text-risk-normal" />
            <span className="flex-1">Your browser can recognise speech fully on-device after a one-time language download.</span>
            <Button size="sm" onClick={() => void speech.installOnDevice()} disabled={speech.installing || onDevice === 'downloading'}>
              {speech.installing || onDevice === 'downloading' ? <Spinner /> : <Download />} Install
            </Button>
          </div>
        )}

        {api && onDevice !== 'available' && (
          <div className="flex flex-col gap-3 rounded-lg border border-risk-elevated/40 bg-risk-elevated/8 p-3 text-sm">
            <p className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-risk-elevated" />
              <span>
                Without on-device support, recognition runs on the browser vendor's servers — your microphone audio would leave this device.
                Off by default.
              </span>
            </p>
            <div className="flex items-center justify-between gap-4">
              <Label htmlFor="cloud-consent" className="flex items-center gap-2">
                <Cloud className="size-4" /> Allow cloud recognition
              </Label>
              <Switch id="cloud-consent" checked={speech.cloudConsent} onCheckedChange={speech.setCloudConsent} />
            </div>
          </div>
        )}

        {!api && speech.support && (
          <p className="text-sm text-muted-foreground">
            This browser has no speech recognition (e.g. Firefox). Use Chrome or Edge, or test phrases with the code-word card.
          </p>
        )}
        {speech.errorMessage && <p className="text-sm text-destructive">{speech.errorMessage}</p>}
      </CardContent>
    </Card>
  );
}

function ContactsCard() {
  const { contacts } = usePipelineContext();
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<ContactChannel>('SMS');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);
  const full = contacts.contacts.length >= MAX_TRUSTED_CONTACTS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="size-4 text-primary" /> Trusted contacts
        </CardTitle>
        <CardDescription>Who would get a discreet alert. Stored only here and never messaged in this prototype.</CardDescription>
        <CardAction>
          <Badge variant="outline">
            {contacts.contacts.length}/{MAX_TRUSTED_CONTACTS}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form
          className="grid gap-2 sm:grid-cols-[1fr_auto_1.3fr_auto] sm:items-end"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const r = contacts.addContact({ name, channel, address });
            if (r.ok) {
              setName('');
              setAddress('');
              setError(null);
            } else setError(r.error);
          }}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-name">Name</Label>
            <Input
              id="tc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Priya (sister)"
              disabled={full}
              maxLength={40}
            />
          </div>
          <ToggleGroup
            type="single"
            variant="outline"
            value={channel}
            onValueChange={(v) => v && setChannel(v as ContactChannel)}
            aria-label="Channel"
            disabled={full}
          >
            <ToggleGroupItem value="SMS" aria-label="SMS">
              <MessageSquare />
            </ToggleGroupItem>
            <ToggleGroupItem value="EMAIL" aria-label="Email">
              <Mail />
            </ToggleGroupItem>
          </ToggleGroup>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tc-address">{channel === 'SMS' ? 'Phone' : 'Email'}</Label>
            <Input
              id="tc-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={channel === 'SMS' ? '+91 98765 43210' : 'name@example.com'}
              inputMode={channel === 'SMS' ? 'tel' : 'email'}
              disabled={full}
            />
          </div>
          <Button type="submit" disabled={full || !name.trim() || !address.trim()}>
            Add
          </Button>
        </form>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {contacts.contacts.length > 0 && (
          <ul className="flex flex-col divide-y rounded-lg border">
            {contacts.contacts.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                {c.channel === 'SMS' ? (
                  <MessageSquare className="size-4 text-muted-foreground" />
                ) : (
                  <Mail className="size-4 text-muted-foreground" />
                )}
                <span className="flex-1 truncate text-sm font-medium">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{maskAddress(c.channel, c.address)}</span>
                <Button variant="ghost" size="icon-sm" aria-label={`Remove ${c.name}`} onClick={() => contacts.removeContact(c.id)}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function AppearanceCard() {
  const { theme, setTheme } = useTheme();
  return (
    <Card>
      <CardHeader>
        <CardTitle>Appearance</CardTitle>
        <CardDescription>Light, dark, or follow your device.</CardDescription>
      </CardHeader>
      <CardContent>
        <ToggleGroup type="single" variant="outline" value={theme} onValueChange={(v) => v && setTheme(v as Theme)} className="w-full">
          <ToggleGroupItem value="light" className="flex-1">
            <Sun /> Light
          </ToggleGroupItem>
          <ToggleGroupItem value="dark" className="flex-1">
            <Moon /> Dark
          </ToggleGroupItem>
          <ToggleGroupItem value="system" className="flex-1">
            <Monitor /> System
          </ToggleGroupItem>
        </ToggleGroup>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <BaselineCard />
        <CodeWordCard />
        <AppearanceCard />
      </div>
      <div className="flex flex-col gap-4">
        <LiveSpeechCard />
        <ContactsCard />
      </div>
    </div>
  );
}
