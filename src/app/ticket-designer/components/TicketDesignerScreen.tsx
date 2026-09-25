'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

import {
  Upload,
  Trash2,
  QrCode,
  Hash,
  ChevronDown,
  RefreshCw,
  Eye,
  Move,
  Check,
  Printer,
  PenTool,
  Ticket,
  Save,
  X,
  MapPin,
  Calendar,
  Plus,
} from 'lucide-react';

import { buildPublicEventUrl, extractTokenFromScanData } from '@/lib/qr-utils';

type PageSize = 'A4' | 'A3' | 'A2';

type FontStyle = 'normal' | 'bold' | 'italic' | 'bold-italic';

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface FieldBox {
  id: string;

  type: 'qr' | 'serial';

  x: number;

  y: number;

  width: number;

  height: number;

  fontSize: number;

  fontStyle: FontStyle;

  color: string;

  label: string;

  fontFamily: string;

  fontScale: number;

  enableScaledTypography: boolean;

  rotation: number;

  customFontName?: string | null;

  customFontUrl?: string | null;
}

interface GeneratedTicket {
  id: string;

  serial: string;

  qrData: string;
}

const PAGE_SIZES: Record<
  PageSize,
  { label: string; width: number; height: number; mm: string; mmW: number; mmH: number }
> = {
  A4: { label: 'A4', width: 794, height: 1123, mm: '210 × 297 mm', mmW: 210, mmH: 297 },

  A3: { label: 'A3', width: 1123, height: 1587, mm: '297 × 420 mm', mmW: 297, mmH: 420 },

  A2: { label: 'A2', width: 1587, height: 2245, mm: '420 × 594 mm', mmW: 420, mmH: 594 },
};

const FONT_COLORS = [
  { id: 'color-white', hex: '#FFFFFF', label: 'White' },

  { id: 'color-black', hex: '#000000', label: 'Black' },

  { id: 'color-gold', hex: '#F59E0B', label: 'Gold' },

  { id: 'color-red', hex: '#EF4444', label: 'Red' },

  { id: 'color-blue', hex: '#3B82F6', label: 'Blue' },

  { id: 'color-green', hex: '#22C55E', label: 'Green' },
];

async function generateRealQR(data: string): Promise<string> {
  try {
    const QRCode = (await import('qrcode')).default;

    const canvas = document.createElement('canvas');

    await QRCode.toCanvas(canvas, data, {
      width: 200,

      margin: 1,

      color: { dark: '#000000', light: '#FFFFFF' },
    });

    return canvas.toDataURL('image/png');
  } catch {
    return generateQRFallback(data);
  }
}

