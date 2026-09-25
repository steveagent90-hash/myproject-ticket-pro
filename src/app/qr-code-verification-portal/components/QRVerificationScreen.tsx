'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  CameraOff,
  Clock,
  RefreshCw,
  ChevronDown,
  Zap,
  Menu,
  BarChart2,
  History,
  User,
  X,
  Check,
  LogOut,
  Lightbulb,
} from 'lucide-react';

import { extractTokenFromScanData } from '@/lib/qr-utils';

interface ScannerUser {
  id: number;
  name: string;
  email: string;
  role: string;
  orgId?: number;
}

interface TicketRec {
  id: number;
  serial_number: string;
  qr_token: string;
  status: string;
  scanned_at: string | null;
  event_name: string;
}

interface ScanLog {
  id: number;
  serial: string;
  holder: string;
  result: 'valid' | 'used' | 'invalid';
  timestamp: string;
  event: string;
}

interface EventOpt {
  id: number;
  name: string;
  event_date: string;
  status: string;
}

function formatTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
}

export default function QRVerificationScreen({ user }: { user: ScannerUser }) {
  const [cameraActive, setCameraActive] = useState(false);
  const [scanResult, setScanResult] = useState<'valid' | 'used' | 'invalid' | null>(null);
  const [lastScannedTicket, setLastScannedTicket] = useState<any>(null);
  const [scanLog, setScanLog] = useState<ScanLog[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('current');
  const [showEventDropdown, setShowEventDropdown] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [flashState, setFlashState] = useState<'valid' | 'invalid' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState({ total: 0, valid: 0, used: 0, invalid: 0 });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeBottomTab, setActiveBottomTab] = useState<
    'scanner' | 'stats' | 'history' | 'profile'
  >('scanner');
  const [events, setEvents] = useState<EventOpt[]>([]);
  const [demoTickets, setDemoTickets] = useState<TicketRec[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isScanningRef = useRef(false);
  const scanResultRef = useRef<'valid' | 'used' | 'invalid' | null>(null);
  const processQRDataRef = useRef<((data: string) => Promise<void>) | null>(null);
  const resultTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scanCooldownRef = useRef(false);
  const scanLockedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const beepSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    isScanningRef.current = isScanning;
  }, [isScanning]);

  useEffect(() => {
    scanResultRef.current = scanResult;
  }, [scanResult]);

  useEffect(() => {
    loadEvents();
    loadScanLogs();
    loadTickets();
  }, []);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/events', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.events) {
        const eventOpts: EventOpt[] = data.events.map((e: any) => ({
          id: e.id,
          name: e.name,
          event_date: e.event_date,
          status: e.status,
        }));
        setEvents(eventOpts);
      }
    } catch (error) {
      console.error('Load events error:', error);
    }
  }, []);

  const loadScanLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/scanner/scan-logs', { credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.logs) {
        const logs: ScanLog[] = data.logs.map((log: any) => ({
          id: log.id,
          serial: log.serial_number,
          holder: '—',
          result: log.result,
          timestamp: formatTime(new Date(log.created_at)),
          event: log.event_name || '—',
        }));
        setScanLog(logs);
        if (data.stats) {
          setScanCount({
            total: data.stats.total,
            valid: data.stats.valid,
            used: data.stats.used,
            invalid: data.stats.invalid,
          });
        }
      }
    } catch (error) {
      console.error('Load scan logs error:', error);
    }
  }, []);

  const loadTickets = useCallback(async () => {
    const eventId = events[0]?.id;
    if (!eventId) return;
    setLoadingTickets(true);
    try {
      const res = await fetch(`/api/scanner/tickets?eventId=${eventId}`, {
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.tickets) {
        setDemoTickets(data.tickets);
      }
    } catch (error) {
      console.error('Load tickets error:', error);
    } finally {
      setLoadingTickets(false);
    }
  }, [events]);

  useEffect(() => {
    if (events.length > 0) {
      loadTickets();
    }
  }, [events, loadTickets]);

  const playBeep = useCallback(() => {
    try {
      if (beepSoundRef.current) {
        beepSoundRef.current.currentTime = 0;
        beepSoundRef.current.play().catch(() => undefined);
        return;
      }
    } catch {
      beepSoundRef.current = null;
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
      audioCtxRef.current = ctx;
    } catch (err) {
      console.error('Beep audio error:', err);
    }
  }, []);

  useEffect(() => {
    const preload = () => {
      const audio = new Audio('/scanner-beep.wav');
      audio.preload = 'auto';
      beepSoundRef.current = audio;
    };
    preload();
    return () => {
      if (beepSoundRef.current) {
        beepSoundRef.current.pause();
        beepSoundRef.current = null;
      }
    };
  }, []);

  const processQRData = useCallback(
    async (data: string) => {
      if (isScanning || scanCooldownRef.current || scanLockedRef.current) return;
      scanCooldownRef.current = true;
      scanLockedRef.current = true;

      setIsScanning(true);

      try {
        const token = extractTokenFromScanData(data);
        const res = await fetch('/api/scanner/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrToken: token }),
          credentials: 'include',
        });
        const result = await res.json();

        let scanResultVal: 'valid' | 'used' | 'invalid';
        let ticketInfo: any;

        if (!res.ok || result.valid === false) {
          scanResultVal = result.status || 'invalid';
          ticketInfo = {
            serial: result.ticket?.serial || data.slice(0, 20),
            event: result.ticket?.event || '—',
            venue: result.ticket?.venue || '—',
            holder: result.ticket?.scannedBy || '—',
            scannedAt: result.ticket?.scannedAt,
            status: scanResultVal,
            message: result.message,
          };
        } else {
          scanResultVal = result.status;
          ticketInfo = {
            serial: result.ticket?.serial || data.slice(0, 20),
            event: result.ticket?.event || '—',
            venue: result.ticket?.venue || '—',
            holder: '—',
            status: scanResultVal,
            message: result.message,
          };
        }

        setScanResult(scanResultVal);
        setLastScannedTicket({ ...ticketInfo, qrToken: token });
        setFlashState(scanResultVal === 'valid' ? 'valid' : 'invalid');
        setShowDetails(true);
        playBeep();

        if (scanResultRef.current !== 'valid') {
          const newLog: ScanLog = {
            id: Date.now() as any,
            serial: ticketInfo.serial,
            holder: ticketInfo.holder,
            result: scanResultVal,
            timestamp: formatTime(new Date()),
            event: ticketInfo.event,
          };

          setScanLog((prev) => [newLog, ...prev.slice(0, 19)]);
          setScanCount((prev) => ({
            total: prev.total + 1,
            valid: prev.valid,
            used: scanResultVal === 'used' ? prev.used + 1 : prev.used,
            invalid: scanResultVal === 'invalid' ? prev.invalid + 1 : prev.invalid,
          }));
        }
      } catch (error) {
        console.error('Verify error:', error);
        setScanResult('invalid');
        setLastScannedTicket({
          serial: data.slice(0, 20),
          event: '—',
          holder: '—',
          status: 'invalid',
          message: 'Network error',
        });
        setFlashState('invalid');
        setShowDetails(true);
      } finally {
        setIsScanning(false);
      }
    },
    [isScanning, playBeep]
  );

  useEffect(() => {
    processQRDataRef.current = processQRData;
  }, [processQRData]);

  const startScanner = useCallback(
    async (facingMode: 'environment' | 'user' = 'environment') => {
      setCameraError(null);
      try {
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
          } catch {
            scannerRef.current = null;
          }
          scannerRef.current = null;
        }

        const element = document.getElementById('qr-scanner-container');
        if (!element) {
          throw new Error('Scanner element not found');
        }

        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          throw new Error('Scanner element has no dimensions');
        }

        const scanner = new Html5Qrcode('qr-scanner-container');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode },
          { fps: 30, qrbox: { width: 220, height: 220 } },
          async (decodedText: string) => {
            if (scanCooldownRef.current || scanResultRef.current || scanLockedRef.current) return;
            scanCooldownRef.current = true;
            setTimeout(() => {
              scanCooldownRef.current = false;
            }, 500);
            playBeep();
            if (processQRDataRef.current) {
              await processQRDataRef.current(decodedText);
            }
          },
          () => undefined
        );

        setCameraActive(true);
      } catch (err) {
        console.error('Start scanner error:', err);
        let msg = 'Camera access denied or unavailable.';
        if (typeof err === 'string') {
          msg = err;
        } else if (err instanceof Error) {
          msg = err.message || msg;
          if (err.name === 'NotAllowedError')
            msg = 'Camera permission denied. Please allow camera access.';
          else if (err.name === 'NotFoundError') msg = 'No camera found on this device.';
          else if (err.name === 'NotReadableError')
            msg = 'Camera is already in use. Close other tabs/apps and retry.';
          else if (err.name === 'OverconstrainedError')
            msg = 'Camera does not support the requested mode.';
          else if (err.name === 'TypeError') msg = 'Camera input is not available on this device.';
        } else if (err && typeof err === 'object' && 'message' in err) {
          msg = String((err as any).message) || msg;
        }
        setCameraError(msg);
        setCameraActive(false);
      }
    },
    [playBeep]
  );

  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        scannerRef.current = null;
      }
      scannerRef.current?.clear();
      scannerRef.current = null;
    }
    setCameraActive(false);
  }, []);

  const clearResult = useCallback(async () => {
    scanLockedRef.current = false;
    setFlashState(null);
    setScanResult(null);
    setLastScannedTicket(null);
    setShowDetails(false);
    setIsScanning(false);
    await stopCamera();
    await startScanner('environment');
  }, [startScanner, stopCamera]);

  const flipCamera = useCallback(async () => {
    if (!scannerRef.current) return;
    const current = scannerRef.current.getRunningTrackSettings?.();
    const next: 'environment' | 'user' =
      (current?.facingMode as 'environment' | 'user') === 'user' ? 'environment' : 'user';
    await stopCamera();
    await startScanner(next);
  }, [stopCamera, startScanner]);

  const handleConfirmScan = async () => {
    if (!lastScannedTicket) return;
    setConfirming(true);
    try {
      const res = await fetch('/api/scanner/verify', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrToken: lastScannedTicket.qrToken || '' }),
        credentials: 'include',
      });
      const result = await res.json();

      if (res.ok && result.success) {
        const newLog: ScanLog = {
          id: Date.now() as any,
          serial: lastScannedTicket.serial,
          holder: lastScannedTicket.holder,
          result: 'valid',
          timestamp: formatTime(new Date()),
          event: lastScannedTicket.event,
        };
        setScanLog((prev) => [newLog, ...prev.slice(0, 19)]);
        await loadScanLogs();
      }
    } catch (error) {
      console.error('Confirm scan error:', error);
    } finally {
      setConfirming(false);
      scanLockedRef.current = false;
      setShowDetails(false);
      setFlashState(null);
      setScanResult(null);
      setLastScannedTicket(null);
      await stopCamera();
      await startScanner('environment');
    }
  };

  useEffect(() => {
    startScanner('environment');
    return () => {
      stopCamera();
      if (resultTimeoutRef.current) clearTimeout(resultTimeoutRef.current);
      if (beepSoundRef.current) {
        beepSoundRef.current.pause();
        beepSoundRef.current = null;
      }
    };
  }, [startScanner, stopCamera]);

  const simulateScan = (qrString: string) => {
    processQRData(qrString);
  };

  const handleManualVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processQRData(manualInput.trim());
    setManualInput('');
  };

  const handleClearLog = () => {
    setScanLog([]);
    setScanCount({ total: 0, valid: 0, used: 0, invalid: 0 });
    setShowClearConfirm(false);
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.href = '/sign-up-login-screen';
  };

  const DEMO_QR_CODES =
    demoTickets.length > 0
      ? demoTickets.slice(0, 6).map((t) => ({
          id: `demo-${t.id}`,
          label: t.serial_number,
          data: t.qr_token,
          status: t.status as 'valid' | 'used' | 'invalid',
        }))
      : [
          {
            id: 'demo-valid',
            label: 'Valid Ticket',
            data: 'TICKETQR:EVT-2026-0004:EVT-2026-SUMMER-GALA',
            status: 'valid' as const,
          },
          {
            id: 'demo-used',
            label: 'Already Used',
            data: 'TICKETQR:EVT-2026-0003:EVT-2026-SUMMER-GALA',
            status: 'used' as const,
          },
          {
            id: 'demo-invalid',
            label: 'Fake Ticket',
            data: 'FAKE-QR-CODE-12345',
            status: 'invalid' as const,
          },
        ];

  const selectedEventData = events.find((e) => e.id === Number(selectedEvent)) || events[0];

  return (
    <div className="flex flex-col lg:flex-row h-full bg-background overflow-y-auto lg:overflow-hidden">
      {/* Mobile Header */}
      <header className="lg:hidden flex-shrink-0 border-b border-border bg-card/80 backdrop-blur-sm safe-area-top">
        <div className="flex items-center justify-between px-4 py-3">
          <button
            onClick={() => setMenuOpen(true)}
            className="w-11 h-11 flex items-center justify-center rounded-xl border border-border bg-input text-foreground active:scale-95 transition-all"
            aria-label="Open menu"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2">
            <QrCode size={20} className="text-primary" />
            <h1 className="text-sm font-semibold text-foreground">QR Verification Portal</h1>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowEventDropdown(!showEventDropdown)}
              className="flex items-center gap-1 px-2 py-1.5 bg-input border border-border rounded-md text-xs text-foreground active:scale-95 transition-all"
            >
              <span className="font-medium truncate max-w-28">
                {selectedEventData?.name || 'Select Event'}
              </span>
              <ChevronDown size={12} className="text-muted-foreground" />
            </button>
            {showEventDropdown && (
              <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-xl z-50 min-w-48 overflow-hidden">
                {events.map((evt) => (
                  <button
                    key={evt.id}
                    onClick={() => {
                      setSelectedEvent(String(evt.id));
                      setShowEventDropdown(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${selectedEvent === String(evt.id) ? 'text-primary' : 'text-foreground'}`}
                  >
                    <span className="font-medium">{evt.name}</span>
                    <span className="text-muted-foreground">{evt.event_date}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Scanner Column */}
      <div className="flex-1 flex flex-col lg:overflow-hidden pb-20 lg:pb-0">
        {/* Desktop Top bar */}
        <div className="hidden lg:flex items-center justify-between px-5 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <QrCode size={18} className="text-primary" />
              <h1 className="text-sm font-semibold text-foreground">QR Verification Portal</h1>
            </div>
            <div className="h-4 w-px bg-border" />
            <div className="relative">
              <button
                onClick={() => setShowEventDropdown(!showEventDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 bg-input border border-border rounded-md text-xs text-foreground hover:border-primary/50 transition-colors duration-150"
              >
                <span className="font-medium truncate max-w-32">
                  {selectedEventData?.name || 'Select Event'}
                </span>
                <span className="text-muted-foreground truncate max-w-24">
                  {selectedEventData?.event_date}
                </span>
                <ChevronDown size={12} className="text-muted-foreground" />
              </button>
              {showEventDropdown && (
                <div className="absolute top-full right-0 mt-1 bg-card border border-border rounded-md shadow-xl z-50 w-64 overflow-hidden">
                  <div className="max-h-60 overflow-y-auto scrollbar-thin">
                    {events.map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => {
                          setSelectedEvent(String(evt.id));
                          setShowEventDropdown(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-muted/50 transition-colors ${selectedEvent === String(evt.id) ? 'text-primary' : 'text-foreground'}`}
                      >
                        <span className="font-medium truncate">{evt.name}</span>
                        <span className="text-muted-foreground truncate">{evt.event_date}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div
                className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-status-valid animate-pulse' : 'bg-muted-foreground'}`}
              />
              {cameraActive ? 'Camera Active' : 'Camera Off'}
            </div>
          </div>
        </div>

        {/* Scanner area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-6 relative overflow-y-auto lg:overflow-hidden">
          {/* Flash overlay */}
          {flashState && (
            <div
              className={`absolute inset-0 pointer-events-none z-10 transition-opacity duration-600 ${flashState === 'valid' ? 'valid-flash' : 'invalid-flash'}`}
            />
          )}

          {/* Camera / Scanner box */}
          <div className="relative w-full max-w-lg">
            <div
              className={`relative rounded-xl overflow-hidden border-2 transition-all duration-300 ${
                scanResult === 'valid'
                  ? 'border-status-valid glow-valid'
                  : scanResult === 'used' || scanResult === 'invalid'
                    ? 'border-status-invalid glow-invalid'
                    : 'border-border'
              }`}
              style={{ aspectRatio: '4/3' }}
            >
              <div id="qr-scanner-container" className="w-full h-full" />

              {!cameraActive && (
                <div className="absolute inset-0 flex items-center justify-center bg-muted">
                  {cameraError ? (
                    <div className="text-center px-6">
                      <AlertTriangle size={28} className="text-accent mx-auto mb-2" />
                      <p className="text-xs text-muted-foreground">{cameraError}</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <CameraOff size={32} className="text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Camera not started</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Camera controls */}
            <div className="flex items-center gap-3 mt-3">
              {!cameraActive ? (
                <button
                  onClick={() => startScanner('environment')}
                  className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-xs sm:text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all duration-150"
                >
                  <Camera size={14} className="sm:hidden" />
                  <Camera size={16} className="hidden sm:block" />
                  <span className="hidden sm:inline">Start Camera Scanner</span>
                  <span className="sm:hidden">Start Camera</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={flipCamera}
                    className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-muted text-muted-foreground rounded-md text-xs sm:text-sm font-medium hover:bg-muted/80 active:scale-95 transition-all duration-150"
                  >
                    <RefreshCw size={14} className="sm:hidden" />
                    <RefreshCw size={16} className="hidden sm:block" />
                    <span className="hidden sm:inline">Flip Camera</span>
                    <span className="sm:hidden">Flip</span>
                  </button>
                  <button
                    onClick={stopCamera}
                    className="flex-1 flex items-center justify-center gap-2 px-3 sm:px-4 py-2.5 bg-muted text-muted-foreground rounded-md text-xs sm:text-sm font-medium hover:bg-muted/80 active:scale-95 transition-all duration-150"
                  >
                    <CameraOff size={14} className="sm:hidden" />
                    <CameraOff size={16} className="hidden sm:block" />
                    <span className="hidden sm:inline">Stop Camera</span>
                    <span className="sm:hidden">Stop</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {cameraActive && (
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/30 border border-border rounded-md px-3 py-2 w-full max-w-lg">
              <Lightbulb size={12} className="text-accent" />
              <span>
                Hold steady 15–25 cm from the QR code in bright, even lighting for fastest reads.
              </span>
            </div>
          )}

          {cameraActive && scanResult && lastScannedTicket && showDetails && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-md">
              <ScanResultCard
                result={scanResult}
                ticket={lastScannedTicket}
                onConfirm={scanResult === 'valid' ? handleConfirmScan : undefined}
                onDismiss={clearResult}
                confirming={confirming}
              />
            </div>
          )}

          {/* Demo scan buttons */}
          <div className="mt-4 sm:mt-6 w-full max-w-lg">
            <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 sm:mb-3 flex items-center gap-1.5">
                <Zap size={11} className="text-accent" />
                Ticket Verification
              </p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_QR_CODES.map((demo) => {
                  const resultIcons: Record<string, React.ReactElement> = {
                    valid: <CheckCircle2 size={16} className="text-status-valid" />,
                    used: <AlertTriangle size={16} className="text-status-used" />,
                    invalid: <XCircle size={16} className="text-status-invalid" />,
                  };
                  return (
                    <button
                      key={demo.id}
                      onClick={() => simulateScan(demo.data)}
                      disabled={isScanning || !cameraActive}
                      className="flex flex-col items-center gap-1.5 px-3 py-3 sm:px-3 sm:py-2.5 bg-input border border-border rounded-md text-xs hover:border-primary/50 hover:bg-muted/50 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {resultIcons[demo.status] || (
                        <QrCode size={16} className="text-muted-foreground" />
                      )}
                      <span className="text-foreground font-medium">{demo.label}</span>
                    </button>
                  );
                })}
              </div>
              {demoTickets.length === 0 && !loadingTickets && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  No tickets in database. Generate tickets from the Ticket Designer.
                </p>
              )}
            </div>
          </div>

          {/* Manual entry */}
          <form onSubmit={handleManualVerify} className="mt-3 w-full max-w-lg">
            <div className="bg-card border border-border rounded-lg p-3 lg:p-0 lg:border-0 lg:bg-transparent">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder="Paste QR data or serial..."
                  className="flex-1 px-3 py-3 sm:py-2 bg-input border border-border rounded-md text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 transition-colors"
                />
                <button
                  type="submit"
                  disabled={!manualInput.trim() || isScanning}
                  className="px-4 py-3 sm:py-2 bg-secondary border border-border rounded-md text-xs font-semibold text-foreground hover:bg-muted/50 hover:border-primary/50 active:scale-95 transition-all duration-150 disabled:opacity-50"
                >
                  Verify
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel — Stats + Log (desktop) */}
      <div className="hidden lg:flex lg:w-72 flex-shrink-0 border-l border-border bg-card flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
            Session Stats
          </p>
          <div className="grid grid-cols-2 gap-2">
            <StatTile label="Total Scans" value={scanCount.total} color="text-foreground" />
            <StatTile label="Accepted" value={scanCount.valid} color="text-status-valid" />
            <StatTile label="Already Used" value={scanCount.used} color="text-status-used" />
            <StatTile label="Rejected" value={scanCount.invalid} color="text-status-invalid" />
          </div>
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">Admission Rate</span>
              <span className="text-xs font-semibold text-foreground font-mono">
                {scanCount.total > 0 ? Math.round((scanCount.valid / scanCount.total) * 100) : 0}%
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-status-valid rounded-full transition-all duration-500"
                style={{
                  width: `${scanCount.total > 0 ? (scanCount.valid / scanCount.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Clock size={10} />
              Recent Scans
            </p>
            <span className="text-[10px] text-muted-foreground">{scanLog.length} entries</span>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {scanLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                <QrCode size={24} className="text-muted-foreground mb-2" />
                <p className="text-xs text-muted-foreground">
                  No scans yet. Start scanning tickets to see activity here.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {scanLog.map((log) => (
                  <ScanLogRow key={String(log.id)} log={log} />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={() => setShowClearConfirm(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground hover:text-status-invalid hover:border-status-invalid/40 transition-all duration-150"
          >
            <RefreshCw size={12} />
            Clear Session Log
          </button>
        </div>
      </div>

      {/* Mobile Tab Content */}
      <div className="lg:hidden w-full flex-shrink-0 border-t border-border bg-card flex flex-col overflow-hidden pb-20">
        {activeBottomTab === 'scanner' && (
          <>
            <div className="px-4 py-3 border-b border-border">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Session Stats
              </p>
              <div className="grid grid-cols-2 gap-2">
                <StatTile label="Total Scans" value={scanCount.total} color="text-foreground" />
                <StatTile label="Accepted" value={scanCount.valid} color="text-status-valid" />
                <StatTile label="Already Used" value={scanCount.used} color="text-status-used" />
                <StatTile label="Rejected" value={scanCount.invalid} color="text-status-invalid" />
              </div>
              <div className="mt-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Admission Rate</span>
                  <span className="text-xs font-semibold text-foreground font-mono">
                    {scanCount.total > 0
                      ? Math.round((scanCount.valid / scanCount.total) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-status-valid rounded-full transition-all duration-500"
                    style={{
                      width: `${scanCount.total > 0 ? (scanCount.valid / scanCount.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                  <Clock size={10} />
                  Recent Scans
                </p>
                <span className="text-[10px] text-muted-foreground">{scanLog.length} entries</span>
              </div>
              <div className="flex-1 overflow-y-auto scrollbar-thin">
                {scanLog.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                    <QrCode size={24} className="text-muted-foreground mb-2" />
                    <p className="text-xs text-muted-foreground">No scans yet.</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {scanLog.map((log) => (
                      <ScanLogRow key={String(log.id)} log={log} />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-md text-xs text-muted-foreground hover:text-status-invalid hover:border-status-invalid/40 transition-all"
              >
                <RefreshCw size={12} />
                Clear Session Log
              </button>
            </div>
          </>
        )}

        {activeBottomTab === 'stats' && (
          <div className="px-4 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              Session Stats
            </p>
            <div className="grid grid-cols-2 gap-2">
              <StatTile label="Total Scans" value={scanCount.total} color="text-foreground" />
              <StatTile label="Accepted" value={scanCount.valid} color="text-status-valid" />
              <StatTile label="Already Used" value={scanCount.used} color="text-status-used" />
              <StatTile label="Rejected" value={scanCount.invalid} color="text-status-invalid" />
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Admission Rate</span>
                <span className="text-xs font-semibold text-foreground font-mono">
                  {scanCount.total > 0 ? Math.round((scanCount.valid / scanCount.total) * 100) : 0}%
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-status-valid rounded-full transition-all duration-500"
                  style={{
                    width: `${scanCount.total > 0 ? (scanCount.valid / scanCount.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeBottomTab === 'history' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Clock size={10} />
                Recent Scans
              </p>
              <span className="text-[10px] text-muted-foreground">{scanLog.length} entries</span>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin">
              {scanLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <QrCode size={24} className="text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground">No scans yet.</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {scanLog.map((log) => (
                    <ScanLogRow key={String(log.id)} log={log} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeBottomTab === 'profile' && (
          <div className="px-4 py-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                <User size={24} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize">{user.role}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="bg-muted/30 rounded-md px-3 py-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Email</p>
                <p className="text-xs font-semibold text-foreground">{user.email}</p>
              </div>
              <div className="bg-muted/30 rounded-md px-3 py-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Role</p>
                <p className="text-xs font-semibold text-foreground capitalize">
                  {user.role.replace('_', ' ')}
                </p>
              </div>
              <div className="bg-muted/30 rounded-md px-3 py-2.5 border border-border">
                <p className="text-[10px] text-muted-foreground mb-0.5">Session</p>
                <p className="text-xs font-semibold text-foreground">Active</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/90 backdrop-blur-md border-t border-border safe-area-bottom z-40">
        <div className="flex items-center justify-around">
          {[
            { tab: 'scanner' as const, label: 'Scanner', icon: QrCode },
            { tab: 'stats' as const, label: 'Stats', icon: BarChart2 },
            { tab: 'history' as const, label: 'History', icon: Clock },
            { tab: 'profile' as const, label: 'Profile', icon: User },
          ].map((item) => {
            const Icon = item.icon;
            const isActive = activeBottomTab === item.tab;
            return (
              <button
                key={item.tab}
                onClick={() => setActiveBottomTab(item.tab)}
                className={`flex flex-col items-center gap-1 py-2 px-3 flex-1 transition-all ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Mobile Menu Drawer */}
      {menuOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMenuOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-card border-r border-border shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <QrCode size={20} className="text-primary" />
                <span className="font-semibold text-foreground">Menu</span>
              </div>
              <button
                onClick={() => setMenuOpen(false)}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-3 space-y-1">
              <button
                onClick={() => {
                  setActiveBottomTab('scanner');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-all"
              >
                <QrCode size={18} />
                Scanner
              </button>
              <button
                onClick={() => {
                  setActiveBottomTab('stats');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-all"
              >
                <BarChart2 size={18} />
                Stats
              </button>
              <button
                onClick={() => {
                  setActiveBottomTab('history');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-all"
              >
                <History size={18} />
                History
              </button>
              <button
                onClick={() => {
                  setActiveBottomTab('profile');
                  setMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-foreground hover:bg-muted/50 transition-all"
              >
                <User size={18} />
                Profile
              </button>
              <div className="border-t border-border mt-2 pt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-status-invalid hover:bg-status-invalid/10 transition-all"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clear Session Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowClearConfirm(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-base font-semibold text-foreground mb-1">Clear Session Log?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              This will permanently remove all scan records and reset your session stats.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="flex-1 px-4 py-3 bg-muted border border-border rounded-xl text-sm font-medium text-foreground"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLog}
                className="flex-1 px-4 py-3 bg-status-invalid/10 border border-status-invalid/30 rounded-xl text-sm font-semibold text-status-invalid"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ScanResultCard({
  result,
  ticket,
  onConfirm,
  onDismiss,
  confirming,
}: {
  result: 'valid' | 'used' | 'invalid';
  ticket: {
    serial: string;
    event: string;
    venue?: string;
    holder: string;
    status: string;
    message?: string;
    scannedAt?: string;
  };
  onConfirm?: () => void;
  onDismiss: () => void;
  confirming: boolean;
}) {
  const config = {
    valid: {
      icon: CheckCircle2,
      title: 'TICKET VALID',
      subtitle: 'Entry Permitted',
      iconColor: 'text-status-valid',
      borderColor: 'border-status-valid',
      bgColor: 'bg-status-valid/10',
      titleColor: 'text-status-valid',
    },
    used: {
      icon: AlertTriangle,
      title: 'ALREADY USED',
      subtitle: 'Ticket Previously Scanned',
      iconColor: 'text-status-used',
      borderColor: 'border-status-used',
      bgColor: 'bg-status-used/10',
      titleColor: 'text-status-used',
    },
    invalid: {
      icon: XCircle,
      title: 'INVALID TICKET',
      subtitle: 'Entry Denied',
      iconColor: 'text-status-invalid',
      borderColor: 'border-status-invalid',
      bgColor: 'bg-status-invalid/10',
      titleColor: 'text-status-invalid',
    },
  }[result ?? 'invalid'];

  const Icon = config.icon;

  return (
    <div
      className={`${config.bgColor} border ${config.borderColor} rounded-2xl px-6 sm:px-8 py-6 sm:py-8 text-center slide-up w-full max-w-lg mx-4`}
    >
      <Icon size={56} className={`${config.iconColor} mx-auto mb-3`} />
      <h2 className={`text-2xl font-bold ${config.titleColor} tracking-wider`}>{config.title}</h2>
      <p className="text-sm text-muted-foreground mb-6">{config.subtitle}</p>
      {ticket.serial !== '—' && (
        <div className="space-y-2 text-left bg-background/50 rounded-lg p-4 border border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Serial</span>
            <span className="text-sm font-mono font-semibold text-foreground">{ticket.serial}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Event</span>
            <span className="text-sm text-foreground truncate max-w-48">{ticket.event}</span>
          </div>
          {ticket.venue && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Venue</span>
              <span className="text-sm text-foreground truncate max-w-48">{ticket.venue}</span>
            </div>
          )}
          {ticket.scannedAt && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Scanned At</span>
              <span className="text-sm text-foreground truncate max-w-48">
                {new Date(ticket.scannedAt).toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {result === 'valid' && onConfirm && (
        <div className="mt-6 flex gap-3">
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-status-valid text-white rounded-lg text-sm font-semibold hover:bg-status-valid/90 disabled:opacity-60 transition-colors"
          >
            {confirming ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
            {confirming ? 'Confirming...' : 'Confirm & Validate Ticket'}
          </button>
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-3 bg-muted border border-border rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {result !== 'valid' && (
        <div className="mt-6">
          <button
            onClick={onDismiss}
            className="w-full px-4 py-3 bg-status-invalid/10 border border-status-invalid/30 rounded-lg text-sm font-semibold text-status-invalid hover:bg-status-invalid/20 transition-colors"
          >
            Clear & Resume Scanning
          </button>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-muted/30 rounded-md px-3 py-2.5">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xl font-bold font-mono tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function ScanLogRow({ log }: { log: ScanLog }) {
  const resultConfig = {
    valid: {
      icon: CheckCircle2,
      color: 'text-status-valid',
      bg: 'bg-status-valid/10',
      label: 'Valid',
    },
    used: {
      icon: AlertTriangle,
      color: 'text-status-used',
      bg: 'bg-status-used/10',
      label: 'Used',
    },
    invalid: {
      icon: XCircle,
      color: 'text-status-invalid',
      bg: 'bg-status-invalid/10',
      label: 'Invalid',
    },
  }[log.result ?? 'invalid'];
  const Icon = resultConfig.icon;

  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/20 transition-colors duration-100">
      <div
        className={`w-7 h-7 rounded-full ${resultConfig.bg} flex items-center justify-center flex-shrink-0`}
      >
        <Icon size={13} className={resultConfig.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono font-semibold text-foreground truncate">{log.serial}</p>
        <p className="text-[10px] text-muted-foreground truncate">{log.holder}</p>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={`text-[10px] font-semibold ${resultConfig.color}`}>{resultConfig.label}</p>
        <p className="text-[10px] font-mono text-muted-foreground">{log.timestamp}</p>
      </div>
    </div>
  );
}
