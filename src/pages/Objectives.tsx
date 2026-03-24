import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Target, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Objectives: React.FC = () => {
  const { userData } = useAuth();
  const [objectives, setObjectives] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newObjective, setNewObjective] = useState({ title: '', description: '', targetDate: '' });

  useEffect(() => {
    const q = query(collection(db, 'objectives'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setObjectives(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching objectives:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAddObjective = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userData?.role !== 'admin') return;

    try {
      await addDoc(collection(db, 'objectives'), {
        title: newObjective.title,
        description: newObjective.description,
        targetDate: new Date(newObjective.targetDate).toISOString(),
        createdAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setNewObjective({ title: '', description: '', targetDate: '' });
    } catch (error) {
      console.error("Error adding objective:", error);
    }
  };

  if (loading) return <div className="text-slate-400">Carregando objetivos...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Objetivos da Empresa</h1>
        {userData?.role === 'admin' && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors shadow-[0_0_10px_rgba(8,145,178,0.3)] w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Objetivo
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {objectives.map((obj) => (
          <div key={obj.id} className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col h-full hover:border-slate-700 transition-colors group">
            <div className="flex items-start justify-between mb-5">
              <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                <Target className="w-6 h-6" />
              </div>
              <span className="flex items-center text-xs font-medium text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-full">
                <Calendar className="w-3.5 h-3.5 mr-1.5 text-slate-500" />
                {obj.targetDate ? format(new Date(obj.targetDate), "dd 'de' MMM, yyyy", { locale: ptBR }) : 'Sem prazo'}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-3">{obj.title}</h3>
            <p className="text-slate-400 text-sm flex-grow leading-relaxed">{obj.description}</p>
          </div>
        ))}
        {objectives.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
            Nenhum objetivo definido ainda.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">Novo Objetivo</h2>
            <form onSubmit={handleAddObjective} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Título</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newObjective.title}
                  onChange={e => setNewObjective({...newObjective, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  rows={3}
                  value={newObjective.description}
                  onChange={e => setNewObjective({...newObjective, description: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Data Alvo</label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all [color-scheme:dark]"
                  value={newObjective.targetDate}
                  onChange={e => setNewObjective({...newObjective, targetDate: e.target.value})}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-slate-950 font-semibold bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)] w-full sm:w-auto order-1 sm:order-2"
                >
                  Salvar Objetivo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
