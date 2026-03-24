import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Users, Settings, Edit, Trash2 } from 'lucide-react';

export const AdminTeams: React.FC = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', description: '' });
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'teams'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching teams:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const handleAddOrEditTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingTeamId) {
        await updateDoc(doc(db, 'teams', editingTeamId), {
          name: newTeam.name,
          description: newTeam.description,
        });
      } else {
        await addDoc(collection(db, 'teams'), {
          name: newTeam.name,
          description: newTeam.description,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setNewTeam({ name: '', description: '' });
      setEditingTeamId(null);
    } catch (error) {
      console.error("Error saving team:", error);
    }
  };

  const handleEditClick = (team: any) => {
    setNewTeam({ name: team.name, description: team.description });
    setEditingTeamId(team.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (teamId: string) => {
    if (window.confirm('Tem certeza que deseja excluir esta equipe?')) {
      try {
        await deleteDoc(doc(db, 'teams', teamId));
      } catch (error) {
        console.error("Error deleting team:", error);
      }
    }
  };

  const openNewModal = () => {
    setNewTeam({ name: '', description: '' });
    setEditingTeamId(null);
    setIsModalOpen(true);
  };

  if (loading) return <div className="text-slate-400">Carregando equipes...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Gerenciar Equipes</h1>
        <button
          onClick={openNewModal}
          className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors shadow-[0_0_10px_rgba(147,51,234,0.3)] w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Nova Equipe
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {teams.map((team) => (
          <div key={team.id} className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col hover:border-slate-700 transition-colors group">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl group-hover:bg-purple-500/20 transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleEditClick(team)} className="text-slate-500 hover:text-cyan-400 transition-colors p-1">
                  <Edit className="w-5 h-5" />
                </button>
                <button onClick={() => handleDeleteClick(team.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">{team.name}</h3>
            <p className="text-slate-400 text-sm flex-grow">{team.description}</p>
          </div>
        ))}
        {teams.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
            Nenhuma equipe cadastrada.
          </div>
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">{editingTeamId ? 'Editar Equipe' : 'Nova Equipe'}</h2>
            <form onSubmit={handleAddOrEditTeam} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome da Equipe</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  value={newTeam.name}
                  onChange={e => setNewTeam({...newTeam, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition-all"
                  rows={3}
                  value={newTeam.description}
                  onChange={e => setNewTeam({...newTeam, description: e.target.value})}
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
                  className="px-4 py-2 text-slate-950 font-semibold bg-purple-400 hover:bg-purple-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(192,132,252,0.2)] w-full sm:w-auto order-1 sm:order-2"
                >
                  {editingTeamId ? 'Salvar Alterações' : 'Salvar Equipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
