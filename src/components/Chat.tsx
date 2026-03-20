import React, { useState, useEffect, useRef } from 'react';
import { Send } from 'lucide-react';
import { Message } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  orderBy, 
  limit 
} from 'firebase/firestore';

interface ChatProps {
  currentUserId: string;
  otherUserId: string;
}

export const Chat: React.FC<ChatProps> = ({ currentUserId, otherUserId }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!otherUserId) return;

    // Listen for messages between these two users
    // Note: Firestore doesn't support OR queries easily for this, 
    // so we'll fetch all messages where currentUserId is sender OR receiver
    // and filter client-side for simplicity in this demo.
    // In production, you'd use a composite key or separate rooms.
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Message))
        .filter(m => 
          (m.senderId === currentUserId && m.receiverId === otherUserId) ||
          (m.senderId === otherUserId && m.receiverId === currentUserId)
        );
      setMessages(msgs);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'messages'));

    return () => unsubscribe();
  }, [currentUserId, otherUserId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !otherUserId) return;

    try {
      await addDoc(collection(db, 'messages'), {
        senderId: currentUserId,
        receiverId: otherUserId,
        text: newMessage,
        timestamp: new Date().toISOString()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden">
      <div className="p-4 border-b border-zinc-800 bg-black/50">
        <h3 className="text-xs font-mono uppercase tracking-widest text-red-500">Secure Chat</h3>
      </div>
      
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`
              max-w-[80%] p-3 rounded-2xl text-sm
              ${msg.senderId === currentUserId 
                ? 'bg-red-600 text-black rounded-tr-none' 
                : 'bg-zinc-800 text-white rounded-tl-none'}
            `}>
              <p>{msg.text}</p>
              <p className={`text-[8px] mt-1 opacity-50 font-mono ${msg.senderId === currentUserId ? 'text-black' : 'text-zinc-400'}`}>
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        {messages.length === 0 && (
          <div className="h-full flex items-center justify-center text-zinc-600 text-xs font-mono uppercase">
            No messages yet
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      <form onSubmit={sendMessage} className="p-4 bg-black/50 border-t border-zinc-800 flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-red-600 transition-colors"
        />
        <button 
          type="submit"
          className="w-10 h-10 bg-red-600 text-black rounded-xl flex items-center justify-center hover:bg-red-500 transition-colors"
        >
          <Send size={20} />
        </button>
      </form>
    </div>
  );
};
