import { Customer } from '../types';

export interface CustomerQrPayload {
  app: 'takatrek' | 'challan_track';
  type: 'customer';
  id: string;
  name: string;
  phone?: string;
}

export function generateCustomerQrData(customer: Customer): string {
  const payload: CustomerQrPayload = {
    app: 'takatrek',
    type: 'customer',
    id: customer.id,
    name: customer.name,
    phone: customer.phone || ''
  };
  return JSON.stringify(payload);
}

export function parseCustomerQrData(rawData: string): { id?: string; name: string; phone?: string } | null {
  if (!rawData || typeof rawData !== 'string') return null;
  const trimmed = rawData.trim();
  if (!trimmed) return null;

  // Try parsing as JSON first
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object') {
      if (parsed.name && typeof parsed.name === 'string') {
        return {
          id: typeof parsed.id === 'string' ? parsed.id : undefined,
          name: parsed.name.trim(),
          phone: typeof parsed.phone === 'string' ? parsed.phone.trim() : undefined
        };
      }
    }
  } catch {
    // Not valid JSON, continue with fallback formats
  }

  // Fallback: URL with query parameters like ?id=...&name=...
  if (trimmed.includes('name=') || trimmed.includes('id=')) {
    try {
      const url = new URL(trimmed.startsWith('http') ? trimmed : `https://challan.app/${trimmed}`);
      const id = url.searchParams.get('id') || undefined;
      const name = url.searchParams.get('name') || undefined;
      const phone = url.searchParams.get('phone') || undefined;
      if (name) {
        return { id, name: name.trim(), phone: phone?.trim() };
      }
    } catch {
      // Continue
    }
  }

  // Fallback: Plain text format "takatrek:customer:Name", "Challan:Customer:Name" or just plain string
  if (trimmed.toLowerCase().startsWith('takatrek:customer:') || trimmed.toLowerCase().startsWith('challan:customer:')) {
    const parts = trimmed.split(':');
    const name = parts[2];
    if (name) {
      return { name: name.trim() };
    }
  }

  // If text is short and looks like a valid customer name or barcode ID (between 1 and 80 chars)
  if (trimmed.length >= 1 && trimmed.length <= 80 && !trimmed.includes('{') && !trimmed.includes('}')) {
    return { id: trimmed, name: trimmed };
  }

  return null;
}
