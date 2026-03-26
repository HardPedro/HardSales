import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, writeBatch, where, orderBy, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Upload, UserCheck, Phone, MapPin, ExternalLink, Filter, Search, Target, AlertCircle, CheckCircle2, XCircle, Clock, History, Trash2, AlertTriangle } from 'lucide-react';
import * as XLSX from 'xlsx';

export const Leads: React.FC = () => {
  const { userData } = useAuth();
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'available' | 'my_leads'>('available');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Import History State
  const [showHistory, setShowHistory] = useState(false);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingImport, setDeletingImport] = useState<string | null>(null);

  useEffect(() => {
    if (!userData) return;

    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLeads(leadsData);
      setLoading(false);
    }, (err) => {
      console.error("Error fetching leads:", err);
      setError("Erro ao carregar leads.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userData]);

  const fetchImportHistory = async () => {
    setLoadingHistory(true);
    try {
      const q = query(collection(db, 'lead_imports'), orderBy('importedAt', 'desc'));
      const snapshot = await getDocs(q);
      setImportHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (err) {
      console.error("Error fetching history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (showHistory) {
      fetchImportHistory();
    }
  }, [showHistory]);

  const handleDeleteImport = async (importId: string) => {
    if (!window.confirm('Tem certeza que deseja apagar TODOS os leads desta importação? Esta ação não pode ser desfeita.')) return;

    setDeletingImport(importId);
    try {
      const q = query(collection(db, 'leads'), where('importId', '==', importId));
      const snapshot = await getDocs(q);

      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      snapshot.docs.forEach((document) => {
        currentBatch.delete(document.ref);
        operationCount++;

        if (operationCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      await deleteDoc(doc(db, 'lead_imports', importId));

      setSuccess('Importação e leads excluídos com sucesso!');
      setImportHistory(prev => prev.filter(i => i.id !== importId));
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting import:", err);
      setError("Erro ao excluir importação.");
    } finally {
      setDeletingImport(null);
    }
  };

  const handleDeleteAllLeads = async () => {
    if (!window.confirm('ATENÇÃO: Tem certeza que deseja apagar TODOS os leads do sistema? Esta ação é IRREVERSÍVEL.')) return;
    if (!window.confirm('Confirmação final: Apagar absolutamente todos os leads e o histórico de importações?')) return;

    setDeletingImport('all');
    try {
      const batches = [];
      let currentBatch = writeBatch(db);
      let operationCount = 0;

      // Delete all leads
      const leadsSnapshot = await getDocs(collection(db, 'leads'));
      leadsSnapshot.docs.forEach((document) => {
        currentBatch.delete(document.ref);
        operationCount++;

        if (operationCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      // Delete all imports
      const importsSnapshot = await getDocs(collection(db, 'lead_imports'));
      importsSnapshot.docs.forEach((document) => {
        currentBatch.delete(document.ref);
        operationCount++;

        if (operationCount === 500) {
          batches.push(currentBatch.commit());
          currentBatch = writeBatch(db);
          operationCount = 0;
        }
      });

      if (operationCount > 0) {
        batches.push(currentBatch.commit());
      }

      await Promise.all(batches);
      setSuccess('Todos os leads e históricos foram apagados com sucesso!');
      setImportHistory([]);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Error deleting all leads:", err);
      let errorMessage = "Erro ao excluir todos os leads.";
      if (err.message) {
        try {
          const parsedErr = JSON.parse(err.message);
          errorMessage = `Erro: ${parsedErr.error || err.message}`;
        } catch (e) {
          errorMessage = `Erro: ${err.message}`;
        }
      }
      setError(errorMessage);
    } finally {
      setDeletingImport(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const bstr = evt.target?.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

          const importId = Date.now().toString();
          const fileName = file.name;

          // Columns: A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7, I=8, T=19, U=20
          const leadsToAdd = data.slice(1).map(row => ({
            title: row[0] ? String(row[0]) : '',
            totalScore: row[1] !== undefined ? row[1] : '',
            reviewsCount: row[2] !== undefined ? row[2] : '',
            street: row[3] ? String(row[3]) : '',
            city: row[4] ? String(row[4]) : '',
            state: row[5] ? String(row[5]) : '',
            countryCode: row[6] ? String(row[6]) : '',
            website: row[7] ? String(row[7]) : '',
            phone: row[8] ? String(row[8]) : '',
            url: row[19] ? String(row[19]) : '',
            categoryName: row[20] ? String(row[20]) : '',
            status: 'available',
            assignedTo: null,
            assignedAt: null,
            createdAt: new Date().toISOString(),
            importId: importId
          })).filter(lead => lead.title.trim() !== ''); // Only add if title exists

          if (leadsToAdd.length === 0) {
            setError("Nenhum lead válido encontrado no arquivo.");
            setUploading(false);
            return;
          }

          // Batch write to Firestore (max 500 per batch)
          const batches = [];
          let currentBatch = writeBatch(db);
          let operationCount = 0;

          // Add import record
          const importRef = doc(collection(db, 'lead_imports'), importId);
          currentBatch.set(importRef, {
            fileName,
            importedAt: new Date().toISOString(),
            importedBy: userData?.uid,
            leadCount: leadsToAdd.length
          });
          operationCount++;

          for (const lead of leadsToAdd) {
            const newLeadRef = doc(collection(db, 'leads'));
            currentBatch.set(newLeadRef, lead);
            operationCount++;

            if (operationCount === 500) {
              batches.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              operationCount = 0;
            }
          }

          if (operationCount > 0) {
            batches.push(currentBatch.commit());
          }

          await Promise.all(batches);
          setSuccess(`${leadsToAdd.length} leads importados com sucesso!`);
          
          // Reset file input
          if (e.target) e.target.value = '';
        } catch (err) {
          console.error("Error parsing file:", err);
          setError("Erro ao processar o arquivo. Verifique o formato.");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      console.error("Error uploading file:", err);
      setError("Erro ao fazer upload do arquivo.");
      setUploading(false);
    }
  };

  const handleAssumir = async (leadId: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: 'pending',
        assignedTo: userData?.uid,
        assignedAt: new Date().toISOString()
      });
      setSuccess("Lead assumido com sucesso!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error assuming lead:", err);
      setError("Erro ao assumir lead.");
    }
  };

  const handleStatusChange = async (leadId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'leads', leadId), {
        status: newStatus
      });
      setSuccess("Status atualizado!");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating status:", err);
      setError("Erro ao atualizar status.");
    }
  };

  const availableLeads = leads.filter(l => l.status === 'available');
  const myLeads = leads.filter(l => l.assignedTo === userData?.uid);

  const filteredAvailableLeads = availableLeads.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.categoryName && l.categoryName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredMyLeads = myLeads.filter(l => 
    l.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.city && l.city.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (l.categoryName && l.categoryName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Disponível</span>;
      case 'pending':
        return <span className="flex items-center text-xs font-medium text-amber-400 bg-amber-400/10 px-2 py-1 rounded-full border border-amber-400/20"><Clock className="w-3 h-3 mr-1" /> Pendente</span>;
      case 'negotiating':
        return <span className="flex items-center text-xs font-medium text-blue-400 bg-blue-400/10 px-2 py-1 rounded-full border border-blue-400/20"><Target className="w-3 h-3 mr-1" /> Negociando</span>;
      case 'converted':
        return <span className="flex items-center text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-full border border-emerald-400/20"><CheckCircle2 className="w-3 h-3 mr-1" /> Convertido</span>;
      case 'canceled':
        return <span className="flex items-center text-xs font-medium text-red-400 bg-red-400/10 px-2 py-1 rounded-full border border-red-400/20"><XCircle className="w-3 h-3 mr-1" /> Cancelado</span>;
      default:
        return null;
    }
  };

  const LeadCard: React.FC<{ lead: any, isMine: boolean }> = ({ lead, isMine }) => (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">{lead.title}</h3>
          <div className="flex items-center gap-2 mt-1">
            {getStatusBadge(lead.status)}
            {lead.categoryName && (
              <span className="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded-full">
                {lead.categoryName}
              </span>
            )}
          </div>
        </div>
        {lead.totalScore && (
          <div className="flex items-center bg-slate-800 px-2 py-1 rounded-lg">
            <span className="text-amber-400 font-bold mr-1">{lead.totalScore}</span>
            <span className="text-xs text-slate-400">({lead.reviewsCount})</span>
          </div>
        )}
      </div>

      <div className="space-y-2 mb-4">
        {lead.phone && (
          <div className="flex items-center text-sm text-slate-300">
            <Phone className="w-4 h-4 mr-2 text-slate-500" />
            <a href={`tel:${lead.phone}`} className="hover:text-cyan-400 transition-colors">{lead.phone}</a>
          </div>
        )}
        {(lead.city || lead.street) && (
          <div className="flex items-center text-sm text-slate-300">
            <MapPin className="w-4 h-4 mr-2 text-slate-500" />
            <span className="truncate">{lead.street ? `${lead.street}, ` : ''}{lead.city} {lead.state ? `- ${lead.state}` : ''}</span>
          </div>
        )}
        {lead.website && (
          <div className="flex items-center text-sm text-slate-300">
            <ExternalLink className="w-4 h-4 mr-2 text-slate-500" />
            <a href={lead.website} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:text-cyan-300 truncate">
              {lead.website}
            </a>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-800">
        {lead.url ? (
          <a 
            href={lead.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors flex items-center"
          >
            Ver no Maps
          </a>
        ) : <div />}

        {isMine ? (
          <select
            value={lead.status}
            onChange={(e) => handleStatusChange(lead.id, e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg focus:ring-cyan-500 focus:border-cyan-500 block p-2"
          >
            <option value="pending">Pendente</option>
            <option value="negotiating">Negociando</option>
            <option value="converted">Convertido</option>
            <option value="canceled">Cancelado</option>
          </select>
        ) : (
          <button
            onClick={() => handleAssumir(lead.id)}
            className="flex items-center bg-cyan-500 hover:bg-cyan-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            <UserCheck className="w-4 h-4 mr-2" />
            Assumir Lead
          </button>
        )}
      </div>
    </div>
  );

  if (loading) return <div className="text-slate-400">Carregando leads...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Gestão de Leads</h1>
        
        {userData?.role === 'admin' && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
            <button
              onClick={handleDeleteAllLeads}
              disabled={deletingImport === 'all'}
              className="flex justify-center items-center px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg font-medium transition-colors w-full sm:w-auto"
              title="Apagar todos os leads do sistema"
            >
              <AlertTriangle className="w-5 h-5 mr-2" />
              {deletingImport === 'all' ? 'Apagando...' : 'Limpar Tudo'}
            </button>
            <button
              onClick={() => setShowHistory(true)}
              className="flex justify-center items-center px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors w-full sm:w-auto"
            >
              <History className="w-5 h-5 mr-2" />
              Histórico
            </button>
            <div className="relative w-full sm:w-auto">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                onChange={handleFileUpload}
                className="hidden"
                id="upload-leads"
                disabled={uploading}
              />
              <label
                htmlFor="upload-leads"
                className={`flex justify-center items-center px-4 py-2 rounded-lg font-medium cursor-pointer transition-colors w-full sm:w-auto ${
                  uploading 
                    ? 'bg-slate-800 text-slate-400 cursor-not-allowed' 
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                }`}
              >
                <Upload className="w-5 h-5 mr-2" />
                {uploading ? 'Processando...' : 'Importar Planilha'}
              </label>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center">
          <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" />
          {error}
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-sm flex items-center">
          <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
          {success}
        </div>
      )}

      <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
        <div className="border-b border-slate-800">
          <div className="flex">
            <button
              onClick={() => setActiveTab('available')}
              className={`flex-1 py-4 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === 'available'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              Leads Disponíveis ({availableLeads.length})
            </button>
            <button
              onClick={() => setActiveTab('my_leads')}
              className={`flex-1 py-4 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === 'my_leads'
                  ? 'border-cyan-500 text-cyan-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700'
              }`}
            >
              Meus Leads ({myLeads.length})
            </button>
          </div>
        </div>

        <div className="p-6">
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-slate-500" />
            </div>
            <input
              type="text"
              placeholder="Buscar por nome, cidade ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-slate-700 rounded-xl leading-5 bg-slate-950 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 focus:border-cyan-500 sm:text-sm transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {activeTab === 'available' ? (
              filteredAvailableLeads.length > 0 ? (
                filteredAvailableLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} isMine={false} />
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-slate-500">
                  Nenhum lead disponível encontrado.
                </div>
              )
            ) : (
              filteredMyLeads.length > 0 ? (
                filteredMyLeads.map(lead => (
                  <LeadCard key={lead.id} lead={lead} isMine={true} />
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-slate-500">
                  Você ainda não assumiu nenhum lead.
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Import History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-100 flex items-center">
                <History className="w-6 h-6 mr-2 text-cyan-400" />
                Histórico de Importações
              </h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-200">
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 pr-2">
              {loadingHistory ? (
                <p className="text-slate-400 text-center py-4">Carregando histórico...</p>
              ) : importHistory.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Nenhuma importação realizada.</p>
              ) : (
                <div className="space-y-3">
                  {importHistory.map((item) => (
                    <div key={item.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-slate-200">{item.fileName}</p>
                        <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                          <span>{new Date(item.importedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                          <span>•</span>
                          <span>{item.leadCount} leads</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteImport(item.id)}
                        disabled={deletingImport === item.id}
                        className={`p-2 rounded-lg transition-colors ${
                          deletingImport === item.id
                            ? 'text-slate-500 cursor-not-allowed'
                            : 'text-slate-400 hover:text-red-400 hover:bg-red-400/10'
                        }`}
                        title="Excluir importação e todos os seus leads"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