function generateQRFallback(data: string): string {
  const size = 100;

  const modules = 21;

  const cellSize = size / modules;

  let cells = '';

  let hash = 0;

  for (let i = 0; i < data.length; i++) {
    hash = (hash << 5) - hash + data.charCodeAt(i);

    hash |= 0;
  }

  for (let r = 0; r < modules; r++) {
    for (let c = 0; c < modules; c++) {
      const isFinderPattern =
        (r < 7 && c < 7) || (r < 7 && c >= modules - 7) || (r >= modules - 7 && c < 7);

      const bit = isFinderPattern || ((hash ^ (r * 31 + c * 17)) & 1) === 0;

      if (bit) {
        cells += `<rect x="${c * cellSize}" y="${r * cellSize}" width="${cellSize}" height="${cellSize}" fill="black"/>`;
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="white"/>${cells}</svg>`;

  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

function generateSerials(prefix: string, count: number, startNum: number): string[] {
  const serials: string[] = [];

  for (let i = 0; i < count; i++) {
    const num = String(startNum + i).padStart(4, '0');

    serials.push(`${prefix.toUpperCase()}-${num}`);
  }

  return serials;
}

const SERIAL_FONT_OPTIONS = [
  { label: 'Arial', value: 'Arial' },

  { label: 'Helvetica', value: 'Helvetica' },

  { label: 'Times New Roman', value: 'Times New Roman' },

  { label: 'Georgia', value: 'Georgia' },

  { label: 'Verdana', value: 'Verdana' },

  { label: 'Courier New', value: 'Courier New' },

  { label: 'Trebuchet MS', value: 'Trebuchet MS' },

  { label: 'Tahoma', value: 'Tahoma' },
];

function getEffectiveFontFamily(field: FieldBox): string {
  if (field.customFontName && field.customFontUrl) {
    return `"${field.customFontName}", sans-serif`;
  }

  const family = field.fontFamily || 'Arial';

  return family.includes(' ') ? `"${family}"` : family;
}

function getEffectiveFontSize(field: FieldBox): number {
  return (field.fontSize || 14) * (field.fontScale || 1);
}

function getSerialCharacterSizes(field: FieldBox, serial: string): number[] {
  const base = field.fontSize || 14;

  const growth = Math.max(1, field.fontScale || 1);

  if (!field.enableScaledTypography) {
    return serial.split('').map(() => base);
  }

  return serial.split('').map((_, index) => Math.max(base * 0.8, base * Math.pow(growth, index)));
}

function getCustomFontCss(fields: FieldBox[]): string {
  return fields

    .filter((field) => field.type === 'serial' && field.customFontName && field.customFontUrl)

    .map((field) => {
      const safeName = (field.customFontName || 'CustomSerialFont').replace(/['"\\]/g, '');

      return `@font-face { font-family: "${safeName}"; src: url("${field.customFontUrl}") format("woff2"); }`;
    })

    .join('\n');
}

function getPdfFontFamily(field: FieldBox): string {
  const fontFamily = field.customFontName ? 'helvetica' : field.fontFamily || 'Arial';

  if (fontFamily.toLowerCase().includes('times')) return 'times';

  if (fontFamily.toLowerCase().includes('courier')) return 'courier';

  return 'helvetica';
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);

  return result
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : { r: 255, g: 255, b: 255 };
}

interface TicketPosition {
  x: number;

  y: number;
}

function getTicketLayout(
  pageSize: PageSize,

  ticketWidth: number,

  ticketHeight: number,

  position: TicketPosition,

  gap = 18
) {
  const page = PAGE_SIZES[pageSize];

  const cols = Math.max(1, Math.floor((page.width - position.x) / (ticketWidth + gap)));

  const rows = Math.max(1, Math.floor((page.height - position.y) / (ticketHeight + gap)));

  const positions: TicketPosition[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      positions.push({
        x: position.x + col * (ticketWidth + gap),

        y: position.y + row * (ticketHeight + gap),
      });
    }
  }

  return { cols, rows, total: positions.length, positions, gap };
}

function getLayoutPositions(
  pageSize: PageSize,

  ticketWidth: number,

  ticketHeight: number,

  mode: '1-per-page' | '2-per-page' | 'multi',

  gap: number,

  margin: number,

  columns = 2
): TicketPosition[] {
  const page = PAGE_SIZES[pageSize];

  const positions: TicketPosition[] = [];

  if (mode === '1-per-page') {
    positions.push({ x: margin, y: margin });
  } else if (mode === '2-per-page') {
    const totalW = ticketWidth * 2 + gap;

    const startX = Math.max(margin, (page.width - totalW) / 2);

    positions.push({ x: startX, y: margin });

    positions.push({ x: startX + ticketWidth + gap, y: margin });
  } else {
    const cols = Math.max(
      1,

      Math.min(columns, Math.floor((page.width - margin * 2 + gap) / (ticketWidth + gap)))
    );

    const rows = Math.max(1, Math.floor((page.height - margin * 2 + gap) / (ticketHeight + gap)));

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        positions.push({
          x: margin + col * (ticketWidth + gap),

          y: margin + row * (ticketHeight + gap),
        });
      }
    }
  }

  return positions;
}

interface DesignerUser {
  id: number;

  name: string;

  email: string;

  role: string;

  orgId?: number;
}

export default function TicketDesignerScreen({ user }: { user?: DesignerUser }) {
  const [pageSize, setPageSize] = useState<PageSize>('A4');

  const [ticketBg, setTicketBg] = useState<string | null>(null);

  const [events, setEvents] = useState<any[]>([]);

  const [designs, setDesigns] = useState<any[]>([]);

  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);

  const [selectedDesignId, setSelectedDesignId] = useState<string>('');

  const [isSavingDesign, setIsSavingDesign] = useState(false);

  const [isGeneratingTickets, setIsGeneratingTickets] = useState(false);

  const [ticketWidth, setTicketWidth] = useState(340);

  const [ticketHeight, setTicketHeight] = useState(160);

  const [ticketPosition, setTicketPosition] = useState<TicketPosition>({ x: 80, y: 60 });

  const [fields, setFields] = useState<FieldBox[]>([
    {
      id: 'field-qr',

      type: 'qr',

      x: 260,

      y: 30,

      width: 70,

      height: 70,

      fontSize: 12,

      fontStyle: 'normal',

      color: '#000000',

      label: 'QR Code',

      fontFamily: 'Arial',

      fontScale: 1,

      enableScaledTypography: false,

      rotation: 0,
    },

    {
      id: 'field-serial',

      type: 'serial',

      x: 20,

      y: 120,

      width: 180,

      height: 28,

      fontSize: 14,

      fontStyle: 'bold',

      color: '#FFFFFF',

      label: 'Serial Number',

      fontFamily: 'Arial',

      fontScale: 1.12,

      enableScaledTypography: false,

      rotation: 0,
    },
  ]);

  const [selectedField, setSelectedField] = useState<string | null>('field-serial');

  const [serialPrefix, setSerialPrefix] = useState('EVT-2026');

  const [startingNumber, setStartingNumber] = useState(1);

  const [ticketCount, setTicketCount] = useState(20);

  const [generatedTickets, setGeneratedTickets] = useState<GeneratedTicket[]>([]);

  const [selectedTicketForModal, setSelectedTicketForModal] = useState<GeneratedTicket | null>(
    null
  );

  const [isGenerating, setIsGenerating] = useState(false);

  const [isExporting, setIsExporting] = useState(false);

  const [exportProgress, setExportProgress] = useState(0);

  const [activeTab, setActiveTab] = useState<'design' | 'layout' | 'preview'>('design');

  const [layoutMode, setLayoutMode] = useState<'1-per-page' | '2-per-page' | 'multi'>('1-per-page');

  const [layoutGap, setLayoutGap] = useState(18);

  const [layoutMargin, setLayoutMargin] = useState(40);

  const [layoutColumns, setLayoutColumns] = useState(2);

  const [showPageSizeDropdown, setShowPageSizeDropdown] = useState(false);

  const [dragState, setDragState] = useState<{
    fieldId: string;

    startX: number;

    startY: number;

    origX: number;

    origY: number;

    origWidth: number;

    origHeight: number;

    mode: 'move' | 'resize';

    handle?: ResizeHandle;
  } | null>(null);

  const [pageTicketDragState, setPageTicketDragState] = useState<{
    startX: number;

    startY: number;

    origX: number;

    origY: number;
  } | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const serialFontInputRef = useRef<HTMLInputElement>(null);

  const [showEventModal, setShowEventModal] = useState(false);

  const [eventForm, setEventForm] = useState({
    name: '',
    venue: '',
    date: '',
    description: '',
    posterImage: '',
  });

  const [isCreatingEvent, setIsCreatingEvent] = useState(false);

  const selectedFieldData = fields.find((f) => f.id === selectedField);

  const pageSizeData = PAGE_SIZES[pageSize];

  const ticketLayout = getTicketLayout(pageSize, ticketWidth, ticketHeight, ticketPosition, 18);

  useEffect(() => {
    const maxX = Math.max(0, PAGE_SIZES[pageSize].width - ticketWidth);

    const maxY = Math.max(0, PAGE_SIZES[pageSize].height - ticketHeight);

    setTicketPosition((prev) => ({
      x: Math.min(prev.x, maxX),

      y: Math.min(prev.y, maxY),
    }));
  }, [pageSize, ticketWidth, ticketHeight]);

  useEffect(() => {
    if (!user) return;

    loadEvents();

    loadDesigns();
  }, [user]);

  const loadEvents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/events', { credentials: 'include' });

      const data = await res.json();

      if (res.ok && data.events) {
        setEvents(data.events);

        if (data.events.length > 0 && !selectedEventId) {
          setSelectedEventId(data.events[0].id);
        }
      }
    } catch (error) {
      console.error('Load events error:', error);
    }
  }, [selectedEventId]);

  const loadDesigns = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/ticket-designs', { credentials: 'include' });

      const data = await res.json();

      if (res.ok && data.designs) {
        setDesigns(data.designs);
      }
    } catch (error) {
      console.error('Load designs error:', error);
    }
  }, []);

  const handleCreateEvent = async (eventData?: {
    name: string;

    date: string;

    location: string;

    posterImage?: string;
  }) => {
    if (eventData) {
      setEventForm((prev) => ({
        name: eventData.name,

        venue: eventData.location,

        date: eventData.date,

        description: prev.description,

        posterImage: eventData.posterImage ?? '',
      }));
    }

    const form = eventData
      ? {
          name: eventData.name,

          venue: eventData.location,

          date: eventData.date,

          description: eventForm.description,

          posterImage: eventData.posterImage ?? '',
        }
      : eventForm;

    if (!form.name?.trim() || !form.venue?.trim() || !form.date?.trim()) {
      alert('Please fill all required fields');

      return;
    }

    setIsCreatingEvent(true);
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          eventDate: form.date,
          venue: form.venue,
          posterImage: form.posterImage,
          status: 'draft',
        }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok) {
        setShowEventModal(false);
        setEventForm({ name: '', venue: '', date: '', description: '', posterImage: '' });
        await loadEvents();
        setSelectedEventId(data.event.id);
      } else {
        alert(data.error || 'Failed to create event');
      }
    } catch (_error) {
      alert('Network error');
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleSaveDesign = async () => {
    if (!user) return;

    const designConfig = {
      fields,

      pageSize,

      ticketWidth,

      ticketHeight,

      ticketPosition,

      serialPrefix,

      startingNumber,

      ticketCount,

      layoutMode,

      layoutGap,

      layoutMargin,

      layoutColumns,
    };

    const payload = {
      name: `Design ${new Date().toLocaleString()}`,

      pageSize,

      backgroundImage: ticketBg,

      config: designConfig,

      eventId: selectedEventId,
    };

    try {
      setIsSavingDesign(true);

      const res = await fetch('/api/admin/ticket-designs', {
        method: 'POST',

        headers: { 'Content-Type': 'application/json' },

        body: JSON.stringify(payload),

        credentials: 'include',
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to save design');

      alert('Design saved successfully!');

      loadDesigns();
    } catch (error) {
      console.error('Save design error:', error);

      alert(error instanceof Error ? error.message : 'Failed to save design');
    } finally {
      setIsSavingDesign(false);
    }
  };

  const handleLoadDesign = async (designId: string) => {
    if (!designId) return;

    try {
      const res = await fetch(`/api/admin/ticket-designs/${designId}`, { credentials: 'include' });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Failed to load design');

      const config = data.design;

      if (config.config) {
        const parsed =
          typeof config.config === 'string' ? JSON.parse(config.config) : config.config;

        if (parsed.fields) setFields(parsed.fields);

        if (parsed.pageSize) setPageSize(parsed.pageSize);

        if (parsed.ticketWidth) setTicketWidth(parsed.ticketWidth);

        if (parsed.ticketHeight) setTicketHeight(parsed.ticketHeight);

        if (parsed.ticketPosition) setTicketPosition(parsed.ticketPosition);

        if (parsed.serialPrefix) setSerialPrefix(parsed.serialPrefix);

        if (parsed.startingNumber) setStartingNumber(parsed.startingNumber);

        if (parsed.ticketCount) setTicketCount(parsed.ticketCount);

        if (parsed.layoutMode) setLayoutMode(parsed.layoutMode);

        if (parsed.layoutGap) setLayoutGap(parsed.layoutGap);

        if (parsed.layoutMargin) setLayoutMargin(parsed.layoutMargin);

        if (parsed.layoutColumns) setLayoutColumns(parsed.layoutColumns);

        if (config.background_image) setTicketBg(config.background_image);
      }
    } catch (error) {
      console.error('Load design error:', error);

      alert(error instanceof Error ? error.message : 'Failed to load design');
    }
  };

  const applyImageAsTicketBg = (file: File) => {
    const reader = new FileReader();

    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;

      const img = new Image();

      img.onload = () => {
        const imgW = img.naturalWidth;

        const imgH = img.naturalHeight;

        const page = PAGE_SIZES[pageSize];

        const pageAspect = page.width / page.height;

        const imgAspect = imgW / imgH;

        const aspectTolerance = 0.02;

        const matchesPageAspect = Math.abs(imgAspect - pageAspect) / pageAspect < aspectTolerance;

        let width: number;

        let height: number;

        let x: number;

        let y: number;

        if (matchesPageAspect) {
          const scale = Math.min(page.width / imgW, page.height / imgH);

          width = Math.round(imgW * scale);

          height = Math.round(imgH * scale);

          x = Math.round((page.width - width) / 2);

          y = Math.round((page.height - height) / 2);
        } else {
          const padding = 40;

          const availW = page.width - padding * 2;

          const availH = page.height - padding * 2;

          const scale = Math.min(availW / imgW, availH / imgH, 1);

          width = Math.round(imgW * scale);

          height = Math.round(imgH * scale);

          x = Math.round((page.width - width) / 2);

          y = Math.round((page.height - height) / 2);
        }

        setTicketWidth(width);

        setTicketHeight(height);

        setTicketPosition({ x, y });

        setTicketBg(dataUrl);
      };

      img.src = dataUrl;
    };

    reader.readAsDataURL(file);
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    applyImageAsTicketBg(file);
  };

  const handleSerialFontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file || !selectedFieldData || selectedFieldData.type !== 'serial') return;

    const customFontName =
      file.name

        .replace(/\.[^/.]+$/, '')

        .replace(/[^a-zA-Z0-9\s_-]/g, '')

        .trim() || 'CustomSerialFont';

    const customFontUrl = URL.createObjectURL(file);

    updateField(selectedFieldData.id, {
      fontFamily: customFontName,

      customFontName,

      customFontUrl,
    });
  };

  const handleMouseDown = useCallback(
    (e: React.MouseEvent, fieldId: string, mode: 'move' | 'resize', handle?: ResizeHandle) => {
      e.preventDefault();

      e.stopPropagation();

      setSelectedField(fieldId);

      const field = fields.find((f) => f.id === fieldId);

      if (!field) return;

      setDragState({
        fieldId,

        startX: e.clientX,

        startY: e.clientY,

        origX: field.x,

        origY: field.y,

        origWidth: field.width,

        origHeight: field.height,

        mode,

        handle,
      });
    },

    [fields]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState) return;

      const dx = e.clientX - dragState.startX;

      const dy = e.clientY - dragState.startY;

      setFields((prev) =>
        prev.map((f) => {
          if (f.id !== dragState.fieldId) return f;

          if (dragState.mode === 'move') {
            return {
              ...f,

              x: Math.max(0, Math.min(ticketWidth - f.width, dragState.origX + dx)),

              y: Math.max(0, Math.min(ticketHeight - f.height, dragState.origY + dy)),
            };
          }

          const handle = dragState.handle ?? 'se';

          let nextX = dragState.origX;

          let nextY = dragState.origY;

          let nextWidth = dragState.origWidth;

          let nextHeight = dragState.origHeight;

          if (handle.includes('e')) nextWidth = Math.max(30, dragState.origWidth + dx);

          if (handle.includes('s')) nextHeight = Math.max(20, dragState.origHeight + dy);

          if (handle.includes('w')) {
            const proposedWidth = Math.max(30, dragState.origWidth - dx);

            nextX = dragState.origX + (dragState.origWidth - proposedWidth);

            nextWidth = proposedWidth;
          }

          if (handle.includes('n')) {
            const proposedHeight = Math.max(20, dragState.origHeight - dy);

            nextY = dragState.origY + (dragState.origHeight - proposedHeight);

            nextHeight = proposedHeight;
          }

          nextX = Math.max(0, Math.min(ticketWidth - nextWidth, nextX));

          nextY = Math.max(0, Math.min(ticketHeight - nextHeight, nextY));

          return {
            ...f,

            x: nextX,

            y: nextY,

            width: nextWidth,

            height: nextHeight,
          };
        })
      );
    },

    [dragState, ticketWidth, ticketHeight]
  );

  const handleTicketMoveStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();

      e.stopPropagation();

      setPageTicketDragState({
        startX: e.clientX,

        startY: e.clientY,

        origX: ticketPosition.x,

        origY: ticketPosition.y,
      });
    },

    [ticketPosition]
  );

  const handlePageMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!pageTicketDragState) return;

      const dx = e.clientX - pageTicketDragState.startX;

      const dy = e.clientY - pageTicketDragState.startY;

      const maxX = Math.max(0, pageSizeData.width - ticketWidth);

      const maxY = Math.max(0, pageSizeData.height - ticketHeight);

      setTicketPosition({
        x: Math.max(0, Math.min(maxX, pageTicketDragState.origX + dx)),

        y: Math.max(0, Math.min(maxY, pageTicketDragState.origY + dy)),
      });
    },

    [pageTicketDragState, pageSizeData, ticketWidth, ticketHeight]
  );

  const handleMouseUp = useCallback(() => {
    setDragState(null);

    setPageTicketDragState(null);
  }, []);

  const updateField = (id: string, updates: Partial<FieldBox>) => {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  };

  const handleGenerate = async () => {
    setIsGenerating(true);

    await new Promise((r) => setTimeout(r, 400));

    const serials = generateSerials(serialPrefix, ticketCount, startingNumber);

    const tickets: GeneratedTicket[] = serials.map((serial, i) => ({
      id: `ticket-${String(i + 1).padStart(4, '0')}`,

      serial,

      qrData: buildPublicEventUrl(`TICKETQR:${serial}:EVT-${new Date().getFullYear()}`),
    }));

    setGeneratedTickets(tickets);

    if (user && selectedEventId) {
      try {
        setIsGeneratingTickets(true);

        const payload = {
          eventId: selectedEventId,

          prefix: serialPrefix,

          startNumber: startingNumber,

          count: ticketCount,
        };

        const res = await fetch('/api/admin/tickets', {
          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify(payload),

          credentials: 'include',
        });

        if (!res.ok) {
          console.warn('Tickets were generated locally but not saved to DB');
        }
      } catch (error) {
        console.error('Save tickets error:', error);
      } finally {
        setIsGeneratingTickets(false);
      }
    }

    setIsGenerating(false);

    setActiveTab('preview');
  };

  const handleExportPDF = async () => {
    if (generatedTickets.length === 0) return;

    setIsExporting(true);

    setExportProgress(0);

    try {
      const { default: jsPDF } = await import('jspdf');

      const pageSizeData = PAGE_SIZES[pageSize];

      // PDF dimensions in mm

      const pdfW = pageSizeData.mmW;

      const pdfH = pageSizeData.mmH;

      // Convert ticket pixel dimensions to mm (96 DPI → mm: px * 25.4 / 96)

      const PX_TO_MM = 25.4 / 96;

      const ticketWmm = ticketWidth * PX_TO_MM;

      const ticketHmm = ticketHeight * PX_TO_MM;

      const marginMm = layoutMargin * PX_TO_MM;

      const gapMm = layoutGap * PX_TO_MM;

      const layoutPositionsMm = getLayoutPositions(
        pageSize,

        ticketWidth,

        ticketHeight,

        layoutMode,

        layoutGap,

        layoutMargin,

        layoutColumns
      ).map((pos) => ({
        x: pos.x * PX_TO_MM,

        y: pos.y * PX_TO_MM,
      }));

      const ticketsPerPage = layoutPositionsMm.length;

      // Pre-generate all QR codes

      const qrCache: Record<string, string> = {};

      for (let i = 0; i < generatedTickets.length; i++) {
        const t = generatedTickets[i];

        if (!qrCache[t.qrData]) {
          qrCache[t.qrData] = await generateRealQR(t.qrData);
        }

        setExportProgress(Math.round((i / generatedTickets.length) * 40));
      }

      const doc = new jsPDF({
        orientation: pdfW > pdfH ? 'landscape' : 'portrait',

        unit: 'mm',

        format: [pdfW, pdfH],
      });

      let pageIndex = 0;

      for (let i = 0; i < generatedTickets.length; i++) {
        const ticket = generatedTickets[i];

        const posOnPage = i % ticketsPerPage;

        if (posOnPage === 0 && i > 0) {
          doc.addPage();

          pageIndex++;
        }

        const pos = layoutPositionsMm[posOnPage];

        const xMm = pos.x;

        const yMm = pos.y;

        // Draw ticket background

        if (ticketBg) {
          try {
            const ext = ticketBg.startsWith('data:image/png') ? 'PNG' : 'JPEG';

            doc.addImage(ticketBg, ext, xMm, yMm, ticketWmm, ticketHmm);
          } catch {
            doc.setFillColor(26, 32, 53);

            doc.rect(xMm, yMm, ticketWmm, ticketHmm, 'F');
          }
        } else {
          doc.setFillColor(26, 32, 53);

          doc.rect(xMm, yMm, ticketWmm, ticketHmm, 'F');
        }

        // Draw each field

        for (const field of fields) {
          const fxMm = xMm + field.x * PX_TO_MM;

          const fyMm = yMm + field.y * PX_TO_MM;

          const fwMm = field.width * PX_TO_MM;

          const fhMm = field.height * PX_TO_MM;

          if (field.type === 'qr') {
            const qrImg = qrCache[ticket.qrData];

            if (qrImg) {
              try {
                doc.addImage(qrImg, 'PNG', fxMm, fyMm, fwMm, fhMm);
              } catch {
                // skip if image fails
              }
            }
          } else {
            // Serial number text

            const rgb = hexToRgb(field.color);

            doc.setTextColor(rgb.r, rgb.g, rgb.b);

            const pdfFontFamily = getPdfFontFamily(field);

            const isBold = field.fontStyle.includes('bold');

            const isItalic = field.fontStyle.includes('italic');

            if (pdfFontFamily === 'times') {
              if (isBold && isItalic) doc.setFont('times', 'bolditalic');
              else if (isBold) doc.setFont('times', 'bold');
              else if (isItalic) doc.setFont('times', 'italic');
              else doc.setFont('times', 'normal');
            } else if (pdfFontFamily === 'courier') {
              if (isBold && isItalic) doc.setFont('courier', 'bolditalic');
              else if (isBold) doc.setFont('courier', 'bold');
              else if (isItalic) doc.setFont('courier', 'italic');
              else doc.setFont('courier', 'normal');
            } else {
              if (isBold && isItalic) doc.setFont('helvetica', 'bolditalic');
              else if (isBold) doc.setFont('helvetica', 'bold');
              else if (isItalic) doc.setFont('helvetica', 'italic');
              else doc.setFont('helvetica', 'normal');
            }

            const charSizes = getSerialCharacterSizes(field, ticket.serial);

            const maxCharSize = Math.max(...charSizes);

            const textYMm = fyMm + fhMm / 2 + maxCharSize * 0.35 * 0.75;

            let currentX = fxMm + 1;

            charSizes.forEach((charSize, index) => {
              const character = ticket.serial[index];

              const sizePt = charSize * 0.75;

              doc.setFontSize(sizePt);

              const width = doc.getTextWidth(character);

              doc.text(character, currentX, textYMm, { maxWidth: fwMm - 2 });

              currentX += width + 0.6;
            });
          }
        }

        setExportProgress(40 + Math.round(((i + 1) / generatedTickets.length) * 55));
      }

      setExportProgress(98);

      // Save the PDF

      const filename = `tickets-${serialPrefix.toUpperCase()}-${new Date().toISOString().split('T')[0]}.pdf`;

      doc.save(filename);

      setExportProgress(100);

      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error('PDF export failed:', err);

      alert('PDF export failed. Please try again.');
    } finally {
      setIsExporting(false);

      setExportProgress(0);
    }
  };

  const layoutPositions = getLayoutPositions(
    pageSize,

    ticketWidth,

    ticketHeight,

    layoutMode,

    layoutGap,

    layoutMargin,

    layoutColumns
  );

  const ticketsPerPage = layoutPositions.length;

  return (
    <div
      className="flex h-full bg-background"

      onMouseMove={(e) => {
        if (pageTicketDragState) {
          handlePageMouseMove(e);

          return;
        }

        handleMouseMove(e);
      }}

      onMouseUp={handleMouseUp}

      onMouseLeave={handleMouseUp}
    >
      {/* Left Sidebar — Controls */}

      <div className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col overflow-y-auto scrollbar-thin">
        {/* Header */}

        <div className="px-4 py-4 border-b border-border">
          <h1 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <PenTool size={16} className="text-primary" />
            Ticket Designer
          </h1>

          <p className="text-xs text-muted-foreground mt-0.5">
            Design & generate print-ready tickets
          </p>
        </div>

        {/* Page Size */}

        <div className="px-4 py-3 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Page Size
          </label>

          <div className="relative">
            <button
              onClick={() => setShowPageSizeDropdown(!showPageSizeDropdown)}

              className="w-full flex items-center justify-between px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground hover:border-primary/50 transition-colors duration-150"
            >
              <span className="font-medium">{pageSize}</span>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{PAGE_SIZES[pageSize].mm}</span>

                <ChevronDown size={14} className="text-muted-foreground" />
              </div>
            </button>

            {showPageSizeDropdown && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-md shadow-xl z-20 overflow-hidden fade-in">
                {(Object.keys(PAGE_SIZES) as PageSize[]).map((size) => (
                  <button
                    key={`size-${size}`}

                    onClick={() => {
                      setPageSize(size);

                      setShowPageSizeDropdown(false);
                    }}

                    className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 transition-colors duration-100 ${pageSize === size ? 'text-primary' : 'text-foreground'}`}
                  >
                    <span className="font-medium">{size}</span>

                    <span className="text-xs text-muted-foreground">{PAGE_SIZES[size].mm}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground mt-1.5">
            ~{ticketsPerPage} tickets per page
            {isGeneratingTickets && <span className="ml-2 text-primary">· saving to database</span>}
          </p>
        </div>

        {/* Event Selector */}

        <div className="px-4 py-3 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Event
          </label>

          {events.length > 0 ? (
            <select
              value={selectedEventId ?? ''}

              onChange={(e) => setSelectedEventId(e.target.value ? Number(e.target.value) : null)}

              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
            >
              <option value="">Select an event</option>

              {events.map((evt) => (
                <option key={evt.id} value={evt.id}>
                  {evt.name} — {evt.status}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-xs text-muted-foreground">
              No events found. Create an event from the super admin panel or use the demo data.
            </div>
          )}

          <button
            onClick={() => setShowEventModal(true)}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
          >
            <Plus size={14} />
            Create New Event
          </button>
        </div>

        {/* Ticket Background */}

        <div className="px-4 py-3 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Ticket Background
          </label>

          <input
            ref={fileInputRef}

            type="file"

            accept="image/png,image/jpeg,image/jpg"

            onChange={handleBgUpload}

            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}

            className="w-full flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-all duration-150"
          >
            <Upload size={14} />

            {ticketBg ? 'Replace Image' : 'Upload PNG / JPG'}
          </button>

          {ticketBg && (
            <div className="mt-2 rounded-md overflow-hidden border border-border relative h-16">
              <img
                src={ticketBg}

                alt="Ticket background preview"

                className="w-full h-full object-cover"
              />

              <button
                onClick={() => setTicketBg(null)}

                className="absolute top-1 right-1 w-5 h-5 bg-background/80 rounded flex items-center justify-center text-muted-foreground hover:text-status-invalid transition-colors"
              >
                <Trash2 size={10} />
              </button>
            </div>
          )}
        </div>

        {/* Ticket Dimensions */}

        <div className="px-4 py-3 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Ticket Size (px)
          </label>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Width</label>

              <input
                type="number"

                value={ticketWidth}

                onChange={(e) => setTicketWidth(Math.max(100, Number(e.target.value)))}

                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground font-mono focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Height</label>

              <input
                type="number"

                value={ticketHeight}

                onChange={(e) => setTicketHeight(Math.max(60, Number(e.target.value)))}

                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground font-mono focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Page Layout */}

        <div className="px-4 py-3 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Page Layout
          </label>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Layout Mode</label>

              <select
                value={layoutMode}

                onChange={(e) =>
                  setLayoutMode(e.target.value as '1-per-page' | '2-per-page' | 'multi')
                }

                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
              >
                <option value="1-per-page">1 per page</option>

                <option value="2-per-page">2 per page</option>

                <option value="multi">Multi-column</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Gap (px)</label>

                <input
                  type="number"

                  value={layoutGap}

                  onChange={(e) => setLayoutGap(Math.max(0, Number(e.target.value)))}

                  className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground font-mono focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Margin (px)</label>

                <input
                  type="number"

                  value={layoutMargin}

                  onChange={(e) => setLayoutMargin(Math.max(0, Number(e.target.value)))}

                  className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground font-mono focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            </div>

            {layoutMode === 'multi' && (
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Columns</label>

                <input
                  type="number"

                  value={layoutColumns}

                  min={1}

                  max={10}

                  onChange={(e) =>
                    setLayoutColumns(Math.max(1, Math.min(10, Number(e.target.value))))
                  }

                  className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground font-mono focus:outline-none focus:border-primary/60 transition-colors"
                />
              </div>
            )}
          </div>
        </div>

        {/* Serial Settings */}

        <div className="px-4 py-3 border-b border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Serial Generation
          </label>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Prefix</label>

              <input
                type="text"

                value={serialPrefix}

                onChange={(e) => setSerialPrefix(e.target.value)}

                placeholder="e.g. 3ABC or EVT-2026"

                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors uppercase"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Starting Number</label>

              <input
                type="number"

                value={startingNumber}

                min={0}

                max={999999}

                onChange={(e) =>
                  setStartingNumber(Math.max(0, Math.min(999999, Number(e.target.value))))
                }

                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Ticket Count</label>

              <input
                type="number"

                value={ticketCount}

                min={1}

                max={2000000}

                onChange={(e) =>
                  setTicketCount(Math.max(1, Math.min(2000000, Number(e.target.value))))
                }

                className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground font-mono focus:outline-none focus:border-primary/60 transition-colors"
              />
            </div>

            <p className="text-xs text-muted-foreground">
              Preview:{' '}
              <span className="font-mono text-primary">
                {serialPrefix.toUpperCase()}-{String(startingNumber).padStart(4, '0')}
              </span>{' '}
              →{' '}
              <span className="font-mono text-primary">
                {serialPrefix.toUpperCase()}-
                {String(startingNumber + ticketCount - 1).padStart(4, '0')}
              </span>
            </p>
          </div>
        </div>

        {/* Field Properties */}

        {selectedFieldData && (
          <div className="px-4 py-3 border-b border-border">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
              {selectedFieldData.type === 'qr' ? 'QR Code Box' : 'Serial Number Box'}
            </label>

            {selectedFieldData.type === 'serial' && (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground block mb-1">Font Size</label>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"

                      min={8}

                      max={36}

                      value={selectedFieldData.fontSize}

                      onChange={(e) =>
                        updateField(selectedFieldData.id, { fontSize: Number(e.target.value) })
                      }

                      className="flex-1 accent-primary"
                    />

                    <span className="text-xs font-mono text-foreground w-8 text-right">
                      {selectedFieldData.fontSize}px
                    </span>
                  </div>

                  <div className="flex gap-1.5 mt-1.5">
                    {[10, 14, 18, 24].map((size) => (
                      <button
                        key={`fsize-${size}`}

                        onClick={() => updateField(selectedFieldData.id, { fontSize: size })}

                        className={`flex-1 py-1 text-xs rounded border transition-all duration-100 ${selectedFieldData.fontSize === size ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Font Style</label>

                  <div className="flex gap-1.5">
                    {(['normal', 'bold', 'italic', 'bold-italic'] as FontStyle[]).map((style) => (
                      <button
                        key={`fstyle-${style}`}

                        onClick={() => updateField(selectedFieldData.id, { fontStyle: style })}

                        className={`flex-1 py-1.5 text-xs rounded border transition-all duration-100 ${selectedFieldData.fontStyle === style ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/40'}`}

                        title={style}
                      >
                        {style === 'normal' && 'Aa'}

                        {style === 'bold' && <span className="font-bold">B</span>}

                        {style === 'italic' && <span className="italic">I</span>}

                        {style === 'bold-italic' && <span className="font-bold italic">BI</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Font Type</label>

                  <div className="space-y-2">
                    <select
                      value={
                        selectedFieldData.customFontName ? 'custom' : selectedFieldData.fontFamily
                      }

                      onChange={(e) => {
                        const value = e.target.value;

                        if (value === 'custom') {
                          serialFontInputRef.current?.click();

                          return;
                        }

                        updateField(selectedFieldData.id, {
                          fontFamily: value,

                          customFontName: null,

                          customFontUrl: null,
                        });
                      }}

                      className="w-full px-2 py-1.5 bg-input border border-border rounded text-sm text-foreground focus:outline-none focus:border-primary/60 transition-colors"
                    >
                      {SERIAL_FONT_OPTIONS.map((font) => (
                        <option key={font.value} value={font.value}>
                          {font.label}
                        </option>
                      ))}

                      <option value="custom">Upload custom font</option>
                    </select>

                    <input
                      ref={serialFontInputRef}

                      type="file"

                      accept=".ttf,.otf,.woff,.woff2"

                      onChange={handleSerialFontUpload}

                      className="hidden"
                    />

                    <button
                      onClick={() => serialFontInputRef.current?.click()}

                      className="w-full flex items-center justify-center gap-2 px-2 py-1.5 border border-dashed border-border rounded text-xs text-muted-foreground hover:border-primary/60 hover:text-primary transition-all duration-150"
                    >
                      <Upload size={12} />

                      {selectedFieldData.customFontName
                        ? `Loaded: ${selectedFieldData.customFontName}`
                        : 'Upload custom font'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">
                    Scaled Typography Number
                  </label>

                  <div className="flex items-center gap-2 mb-2">
                    <button
                      type="button"

                      onClick={() =>
                        updateField(selectedFieldData.id, {
                          enableScaledTypography: !selectedFieldData.enableScaledTypography,
                        })
                      }

                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${selectedFieldData.enableScaledTypography ? 'bg-primary' : 'bg-muted'}`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${selectedFieldData.enableScaledTypography ? 'translate-x-6' : 'translate-x-1'}`}
                      />
                    </button>

                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                      {selectedFieldData.enableScaledTypography ? 'Enabled' : 'Off'}
                    </span>
                  </div>

                  {selectedFieldData.enableScaledTypography && (
                    <>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"

                          min={1}

                          max={2}

                          step={0.05}

                          value={Math.min(2, Math.max(1, selectedFieldData.fontScale || 1))}

                          onChange={(e) =>
                            updateField(selectedFieldData.id, { fontScale: Number(e.target.value) })
                          }

                          className="flex-1 accent-primary"
                        />

                        <input
                          type="number"

                          min={1}

                          max={2}

                          step={0.05}

                          value={Math.min(2, Math.max(1, selectedFieldData.fontScale || 1))}

                          onChange={(e) =>
                            updateField(selectedFieldData.id, {
                              fontScale: Math.min(2, Math.max(1, Number(e.target.value || 1))),
                            })
                          }

                          className="w-16 px-2 py-1.5 bg-input border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors"
                        />

                        <span className="text-xs font-mono text-foreground w-8 text-right">×</span>
                      </div>

                      <div className="flex gap-1.5 mt-1.5">
                        {[1.1, 1.25, 1.5, 1.75, 2].map((scale) => (
                          <button
                            key={`font-scale-${scale}`}

                            onClick={() => updateField(selectedFieldData.id, { fontScale: scale })}

                            className={`flex-1 py-1 text-[10px] rounded border transition-all duration-100 ${Number(selectedFieldData.fontScale.toFixed(2)) === Number(scale.toFixed(2)) ? 'border-primary text-primary bg-primary/10' : 'border-border text-muted-foreground hover:border-primary/40'}`}
                          >
                            {scale}×
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Rotation</label>

                  <div className="flex items-center gap-2">
                    <input
                      type="range"

                      min={-180}

                      max={180}

                      value={selectedFieldData.rotation}

                      onChange={(e) =>
                        updateField(selectedFieldData.id, { rotation: Number(e.target.value) })
                      }

                      className="flex-1 accent-primary"
                    />

                    <input
                      type="number"

                      min={-180}

                      max={180}

                      value={selectedFieldData.rotation}

                      onChange={(e) =>
                        updateField(selectedFieldData.id, {
                          rotation: Math.min(180, Math.max(-180, Number(e.target.value || 0))),
                        })
                      }

                      className="w-16 px-2 py-1.5 bg-input border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/60 transition-colors"
                    />

                    <span className="text-xs font-mono text-foreground w-7 text-right">°</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground block mb-1.5">Text Color</label>

                  <div className="flex gap-1.5 flex-wrap">
                    {FONT_COLORS.map((c) => (
                      <button
                        key={c.id}

                        onClick={() => updateField(selectedFieldData.id, { color: c.hex })}

                        className={`w-7 h-7 rounded-full border-2 transition-all duration-100 ${selectedFieldData.color === c.hex ? 'border-primary scale-110' : 'border-transparent hover:border-muted-foreground'}`}

                        style={{ backgroundColor: c.hex }}

                        title={c.label}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {selectedFieldData.type === 'qr' && (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Width</label>

                    <input
                      type="number"

                      value={Math.round(selectedFieldData.width)}

                      onChange={(e) =>
                        updateField(selectedFieldData.id, {
                          width: Math.max(40, Number(e.target.value)),
                        })
                      }

                      className="w-full px-2 py-1.5 bg-input border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/60"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Height</label>

                    <input
                      type="number"

                      value={Math.round(selectedFieldData.height)}

                      onChange={(e) =>
                        updateField(selectedFieldData.id, {
                          height: Math.max(40, Number(e.target.value)),
                        })
                      }

                      className="w-full px-2 py-1.5 bg-input border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/60"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  QR code will auto-scale to fit this box
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 mt-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">X</label>

                <input
                  type="number"

                  value={Math.round(selectedFieldData.x)}

                  onChange={(e) => updateField(selectedFieldData.id, { x: Number(e.target.value) })}

                  className="w-full px-2 py-1.5 bg-input border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/60"
                />
              </div>

              <div>
                <label className="text-xs text-muted-foreground block mb-1">Y</label>

                <input
                  type="number"

                  value={Math.round(selectedFieldData.y)}

                  onChange={(e) => updateField(selectedFieldData.id, { y: Number(e.target.value) })}

                  className="w-full px-2 py-1.5 bg-input border border-border rounded text-xs font-mono text-foreground focus:outline-none focus:border-primary/60"
                />
              </div>
            </div>
          </div>
        )}

        {/* Design Save / Load */}

        <div className="px-4 py-3 border-t border-border">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
            Design Storage
          </label>

          <div className="space-y-2">
            <button
              onClick={handleSaveDesign}

              disabled={isSavingDesign || !user}

              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-accent text-accent-foreground rounded-md text-sm font-medium hover:bg-accent/90 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSavingDesign ? (
                <RefreshCw size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}

              {isSavingDesign ? 'Saving...' : 'Save Design to DB'}
            </button>

            {designs.length > 0 && (
              <select
                value={selectedDesignId}

                onChange={(e) => {
                  setSelectedDesignId(e.target.value);

                  if (e.target.value) handleLoadDesign(e.target.value);
                }}

                className="w-full px-3 py-2 text-xs bg-input border border-border rounded-md text-foreground focus:outline-none focus:border-primary/60 transition-colors"
              >
                <option value="">Load a saved design</option>

                {designs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Generate & Export */}

        <div className="px-4 py-4 mt-auto space-y-2">
          <button
            onClick={handleGenerate}

            disabled={isGenerating}

            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-md text-sm font-semibold hover:bg-primary/90 active:scale-95 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Hash size={14} />
                Generate {ticketCount} Tickets
              </>
            )}
          </button>

          {generatedTickets.length > 0 && (
            <div className="space-y-1.5">
              <button
                onClick={handleExportPDF}

                disabled={isExporting}

                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-md text-sm font-semibold hover:bg-accent/90 active:scale-95 transition-all duration-150 disabled:opacity-60"
              >
                {isExporting ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Building PDF... {exportProgress}%
                  </>
                ) : (
                  <>
                    <Printer size={14} />
                    Export PDF ({generatedTickets.length} tickets)
                  </>
                )}
              </button>

              {isExporting && (
                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300 rounded-full"

                    style={{ width: `${exportProgress}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Main Canvas Area */}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Canvas Toolbar */}

        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab('design')}

              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 ${activeTab === 'design' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <PenTool size={12} />
              Design
            </button>

            <button
              onClick={() => setActiveTab('layout')}

              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 ${activeTab === 'layout' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Move size={12} />
              Layout
            </button>

            <button
              onClick={() => setActiveTab('preview')}

              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all duration-150 ${activeTab === 'preview' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Eye size={12} />
              Preview
              {generatedTickets.length > 0 && (
                <span className="ml-1 text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5">
                  {generatedTickets.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Canvas: {ticketWidth} × {ticketHeight}px
            </span>

            <div className="h-4 w-px bg-border" />

            <span className="text-xs text-muted-foreground">
              Page: {PAGE_SIZES[pageSize].label} ({PAGE_SIZES[pageSize].mm})
            </span>
          </div>
        </div>

        {/* Canvas Content */}

        <div className="flex-1 overflow-auto canvas-grid p-8 flex items-start justify-center">
          {activeTab === 'design' ? (
            <TicketCanvas
              ticketBg={ticketBg}

              ticketWidth={ticketWidth}

              ticketHeight={ticketHeight}

              fields={fields}

              selectedField={selectedField}

              onSelectField={setSelectedField}

              onMouseDown={handleMouseDown}

              onTicketMoveStart={handleTicketMoveStart}

              sampleSerial={`${serialPrefix.toUpperCase()}-0001`}

              pageSize={pageSize}

              ticketPosition={ticketPosition}

              onDropImage={applyImageAsTicketBg}
            />
          ) : activeTab === 'layout' ? (
            <TicketLayoutPreview
              ticketBg={ticketBg}

              ticketWidth={ticketWidth}

              ticketHeight={ticketHeight}

              pageSize={pageSize}

              layoutMode={layoutMode}

              layoutGap={layoutGap}

              layoutMargin={layoutMargin}

              layoutColumns={layoutColumns}
            />
          ) : (
            <TicketPreviewGrid
              tickets={generatedTickets}

              ticketBg={ticketBg}

              onSelectTicket={(t) => setSelectedTicketForModal(t)}

              ticketWidth={ticketWidth}

              ticketHeight={ticketHeight}

              fields={fields}

              pageSize={pageSize}

              layoutMode={layoutMode}

              layoutGap={layoutGap}

              layoutMargin={layoutMargin}

              layoutColumns={layoutColumns}
            />
          )}
        </div>
      </div>

      {showEventModal && (
        <EventCreationModal
          isOpen={showEventModal}
          onClose={() => setShowEventModal(false)}
          onCreate={handleCreateEvent}
        />
      )}

      {selectedTicketForModal && (
        <TicketDetailModal
          ticket={selectedTicketForModal}
          posterImage={events.find((e) => e.id === selectedEventId)?.poster_image || null}
          eventName={events.find((e) => e.id === selectedEventId)?.name || 'Event'}
          eventVenue={events.find((e) => e.id === selectedEventId)?.venue || ''}
          eventDate={events.find((e) => e.id === selectedEventId)?.event_date || ''}
          onClose={() => setSelectedTicketForModal(null)}
        />
      )}
    </div>
  );
}

// ─── Event Creation Modal Component ──────────────────────────────────────────
interface EventCreationModalProps {
  isOpen: boolean;

  onClose: () => void;

  onCreate: (eventData: {
    name: string;

    date: string;

    location: string;

    posterImage?: string;
  }) => void;
}

function EventCreationModal({ isOpen, onClose, onCreate }: EventCreationModalProps) {
  const [name, setName] = useState('');

  const [date, setDate] = useState('');

  const [location, setLocation] = useState('');

  const [posterImage, setPosterImage] = useState<string | null>(null);

  const [posterFile, setPosterFile] = useState<File | null>(null);

  const handlePosterUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = (ev) => {
      setPosterImage(ev.target?.result as string);
    };

    reader.readAsDataURL(file);

    setPosterFile(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    onCreate({ name, date, location, posterImage: posterImage ?? undefined });

    setName('');

    setDate('');

    setLocation('');

    setPosterImage(null);

    setPosterFile(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md bg-popover border border-border rounded-lg shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Ticket size={20} />
            <h2 className="text-lg font-semibold">Create New Event</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Event Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary/60 transition-colors"
              required
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Date</label>
            <div className="relative">
              <Calendar
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary/60 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Location</label>
            <div className="relative">
              <MapPin
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-input border border-border rounded-md text-sm focus:outline-none focus:border-primary/60 transition-colors"
                placeholder="Enter location"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Event Poster
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg"
                onChange={handlePosterUpload}
                className="hidden"
                id="poster-upload"
              />
              <label
                htmlFor="poster-upload"
                className="flex items-center justify-center gap-2 w-full px-3 py-2 border border-dashed border-border rounded-md text-sm text-muted-foreground hover:border-primary/60 hover:text-primary transition-all duration-150 cursor-pointer"
              >
                <Upload size={14} />
                {posterImage ? 'Replace Poster' : 'Upload Poster Image'}
              </label>
            </div>
            {posterImage && (
              <div className="mt-3 rounded-md overflow-hidden border border-border h-24 relative">
                <img
                  src={posterImage}
                  alt="Poster preview"
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Ticket Canvas Component ───────────────────────────────────────────────

interface TicketCanvasProps {
  ticketBg: string | null;

  ticketWidth: number;

  ticketHeight: number;

  fields: FieldBox[];

  selectedField: string | null;

  onSelectField: (id: string) => void;

  onMouseDown: (
    e: React.MouseEvent,

    fieldId: string,

    mode: 'move' | 'resize',

    handle?: ResizeHandle
  ) => void;

  onTicketMoveStart: (e: React.MouseEvent) => void;

  sampleSerial: string;

  pageSize: PageSize;

  ticketPosition: TicketPosition;

  onDropImage: (file: File) => void;
}

function TicketCanvas({
  ticketBg,

  ticketWidth,

  ticketHeight,

  fields,

  selectedField,

  onSelectField,

  onMouseDown,

  onTicketMoveStart,

  sampleSerial,

  pageSize,

  ticketPosition,

  onDropImage,
}: TicketCanvasProps) {
  const [qrPreview, setQrPreview] = React.useState<string>('');

  const [isDragOver, setIsDragOver] = React.useState(false);

  const page = PAGE_SIZES[pageSize];

  React.useEffect(() => {
    generateRealQR(sampleSerial).then(setQrPreview);
  }, [sampleSerial]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    e.stopPropagation();

    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();

    e.stopPropagation();

    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();

    e.stopPropagation();

    setIsDragOver(false);

    const file = e.dataTransfer.files[0];

    if (file && file.type.startsWith('image/')) {
      onDropImage(file);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <style dangerouslySetInnerHTML={{ __html: getCustomFontCss(fields) }} />

      <div className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-full border border-border flex items-center gap-2">
        <Move size={11} />
        Drag ticket to place it on the page · drag field inside ticket to reposition
      </div>

      <div
        className={`relative ticket-shadow border-2 ${isDragOver ? 'border-primary bg-primary/5' : 'border-border bg-white'} overflow-hidden select-none`}

        style={{
          width: page.width,

          height: page.height,
        }}

        onDragOver={handleDragOver}

        onDragLeave={handleDragLeave}

        onDrop={handleDrop}
      >
        <div className="absolute inset-0 bg-white" />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.08),_transparent_52%)]" />

        <div className="absolute left-3 top-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          {page.label} page
        </div>

        <div
          className="absolute cursor-grab active:cursor-grabbing"

          style={{
            left: ticketPosition.x,

            top: ticketPosition.y,

            width: ticketWidth,

            height: ticketHeight,

            backgroundColor: ticketBg ? 'transparent' : '#1a2035',

            backgroundImage: ticketBg ? `url(${ticketBg})` : 'none',

            backgroundSize: 'cover',

            backgroundPosition: 'center',

            boxShadow: '0 14px 26px rgba(15, 23, 42, 0.18)',
          }}

          onMouseDown={onTicketMoveStart}
        >
          {!ticketBg && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center opacity-30">
                <Ticket size={32} className="text-muted-foreground mx-auto mb-2" />

                <p className="text-xs text-muted-foreground">Upload ticket background</p>
              </div>
            </div>
          )}

          <div
            className="absolute top-0 bottom-0 right-[80px] border-r-2 border-dashed opacity-20"

            style={{ borderColor: ticketBg ? 'white' : 'var(--border)' }}
          />

          {fields.map((field) => {
            const isSelected = selectedField === field.id;

            const resizeHandles: ResizeHandle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

            return (
              <div
                key={field.id}

                className={`absolute cursor-grab group ${isSelected ? 'ring-2 ring-primary ring-offset-0' : 'ring-1 ring-white/20 hover:ring-primary/50'}`}

                style={{
                  left: field.x,

                  top: field.y,

                  width: field.width,

                  height: field.height,

                  transform: `rotate(${field.rotation || 0}deg)`,

                  transformOrigin: 'center center',
                }}

                onMouseDown={(e) => onMouseDown(e, field.id, 'move')}

                onClick={() => onSelectField(field.id)}
              >
                {field.type === 'qr' ? (
                  <div className="w-full h-full flex items-center justify-center bg-white/10 backdrop-blur-sm">
                    {qrPreview ? (
                      <img
                        src={qrPreview}

                        alt="QR code preview"

                        className="w-full h-full object-contain p-0.5"
                      />
                    ) : (
                      <QrCode size={24} className="text-white/50" />
                    )}
                  </div>
                ) : (
                  <div
                    className="w-full h-full flex items-center px-1"

                    style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
                  >
                    <div
                      className="w-full h-full flex items-end overflow-hidden"

                      style={{
                        fontFamily: getEffectiveFontFamily(field),

                        color: field.color,

                        fontWeight: field.fontStyle.includes('bold') ? 700 : 400,

                        fontStyle: field.fontStyle.includes('italic') ? 'italic' : 'normal',
                      }}
                    >
                      {sampleSerial.split('').map((char, index) => {
                        const charSize = field.enableScaledTypography
                          ? Math.max(
                              8,

                              (field.fontSize || 14) *
                                Math.pow(Math.max(1, field.fontScale || 1), index)
                            )
                          : field.fontSize || 14;

                        return (
                          <span
                            key={`${field.id}-${index}`}

                            style={{
                              fontSize: charSize,

                              lineHeight: 1,

                              display: 'inline-block',

                              transform:
                                field.enableScaledTypography && index > 0
                                  ? `translateY(${Math.min(8, index * 1.5)}px)`
                                  : 'translateY(0px)',
                            }}
                          >
                            {char}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isSelected && (
                  <>
                    <div className="absolute inset-0 border border-dashed border-primary/80 pointer-events-none" />

                    {resizeHandles.map((handle) => {
                      const positionStyle: Record<ResizeHandle, React.CSSProperties> = {
                        nw: { left: 0, top: 0, transform: 'translate(-50%, -50%)' },

                        n: { left: '50%', top: 0, transform: 'translate(-50%, -50%)' },

                        ne: { right: 0, top: 0, transform: 'translate(50%, -50%)' },

                        e: { right: 0, top: '50%', transform: 'translate(50%, -50%)' },

                        se: { right: 0, bottom: 0, transform: 'translate(50%, 50%)' },

                        s: { left: '50%', bottom: 0, transform: 'translate(-50%, 50%)' },

                        sw: { left: 0, bottom: 0, transform: 'translate(-50%, 50%)' },

                        w: { left: 0, top: '50%', transform: 'translate(-50%, -50%)' },
                      };

                      return (
                        <div
                          key={handle}

                          className="absolute w-2.5 h-2.5 bg-primary border border-white rounded-full shadow-sm cursor-pointer"

                          style={{
                            ...positionStyle[handle],

                            boxShadow: '0 0 0 1px rgba(255,255,255,0.8)',
                          }}

                          onMouseDown={(e) => {
                            e.stopPropagation();

                            onMouseDown(e, field.id, 'resize', handle);
                          }}
                        />
                      );
                    })}

                    <div
                      className="absolute -top-7 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full cursor-grab"

                      onMouseDown={(e) => {
                        e.stopPropagation();

                        onMouseDown(e, field.id, 'move');
                      }}
                    />
                  </>
                )}

                <div className="absolute -top-5 left-0 text-[9px] text-primary bg-background/80 px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-100 whitespace-nowrap">
                  {field.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        {fields.map((f) => (
          <button
            key={`legend-${f.id}`}

            onClick={() => onSelectField(f.id)}

            className={`flex items-center gap-1.5 px-2 py-1 rounded border transition-all duration-100 ${selectedField === f.id ? 'border-primary text-primary bg-primary/5' : 'border-border hover:border-primary/40'}`}
          >
            {f.type === 'qr' ? <QrCode size={11} /> : <Hash size={11} />}

            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Ticket Preview Item Component ─────────────────────────────────────────

interface TicketPreviewItemProps {
  ticket: GeneratedTicket;

  ticketBg: string | null;

  ticketWidth: number;

  ticketHeight: number;

  fields: FieldBox[];

  scale: number;
}

function TicketPreviewItem({
  ticket,

  ticketBg,

  ticketWidth,

  ticketHeight,

  fields,

  scale,
}: TicketPreviewItemProps) {
  const [qrData, setQrData] = React.useState<string>('');

  React.useEffect(() => {
    generateRealQR(ticket.qrData).then(setQrData);
  }, [ticket.qrData]);

  return (
    <div
      className="relative overflow-hidden rounded"

      style={{
        width: ticketWidth * scale,

        height: ticketHeight * scale,

        backgroundColor: ticketBg ? 'transparent' : '#1a2035',

        backgroundImage: ticketBg ? `url(${ticketBg})` : 'none',

        backgroundSize: 'cover',
      }}
    >
      {fields.map((field) => (
        <div
          key={`${ticket.id}-${field.id}`}

          className="absolute"

          style={{
            left: field.x * scale,

            top: field.y * scale,

            width: field.width * scale,

            height: field.height * scale,
          }}
        >
          {field.type === 'qr' ? (
            qrData ? (
              <img
                src={qrData}

                alt={`QR for ${ticket.serial}`}

                className="w-full h-full object-contain"
              />
            ) : null
          ) : (
            <div
              className="flex items-end overflow-hidden h-full w-full"

              style={{
                fontFamily: getEffectiveFontFamily(field),

                color: field.color,

                fontWeight: field.fontStyle.includes('bold') ? 700 : 400,

                fontStyle: field.fontStyle.includes('italic') ? 'italic' : 'normal',
              }}
            >
              {ticket.serial.split('').map((char, index) => {
                const charSize = field.enableScaledTypography
                  ? Math.max(
                      4,

                      (field.fontSize || 14) *
                        Math.pow(Math.max(1, field.fontScale || 1), index) *
                        scale
                    )
                  : (field.fontSize || 14) * scale;

                return (
                  <span
                    key={`${ticket.id}-${field.id}-${index}`}

                    style={{
                      fontSize: charSize,

                      lineHeight: 1,

                      display: 'inline-block',

                      transform:
                        field.enableScaledTypography && index > 0
                          ? `translateY(${Math.min(10, index * 1.8)}px)`
                          : 'translateY(0px)',
                    }}
                  >
                    {char}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface TicketPreviewGridProps {
  tickets: GeneratedTicket[];

  ticketBg: string | null;

  onSelectTicket: (ticket: GeneratedTicket) => void;

  ticketWidth: number;

  ticketHeight: number;

  fields: FieldBox[];

  pageSize: PageSize;

  layoutMode: '1-per-page' | '2-per-page' | 'multi';

  layoutGap: number;

  layoutMargin: number;

  layoutColumns: number;
}

function TicketPreviewGrid({
  tickets,

  ticketBg,

  onSelectTicket,

  ticketWidth,

  ticketHeight,

  fields,

  pageSize,

  layoutMode,

  layoutGap,

  layoutMargin,

  layoutColumns,
}: TicketPreviewGridProps) {
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Ticket size={28} className="text-muted-foreground" />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">No tickets generated yet</h3>

          <p className="text-xs text-muted-foreground max-w-xs">
            Configure your ticket layout in the Design tab and click Generate to create your
            tickets.
          </p>
        </div>
      </div>
    );
  }

  // ─── Ticket Canvas Component ───────────────────────────────────────────────

  const page = PAGE_SIZES[pageSize];

  const scale = Math.min(0.6, 760 / page.width);

  const positions = getLayoutPositions(
    pageSize,

    ticketWidth,

    ticketHeight,

    layoutMode,

    layoutGap,

    layoutMargin,

    layoutColumns
  );

  const visibleTickets = tickets.slice(0, Math.min(tickets.length, positions.length));

  return (
    <div className="flex flex-col items-center gap-6">
      <style dangerouslySetInnerHTML={{ __html: getCustomFontCss(fields) }} />

      <div className="flex items-center gap-3 text-xs text-muted-foreground bg-card px-4 py-2 rounded-full border border-border">
        <Check size={12} className="text-status-valid" />
        <span className="font-semibold text-foreground">{positions.length}</span> tickets fit on one
        page ·<span>{page.label} layout</span>
      </div>

      <div
        className="relative bg-white border border-border ticket-shadow"

        style={{
          width: page.width * scale,

          height: page.height * scale,
        }}
      >
        {positions.map((slot, index) => {
          const ticket = visibleTickets[index];

          if (!ticket) return null;

          return (
            <div
              key={ticket.id}

              className="absolute"

              style={{
                left: slot.x * scale,

                top: slot.y * scale,

                width: ticketWidth * scale,

                height: ticketHeight * scale,
              }}
            >
              <TicketPreviewItem
                ticket={ticket}

                ticketBg={ticketBg}

                ticketWidth={ticketWidth}

                ticketHeight={ticketHeight}

                fields={fields}

                scale={scale}
              />
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden w-full max-w-2xl">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Generated Serials
          </span>

          <span className="text-xs text-muted-foreground">{tickets.length} total</span>
        </div>

        <div className="max-h-48 overflow-y-auto scrollbar-thin">
          <div className="grid grid-cols-3 gap-0">
            {tickets.slice(0, 30).map((t, i) => (
              <div
                key={t.id}
                onClick={() => onSelectTicket(t)}
                className="px-3 py-1.5 text-xs font-mono text-foreground border-b border-r border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
              >
                <span className="text-muted-foreground mr-1">
                  {String(i + 1).padStart(2, '0')}.
                </span>

                <span className="text-primary">{t.serial}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Ticket Detail Modal Component ─────────────────────────────────────────────

interface TicketDetailModalProps {
  ticket: GeneratedTicket;

  posterImage: string | null;

  eventName: string;

  eventVenue: string;

  eventDate: string;

  onClose: () => void;
}

function TicketDetailModal({
  ticket,

  posterImage,

  eventName,

  eventVenue,

  eventDate,

  onClose,
}: TicketDetailModalProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');

  useEffect(() => {
    generateRealQR(ticket.qrData).then(setQrCodeUrl);
  }, [ticket.qrData]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md bg-popover border border-border rounded-xl shadow-xl overflow-hidden">
        {posterImage ? (
          <div className="relative w-full h-36">
            <img
              src={posterImage}
              alt={`${eventName} poster`}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="w-full h-36 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Ticket size={32} className="text-primary/40" />
          </div>
        )}

        <div className="p-5 space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">{eventName}</h2>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Calendar size={16} className="text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Date</p>
                <p className="text-sm font-medium text-foreground">
                  {eventDate
                    ? new Date(eventDate).toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <MapPin size={16} className="text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Venue</p>
                <p className="text-sm font-medium text-foreground">{eventVenue || '—'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Ticket size={16} className="text-primary flex-shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  Serial Number
                </p>
                <p className="text-sm font-medium text-foreground">{ticket.serial}</p>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-4 border-t border-border">
            {qrCodeUrl ? (
              <img src={qrCodeUrl} alt="Ticket QR Code" className="w-28 h-28 object-contain" />
            ) : (
              <Ticket size={48} className="text-muted-foreground/30" />
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-border">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-accent transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface TicketLayoutPreviewProps {
  ticketBg: string | null;

  ticketWidth: number;

  ticketHeight: number;

  pageSize: PageSize;

  layoutMode: '1-per-page' | '2-per-page' | 'multi';

  layoutGap: number;

  layoutMargin: number;

  layoutColumns: number;
}

function TicketLayoutPreview({
  ticketBg,

  ticketWidth,

  ticketHeight,

  pageSize,

  layoutMode,

  layoutGap,

  layoutMargin,

  layoutColumns,
}: TicketLayoutPreviewProps) {
  const page = PAGE_SIZES[pageSize];

  const scale = Math.min(0.6, 760 / page.width);

  const positions = getLayoutPositions(
    pageSize,

    ticketWidth,

    ticketHeight,

    layoutMode,

    layoutGap,

    layoutMargin,

    layoutColumns
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-xs text-muted-foreground bg-card px-3 py-1.5 rounded-full border border-border flex items-center gap-2">
        <Move size={11} />
        {positions.length} ticket{positions.length !== 1 ? 's' : ''} per page ·{' '}
        {layoutMode.replace('-', ' ')} layout
      </div>

      <div
        className="relative bg-white border border-border ticket-shadow"

        style={{
          width: page.width * scale,

          height: page.height * scale,
        }}
      >
        {positions.map((pos, index) => (
          <div
            key={index}

            className="absolute border-2 border-dashed border-primary/40 bg-primary/5"

            style={{
              left: pos.x * scale,

              top: pos.y * scale,

              width: ticketWidth * scale,

              height: ticketHeight * scale,
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-primary/70 font-medium">#{index + 1}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden w-full max-w-2xl">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Layout Summary
          </span>
        </div>

        <div className="p-4 grid grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-muted-foreground block mb-1">Mode</span>

            <span className="text-foreground font-medium capitalize">
              {layoutMode.replace('-', ' ')}
            </span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1">Tickets per page</span>

            <span className="text-foreground font-medium">{positions.length}</span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1">Gap</span>

            <span className="text-foreground font-medium">{layoutGap}px</span>
          </div>

          <div>
            <span className="text-muted-foreground block mb-1">Margin</span>

            <span className="text-foreground font-medium">{layoutMargin}px</span>
          </div>

          {layoutMode === 'multi' && (
            <div>
              <span className="text-muted-foreground block mb-1">Columns</span>

              <span className="text-foreground font-medium">{layoutColumns}</span>
            </div>
          )}

          <div>
            <span className="text-muted-foreground block mb-1">Ticket size</span>

            <span className="text-foreground font-medium">
              {ticketWidth} × {ticketHeight}px
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
