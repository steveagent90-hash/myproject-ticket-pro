import { getDb, initDatabase } from '@/lib/db';

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  initDatabase();
  const db = getDb();

  const { token: rawToken } = await params;
  const token = decodeURIComponent(rawToken);

  if (!token) {
    return Response.json({ error: 'Token is required' }, { status: 400 });
  }

  try {
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

    if (!ticket) {
      return Response.json({ error: 'Ticket not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      ticket: {
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
      },
    });
  } catch (error) {
    console.error('Public event lookup error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
