import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface Point {
  lat: number;
  lng: number;
}

export interface Route {
  km: number;
  minutes: number;
}

const TIMEOUT_MS = 5000;

/**
 * İki nokta arası kamyon yolu mesafesi ve süresi (OpenRouteService, ücretsiz paket günde 2000 istek).
 * ORS_API_KEY yoksa ya da servis yanıt vermezse null döner; talep yine açılır, mesafe il merkezlerinden kalır.
 * Ayrıntılar: docs/harita.md
 */
@Injectable()
export class RouteService {
  private readonly logger = new Logger(RouteService.name);
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    this.apiKey = config.get<string>('ORS_API_KEY') || undefined;
    this.baseUrl = config.get<string>('ORS_BASE_URL') ?? 'https://api.openrouteservice.org';
  }

  async route(from: Point, to: Point): Promise<Route | null> {
    if (!this.apiKey) return null;
    try {
      const res = await fetch(`${this.baseUrl}/v2/directions/driving-hgv`, {
        method: 'POST',
        headers: { Authorization: this.apiKey, 'Content-Type': 'application/json', Accept: 'application/json' },
        // ORS sırası boylam, enlem
        body: JSON.stringify({ coordinates: [[from.lng, from.lat], [to.lng, to.lat]] }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Yol hesaplanamadı (ORS ${res.status}): ${(await res.text()).slice(0, 200)}`);
        return null;
      }
      const body = (await res.json()) as { routes?: { summary?: { distance?: number; duration?: number } }[] };
      const summary = body.routes?.[0]?.summary;
      if (typeof summary?.distance !== 'number' || typeof summary.duration !== 'number') return null;
      return { km: Math.max(1, Math.round(summary.distance / 1000)), minutes: Math.max(1, Math.round(summary.duration / 60)) };
    } catch (err) {
      this.logger.warn(`Yol hesaplanamadı (ORS): ${(err as Error).message}`);
      return null;
    }
  }
}
