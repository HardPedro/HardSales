import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, doc, orderBy, where, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, FileText, CheckCircle, XCircle, Clock, Calendar as CalendarIcon, Phone, Users, DollarSign, Settings, Image as ImageIcon, Trash2 } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay, isAfter, startOfDay, startOfWeek, endOfWeek, isWithinInterval, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Reports: React.FC = () => {
  const { userData } = useAuth();
  const [reports, setReports] = useState<any[]>([]);
  const [quotas, setQuotas] = useState({ calls: 0, approaches: 0 });
  const [loading, setLoading] = useState(true);
  
  // Modals
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isQuotasModalOpen, setIsQuotasModalOpen] = useState(false);
  
  // Forms
  const [newReport, setNewReport] = useState<{ calls: string, approaches: string, proofFiles: File[] }>({ calls: '', approaches: '', proofFiles: [] });
  const [newQuotas, setNewQuotas] = useState({ calls: '', approaches: '' });
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Calendar State
  const [currentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  useEffect(() => {
    if (!userData) return;

    // Fetch Quotas
    const fetchQuotas = async () => {
      try {
        const docRef = doc(db, 'settings', 'quotas');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setQuotas(docSnap.data() as { calls: number, approaches: number });
        }
      } catch (error) {
        console.error("Error fetching quotas:", error);
      }
    };
    fetchQuotas();

    // Fetch Reports
    let q;
    if (userData.role === 'admin') {
      q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    } else {
      q = query(collection(db, 'reports'), where('userId', '==', userData.uid), orderBy('createdAt', 'desc'));
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching reports:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, [userData]);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          
          // Compress to JPEG with 0.6 quality to ensure it stays well under 1MB Firestore limit
          const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
          resolve(dataUrl);
        };
        img.onerror = (error) => reject(error);
      };
      reader.onerror = (error) => reject(error);
    });
  };

  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    if (newReport.proofFiles.length === 0) {
      setError("É obrigatório enviar pelo menos 1 comprovante.");
      return;
    }

    if (newReport.proofFiles.length > 10) {
      setError("Máximo de 10 comprovantes permitidos.");
      return;
    }

    setUploading(true);
    try {
      // Compress images and convert to base64 strings
      const proofUrls = await Promise.all(newReport.proofFiles.map(file => compressImage(file)));

      await addDoc(collection(db, 'reports'), {
        userId: userData.uid,
        userName: userData.name || userData.username || 'Usuário',
        date: format(selectedDate, 'yyyy-MM-dd'),
        calls: Number(newReport.calls) || 0,
        approaches: Number(newReport.approaches) || 0,
        proofUrls: proofUrls,
        createdAt: new Date().toISOString()
      });
      setIsReportModalOpen(false);
      setNewReport({ calls: '', approaches: '', proofFiles: [] });
      setError(null);
    } catch (error: any) {
      console.error("Error adding report:", error);
      setError("Erro ao salvar relatório: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateQuotas = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userData?.role !== 'admin') return;

    try {
      const updatedQuotas = {
        calls: Number(newQuotas.calls) || 0,
        approaches: Number(newQuotas.approaches) || 0
      };
      await setDoc(doc(db, 'settings', 'quotas'), updatedQuotas);
      setQuotas(updatedQuotas);
      setIsQuotasModalOpen(false);
    } catch (error) {
      console.error("Error updating quotas:", error);
    }
  };

  const handleDeleteReport = async (reportId: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este relatório?")) return;
    try {
      await deleteDoc(doc(db, 'reports', reportId));
    } catch (error) {
      console.error("Error deleting report:", error);
      alert("Erro ao excluir relatório.");
    }
  };

  const openReportModal = () => {
    setError(null);
    setIsReportModalOpen(true);
  };

  const openQuotasModal = () => {
    setNewQuotas({ calls: quotas.calls.toString(), approaches: quotas.approaches.toString() });
    setIsQuotasModalOpen(true);
  };

  // Calendar logic
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Filter reports for selected date
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const reportsForSelectedDate = reports.filter(r => r.date === selectedDateStr);
  const hasReportForToday = reports.some(r => r.date === format(new Date(), 'yyyy-MM-dd') && r.userId === userData?.uid);

  // User Progress Calculations
  const userReports = reports.filter(r => r.userId === userData?.uid);
  
  // Daily Progress
  const dailyUserReports = userReports.filter(r => r.date === selectedDateStr);
  const dailyCalls = dailyUserReports.reduce((sum, r) => sum + r.calls, 0);
  const dailyApproaches = dailyUserReports.reduce((sum, r) => sum + r.approaches, 0);

  // Weekly Progress
  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 }); // Monday
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 }); // Sunday
  const weeklyUserReports = userReports.filter(r => {
    const rDate = parseISO(r.date);
    return isWithinInterval(rDate, { start: weekStart, end: weekEnd });
  });
  const weeklyCalls = weeklyUserReports.reduce((sum, r) => sum + r.calls, 0);
  const weeklyApproaches = weeklyUserReports.reduce((sum, r) => sum + r.approaches, 0);

  const renderProgress = (current: number, target: number, type: 'daily' | 'weekly', colorClass: string, bgClass: string) => {
    const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
    const extra = current > target ? current - target : 0;

    return (
      <div className="mt-3">
        <div className="flex justify-between items-end mb-1">
          <span className="text-xs font-medium text-slate-400">
            {type === 'daily' ? 'Hoje' : 'Semana'}: <strong className="text-slate-200">{current}</strong> / {target}
          </span>
          {extra > 0 && type === 'daily' && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded bg-${colorClass}-500/20 text-${colorClass}-400 border border-${colorClass}-500/30`}>
              +{extra} extra{extra > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div className={`h-2 rounded-full ${bgClass} transition-all duration-500`} style={{ width: `${percent}%` }}></div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="text-slate-400">Carregando relatórios...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Relatórios Diários</h1>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
          {userData?.role === 'admin' && (
            <button
              onClick={openQuotasModal}
              className="flex items-center justify-center px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors w-full sm:w-auto"
            >
              <Settings className="w-5 h-5 mr-2" />
              Configurar Cotas
            </button>
          )}
          
          {(userData?.role === 'user' || userData?.role === 'admin') && (
            <button
              onClick={openReportModal}
              disabled={!isToday(selectedDate) || hasReportForToday}
              className={`flex items-center justify-center px-4 py-2 rounded-lg transition-colors w-full sm:w-auto ${
                !isToday(selectedDate) || hasReportForToday
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_10px_rgba(8,145,178,0.3)]'
              }`}
            >
              <Plus className="w-5 h-5 mr-2" />
              {hasReportForToday ? 'Relatório Enviado' : 'Enviar Relatório de Hoje'}
            </button>
          )}
        </div>
      </div>

      {/* Quotas Display */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-4 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 mr-5">
                <Phone className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Meta Diária de Ligações</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">{quotas.calls}</p>
              </div>
            </div>
            <div className="text-right border-l border-slate-800 pl-6">
              <p className="text-xs font-medium text-slate-500">Meta Semanal</p>
              <p className="text-lg font-bold text-blue-400 mt-1">{quotas.calls * 5}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800/50">
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Seu Progresso</p>
            {renderProgress(dailyCalls, quotas.calls, 'daily', 'blue', 'bg-blue-500')}
            {renderProgress(weeklyCalls, quotas.calls * 5, 'weekly', 'blue', 'bg-blue-500')}
          </div>
        </div>
        
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="p-4 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 mr-5">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Meta Diária de Abordagens</p>
                <p className="text-2xl font-bold text-slate-100 mt-1">{quotas.approaches}</p>
              </div>
            </div>
            <div className="text-right border-l border-slate-800 pl-6">
              <p className="text-xs font-medium text-slate-500">Meta Semanal</p>
              <p className="text-lg font-bold text-purple-400 mt-1">{quotas.approaches * 5}</p>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-800/50">
            <p className="text-xs font-semibold text-slate-300 mb-2 uppercase tracking-wider">Seu Progresso</p>
            {renderProgress(dailyApproaches, quotas.approaches, 'daily', 'purple', 'bg-purple-500')}
            {renderProgress(weeklyApproaches, quotas.approaches * 5, 'weekly', 'purple', 'bg-purple-500')}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-1 bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6">
          <h2 className="text-lg font-bold text-slate-100 mb-4 flex items-center">
            <CalendarIcon className="w-5 h-5 mr-2 text-cyan-400" />
            {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((day, i) => (
              <div key={i} className="text-xs font-medium text-slate-500 py-1">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: monthStart.getDay() }).map((_, i) => (
              <div key={`empty-${i}`} className="p-2" />
            ))}
            {daysInMonth.map((day, i) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const hasReport = reports.some(r => r.date === dateStr && (userData?.role === 'admin' || r.userId === userData?.uid));
              const isSelected = isSameDay(day, selectedDate);
              const isFuture = isAfter(startOfDay(day), startOfDay(new Date()));
              
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(day)}
                  disabled={isFuture}
                  className={`
                    p-2 rounded-lg text-sm font-medium transition-all relative
                    ${isFuture ? 'text-slate-600 cursor-not-allowed' : 'hover:bg-slate-800'}
                    ${isSelected ? 'bg-cyan-600 text-white hover:bg-cyan-500' : 'text-slate-300'}
                    ${isToday(day) && !isSelected ? 'border border-cyan-500/50 text-cyan-400' : ''}
                  `}
                >
                  {format(day, 'd')}
                  {hasReport && !isSelected && (
                    <span className="absolute bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-emerald-400 rounded-full"></span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reports List for Selected Date */}
        <div className="lg:col-span-2 bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6 flex flex-col">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <FileText className="w-5 h-5 mr-2 text-cyan-400" />
              Relatórios de {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
            </div>
            {isToday(selectedDate) && (
              <span className="text-xs font-medium bg-cyan-500/10 text-cyan-400 px-2 py-1 rounded-full border border-cyan-500/20">
                Hoje
              </span>
            )}
          </h2>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-4">
            {reportsForSelectedDate.length === 0 ? (
              <div className="text-center py-12 text-slate-500 border border-dashed border-slate-800 rounded-xl">
                Nenhum relatório enviado neste dia.
              </div>
            ) : (
              reportsForSelectedDate.map((report) => (
                <div key={report.id} className="bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="font-bold text-slate-200">{report.userName}</h3>
                      <p className="text-xs text-slate-500">{format(new Date(report.createdAt), "HH:mm")}</p>
                    </div>
                    {userData?.role === 'admin' && (
                      <button
                        onClick={() => handleDeleteReport(report.id)}
                        className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                        title="Excluir relatório"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/50">
                      <div className="flex items-center text-xs text-slate-400 mb-1">
                        <Phone className="w-3.5 h-3.5 mr-1.5" /> Ligações
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-lg font-bold text-slate-200">{report.calls}</span>
                        <span className="text-xs text-slate-500 mb-1">/ {quotas.calls}</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/50">
                      <div className="flex items-center text-xs text-slate-400 mb-1">
                        <Users className="w-3.5 h-3.5 mr-1.5" /> Abordagens
                      </div>
                      <div className="flex items-end gap-2">
                        <span className="text-lg font-bold text-slate-200">{report.approaches}</span>
                        <span className="text-xs text-slate-500 mb-1">/ {quotas.approaches}</span>
                      </div>
                    </div>
                    <div className="bg-slate-900 p-3 rounded-lg border border-slate-800/50">
                      <div className="flex items-center text-xs text-slate-400 mb-1">
                        <ImageIcon className="w-3.5 h-3.5 mr-1.5" /> Comprovantes
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {report.proofUrls && report.proofUrls.length > 0 ? (
                          report.proofUrls.map((url: string, index: number) => (
                            <a 
                              key={index}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center bg-cyan-500/10 px-2 py-1 rounded"
                            >
                              Ver img {index + 1}
                            </a>
                          ))
                        ) : report.proofUrl ? (
                          <a 
                            href={report.proofUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 flex items-center bg-cyan-500/10 px-2 py-1 rounded"
                          >
                            Ver imagem
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Sem comprovante</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* New Report Modal */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">Relatório de Hoje</h2>
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            <form onSubmit={handleAddReport} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Ligações</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    value={newReport.calls}
                    onChange={e => setNewReport({...newReport, calls: e.target.value})}
                  />
                  <p className="text-xs text-slate-500 mt-1">Meta: {quotas.calls}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Abordagens</label>
                  <input
                    type="number"
                    required
                    min="0"
                    className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    value={newReport.approaches}
                    onChange={e => setNewReport({...newReport, approaches: e.target.value})}
                  />
                  <p className="text-xs text-slate-500 mt-1">Meta: {quotas.approaches}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Comprovantes das Ligações (Obrigatório, máx 10)</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
                  onChange={e => {
                    const files = Array.from(e.target.files || []);
                    if (files.length > 10) {
                      setError("Você só pode selecionar até 10 imagens.");
                      return;
                    }
                    setError(null);
                    setNewReport({...newReport, proofFiles: files});
                  }}
                />
                <p className="text-xs text-slate-500 mt-1">Selecione até 10 imagens. Elas serão comprimidas automaticamente.</p>
                {newReport.proofFiles.length > 0 && (
                  <div className="mt-2 text-xs text-slate-400">
                    {newReport.proofFiles.length} arquivo(s) selecionado(s).
                  </div>
                )}
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(false)}
                  disabled={uploading}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full sm:w-auto order-2 sm:order-1 disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 text-slate-950 font-semibold bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)] w-full sm:w-auto order-1 sm:order-2 disabled:opacity-50 flex items-center justify-center"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-950 mr-2"></div>
                      Enviando...
                    </>
                  ) : (
                    'Enviar Relatório'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quotas Modal (Admin) */}
      {isQuotasModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">Configurar Cotas Diárias</h2>
            <form onSubmit={handleUpdateQuotas} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Meta de Ligações</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newQuotas.calls}
                  onChange={e => setNewQuotas({...newQuotas, calls: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Meta de Abordagens</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newQuotas.approaches}
                  onChange={e => setNewQuotas({...newQuotas, approaches: e.target.value})}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsQuotasModalOpen(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-slate-950 font-semibold bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)] w-full sm:w-auto order-1 sm:order-2"
                >
                  Salvar Cotas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

