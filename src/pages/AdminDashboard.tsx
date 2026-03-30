import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, where, getDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { CheckCircle, XCircle, UserPlus, TrendingUp, Phone, Users, DollarSign, Activity, AlertTriangle, ChevronRight, ArrowLeft, FileText, Trash2, Target, Calendar, BookOpen } from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const AdminDashboard: React.FC = () => {
  const { userData } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [quotas, setQuotas] = useState({ calls: 0, approaches: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedSeller, setSelectedSeller] = useState<any | null>(null);
  const [sellerReports, setSellerReports] = useState<any[]>([]);
  const [sellerLeads, setSellerLeads] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reportToDelete, setReportToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.role !== 'admin') return;

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

    // Fetch pending access requests
    const qRequests = query(collection(db, 'access_requests'), where('status', '==', 'pending'));
    const unsubscribeRequests = onSnapshot(qRequests, (snapshot) => {
      setRequests(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Fetch all users to map IDs to names
    const qUsers = query(collection(db, 'users'));
    let usersMap: Record<string, any> = {};
    const unsubscribeUsers = onSnapshot(qUsers, (snapshot) => {
      snapshot.docs.forEach(doc => {
        usersMap[doc.data().uid] = doc.data();
      });
      updateMetrics();
    });

    // Fetch all leads
    const qLeads = query(collection(db, 'leads'));
    let allLeads: any[] = [];
    const unsubscribeLeads = onSnapshot(qLeads, (snapshot) => {
      allLeads = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateMetrics();
    });

    let allReports: any[] = [];
    // Fetch reports for metrics
    const qReports = query(collection(db, 'reports'));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      allReports = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      updateMetrics();
    });

    let allStudyConfirmations: any[] = [];
    const qStudy = query(collection(db, 'studyConfirmations'));
    const unsubscribeStudy = onSnapshot(qStudy, (snapshot) => {
      allStudyConfirmations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      updateMetrics();
    });

    let allAttendances: any[] = [];
    const qAttendances = query(collectionGroup(db, 'attendances'));
    const unsubscribeAttendances = onSnapshot(qAttendances, (snapshot) => {
      allAttendances = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), meetingId: doc.ref.parent.parent?.id }));
      updateMetrics();
    });

    function updateMetrics() {
      // Calculate metrics per user for the current month
      const now = new Date();
      const start = startOfMonth(now);
      const end = endOfMonth(now);

      const userMetrics: Record<string, any> = {};

      // Initialize all users with role 'user'
      Object.values(usersMap).forEach(user => {
        if (user.role === 'user') {
          userMetrics[user.uid] = {
            userId: user.uid,
            userName: user.name || user.username || 'Usuário Desconhecido',
            totalCalls: 0,
            totalApproaches: 0,
            reportCount: 0,
            reports: [],
            leads: [],
            studyConfirmations: [],
            attendances: [],
            convertedLeads: 0,
            canceledLeads: 0
          };
        }
      });

      allReports.forEach(report => {
        const reportDate = parseISO(report.date);
        if (isWithinInterval(reportDate, { start, end })) {
          if (!userMetrics[report.userId]) {
            userMetrics[report.userId] = {
              userId: report.userId,
              userName: report.userName,
              totalCalls: 0,
              totalApproaches: 0,
              reportCount: 0,
              reports: [],
              leads: [],
              studyConfirmations: [],
              attendances: [],
              convertedLeads: 0,
              canceledLeads: 0
            };
          }
          userMetrics[report.userId].totalCalls += report.calls || 0;
          userMetrics[report.userId].totalApproaches += report.approaches || 0;
          userMetrics[report.userId].reportCount += 1;
          userMetrics[report.userId].reports.push(report);
        }
      });

      // Add leads to user metrics
      allLeads.forEach(lead => {
        if (lead.assignedTo && lead.assignedAt) {
          const assignedDate = parseISO(lead.assignedAt);
          if (isWithinInterval(assignedDate, { start, end })) {
            if (!userMetrics[lead.assignedTo]) {
              // If user has leads but no reports this month, initialize them
              userMetrics[lead.assignedTo] = {
                userId: lead.assignedTo,
                userName: usersMap[lead.assignedTo]?.name || 'Usuário Desconhecido',
                totalCalls: 0,
                totalApproaches: 0,
                reportCount: 0,
                reports: [],
                leads: [],
                studyConfirmations: [],
                attendances: [],
                convertedLeads: 0,
                canceledLeads: 0
              };
            }
            userMetrics[lead.assignedTo].leads.push(lead);
            if (lead.status === 'converted') {
              userMetrics[lead.assignedTo].convertedLeads += 1;
            } else if (lead.status === 'canceled') {
              userMetrics[lead.assignedTo].canceledLeads += 1;
            }
          }
        }
      });

      // Add study confirmations to user metrics
      allStudyConfirmations.forEach(conf => {
        if (conf.userId && conf.createdAt) {
          const confDate = parseISO(conf.createdAt);
          if (isWithinInterval(confDate, { start, end })) {
            if (!userMetrics[conf.userId]) {
              userMetrics[conf.userId] = {
                userId: conf.userId,
                userName: usersMap[conf.userId]?.name || conf.username || 'Usuário Desconhecido',
                totalCalls: 0,
                totalApproaches: 0,
                reportCount: 0,
                reports: [],
                leads: [],
                studyConfirmations: [],
                attendances: [],
                convertedLeads: 0,
                canceledLeads: 0
              };
            }
            userMetrics[conf.userId].studyConfirmations.push(conf);
          }
        }
      });

      // Add attendances to user metrics
      allAttendances.forEach(att => {
        if (att.id && att.markedAt) { // att.id is the userId
          const attDate = parseISO(att.markedAt);
          if (isWithinInterval(attDate, { start, end })) {
            if (!userMetrics[att.id]) {
              userMetrics[att.id] = {
                userId: att.id,
                userName: usersMap[att.id]?.name || att.userName || 'Usuário Desconhecido',
                totalCalls: 0,
                totalApproaches: 0,
                reportCount: 0,
                reports: [],
                leads: [],
                studyConfirmations: [],
                attendances: [],
                convertedLeads: 0,
                canceledLeads: 0
              };
            }
            userMetrics[att.id].attendances.push(att);
          }
        }
      });

      // Sort reports for each user by date descending
      Object.values(userMetrics).forEach(user => {
        user.reports.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
        // Sort leads by assignedAt descending
        user.leads.sort((a: any, b: any) => {
          if (!a.assignedAt) return 1;
          if (!b.assignedAt) return -1;
          return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
        });
        // Sort study confirmations by createdAt descending
        user.studyConfirmations.sort((a: any, b: any) => {
          if (!a.createdAt) return 1;
          if (!b.createdAt) return -1;
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        // Sort attendances by markedAt descending
        user.attendances.sort((a: any, b: any) => {
          if (!a.markedAt) return 1;
          if (!b.markedAt) return -1;
          return new Date(b.markedAt).getTime() - new Date(a.markedAt).getTime();
        });
      });

      setMetrics(Object.values(userMetrics).sort((a, b) => b.totalApproaches - a.totalApproaches));
      
      // Update selected seller if open
      if (selectedSeller) {
        const updatedSeller = userMetrics[selectedSeller.userId];
        if (updatedSeller) {
          setSelectedSeller(updatedSeller);
          setSellerReports(updatedSeller.reports);
          setSellerLeads(updatedSeller.leads);
        }
      }
      
      setLoading(false);
    };

    return () => {
      unsubscribeRequests();
      unsubscribeReports();
      unsubscribeLeads();
      unsubscribeUsers();
      unsubscribeStudy();
      unsubscribeAttendances();
    };
  }, [userData, selectedSeller?.userId]);

  const handleApprove = async (request: any) => {
    try {
      // Create user document
      await setDoc(doc(db, 'users', request.uid), {
        uid: request.uid,
        username: request.username,
        name: request.name,
        role: 'user',
        createdAt: new Date().toISOString()
      });

      // Update request status
      await updateDoc(doc(db, 'access_requests', request.id), {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
      setError(null);
    } catch (error) {
      console.error("Error approving request:", error);
      setError("Erro ao aprovar solicitação.");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'access_requests', requestId), {
        status: 'rejected',
        updatedAt: new Date().toISOString()
      });
      setError(null);
    } catch (error) {
      console.error("Error rejecting request:", error);
      setError("Erro ao recusar solicitação.");
    }
  };

  const openSellerProfile = (seller: any) => {
    setSelectedSeller(seller);
    setSellerReports(seller.reports);
  };

  const confirmDeleteReport = async () => {
    if (!reportToDelete) return;
    try {
      await deleteDoc(doc(db, 'reports', reportToDelete));
      setSellerReports(prev => prev.filter(r => r.id !== reportToDelete));
      
      // Update the metrics state to reflect the deletion
      setMetrics(prev => prev.map(seller => {
        if (seller.userId === selectedSeller.userId) {
          const deletedReport = seller.reports.find((r: any) => r.id === reportToDelete);
          if (deletedReport) {
            return {
              ...seller,
              totalCalls: seller.totalCalls - (deletedReport.calls || 0),
              totalApproaches: seller.totalApproaches - (deletedReport.approaches || 0),
              reportCount: seller.reportCount - 1,
              reports: seller.reports.filter((r: any) => r.id !== reportToDelete)
            };
          }
        }
        return seller;
      }));
      
      // Update selectedSeller state as well
      setSelectedSeller((prev: any) => {
        if (!prev) return prev;
        const deletedReport = prev.reports.find((r: any) => r.id === reportToDelete);
        if (!deletedReport) return prev;
        return {
          ...prev,
          totalCalls: prev.totalCalls - (deletedReport.calls || 0),
          totalApproaches: prev.totalApproaches - (deletedReport.approaches || 0),
          reportCount: prev.reportCount - 1,
          reports: prev.reports.filter((r: any) => r.id !== reportToDelete)
        };
      });

      setReportToDelete(null);
      setError(null);
    } catch (error) {
      console.error("Error deleting report:", error);
      setError("Erro ao apagar relatório.");
      setReportToDelete(null);
    }
  };

  if (loading) return <div className="text-slate-400">Carregando painel...</div>;

  if (selectedSeller) {
    const isBelowCallsQuota = selectedSeller.totalCalls < (quotas.calls * selectedSeller.reportCount);
    const isBelowApproachesQuota = selectedSeller.totalApproaches < (quotas.approaches * selectedSeller.reportCount);

    return (
      <div className="space-y-6">
        {error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
        <button 
          onClick={() => setSelectedSeller(null)}
          className="flex items-center text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar para Supervisão
        </button>

        <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0 h-16 w-16 bg-slate-800 rounded-full flex items-center justify-center border-2 border-slate-700">
                <span className="text-2xl text-cyan-400 font-bold">{selectedSeller.userName.charAt(0).toUpperCase()}</span>
              </div>
              <div className="ml-4">
                <h2 className="text-2xl font-bold text-slate-100">{selectedSeller.userName}</h2>
                <p className="text-slate-400">Perfil do Vendedor</p>
              </div>
            </div>
            {(isBelowCallsQuota || isBelowApproachesQuota) && (
              <div className="flex items-center bg-amber-500/10 text-amber-400 px-4 py-2 rounded-lg border border-amber-500/20">
                <AlertTriangle className="w-5 h-5 mr-2" />
                <span className="text-sm font-medium">Abaixo da meta mensal</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center text-slate-400 mb-2">
                <Activity className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Dias Trabalhados</span>
              </div>
              <p className="text-2xl font-bold text-slate-100">{selectedSeller.reportCount}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center text-slate-400 mb-2">
                <Phone className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Total de Ligações</span>
              </div>
              <div className="flex items-end gap-2">
                <p className={`text-2xl font-bold ${isBelowCallsQuota ? 'text-amber-400' : 'text-slate-100'}`}>
                  {selectedSeller.totalCalls}
                </p>
                <p className="text-xs text-slate-500 mb-1">/ {quotas.calls * selectedSeller.reportCount} meta</p>
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center text-slate-400 mb-2">
                <Users className="w-4 h-4 mr-2" />
                <span className="text-sm font-medium">Total de Abordagens</span>
              </div>
              <div className="flex items-end gap-2">
                <p className={`text-2xl font-bold ${isBelowApproachesQuota ? 'text-amber-400' : 'text-slate-100'}`}>
                  {selectedSeller.totalApproaches}
                </p>
                <p className="text-xs text-slate-500 mb-1">/ {quotas.approaches * selectedSeller.reportCount} meta</p>
              </div>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center text-slate-400 mb-2">
                <CheckCircle className="w-4 h-4 mr-2 text-emerald-400" />
                <span className="text-sm font-medium">Leads Convertidos</span>
              </div>
              <p className="text-2xl font-bold text-emerald-400">{selectedSeller.convertedLeads || 0}</p>
            </div>
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div className="flex items-center text-slate-400 mb-2">
                <XCircle className="w-4 h-4 mr-2 text-red-400" />
                <span className="text-sm font-medium">Leads Cancelados</span>
              </div>
              <p className="text-2xl font-bold text-red-400">{selectedSeller.canceledLeads || 0}</p>
            </div>
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center mt-8">
            <Target className="w-5 h-5 mr-2 text-cyan-400" />
            Leads Assumidos ({sellerLeads.length})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {sellerLeads.length === 0 ? (
              <p className="text-slate-500 col-span-full py-4">Nenhum lead assumido.</p>
            ) : (
              sellerLeads.map((lead) => (
                <div key={lead.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-200 truncate pr-2">{lead.title}</h4>
                    <span className={`text-xs px-2 py-1 rounded-full border ${
                      lead.status === 'pending' ? 'bg-amber-400/10 text-amber-400 border-amber-400/20' :
                      (lead.status === 'approached' || lead.status === 'negociando') ? 'bg-blue-400/10 text-blue-400 border-blue-400/20' :
                      lead.status === 'converted' ? 'bg-emerald-400/10 text-emerald-400 border-emerald-400/20' :
                      'bg-red-400/10 text-red-400 border-red-400/20'
                    }`}>
                      {lead.status === 'pending' ? 'Pendente' :
                       (lead.status === 'approached' || lead.status === 'negociando') ? 'Abordado' :
                       lead.status === 'converted' ? 'Convertido' : 'Cancelado'}
                    </span>
                  </div>
                  {lead.phone && (
                    <div className="flex items-center text-sm text-slate-400 mb-1">
                      <Phone className="w-3 h-3 mr-1.5" />
                      {lead.phone}
                    </div>
                  )}
                  {lead.assignedAt && (
                    <div className="flex items-center text-xs text-slate-500 mt-auto pt-3">
                      <Calendar className="w-3 h-3 mr-1.5" />
                      Assumido em {format(parseISO(lead.assignedAt), "dd/MM/yyyy HH:mm")}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center mt-8">
            <BookOpen className="w-5 h-5 mr-2 text-cyan-400" />
            Resumos de Estudo ({selectedSeller.studyConfirmations?.length || 0})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {!selectedSeller.studyConfirmations || selectedSeller.studyConfirmations.length === 0 ? (
              <p className="text-slate-500 col-span-full py-4">Nenhum resumo enviado.</p>
            ) : (
              selectedSeller.studyConfirmations.map((conf: any) => (
                <div key={conf.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-200 truncate pr-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
                      Resumo Enviado
                    </h4>
                    <span className="text-xs text-slate-500">
                      {format(parseISO(conf.createdAt), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 line-clamp-3 mt-2">{conf.summary}</p>
                </div>
              ))
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center mt-8">
            <Users className="w-5 h-5 mr-2 text-cyan-400" />
            Presenças em Reuniões ({selectedSeller.attendances?.length || 0})
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {!selectedSeller.attendances || selectedSeller.attendances.length === 0 ? (
              <p className="text-slate-500 col-span-full py-4">Nenhuma presença registrada.</p>
            ) : (
              selectedSeller.attendances.map((att: any) => (
                <div key={att.meetingId} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-bold text-slate-200 truncate pr-2 flex items-center">
                      <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
                      Presente
                    </h4>
                    <span className="text-xs text-slate-500">
                      {format(parseISO(att.markedAt), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400 mt-2">Reunião: {format(parseISO(att.meetingId), "dd/MM/yyyy")}</p>
                </div>
              ))
            )}
          </div>

          <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center">
            <FileText className="w-5 h-5 mr-2 text-cyan-400" />
            Relatórios Enviados
          </h3>
          
          <div className="space-y-3">
            {sellerReports.length === 0 ? (
              <p className="text-slate-500 text-center py-4">Nenhum relatório enviado.</p>
            ) : (
              sellerReports.map((report) => (
                <div key={report.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <p className="font-bold text-slate-200">{format(parseISO(report.date), "dd 'de' MMMM, yyyy", { locale: ptBR })}</p>
                    <p className="text-xs text-slate-500">Enviado às {format(parseISO(report.createdAt), "HH:mm")}</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Ligações</p>
                      <p className={`font-bold ${report.calls < quotas.calls ? 'text-amber-400' : 'text-slate-200'}`}>{report.calls}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Abordagens</p>
                      <p className={`font-bold ${report.approaches < quotas.approaches ? 'text-amber-400' : 'text-slate-200'}`}>{report.approaches}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Comprovantes</p>
                      <div className="flex flex-wrap gap-1 justify-center max-w-[120px]">
                        {report.proofUrls && report.proofUrls.length > 0 ? (
                          report.proofUrls.map((url: string, index: number) => (
                            <a 
                              key={index}
                              href={url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded"
                            >
                              Img {index + 1}
                            </a>
                          ))
                        ) : report.proofUrl ? (
                          <a 
                            href={report.proofUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-cyan-400 hover:text-cyan-300 bg-cyan-500/10 px-1.5 py-0.5 rounded"
                          >
                            Ver img
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500">Nenhum</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setReportToDelete(report.id)}
                      className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors ml-2"
                      title="Apagar relatório"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {reportToDelete && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
              <h3 className="text-xl font-bold text-slate-100 mb-2">Apagar Relatório</h3>
              <p className="text-slate-400 mb-6">
                Tem certeza que deseja apagar este relatório? Esta ação não pode ser desfeita e os dados serão removidos das métricas.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setReportToDelete(null)}
                  className="px-4 py-2 text-slate-300 hover:text-slate-100 font-medium transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteReport}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-medium rounded-lg transition-colors"
                >
                  Apagar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Supervisão</h1>
      </div>

      {/* Access Requests Section */}
      <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-100 flex items-center">
            <UserPlus className="w-5 h-5 mr-2 text-cyan-400" />
            Solicitações de Acesso Pendentes
          </h2>
          {requests.length > 0 && (
            <span className="bg-cyan-500/10 text-cyan-400 py-1 px-3 rounded-full text-xs font-bold border border-cyan-500/20">
              {requests.length} pendente(s)
            </span>
          )}
        </div>
        
        {requests.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            Nenhuma solicitação de acesso pendente no momento.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {requests.map((request) => (
              <div key={request.id} className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors">
                <div>
                  <h3 className="text-slate-200 font-bold">{request.name}</h3>
                  <p className="text-sm text-slate-400">Usuário: <span className="text-slate-300">@{request.username}</span></p>
                  <p className="text-xs text-slate-500 mt-1">Solicitado em: {format(parseISO(request.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    onClick={() => handleReject(request.id)}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-slate-800 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors border border-slate-700 hover:border-red-500/30"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Recusar
                  </button>
                  <button
                    onClick={() => handleApprove(request)}
                    className="flex-1 sm:flex-none flex items-center justify-center px-4 py-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20 hover:border-emerald-500/40"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Aprovar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Seller Metrics Section */}
      <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-cyan-400" />
            Métricas dos Vendedores (Mês Atual)
          </h2>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-900/50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Vendedor</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Relatórios</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Ligações</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Abordagens</th>
                <th className="px-6 py-4 text-center text-xs font-semibold text-slate-400 uppercase tracking-wider">Convertidos</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {metrics.map((metric) => {
                const isBelowCallsQuota = metric.totalCalls < (quotas.calls * metric.reportCount);
                const isBelowApproachesQuota = metric.totalApproaches < (quotas.approaches * metric.reportCount);
                const isBelowQuota = isBelowCallsQuota || isBelowApproachesQuota;

                return (
                  <tr 
                    key={metric.userId} 
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                    onClick={() => openSellerProfile(metric)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                          <span className="text-cyan-400 font-bold">{metric.userName.charAt(0).toUpperCase()}</span>
                        </div>
                        <div className="ml-4 flex items-center">
                          <div className="text-sm font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">{metric.userName}</div>
                          {isBelowQuota && (
                            <AlertTriangle className="w-4 h-4 ml-2 text-amber-400" title="Abaixo da meta acumulada" />
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                        <Activity className="w-3 h-3 mr-1" />
                        {metric.reportCount} dias
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center text-sm text-slate-300">
                        <Phone className="w-4 h-4 mr-1.5 text-blue-400" />
                        <span className={isBelowCallsQuota ? 'text-amber-400 font-bold' : ''}>{metric.totalCalls}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center text-sm text-slate-300">
                        <Users className="w-4 h-4 mr-1.5 text-purple-400" />
                        <span className={isBelowApproachesQuota ? 'text-amber-400 font-bold' : ''}>{metric.totalApproaches}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center text-sm text-slate-300">
                        <CheckCircle className="w-4 h-4 mr-1.5 text-emerald-400" />
                        <span className="font-bold text-emerald-400">{metric.convertedLeads || 0}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end">
                        <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-cyan-400 transition-colors" />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {metrics.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                    Nenhum dado registrado neste mês.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
