import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, MapPin, User, Phone, Heart, Thermometer, AlertTriangle, MessageCircle, Mic } from 'lucide-react';
import { SOSButton } from '../components/SOSButton';
import { MedicationList } from '../components/MedicationList';
import { Chat } from '../components/Chat';
import { Medication, Alert, EmergencyContact, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { GoogleGenAI, Modality } from "@google/genai";
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc 
} from 'firebase/firestore';

export const ElderView: React.FC = () => {
  const { user, signOut } = useAuth();
  const [currentTab, setCurrentTab] = useState<'home' | 'location' | 'profile' | 'contacts' | 'chat'>('home');
  const [isSendingSOS, setIsSendingSOS] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [meds, setMeds] = useState<Medication[]>([]);
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [currentLocation, setCurrentLocation] = useState({ lat: 41.2995, lng: 69.2401 });
  const [caregiverProfile, setCaregiverProfile] = useState<UserProfile | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Listen for caregiver profile if connected
    let unsubscribeCaregiver = () => {};
    if (user.caregiverId) {
      unsubscribeCaregiver = onSnapshot(doc(db, 'users', user.caregiverId), (doc) => {
        if (doc.exists()) setCaregiverProfile(doc.data() as UserProfile);
      });
    }

    // Listen for medications
    const medsQuery = query(collection(db, 'medications'), where('userId', '==', user.uid));
    const unsubscribeMeds = onSnapshot(medsQuery, (snapshot) => {
      const medsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Medication));
      setMeds(medsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'medications'));

    // Listen for contacts
    const contactsQuery = query(collection(db, 'emergency_contacts'), where('userId', '==', user.uid));
    const unsubscribeContacts = onSnapshot(contactsQuery, (snapshot) => {
      const contactsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EmergencyContact));
      setContacts(contactsData);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'emergency_contacts'));

    return () => {
      unsubscribeMeds();
      unsubscribeContacts();
      unsubscribeCaregiver();
    };
  }, [user]);

  // Geofencing Simulation
  useEffect(() => {
    if (!user?.safeZone) return;

    const interval = setInterval(() => {
      // Simulate slight movement
      const newLat = currentLocation.lat + (Math.random() - 0.5) * 0.005;
      const newLng = currentLocation.lng + (Math.random() - 0.5) * 0.005;
      setCurrentLocation({ lat: newLat, lng: newLng });

      // Calculate distance (simplified)
      const dist = Math.sqrt(Math.pow(newLat - user.safeZone.lat, 2) + Math.pow(newLng - user.safeZone.lng, 2)) * 111000;
      
      // Sync location to Firestore so caregiver can see it
      updateDoc(doc(db, 'users', user.uid), {
        currentLocation: { lat: newLat, lng: newLng },
        lastSeen: new Date().toISOString()
      }).catch(e => console.error("Location sync error:", e));

      if (dist > user.safeZone.radius) {
        triggerAlert('GEOFENCE', `Elder left safe zone! Current distance: ${Math.round(dist)}m`);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [user, currentLocation]);

  const triggerAlert = async (type: Alert['type'], message: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'alerts'), {
        userId: user.uid,
        type,
        message,
        timestamp: new Date().toISOString(),
        resolved: false
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'alerts');
    }
  };

  const handleListen = async (med: Medication) => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      const prompt = `Say clearly and slowly in Uzbek: "Vaqt bo'ldi. Iltimos, ${med.name} dorisini ${med.dosage} miqdorda iching. Salomat bo'ling!"`;
      
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Kore' },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
        audio.onended = () => setIsSpeaking(false);
        await audio.play();
      } else {
        setIsSpeaking(false);
      }
    } catch (error) {
      console.error("TTS error:", error);
      setIsSpeaking(false);
    }
  };

  const logVitals = async () => {
    const hr = prompt('Yurak urishi (bpm):', '72');
    const bp = prompt('Qon bosimi (masalan, 120/80):', '120/80');
    const temp = prompt('Tana harorati (°C):', '36.6');

    if (!hr || !bp || !temp) return;

    try {
      await updateDoc(doc(db, 'users', user!.uid), {
        vitals: {
          heartRate: parseInt(hr),
          bloodPressure: bp,
          temperature: parseFloat(temp),
          lastUpdated: new Date().toISOString()
        }
      });
      alert('Salomatlik ko\'rsatkichlari saqlandi!');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user!.uid}`);
    }
  };

  const simulateFall = async () => {
    if (confirm('Yiqilishni simulyatsiya qilishni xohlaysizmi? Bu qarovchiga SOS xabarini yuboradi.')) {
      await triggerAlert('FALL', 'DIQQAT: Yiqilish aniqlandi! Keksa kishi yordamga muhtoj bo\'lishi mumkin.');
      alert('Yiqilish haqida ogohlantirish yuborildi!');
    }
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (countdown !== null && countdown > 0) {
      timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    } else if (countdown === 0) {
      sendSOS();
      setCountdown(null);
    }
    return () => clearTimeout(timer);
  }, [countdown]);

  const [isListening, setIsListening] = useState(false);

  const startVoiceSOS = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert('Sizning brauzeringiz ovozni aniqlashni qo\'llab-quvvatlamaydi.');
      return;
    }

    // @ts-ignore
    const recognition = new window.webkitSpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'uz-UZ';

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('')
        .toLowerCase();

      if (transcript.includes('yordam') || transcript.includes('sos') || transcript.includes('qutqaring')) {
        recognition.stop();
        handleSOS();
      }
    };

    recognition.start();
  };

  const handleSOS = () => {
    if (countdown !== null) {
      setCountdown(null);
    } else {
      setCountdown(3);
    }
  };

  const sendSOS = async () => {
    setIsSendingSOS(true);
    await triggerAlert('SOS', 'Emergency SOS Button Pressed!');
    setIsSendingSOS(false);
  };

  const handleTakeMed = async (id: string) => {
    try {
      await updateDoc(doc(db, 'medications', id), {
        taken: true,
        lastTaken: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `medications/${id}`);
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'home':
        return (
          <main className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="space-y-8">
              <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center"
              >
                <SOSButton onPress={handleSOS} isSending={isSendingSOS} countdown={countdown} />
                <p className="mt-4 text-zinc-500 font-mono text-[10px] uppercase tracking-[0.2em]">Yordam uchun bosing</p>
              </motion.section>

              <div className="grid grid-cols-3 gap-4">
                <button 
                  onClick={logVitals}
                  className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-zinc-800 transition-colors group"
                >
                  <div className="w-12 h-12 bg-red-600/10 text-red-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Heart size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Vitals</span>
                </button>
                <button 
                  onClick={startVoiceSOS}
                  className={`bg-zinc-900 border p-6 rounded-3xl flex flex-col items-center gap-3 transition-all group ${isListening ? 'border-red-600 bg-red-900/20 animate-pulse' : 'border-zinc-800 hover:bg-zinc-800'}`}
                >
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform ${isListening ? 'bg-red-600 text-black' : 'bg-red-600/10 text-red-500'}`}>
                    <Mic size={24} />
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-widest ${isListening ? 'text-red-500' : 'text-zinc-400'}`}>
                    {isListening ? 'Listening' : 'Voice SOS'}
                  </span>
                </button>
                <button 
                  onClick={simulateFall}
                  className="bg-zinc-900 border border-zinc-800 p-6 rounded-3xl flex flex-col items-center gap-3 hover:bg-red-900/20 transition-colors group"
                >
                  <div className="w-12 h-12 bg-orange-600/10 text-orange-500 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <AlertTriangle size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Fall Sim</span>
                </button>
              </div>
            </div>

            <motion.section 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <MedicationList medications={meds} onTake={handleTakeMed} onListen={handleListen} />
            </motion.section>
          </main>
        );
      case 'location':
        return (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 h-[500px] relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-[url('https://picsum.photos/seed/map-elder/1200/800')] bg-cover bg-center grayscale invert" />
              <div className="relative z-10 h-full flex flex-col justify-between">
                <div>
                  <h3 className="text-red-500 font-mono text-xs uppercase tracking-widest mb-2">Current Location</h3>
                  <p className="text-3xl font-black tracking-tighter uppercase">Safe Zone: {user?.safeZone ? 'Active' : 'Not Set'}</p>
                </div>
                <div className="bg-black/80 backdrop-blur-sm border border-red-600/50 p-6 rounded-2xl flex items-center gap-4">
                  <div className="w-4 h-4 bg-green-500 rounded-full animate-ping" />
                  <div>
                    <p className="font-bold">Tashkent, Uzbekistan</p>
                    <p className="text-zinc-500 text-sm font-mono">GPS: {currentLocation.lat.toFixed(4)}° N, {currentLocation.lng.toFixed(4)}° E</p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      case 'contacts':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-6"
          >
            <h2 className="text-3xl font-black tracking-tighter uppercase">Emergency Contacts</h2>
            <div className="space-y-4">
              {contacts.map(contact => (
                <div key={contact.id} className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex justify-between items-center">
                  <div>
                    <p className="text-xl font-bold">{contact.name}</p>
                    <p className="text-zinc-500 text-sm uppercase font-mono">{contact.relation}</p>
                  </div>
                  <a href={`tel:${contact.phone}`} className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center hover:bg-red-500 transition-colors">
                    <Phone className="text-black" size={24} />
                  </a>
                </div>
              ))}
              {contacts.length === 0 && (
                <p className="text-zinc-500 text-center py-12">No emergency contacts added yet.</p>
              )}
            </div>
          </motion.div>
        );
      case 'chat':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto h-[600px]"
          >
            <Chat currentUserId={user!.uid} otherUserId={user!.caregiverId || ''} />
          </motion.div>
        );
      case 'profile':
        return (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto space-y-8"
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 flex flex-col items-center text-center">
              <div className="w-32 h-32 rounded-3xl bg-zinc-800 border-2 border-red-600 mb-6 overflow-hidden">
                <img src={user?.photoURL || 'https://picsum.photos/seed/elder/400/400'} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <h2 className="text-4xl font-black tracking-tighter uppercase mb-2">{user?.displayName}</h2>
              <p className="text-red-500 font-mono text-sm uppercase tracking-widest mb-4">Elder Account</p>
              
              <div className="w-full bg-black/50 border border-zinc-800 rounded-2xl p-4 mb-8">
                <p className="text-zinc-500 text-[10px] uppercase font-bold mb-1">Your User ID (Give this to your caregiver)</p>
                <code className="text-white font-mono text-lg select-all">{user?.uid}</code>
              </div>

              <div className="w-full space-y-4">
                <div className="flex justify-between items-center p-4 bg-zinc-800/50 rounded-xl">
                  <span className="text-zinc-400 text-sm">Caregiver</span>
                  <span className="font-bold">{caregiverProfile?.displayName || 'Not Connected'}</span>
                </div>
              </div>
              
              <button 
                onClick={signOut}
                className="mt-12 w-full py-4 rounded-2xl border-2 border-zinc-800 text-zinc-500 font-bold uppercase tracking-widest hover:bg-zinc-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-6 pb-32">
      <header className="flex justify-between items-center mb-12">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-600 rounded-xl flex items-center justify-center">
            <Activity className="text-black" size={28} />
          </div>
          <h1 className="text-3xl font-black tracking-tighter uppercase">SilverGuard</h1>
        </div>
        <div className="flex items-center gap-4 bg-zinc-900 px-4 py-2 rounded-full border border-zinc-800">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-400">System Online</span>
        </div>
      </header>

      {renderContent()}

      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 p-4 flex justify-around items-center z-50">
        <button onClick={() => setCurrentTab('home')} className={`flex flex-col items-center gap-1 ${currentTab === 'home' ? 'text-red-500' : 'text-zinc-500'}`}>
          <Activity size={32} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Home</span>
        </button>
        <button onClick={() => setCurrentTab('location')} className={`flex flex-col items-center gap-1 ${currentTab === 'location' ? 'text-red-500' : 'text-zinc-500'}`}>
          <MapPin size={32} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Location</span>
        </button>
        <button onClick={() => setCurrentTab('contacts')} className={`flex flex-col items-center gap-1 ${currentTab === 'contacts' ? 'text-red-500' : 'text-zinc-500'}`}>
          <Phone size={32} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Contacts</span>
        </button>
        <button onClick={() => setCurrentTab('chat')} className={`flex flex-col items-center gap-1 ${currentTab === 'chat' ? 'text-red-500' : 'text-zinc-500'}`}>
          <MessageCircle size={32} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Chat</span>
        </button>
        <button onClick={() => setCurrentTab('profile')} className={`flex flex-col items-center gap-1 ${currentTab === 'profile' ? 'text-red-500' : 'text-zinc-500'}`}>
          <User size={32} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Profile</span>
        </button>
      </nav>
    </div>
  );
};
