import React, { useState, useRef, useEffect } from 'react';
import { Message, AIPersona, ApiKeys } from './types.ts';
import { INITIAL_MODELS } from './constants.tsx';
import { callAI } from './services/apiService.ts';
import * as pdfjsLib from 'pdfjs-dist';

// Setting up the worker for PDF.js using the esm.sh version
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs`;

// Zengin metin formatlayıcı bileşeni
const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  // Regex kuralları
  const tokens = [
    { name: 'bold', regex: /\*\*(.*?)\*\*/g, className: 'font-bold' },
    { name: 'italic', regex: /\*(.*?)\*/g, className: 'italic' },
    { name: 'thin', regex: /~(.*?)~/g, className: 'font-light' },
    { name: 'blue', regex: /\[mavi\](.*?)\[\/mavi\]/g, className: 'text-blue-500 font-medium' },
    { name: 'red', regex: /\[kirmizi\](.*?)\[\/kirmizi\]/g, className: 'text-red-500 font-medium' },
    { name: 'green', regex: /\[yesil\](.*?)\[\/yesil\]/g, className: 'text-green-500 font-medium' },
    { name: 'orange', regex: /\[turuncu\](.*?)\[\/turuncu\]/g, className: 'text-orange-500 font-medium' },
    { name: 'purple', regex: /\[mor\](.*?)\[\/mor\]/g, className: 'text-purple-500 font-medium' },
  ];

  // Basit bir parser: HTML string'e dönüştürüp dangerouslySetInnerHTML kullanmak yerine
  // güvenli bir şekilde React elementlerine dönüştürelim.
  // Not: Bu basit implementasyon iç içe geçmeyi (nesting) sadece tek seviye destekler.
  
  // Fix: Replaced JSX.Element with React.ReactNode to resolve namespace issues in some TS environments
  let formattedParts: (string | React.ReactNode)[] = [text];

  tokens.forEach(token => {
    // Fix: Replaced JSX.Element with React.ReactNode to resolve namespace issues in some TS environments
    const newParts: (string | React.ReactNode)[] = [];
    formattedParts.forEach(part => {
      if (typeof part !== 'string') {
        newParts.push(part);
        return;
      }

      const splitParts = part.split(token.regex);
      splitParts.forEach((subPart, index) => {
        if (index % 2 === 1) {
          newParts.push(<span key={`${token.name}-${index}`} className={token.className}>{subPart}</span>);
        } else if (subPart !== "") {
          newParts.push(subPart);
        }
      });
    });
    formattedParts = newParts;
  });

  return <>{formattedParts}</>;
};

export default function App() {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('chatMessages');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) }));
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  const [inputText, setInputText] = useState('');
  const [isTypingId, setIsTypingId] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  const [activeModels, setActiveModels] = useState<AIPersona[]>(() => {
    const saved = localStorage.getItem('activeModels');
    return saved ? JSON.parse(saved) : INITIAL_MODELS;
  });

  const [keys, setKeys] = useState<ApiKeys>(() => {
    const saved = localStorage.getItem('apiKeys');
    return saved ? JSON.parse(saved) : { openai: '', anthropic: '' };
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    localStorage.setItem('activeModels', JSON.stringify(activeModels));
    localStorage.setItem('apiKeys', JSON.stringify(keys));
  }, [activeModels, keys]);

  useEffect(() => {
    localStorage.setItem('chatMessages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTypingId, isProcessingFile]);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = "";

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: any) => (item as any).str).join(" ");
      fullText += pageText + "\n";
    }

    return fullText.trim();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Lütfen sadece PDF dosyası yükleyin.');
      return;
    }

    setIsProcessingFile(true);
    try {
      const text = await extractTextFromPDF(file);
      if (!text) throw new Error("PDF'den metin okunamadı.");

      const newMessage: Message = {
        id: `file-${Date.now()}`,
        role: 'user',
        content: `📄 [Döküman Eklendi: **${file.name}**]\n\nİçerik özeti:\n~${text.substring(0, 500)}...~\n\n(Dosya içeriği [mavi]bağlam[/mavi] olarak yüklendi.)`,
        senderName: 'Siz (Dosya)',
        senderId: 'user',
        timestamp: new Date(),
        modelType: 'user'
      };

      setMessages(prev => [...prev, newMessage]);
    } catch (error) {
      console.error(error);
      alert('PDF işlenirken bir hata oluştu.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSendMessage = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputText,
      senderName: 'Siz',
      senderId: 'user',
      timestamp: new Date(),
      modelType: 'user'
    };

    setMessages(prev => [...prev, newMessage]);
    setInputText('');
  };

  const triggerModelResponse = async (persona: AIPersona) => {
    if (isTypingId || messages.length === 0) return;
    
    if (persona.provider === 'openai' && !keys.openai) {
      alert("Lütfen ayarlardan OpenAI API anahtarınızı girin.");
      setIsSettingsOpen(true);
      return;
    }
    if (persona.provider === 'anthropic' && !keys.anthropic) {
      alert("Lütfen ayarlardan Anthropic API anahtarınızı girin.");
      setIsSettingsOpen(true);
      return;
    }

    setIsTypingId(persona.id);
    try {
      const responseText = await callAI(persona, messages, keys);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        senderName: persona.name,
        senderId: persona.id,
        timestamp: new Date(),
        modelType: persona.id
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      console.error(err);
    } finally {
      setIsTypingId(null);
    }
  };

  const clearChat = () => {
    if (window.confirm("Tüm sohbet geçmişini silmek istediğinize emin misiniz?")) {
      setMessages([]);
      localStorage.removeItem('chatMessages');
    }
  };

  const toggleModel = (id: string) => {
    setActiveModels(prev => prev.map(m => m.id === id ? { ...m, isActive: !m.isActive } : m));
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-4xl mx-auto border-x border-gray-200 shadow-2xl relative overflow-hidden">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileUpload} 
        accept=".pdf" 
        className="hidden" 
      />

      {isSettingsOpen && (
        <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50">
              <h2 className="text-xl font-bold text-indigo-900">Nexus Yapılandırması</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">API Anahtarları</h3>
                <div className="space-y-3">
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-tighter">OpenAI Platform</label>
                    <input 
                      type="password" 
                      value={keys.openai} 
                      onChange={e => setKeys({...keys, openai: e.target.value})}
                      placeholder="sk-..."
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm outline-none"
                    />
                  </div>
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-tighter">Anthropic Platform</label>
                    <input 
                      type="password" 
                      value={keys.anthropic} 
                      onChange={e => setKeys({...keys, anthropic: e.target.value})}
                      placeholder="sk-ant-..."
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Aktif Sinir Ağları</h3>
                <div className="grid gap-3">
                  {activeModels.map(model => (
                    <div key={model.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl hover:bg-white border border-transparent hover:border-indigo-100 transition-all cursor-pointer" onClick={() => toggleModel(model.id)}>
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{model.icon}</span>
                        <div>
                          <p className="text-sm font-bold text-gray-800">{model.name}</p>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">{model.provider}</p>
                        </div>
                      </div>
                      <div className={`w-12 h-6 rounded-full p-1 transition-colors ${model.isActive ? 'bg-indigo-600' : 'bg-gray-300'}`}>
                        <div className={`w-4 h-4 bg-white rounded-full transition-transform ${model.isActive ? 'translate-x-6' : 'translate-x-0'}`}></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <button 
                onClick={clearChat}
                className="w-full py-2 text-sm text-red-400 font-bold hover:bg-red-50 rounded-xl transition-colors uppercase tracking-widest"
              >
                Nexus Hafızasını Boşalt
              </button>
            </div>
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <button onClick={() => setIsSettingsOpen(false)} className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg shadow-indigo-100 transition-transform active:scale-95">
                SİSTEME DÖN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="p-4 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between shadow-sm z-10 sticky top-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-200">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="font-black text-xl text-gray-900 tracking-tighter leading-none italic">AI NEXUS</h1>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <p className="text-[9px] text-gray-400 font-bold tracking-widest uppercase">Multi-Sync Intelligence Network</p>
            </div>
          </div>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="w-10 h-10 flex items-center justify-center hover:bg-gray-100 rounded-2xl transition-all border border-transparent hover:border-gray-200 group">
          <svg className="w-6 h-6 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path>
          </svg>
        </button>
      </header>

      {/* Chat Messages */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-8 scroll-smooth bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center mb-6 animate-pulse">
               <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
            </div>
            <h2 className="text-lg font-black tracking-tighter uppercase italic text-gray-800">SİSTEM ÇALIŞMAYA HAZIR</h2>
            <p className="max-w-[280px] text-xs font-medium leading-relaxed mt-2">Bir mesaj gönderin veya PDF yükleyerek ağdaki yapay zekaları senkronize edin.</p>
          </div>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in slide-in-from-bottom-4 duration-500`}>
              <div className="flex items-center gap-2 mb-1 px-1">
                {msg.role !== 'user' && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">{msg.senderName}</span>
                  </div>
                )}
              </div>
              <div className={`max-w-[92%] p-5 rounded-3xl transition-all ${
                msg.role === 'user' 
                ? 'bg-gray-900 text-white rounded-tr-none shadow-2xl shadow-gray-200' 
                : 'bg-white border border-gray-100 text-gray-800 rounded-tl-none shadow-xl shadow-gray-100'
              }`}>
                <div className="text-sm leading-loose whitespace-pre-wrap">
                  <FormattedText text={msg.content} />
                </div>
                <div className={`flex justify-between items-center mt-3 opacity-30 text-[8px] font-bold uppercase tracking-widest`}>
                  <span>{msg.timestamp instanceof Date ? msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                  {msg.role === 'user' && <span>NEXUS SYNCED</span>}
                </div>
              </div>
            </div>
          ))
        )}
        {isProcessingFile && (
          <div className="flex items-center gap-4 p-5 bg-white rounded-3xl border border-indigo-100 shadow-xl shadow-indigo-50 animate-pulse">
             <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
               <svg className="w-6 h-6 text-white animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
             </div>
             <div>
                <p className="text-xs font-black text-indigo-900 uppercase tracking-tighter">PDF Tarama İşlemi</p>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">Veri Ayıklanıyor...</p>
             </div>
          </div>
        )}
        {isTypingId && (
          <div className="flex flex-col items-start gap-1">
             <div className="flex items-center gap-1.5 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                <span className="text-[9px] font-black text-indigo-500 italic uppercase">
                  {activeModels.find(m => m.id === isTypingId)?.name} Yanıt Üretiyor
                </span>
             </div>
             <div className="bg-white p-5 rounded-3xl rounded-tl-none border border-gray-100 shadow-sm flex gap-1.5">
                <div className="w-2 h-2 bg-indigo-200 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
                <div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce delay-300"></div>
             </div>
          </div>
        )}
      </main>

      {/* Model Trigger Bar */}
      <div className="bg-white/50 backdrop-blur-sm border-t border-gray-100 px-4 py-3 flex gap-4 overflow-x-auto scrollbar-hide">
        {activeModels.filter(m => m.isActive).map(model => (
          <button
            key={model.id}
            onClick={() => triggerModelResponse(model)}
            disabled={!!isTypingId || messages.length === 0 || isProcessingFile}
            className={`flex items-center gap-2.5 px-5 py-2.5 rounded-2xl text-[10px] font-black tracking-widest uppercase transition-all whitespace-nowrap border
              ${isTypingId === model.id ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg shadow-indigo-200 animate-pulse' : 'bg-white text-gray-600 border-gray-100 hover:border-indigo-200 hover:bg-gray-50 active:scale-95 shadow-sm'}
              ${(messages.length === 0 || isProcessingFile) ? 'opacity-20 grayscale cursor-not-allowed' : ''}
            `}
          >
            <span className="text-lg leading-none">{model.icon}</span>
            <span>{model.name}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <footer className="p-4 bg-white border-t border-gray-100">
        <form onSubmit={handleSendMessage} className="flex gap-3 items-center">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-12 h-12 flex items-center justify-center rounded-2xl bg-gray-50 text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-gray-200 hover:border-indigo-200 shadow-sm"
            title="PDF Analiz"
            disabled={isProcessingFile}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
          </button>
          
          <div className="flex-1 flex gap-2 bg-gray-100 p-2.5 rounded-2xl items-center focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-600/20 transition-all border border-transparent focus-within:border-indigo-100 shadow-inner">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Nexus ağına mesaj gönder..."
              className="flex-1 bg-transparent border-none px-3 py-1 text-sm outline-none font-medium placeholder:text-gray-400"
              disabled={isProcessingFile}
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isProcessingFile}
              className="bg-indigo-600 text-white w-10 h-10 flex items-center justify-center rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-30 shadow-lg shadow-indigo-200 active:scale-90"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path>
              </svg>
            </button>
          </div>
        </form>
      </footer>
    </div>
  );
}
