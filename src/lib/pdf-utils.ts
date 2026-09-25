import { jsPDF } from 'jspdf';
import { generateQRCode } from '@/lib/qr-utils';

interface DesignField {
  id: string;
  type: 'qr' | 'serial';
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize?: number;
  fontColor?: string;
  bold?: boolean;
  italic?: boolean;
}

interface TicketDesignConfig {
  backgroundImage: string | null;
  pageSize: 'A4' | 'A3' | 'A2';
  fields: DesignField[];
  gridRows: number;
  gridCols: number;
  prefix: string;
  startNumber: number;
  quantity: number;
}

const PAGE_DIMENSIONS = {
  A4: { width: 210, height: 297 },
  A3: { width: 297, height: 420 },
  A2: { width: 420, height: 594 },
};

export async function generatePdf(config: TicketDesignConfig, eventName: string): Promise<void> {
  const page = PAGE_DIMENSIONS[config.pageSize];
  const orientation = page.width > page.height ? 'landscape' : 'portrait';
  const pdf = new jsPDF(orientation, 'mm', config.pageSize);

  const cellWidth = page.width / config.gridCols;
  const cellHeight = page.height / config.gridRows;

  const totalTickets = Math.min(config.quantity, config.gridRows * config.gridCols);

  for (let i = 0; i < totalTickets; i++) {
    const row = Math.floor(i / config.gridCols);
    const col = i % config.gridCols;
    const x = col * cellWidth;
    const y = row * cellHeight;

    const serialNum = String(config.startNumber + i).padStart(4, '0');
    const serial = `${config.prefix.toUpperCase()}-${serialNum}`;
    const qrData = `TICKETQR:${serial}:${eventName.replace(/\s+/g, '-').toUpperCase()}`;

    await drawTicket(
      pdf,
      config.backgroundImage,
      config.fields,
      serial,
      qrData,
      x,
      y,
      cellWidth,
      cellHeight
    );
  }

  const fileName = `${eventName.replace(/\s+/g, '_')}_${config.prefix}_tickets.pdf`;
  pdf.save(fileName);
}

async function drawTicket(
  pdf: jsPDF,
  backgroundImage: string | null,
  fields: DesignField[],
  serial: string,
  qrData: string,
  offsetX: number,
  offsetY: number,
  cellWidth: number,
  cellHeight: number
): Promise<void> {
  if (backgroundImage) {
    try {
      const imgProps = pdf.getImageProperties(backgroundImage);
      const ratio = Math.min(cellWidth / imgProps.width, cellHeight / imgProps.height);
      const imgWidth = imgProps.width * ratio;
      const imgHeight = imgProps.height * ratio;
      const imgX = offsetX + (cellWidth - imgWidth) / 2;
      const imgY = offsetY + (cellHeight - imgHeight) / 2;
      pdf.addImage(backgroundImage, 'PNG', imgX, imgY, imgWidth, imgHeight);
    } catch (error) {
      console.error('Failed to draw background:', error);
    }
  }

  for (const field of fields) {
    const x = offsetX + field.x;
    const y = offsetY + field.y;

    if (field.type === 'qr') {
      const qrDataUrl = await generateQRCode(qrData, {
        width: field.width,
        color: { dark: field.fontColor || '#000000', light: '#ffffff' },
      });
      pdf.addImage(qrDataUrl, 'PNG', x, y, field.width, field.height);
    } else {
      let fontStyle = '';
      if (field.bold) fontStyle += 'bold';
      if (field.italic) fontStyle += 'italic';
      pdf.setFontSize(field.fontSize || 12);
      if (fontStyle)
        pdf.setFont('helvetica', fontStyle as 'bold' | 'italic' | 'bolditalic' | 'normal');
      pdf.setTextColor(field.fontColor || '#000000');
      const textWidth = pdf.getTextWidth(serial);
      const textX = x + (field.width - textWidth) / 2;
      const textY = y + field.height / 2 + 2;
      pdf.text(serial, textX, textY);
    }
  }
}
