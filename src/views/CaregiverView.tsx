import React, { useState, useEffect } from 'react';
import { HealthChart } from '../components/HealthChart';
import { AlertList } from '../components/AlertList';
import { HealthData, Alert, HealthLog, Medication, EmergencyContact, UserProfile } from '../types';
import { motion } from 'motion/react';
import { Activity, Heart, Thermometer, MapPin, Bell, Settings, Plus, Phone, MessageCircle, User } from 'lucide-react';
import { Chat } from '../components/Chat';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleGenAI } from "@google/genai";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  orderBy, 
  limit,
  getDoc
} from 'firebase/firestore';

export const CaregiverView: React.FC = () => {
  const { user, signOut } = useAuth();
  const [currentTab, setCurrentTab] = useState<'dashboard' | 'logs' | 'meds' | 'contacts' | 'chat'>('dashboard');
  const [healthData, setHealthData] = useState<HealthData[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [elderProfile, setElderProfile] = useState<UserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (!user || !user.elderIds || user.elderIds.length === 0) {
      setElderProfile(null);
      return;
    }

    const elderId = user.elderIds[0];

    // Listen for elder profile
    const unsubscribeElder = onSnapshot(doc(db, 'users', elderId), (doc) => {
      if (doc.exists()) setElderProfile(doc.data() as UserProfile);
    });

    // Listen for alerts
    const alertsQuery = query(collection(db, 'alerts'), where('userId', '==', elderId), orderBy('timestamp', 'desc'), limit(20));
    const unsubscribeAlerts = onSnapshot(alertsQuery, (snapshot) => {
      const alertsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Alert));
      setAlerts(alertsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'alerts'));

    // Listen for logs
    const logsQuery = query(collection(db, 'health_logs'), where('userId', '==', elderId), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(logsQuery, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as HealthLog));
      setLogs(logsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'health_logs'));

    // Listen for meds
    const medsQuery = query(collection(db, 'medications'), where('userId', '==', elderId));
    const unsubscribeMeds = onSnapshot(medsQuery, (snapshot) => {
      const medsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medication));
      setMeds(medsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'medications'));

    // Listen for contacts
    const contactsQuery = query(collection(db, 'emergency_contacts'), where('userId', '==', elderId));
    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyContact));
      setContacts(contactsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'emergency_contacts'));

    return () => {
      unsubscribeElder();
      unsubscribeAlerts();
      unsubscribeLogs();
      unsubscribeMeds();
      unsubscribeContacts();
    };
  }, [user]);

  const handleResolveAlert = async (id: string) => {
    try {
      await updateDoc(doc(db, 'alerts', id), { resolved: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `alerts/${id}`);
    }
  };

  const addHealthLog = async () => {
    const elderId = user?.elderIds?.[0];
    if (!elderId) {
      alert('Please connect an elder first.');
      return;
    }
    const notes = prompt('Enter health notes for today:');
    if (!notes) return;

    try {
      await addDoc(collection(db, 'health_logs'), {
        userId: elderId,
        mood: 'good',
        notes,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'health_logs');
    }
  };

  const addMedication = async () => {
    const elderId = user?.elderIds?.[0];
    if (!elderId) {
      alert('Please connect an elder first.');
      return;
    }
    const name = prompt('Enter medication name:');
    if (!name) return;
    const dosage = prompt('Enter dosage (e.g., 500mg):');
    if (!dosage) return;
    const time = prompt('Enter time (HH:mm, e.g., 08:00):');
    if (!time || !time.match(/^\d{2}:\d{2}$/)) {
      alert('Invalid time format. Please use HH:mm');
      return;
    }

    try {
      await addDoc(collection(db, 'medications'), {
        userId: elderId,
        name,
        dosage,
        time,
        taken: false,
        lastTaken: null
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'medications');
    }
  };

  const addContact = async () => {
    const elderId = user?.elderIds?.[0];
    if (!elderId) {
      alert('Please connect an elder first.');
      return;
    }
    const name = prompt('Enter contact name:');
    if (!name) return;
    const relation = prompt('Enter relation (e.g., Son, Doctor):');
    if (!relation) return;
    const phone = prompt('Enter phone number:');
    if (!phone) return;

    try {
      await addDoc(collection(db, 'emergency_contacts'), {
        userId: elderId,
        name,
        relation,
        phone,
        isPrimary: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'emergency_contacts');
    }
  };

  const connectElder = async () => {
    const elderUid = prompt('Enter the Elder\'s User ID (found in their profile):');
    if (!elderUid) return;

    setIsConnecting(true);
    try {
      const elderDoc = await getDoc(doc(db, 'users', elderUid));
      if (!elderDoc.exists()) {
        alert('Elder not found. Please check the ID.');
        return;
      }
      const elderData = elderDoc.data() as UserProfile;
      if (elderData.role !== 'elder') {
        alert('This user is not an elder.');
        return;
      }

      // Update caregiver's elderIds
      const newElderIds = [...(user?.elderIds || []), elderUid];
      await updateDoc(doc(db, 'users', user!.uid), { elderIds: newElderIds });
      
      // Update elder's caregiverId
      await updateDoc(doc(db, 'users', elderUid), { caregiverId: user!.uid });
      
      alert('Successfully connected to elder!');
    } catch (error) {
      console.error('Error connecting elder:', error);
      alert('Failed to connect. Check your internet or permissions.');
    } finally {
      setIsConnecting(false);
    }
  };

  const updateSafeZone = async () => {
    const elderId = user?.elderIds?.[0];
    if (!elderId) return;

    const lat = prompt('Xavfsiz hudud kengligi (Latitude):', elderProfile?.safeZone?.lat.toString() || '41.2995');
    const lng = prompt('Xavfsiz hudud uzunligi (Longitude):', elderProfile?.safeZone?.lng.toString() || '69.2401');
    const radius = prompt('Xavfsiz hudud radiusi (metrda):', elderProfile?.safeZone?.radius.toString() || '500');

    if (!lat || !lng || !radius) return;

    try {
      await updateDoc(doc(db, 'users', elderId), {
        safeZone: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
          radius: parseFloat(radius)
        }
      });
      alert('Xavfsiz hudud yangilandi!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${elderId}`);
    }
  };

  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const generateAIInsight = async () => {
    if (!elderProfile || logs.length === 0) {
      alert('Tahlil qilish uchun yetarli ma\'lumot yo\'q.');
      return;
    }

    setIsAnalyzing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `
        Sen SilverGuard tizimining tibbiy tahlilchisisan. 
        Quyidagi ma'lumotlar asosida keksa kishining holati haqida qisqa, professional va foydali hisobot ber:
        Ismi: ${elderProfile.displayName}
        Vitals: Yurak urishi ${elderProfile.vitals?.heartRate} bpm, Qon bosimi ${elderProfile.vitals?.bloodPressure}, Harorat ${elderProfile.vitals?.temperature}°C
        Oxirgi sog'liq qaydlari: ${logs.slice(0, 5).map(l => l.notes).join('; ')}
        Dorilar: ${meds.map(m => m.name).join(', ')}
        
        Hisobotni o'zbek tilida yoz. Agar xavfli holat bo'lsa, ogohlantir.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });

      setAiInsight(response.text);
    } catch (error) {
      console.error('AI Analysis error:', error);
      alert('AI tahlilida xatolik yuz berdi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const renderContent = () => {
    if (!user?.elderIds || user.elderIds.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-6">
          <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center border border-zinc-800">
            <User className="text-zinc-500" size={40} />
          </div>
          <div className="max-w-md">
            <h2 className="text-2xl font-bold mb-2">No Elder Connected</h2>
            <p className="text-zinc-500">To start monitoring, you need to connect to an elder's account. Ask the elder for their User ID from their profile page.</p>
          </div>
          <button 
            onClick={connectElder}
            disabled={isConnecting}
            className="bg-red-600 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 transition-all disabled:opacity-50"
          >
            {isConnecting ? 'Connecting...' : 'Connect Elder'}
          </button>
        </div>
      );
    }

    switch (currentTab) {
      case 'chat':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto h-[600px]"
          >
            <Chat currentUserId={user!.uid} otherUserId={user!.elderIds?.[0] || ''} />
          </motion.div>
        );
      case 'dashboard':
        return (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                    <Heart size={20} />
                    <span className="text-xs font-mono uppercase tracking-widest">Heart Rate</span>
                  </div>
                  <p className="text-4xl font-black tracking-tighter">
                    {elderProfile?.vitals?.heartRate || '--'} <span className="text-sm text-zinc-500 font-normal">bpm</span>
                  </p>
                  {elderProfile?.vitals?.lastUpdated && (
                    <p className="text-[10px] text-zinc-600 font-mono mt-2">Updated: {new Date(elderProfile.vitals.lastUpdated).toLocaleTimeString()}</p>
                  )}
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                    <Activity size={20} />
                    <span className="text-xs font-mono uppercase tracking-widest">Blood Pressure</span>
                  </div>
                  <p className="text-4xl font-black tracking-tighter">{elderProfile?.vitals?.bloodPressure || '--'}</p>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                    <Thermometer size={20} />
                    <span className="text-xs font-mono uppercase tracking-widest">Body Temp</span>
                  </div>
                  <p className="text-4xl font-black tracking-tighter">
                    {elderProfile?.vitals?.temperature || '--'} <span className="text-sm text-zinc-500 font-normal">°C</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <HealthChart data={healthData} type="heartRate" title="Heart Rate History" />
                <HealthChart data={healthData} type="bloodPressure" title="Blood Pressure History" />
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 h-[400px] relative overflow-hidden">
                <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/map/1200/800')] bg-cover bg-center grayscale invert" />
                <div className="relative z-10 h-full flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3 text-red-500">
                      <MapPin size={20} />
                      <span className="text-xs font-mono uppercase tracking-widest">Live Location</span>
                    </div>
                    <button 
                      onClick={updateSafeZone}
                      className="bg-black/50 hover:bg-black border border-zinc-800 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors"
                    >
                      Edit Safe Zone
                    </button>
                  </div>
                  <div className="w-full flex items-center justify-center">
                    <div className="bg-black/80 backdrop-blur-sm border border-red-900/50 px-6 py-3 rounded-full flex flex-col items-center gap-1">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-600 rounded-full animate-ping" />
                        <span className="text-sm font-bold tracking-tight">
                          Elder at: {elderProfile?.currentLocation ? `${elderProfile.currentLocation.lat.toFixed(4)}, ${elderProfile.currentLocation.lng.toFixed(4)}` : 'Home (Tashkent)'}
                        </span>
                      </div>
                      <div className="flex flex-col items-center">
                        {elderProfile?.lastSeen && (
                          <span className="text-[10px] font-mono text-zinc-500 uppercase">Last seen: {new Date(elderProfile.lastSeen).toLocaleTimeString()}</span>
                        )}
                        {elderProfile?.safeZone && (
                          <span className="text-[10px] font-mono text-red-500 uppercase mt-1">Safe Zone: {elderProfile.safeZone.radius}m Radius</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-red-500 font-mono text-xs uppercase tracking-widest">AI Health Insight</h3>
                  <button 
                    onClick={generateAIInsight}
                    disabled={isAnalyzing}
                    className="bg-red-600 text-black px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-red-500 transition-all disabled:opacity-50"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze Now'}
                  </button>
                </div>
                {aiInsight ? (
                  <div className="text-sm text-zinc-300 leading-relaxed font-medium bg-black/30 p-4 rounded-xl border border-zinc-800/50">
                    {aiInsight}
                  </div>
                ) : (
                  <p className="text-xs text-zinc-500 italic">Click "Analyze Now" to get an AI-powered health report based on recent logs and vitals.</p>
                )}
              </div>

              <AlertList alerts={alerts} onResolve={handleResolveAlert} />
              
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h3 className="text-red-500 font-mono text-xs uppercase tracking-widest mb-6">Patient Info</h3>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-700">
                    <img src={elderProfile?.photoURL || 'https://picsum.photos/seed/elder/200/200'} alt="Elder" referrerPolicy="no-referrer" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{elderProfile?.displayName || 'Sherzod Nazarov'}</p>
                    <p className="text-zinc-500 text-sm">Age: 72 • Male</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-zinc-500">Primary Caregiver</span>
                    <span className="font-bold">{user?.displayName}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'logs':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Daily Health Logs</h2>
              <button onClick={addHealthLog} className="bg-red-600 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                <Plus size={20} /> Add Log
              </button>
            </div>
            <div className="space-y-4">
              {logs.map(log => (
                <div key={log.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                  <div className="flex justify-between items-start mb-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-bold ${
                      log.mood === 'great' ? 'bg-green-500/20 text-green-500' : 
                      log.mood === 'bad' ? 'bg-red-500/20 text-red-500' : 'bg-zinc-800 text-zinc-400'
                    }`}>
                      Mood: {log.mood}
                    </span>
                    <span className="text-zinc-500 font-mono text-xs">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="text-zinc-300">{log.notes}</p>
                </div>
              ))}
              {logs.length === 0 && <p className="text-zinc-500 text-center py-12">No health logs recorded yet.</p>}
            </div>
          </motion.div>
        );
      case 'meds':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Medication Adherence</h2>
              <button onClick={addMedication} className="bg-red-600 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                <Plus size={20} /> Add Med
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meds.map(med => (
                <div key={med.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-xl font-bold">{med.name}</p>
                    <p className="text-zinc-500 text-sm">{med.dosage} • {med.time}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${med.taken ? 'bg-green-500/20 text-green-500' : 'bg-red-500/20 text-red-500'}`}>
                    {med.taken ? <Activity size={24} /> : <Bell size={24} />}
                  </div>
                </div>
              ))}
              {meds.length === 0 && <p className="text-zinc-500 text-center py-12 col-span-2">No medications scheduled yet.</p>}
            </div>
          </motion.div>
        );
      case 'contacts':
        return (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-3xl font-black tracking-tighter uppercase">Emergency Contacts</h2>
              <button onClick={addContact} className="bg-red-600 text-black px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                <Plus size={20} /> Add Contact
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.map(contact => (
                <div key={contact.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-xl font-bold">{contact.name}</p>
                    <p className="text-zinc-500 text-sm uppercase font-mono">{contact.relation}</p>
                  </div>
                  <a href={`tel:${contact.phone}`} className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center hover:bg-zinc-700 transition-colors">
                    <Phone size={24} />
                  </a>
                </div>
              ))}
              {contacts.length === 0 && <p className="text-zinc-500 text-center py-12 col-span-2">No emergency contacts added yet.</p>}
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-600 rounded-lg flex items-center justify-center">
            <Bell className="text-black" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase leading-none">SilverGuard</h1>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Caregiver Dashboard</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-2 bg-zinc-900 p-1 rounded-xl border border-zinc-800">
            <button onClick={() => setCurrentTab('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${currentTab === 'dashboard' ? 'bg-red-600 text-black' : 'text-zinc-500 hover:text-white'}`}>Dashboard</button>
            <button onClick={() => setCurrentTab('logs')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${currentTab === 'logs' ? 'bg-red-600 text-black' : 'text-zinc-500 hover:text-white'}`}>Logs</button>
            <button onClick={() => setCurrentTab('meds')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${currentTab === 'meds' ? 'bg-red-600 text-black' : 'text-zinc-500 hover:text-white'}`}>Meds</button>
            <button onClick={() => setCurrentTab('contacts')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${currentTab === 'contacts' ? 'bg-red-600 text-black' : 'text-zinc-500 hover:text-white'}`}>Contacts</button>
            <button onClick={() => setCurrentTab('chat')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-colors ${currentTab === 'chat' ? 'bg-red-600 text-black' : 'text-zinc-500 hover:text-white'}`}>Chat</button>
          </nav>
          <button onClick={signOut} className="text-zinc-500 hover:text-white transition-colors"><Settings size={24} /></button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto">
        {renderContent()}
      </main>
    </div>
  );
};
