export interface HealthData {
  id: string;
  userId: string;
  heartRate: number;
  bloodPressureSystolic: number;
  bloodPressureDiastolic: number;
  timestamp: string;
  location?: {
    lat: number;
    lng: number;
  };
}

export interface Medication {
  id: string;
  userId: string;
  name: string;
  dosage: string;
  time: string; // HH:mm
  taken: boolean;
  lastTaken?: string;
}

export interface Alert {
  id: string;
  userId: string;
  type: 'SOS' | 'HEART_RATE' | 'BLOOD_PRESSURE' | 'FALL' | 'GEOFENCE';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  role: 'elder' | 'caregiver';
  caregiverId?: string | null;
  elderIds?: string[];
  photoURL?: string;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  lastSeen?: string;
  vitals?: {
    heartRate: number;
    bloodPressure: string;
    temperature: number;
    lastUpdated: string;
  };
  safeZone?: {
    lat: number;
    lng: number;
    radius: number;
  };
}

export interface HealthLog {
  id: string;
  userId: string;
  mood: 'great' | 'good' | 'okay' | 'bad' | 'critical';
  notes: string;
  timestamp: string;
}

export interface EmergencyContact {
  id: string;
  userId: string;
  name: string;
  relation: string;
  phone: string;
  isPrimary: boolean;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string;
    providerInfo: {
      providerId: string;
      displayName: string;
      email: string;
      photoUrl: string;
    }[];
  };
}
