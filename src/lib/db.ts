import Dexie, { type Table } from 'dexie';

export type OpStatus = 'pending' | 'syncing' | 'synced' | 'failed' | 'conflict';
export type OpType = 'route_stop_status_update' | 'incident_create';
export type Op = {
  id: string; driverId: string; type: OpType; routeId?: string; stopId?: string; payload: Record<string, unknown>;
  label: string; createdAt: number; status: OpStatus; error?: string; attempts: number; syncedAt?: number;
};
export type CacheRow = { key: string; value: unknown; savedAt: number };

class DriverDB extends Dexie {
  ops!: Table<Op, string>;
  cache!: Table<CacheRow, string>;
  constructor() {
    super('lebbas-container-driver');
    this.version(1).stores({ ops: 'id, driverId, status, createdAt, stopId', cache: 'key' });
  }
}
export const db = new DriverDB();
