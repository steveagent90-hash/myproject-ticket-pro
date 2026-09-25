import { Ticket, CalendarDays, MapPin, Calendar, Clock } from 'lucide-react';

import { getDb, initDatabase } from '@/lib/db';
import { generateQRCode } from '@/lib/qr-utils';

interface EventData {
  id: number;
  name: string;
  description: string | null;
  date: string | null;
  venue: string;
  posterImage: string | null;
}

interface TicketData {
  id: number;
  serialNumber: string;
  status: string;
  event: EventData;
}

interface EventPageProps {
  params: Promise<{ token: string }>;
}

async function getTicketData(token: string): Promise<TicketData | null> {
  initDatabase();
  const db = getDb();

  const ticket = db
    .prepare(
      `
      SELECT t.id, t.serial_number, t.qr_token, t.status,
             e.id as event_id, e.name as event_name, e.description as event_description,
             e.event_date, e.venue, e.poster_image, e.status as event_status
      FROM tickets t
      JOIN events e ON t.event_id = e.id
      WHERE t.qr_token = ?
    `
    )
    .get(token) as
    | {
        id: number;
        serial_number: string;
        qr_token: string;
        status: string;
        event_id: number;
        event_name: string;
        event_description: string | null;
        event_date: string | null;
        venue: string;
        poster_image: string | null;
        event_status: string;
      }
    | undefined;

  if (!ticket) return null;

  return {
    id: ticket.id,
    serialNumber: ticket.serial_number,
    status: ticket.status,
    event: {
      id: ticket.event_id,
      name: ticket.event_name,
      description: ticket.event_description,
      date: ticket.event_date,
      venue: ticket.venue,
      posterImage: ticket.poster_image,
    },
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  const ticket = await getTicketData(token);

  if (!ticket) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
            <Ticket className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">
            Ticket Not Found
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            The ticket you are trying to view could not be found.
          </p>
        </div>
      </div>
    );
  }

  const eventDate = ticket.event.date ? new Date(ticket.event.date) : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:4028';
  const fullUrl = `${appUrl}/e/${encodeURIComponent(token)}`;
  let qrCodeUrl = '';
  try {
    qrCodeUrl = await generateQRCode(fullUrl, { width: 200, margin: 2 });
  } catch {
    qrCodeUrl = '';
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 py-6 sm:py-8 px-4">
      <div className="max-w-md mx-auto">
        {/* Poster */}
        <div className="rounded-xl overflow-hidden shadow-lg mb-6">
          {ticket.event.posterImage ? (
            <img
              src={ticket.event.posterImage}
              alt={`${ticket.event.name} poster`}
              className="w-full h-48 sm:h-56 object-cover"
            />
          ) : (
            <div className="w-full h-48 sm:h-56 bg-gradient-to-br from-blue-500/20 to-purple-500/10 flex items-center justify-center">
              <Ticket className="h-16 w-16 text-blue-400/50" />
            </div>
          )}
        </div>

        {/* Ticket Card */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-700">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
              {ticket.event.name}
            </h1>
            {ticket.event.description && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                {ticket.event.description}
              </p>
            )}
          </div>

          {/* Event Details */}
          <div className="px-6 py-5 space-y-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Date
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  {eventDate
                    ? eventDate.toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
              </div>
            </div>

            {eventDate && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                    Time
                  </p>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                    {eventDate.toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Venue
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  {ticket.event.venue || '—'}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Ticket className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                  Ticket Type / Serial
                </p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-200">
                  {ticket.serialNumber}
                </p>
              </div>
            </div>
          </div>

          {/* QR Code Section */}
          <div className="px-6 py-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-4">
              Present this QR code at the entrance for verification
            </p>
            <div className="flex justify-center">
              <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border-2 border-slate-200 dark:border-slate-700 shadow-sm">
                {qrCodeUrl ? (
                  <img
                    src={qrCodeUrl}
                    alt="Ticket QR Code"
                    className="w-32 h-32 sm:w-40 sm:h-40 object-contain"
                  />
                ) : (
                  <Ticket className="w-32 h-32 sm:w-40 sm:h-40 text-slate-300 dark:text-slate-600" />
                )}
              </div>
            </div>
          </div>

          {/* Status Footer */}
          <div className="px-6 py-3 bg-slate-100 dark:bg-slate-800/30 border-t border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                Ticket ID: {ticket.id}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
