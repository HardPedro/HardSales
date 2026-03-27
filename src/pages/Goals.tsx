import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Flag, CheckCircle, Clock, Trophy, Users, User, Edit, Trash2, AlertTriangle } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Goals: React.FC = () => {
  const { userData } = useAuth();
  const [goals, setGoals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newGoal, setNewGoal] = useState({ 
    title: '', 
    targetValue: '', 
    deadline: '',
    type: 'individual',
    rewardValue: ''
  });
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isProgressModalOpen, setIsProgressModalOpen] = useState(false);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [newProgressValue, setNewProgressValue] = useState('');

  useEffect(() => {
    if (!userData) return;

    const q = query(collection(db, 'goals'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allGoals = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      if (userData.role === 'admin') {
        setGoals(allGoals);
      } else {
        setGoals(allGoals.filter((g: any) => 
          g.type === 'general' || 
          g.type === 'team' || 
          g.type === 'individual' ||
          (!g.type && g.userId === userData.username)
        ));
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching goals:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, [userData]);

  const handleAddOrEditGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || userData.role !== 'admin') return;

    try {
      if (editingGoalId) {
        await updateDoc(doc(db, 'goals', editingGoalId), {
          title: newGoal.title,
          targetValue: Number(newGoal.targetValue),
          deadline: new Date(newGoal.deadline).toISOString(),
          type: newGoal.type,
          rewardValue: Number(newGoal.rewardValue) || 0,
        });
      } else {
        await addDoc(collection(db, 'goals'), {
          title: newGoal.title,
          targetValue: Number(newGoal.targetValue),
          currentValue: 0,
          deadline: new Date(newGoal.deadline).toISOString(),
          userId: '',
          teamId: '',
          type: newGoal.type,
          rewardValue: Number(newGoal.rewardValue) || 0,
          status: 'pending',
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setNewGoal({ title: '', targetValue: '', deadline: '', type: 'individual', rewardValue: '' });
      setEditingGoalId(null);
    } catch (error) {
      console.error("Error saving goal:", error);
    }
  };

  const handleEditClick = (goal: any) => {
    setNewGoal({ 
      title: goal.title, 
      targetValue: goal.targetValue.toString(), 
      deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
      type: goal.type || 'individual',
      rewardValue: goal.rewardValue ? goal.rewardValue.toString() : ''
    });
    setEditingGoalId(goal.id);
    setIsModalOpen(true);
  };

  const handleProgressClick = (goal: any) => {
    setProgressGoalId(goal.id);
    setNewProgressValue(goal.currentValue.toString());
    setIsProgressModalOpen(true);
  };

  const handleUpdateProgress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || userData.role !== 'admin' || !progressGoalId) return;

    try {
      await updateDoc(doc(db, 'goals', progressGoalId), {
        currentValue: Number(newProgressValue)
      });
      setIsProgressModalOpen(false);
      setProgressGoalId(null);
      setNewProgressValue('');
    } catch (error) {
      console.error("Error updating progress:", error);
    }
  };

  const handleDeleteClick = async (goalId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta meta?')) {
      try {
        await deleteDoc(doc(db, 'goals', goalId));
      } catch (error) {
        console.error("Error deleting goal:", error);
      }
    }
  };

  const openNewModal = () => {
    setNewGoal({ title: '', targetValue: '', deadline: '', type: 'individual', rewardValue: '' });
    setEditingGoalId(null);
    setIsModalOpen(true);
  };

  if (loading) return <div className="text-slate-400">Carregando metas...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Metas</h1>
        {userData?.role === 'admin' && (
          <button
            onClick={openNewModal}
            className="flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors shadow-[0_0_10px_rgba(8,145,178,0.3)] w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nova Meta
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {goals.map((goal) => {
          const progress = Math.min((goal.currentValue / goal.targetValue) * 100, 100);
          const isCompleted = progress >= 100;
          
          const hoursToDeadline = differenceInHours(new Date(goal.deadline), new Date());
          const isUrgent = !isCompleted && hoursToDeadline > 0 && hoursToDeadline <= 12;

          return (
            <div key={goal.id} className={`bg-slate-900 p-6 rounded-2xl shadow-lg border flex flex-col transition-colors group ${
              isUrgent ? 'border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.15)]' : 'border-slate-800 hover:border-slate-700'
            }`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl border transition-colors ${
                  isCompleted 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 group-hover:bg-emerald-500/20' 
                    : isUrgent
                    ? 'bg-red-500/10 text-red-400 border-red-500/20 group-hover:bg-red-500/20'
                    : 'bg-purple-500/10 text-purple-400 border-purple-500/20 group-hover:bg-purple-500/20'
                }`}>
                  {isCompleted ? <CheckCircle className="w-6 h-6" /> : isUrgent ? <AlertTriangle className="w-6 h-6 animate-pulse" /> : <Flag className="w-6 h-6" />}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`flex items-center text-xs font-medium px-3 py-1.5 rounded-full border ${
                    isUrgent 
                      ? 'text-red-400 bg-red-950/50 border-red-500/30 animate-pulse' 
                      : 'text-slate-400 bg-slate-950 border-slate-800'
                  }`}>
                    <Clock className={`w-3.5 h-3.5 mr-1.5 ${isUrgent ? 'text-red-400' : 'text-slate-500'}`} />
                    {format(new Date(goal.deadline), "dd/MM/yyyy")}
                    {isUrgent && <span className="ml-1 font-bold">({hoursToDeadline}h)</span>}
                  </span>
                  {goal.rewardValue > 0 && (
                    <span className="flex items-center text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-full">
                      <Trophy className="w-3.5 h-3.5 mr-1.5" />
                      R$ {goal.rewardValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {userData?.role === 'admin' && (
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => handleProgressClick(goal)} className="text-slate-500 hover:text-emerald-400 transition-colors p-1" title="Atualizar Progresso">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleEditClick(goal)} className="text-slate-500 hover:text-cyan-400 transition-colors p-1" title="Editar Meta">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteClick(goal.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1" title="Excluir Meta">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-100 mb-1">{goal.title}</h3>
              
              <div className="flex items-center gap-2 mb-4">
                <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                  goal.type === 'general' ? 'bg-blue-500/20 text-blue-400' :
                  goal.type === 'team' ? 'bg-indigo-500/20 text-indigo-400' :
                  'bg-slate-800 text-slate-300'
                }`}>
                  {goal.type === 'general' ? 'Geral' : goal.type === 'team' ? 'Equipe' : 'Individual'}
                </span>
              </div>
              
              <div className="mt-auto pt-4">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-400">Progresso</span>
                  <span className="font-bold text-slate-200">
                    {goal.currentValue.toLocaleString('pt-BR')} / {goal.targetValue.toLocaleString('pt-BR')}
                  </span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
                  <div
                    className={`h-2.5 rounded-full transition-all duration-500 ${
                      isCompleted ? 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]' : 'bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.5)]'
                    }`}
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>
                <p className="text-right text-xs text-slate-500 mt-2 font-medium">
                  {progress.toFixed(1)}% concluído
                </p>
              </div>
            </div>
          );
        })}
        {goals.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
            Nenhuma meta definida ainda.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">{editingGoalId ? 'Editar Meta' : 'Nova Meta'}</h2>
            <form onSubmit={handleAddOrEditGoal} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Título da Meta</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newGoal.title}
                  onChange={e => setNewGoal({...newGoal, title: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Quantidade de Vendas</label>
                  <input
                    type="number"
                    required
                    min="1"
                    className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    value={newGoal.targetValue}
                    onChange={e => setNewGoal({...newGoal, targetValue: e.target.value})}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Premiação (R$)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    value={newGoal.rewardValue}
                    onChange={e => setNewGoal({...newGoal, rewardValue: e.target.value})}
                    placeholder="Opcional"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Tipo de Meta</label>
                <select
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newGoal.type}
                  onChange={e => setNewGoal({...newGoal, type: e.target.value})}
                >
                  <option value="individual">Individual</option>
                  <option value="team">Equipe</option>
                  <option value="general">Geral</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Prazo</label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all [color-scheme:dark]"
                  value={newGoal.deadline}
                  onChange={e => setNewGoal({...newGoal, deadline: e.target.value})}
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
                  {editingGoalId ? 'Salvar Alterações' : 'Salvar Meta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Progress Modal */}
      {isProgressModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold mb-6 text-slate-100">Atualizar Progresso</h2>
            <form onSubmit={handleUpdateProgress} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Valor Atual</label>
                <input
                  type="number"
                  required
                  min="0"
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newProgressValue}
                  onChange={e => setNewProgressValue(e.target.value)}
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsProgressModalOpen(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-slate-950 font-semibold bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)] w-full sm:w-auto order-1 sm:order-2"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

