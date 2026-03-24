import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Calendar, CheckCircle2, XCircle, Settings, Clock, Users, UserCheck } from 'lucide-react';
import { startOfWeek, addDays, format, isBefore, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const DAYS_OF_WEEK = [
  { value: 0, label: 'Domingo' },
  { value: 1, label: 'Segunda-feira' },
  { value: 2, label: 'Terça-feira' },
  { value: 3, label: 'Quarta-feira' },
  { value: 4, label: 'Quinta-feira' },
  { value: 5, label: 'Sexta-feira' },
  { value: 6, label: 'Sábado' },
];

export const Meetings: React.FC = () => {
  const { userData } = useAuth();
  const [defaultDay, setDefaultDay] = useState<number>(1); // Default to Monday
  const [isScheduled, setIsScheduled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [hasAttended, setHasAttended] = useState(false);
  const [markingAttendance, setMarkingAttendance] = useState(false);

  const isAdmin = userData?.role === 'admin';

  // Compute current week's meeting date
  const today = new Date();
  const startOfCurrentWeek = startOfWeek(today, { weekStartsOn: 0 }); // Sunday
  const meetingDate = addDays(startOfCurrentWeek, defaultDay);
  const meetingDateString = format(meetingDate, 'yyyy-MM-dd');

  useEffect(() => {
    // Listen to default day settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'meetingConfig'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().defaultDayOfWeek !== undefined) {
        setDefaultDay(docSnap.data().defaultDayOfWeek);
      }
      setLoading(false);
    });

    return () => unsubscribeSettings();
  }, []);

  useEffect(() => {
    if (loading) return;
    
    // Listen to this week's meeting status
    const unsubscribeMeeting = onSnapshot(doc(db, 'meetings', meetingDateString), (docSnap) => {
      if (docSnap.exists() && docSnap.data().status === 'scheduled') {
        setIsScheduled(true);
      } else {
        setIsScheduled(false);
      }
    });

    // Listen to attendances for this meeting
    const attendancesRef = collection(db, 'meetings', meetingDateString, 'attendances');
    const unsubscribeAttendances = onSnapshot(query(attendancesRef), (snapshot) => {
      const attList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAttendances(attList);
      
      if (userData) {
        setHasAttended(attList.some(att => att.id === userData.uid));
      }
    });

    return () => {
      unsubscribeMeeting();
      unsubscribeAttendances();
    };
  }, [meetingDateString, loading, userData]);

  const handleSaveDefaultDay = async (newDay: number) => {
    if (!isAdmin) return;
    setSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'meetingConfig'), {
        defaultDayOfWeek: newDay,
        updatedAt: new Date().toISOString(),
        updatedBy: userData?.name
      }, { merge: true });
    } catch (error) {
      console.error("Error saving meeting config:", error);
      alert("Erro ao salvar configuração.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleToggleMeeting = async () => {
    if (!isAdmin || !userData) return;
    setScheduling(true);
    try {
      const meetingRef = doc(db, 'meetings', meetingDateString);
      if (isScheduled) {
        // Cancel meeting
        await deleteDoc(meetingRef);
      } else {
        // Schedule meeting
        await setDoc(meetingRef, {
          date: meetingDateString,
          status: 'scheduled',
          createdAt: new Date().toISOString(),
          createdBy: userData.name
        });
      }
    } catch (error) {
      console.error("Error toggling meeting:", error);
      alert("Erro ao alterar status da reunião.");
    } finally {
      setScheduling(false);
    }
  };

  const handleMarkAttendance = async () => {
    if (!userData || !isScheduled) return;
    setMarkingAttendance(true);
    try {
      const attendanceRef = doc(db, 'meetings', meetingDateString, 'attendances', userData.uid);
      await setDoc(attendanceRef, {
        userId: userData.uid,
        name: userData.name,
        markedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error marking attendance:", error);
      alert("Erro ao marcar presença.");
    } finally {
      setMarkingAttendance(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  const isPast = isBefore(meetingDate, new Date()) && !isSameDay(meetingDate, new Date());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
          <Calendar className="w-6 h-6 text-cyan-400" />
          Reuniões Semanais
        </h1>
        <p className="text-slate-400 mt-1">Acompanhe o status da reunião desta semana.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 flex flex-col items-center justify-center text-center">
          <h2 className="text-lg font-semibold text-slate-200 mb-6 w-full text-left">Status desta Semana</h2>
          
          {isScheduled ? (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-400" />
              </div>
              <h3 className="text-xl font-bold text-green-400 mb-2">Reunião Confirmada</h3>
              <p className="text-slate-300 text-lg mb-1">
                {DAYS_OF_WEEK.find(d => d.value === defaultDay)?.label}
              </p>
              <p className="text-slate-400">
                {format(meetingDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
              {isPast && (
                <span className="mt-4 px-3 py-1 bg-slate-800 text-slate-400 text-sm rounded-full">
                  Esta reunião já ocorreu
                </span>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4">
                <Clock className="w-10 h-10 text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-slate-400 mb-2">Nenhuma Reunião</h3>
              <p className="text-slate-500 text-center max-w-xs">
                A reunião desta semana ainda não foi confirmada pelos administradores.
              </p>
            </div>
          )}

          {/* User Attendance Button */}
          {!isAdmin && isScheduled && (
            <div className="mt-8 pt-6 border-t border-slate-800 w-full">
              {hasAttended ? (
                <div className="flex items-center justify-center p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 font-medium">
                  <CheckCircle2 className="w-5 h-5 mr-2" />
                  Presença Confirmada
                </div>
              ) : (
                <button
                  onClick={handleMarkAttendance}
                  disabled={markingAttendance}
                  className="w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white disabled:opacity-50"
                >
                  {markingAttendance ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                  ) : (
                    <>
                      <UserCheck className="w-5 h-5" />
                      Marcar Presença
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {isAdmin && (
            <div className="mt-8 pt-6 border-t border-slate-800 w-full">
              <button
                onClick={handleToggleMeeting}
                disabled={scheduling}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                  isScheduled 
                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' 
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                } disabled:opacity-50`}
              >
                {scheduling ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-current"></div>
                ) : isScheduled ? (
                  <>
                    <XCircle className="w-5 h-5" />
                    Cancelar Reunião
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5" />
                    Marcar Reunião
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Settings and Attendances Column */}
        <div className="space-y-6">
          {/* Settings Card (Admin Only) */}
          {isAdmin && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center gap-2 mb-6">
                <Settings className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-200">Configurações</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-2">
                    Dia Padrão da Reunião
                  </label>
                  <p className="text-sm text-slate-500 mb-4">
                    Defina o dia da semana em que as reuniões normalmente ocorrem. Isso atualizará a data exibida para a equipe.
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {DAYS_OF_WEEK.map((day) => (
                      <button
                        key={day.value}
                        onClick={() => handleSaveDefaultDay(day.value)}
                        disabled={savingSettings}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                          defaultDay === day.value
                            ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                            : 'bg-slate-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {day.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Attendances List (Admin Only) */}
          {isAdmin && isScheduled && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" />
                  <h2 className="text-lg font-semibold text-slate-200">Presenças Confirmadas</h2>
                </div>
                <span className="bg-slate-800 text-cyan-400 px-3 py-1 rounded-full text-sm font-bold">
                  {attendances.length}
                </span>
              </div>
              
              {attendances.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Ninguém marcou presença ainda.</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                  {attendances.map((att) => (
                    <div key={att.id} className="flex items-center justify-between p-3 bg-slate-950 border border-slate-800 rounded-lg">
                      <span className="font-medium text-slate-200">{att.name}</span>
                      <span className="text-xs text-slate-500">
                        {new Date(att.markedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
