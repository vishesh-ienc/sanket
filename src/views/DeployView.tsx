import { Construction, Smartphone, ShieldCheck, Cpu, Lock, Wifi, WifiOff, Download, ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PLATFORMS = [
  {
    name: 'Android',
    version: 'Android 10+',
    icon: '🤖',
    status: 'planned',
    format: '.apk',
    description: 'Background service with notification permission',
  },
  {
    name: 'iOS',
    version: 'iOS 16+',
    icon: '🍎',
    status: 'planned',
    format: '.ipa',
    description: 'Background audio entitlement via App Store',
  },
];

const SETUP_STEPS = [
  {
    step: 1,
    icon: Download,
    title: 'Download the Engine Package',
    description:
      'Download the platform-specific package for your phone (Android APK or iOS IPA). The engine is a lightweight background service, under 18 MB.',
    detail: 'No cloud account required. The package is self-contained.',
  },
  {
    step: 2,
    icon: Smartphone,
    title: 'Install on Your Device',
    description:
      'On Android, enable "Install from unknown sources" in Developer Options. On iOS, use AltStore or a trusted provisioning profile. Follow the on-screen wizard.',
    detail: 'The installer does not modify any existing apps or settings.',
  },
  {
    step: 3,
    icon: Lock,
    title: 'Grant Microphone Access',
    description:
      'The engine requests continuous microphone access to run in the background. Audio is processed entirely on-device using the phone\'s neural engine. No raw audio ever leaves the phone.',
    detail: 'You can revoke access at any time from your phone\'s app settings.',
  },
  {
    step: 4,
    icon: Wifi,
    title: 'Pair with This Dashboard',
    description:
      'Open Settings in the Sanket engine app and copy the 6-digit pairing code. Enter it here to link your phone. All data is sent over an encrypted local channel.',
    detail: 'The pairing works even without internet, over local Wi-Fi or USB tethering.',
  },
  {
    step: 5,
    icon: ShieldCheck,
    title: 'Engine Runs Silently',
    description:
      'Once paired, the engine captures and analyses voice in the background. Only the risk score, signal values, and event flags are sent to this dashboard. Your voice never leaves your phone.',
    detail: 'Battery usage is under 3% per hour on most modern phones.',
  },
];

const FEATURES = [
  { icon: WifiOff, label: 'Fully offline', description: 'No internet required for analysis' },
  { icon: Lock, label: 'Voice stays local', description: 'Raw audio never transmitted' },
  { icon: Cpu, label: 'On-device neural engine', description: 'Runs on phone\'s built-in AI chip' },
  { icon: ShieldCheck, label: 'Tamper-resistant', description: 'Signed binaries, no root required' },
];

export function DeployView() {
  return (
    <div className="flex flex-col gap-6">
      {/* In-progress banner */}
      <div className="flex items-start gap-4 rounded-xl border border-amber-500/30 bg-amber-500/8 p-5">
        <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
          <Construction className="size-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-amber-700 dark:text-amber-300">Local Engine Deployment</h2>
            <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30">
              In Development
            </Badge>
          </div>
          <p className="mt-1.5 text-sm text-amber-700/80 dark:text-amber-300/70 leading-relaxed">
            The local phone engine is currently in active development. This page shows how the feature will work when released. No download is available yet.
          </p>
        </div>
      </div>

      {/* What it is */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="size-4 text-primary" />
            Run Sanket on Your Phone
          </CardTitle>
          <CardDescription>
            A lightweight background service that captures and analyses voice directly on your device. The risk score and signals stream to this dashboard. Your voice never leaves your phone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="flex flex-col gap-2 rounded-xl border bg-muted/20 p-4">
                <f.icon className="size-5 text-primary" />
                <p className="text-sm font-semibold leading-tight">{f.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Platform download cards */}
      <Card>
        <CardHeader>
          <CardTitle>Download Engine</CardTitle>
          <CardDescription>Choose your platform. Both packages are under 18 MB and require no account.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {PLATFORMS.map((p) => (
            <div
              key={p.name}
              className="relative flex flex-col gap-3 rounded-xl border bg-muted/10 p-5 opacity-70"
            >
              <div className="absolute top-3 right-3">
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  <Clock className="size-2.5 mr-1" /> Coming Soon
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-3xl">{p.icon}</span>
                <div>
                  <p className="font-semibold">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.version}</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <Button disabled variant="outline" className="w-full mt-1">
                <Download className="size-4" />
                Download {p.format}
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Setup walkthrough */}
      <Card>
        <CardHeader>
          <CardTitle>How Setup Will Work</CardTitle>
          <CardDescription>A step-by-step walkthrough of the installation and pairing process.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-0">
          {SETUP_STEPS.map((step, idx) => (
            <div key={step.step} className="flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 border-2 border-primary/20 text-primary">
                  <step.icon className="size-4" />
                </div>
                {idx < SETUP_STEPS.length - 1 && (
                  <div className="mt-1 w-0.5 flex-1 bg-border min-h-[2rem]" />
                )}
              </div>
              {/* Content */}
              <div className={cn('min-w-0 flex-1 pb-6', idx === SETUP_STEPS.length - 1 && 'pb-0')}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-bold tracking-widest text-muted-foreground uppercase">Step {step.step}</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                <p className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground/70">
                  <CheckCircle2 className="mt-0.5 size-3 shrink-0 text-risk-normal" />
                  {step.detail}
                </p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Privacy guarantee */}
      <Card className="border-risk-normal/20 bg-risk-normal/4">
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start">
          <ShieldCheck className="size-8 shrink-0 text-risk-normal mt-0.5" />
          <div>
            <h3 className="font-semibold text-risk-normal mb-1">Privacy Architecture</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The local engine performs all speech analysis on the phone's own processor. Only derived metrics (risk score, signal values, event flags) are transmitted to this dashboard over an encrypted local channel. Your voice audio stays on the device at all times. Even if the network connection is lost, analysis continues uninterrupted on-device.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['No cloud storage', 'AES-256 local channel', 'No third-party SDKs', 'Open architecture'].map((tag) => (
                <span key={tag} className="rounded-full border border-risk-normal/30 bg-risk-normal/10 px-2.5 py-0.5 text-xs font-medium text-risk-normal">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="flex items-center justify-between rounded-xl border bg-gradient-to-r from-primary/8 via-transparent to-transparent p-5">
        <div>
          <p className="font-semibold">Interested in early access?</p>
          <p className="text-sm text-muted-foreground mt-0.5">Get notified when the local engine is ready for testing.</p>
        </div>
        <Button disabled variant="outline" className="shrink-0">
          Join Waitlist <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
