import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { PenTool, Plus, Trash2, Clock, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';

interface Whiteboard {
  id: string;
  title: string;
  createdAt: any;
  createdBy: string;
}

export const WhiteboardsList: React.FC = () => {
  const { userData } = useAuth();
  const [whiteboards, setWhiteboards] = useState<Whiteboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'whiteboards'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setWhiteboards(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Whiteboard)));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching whiteboards:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !isAdmin) return;

    setSubmitting(true);
    try {
      const docRef = await addDoc(collection(db, 'whiteboards'), {
        title: newTitle,
        data: null, // Initial empty canvas data
        createdAt: serverTimestamp(),
        createdBy: userData.uid
      });
      setNewTitle('');
      setIsAdding(false);
      navigate(`/whiteboards/${docRef.id}`);
    } catch (error) {
      console.error("Error adding whiteboard:", error);
      alert("Erro ao criar quadro branco.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin || !window.confirm('Tem certeza que deseja excluir este quadro branco?')) return;
    try {
      await deleteDoc(doc(db, 'whiteboards', id));
    } catch (error) {
      console.error("Error deleting whiteboard:", error);
      alert("Erro ao excluir quadro branco.");
    }
  };

  if (loading) return <div className="text-slate-400">Carregando quadros...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Quadros Brancos</h1>
          <p className="text-slate-400 mt-1">Anotações e desenhos da supervisão.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Quadro
          </button>
        )}
      </div>

      {isAdding && isAdmin && (
        <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 shadow-lg">
          <h2 className="text-xl font-semibold text-slate-100 mb-4">Criar Novo Quadro</h2>
          <form onSubmit={handleAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Título do Quadro</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="Ex: Estratégia de Vendas - Abril"
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Criando...' : 'Criar Quadro'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {whiteboards.map((board) => (
          <div key={board.id} className="bg-slate-900 rounded-xl border border-slate-800 shadow-lg overflow-hidden flex flex-col hover:border-slate-700 transition-colors">
            <div className="p-6 flex-1 cursor-pointer" onClick={() => navigate(`/whiteboards/${board.id}`)}>
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg text-cyan-400">
                  <PenTool className="w-6 h-6" />
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(board.id);
                    }}
                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="Excluir quadro"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <h3 className="text-lg font-semibold text-slate-100 mb-2 line-clamp-2">{board.title}</h3>
              <div className="flex items-center text-sm text-slate-500">
                <Clock className="w-4 h-4 mr-1.5" />
                {board.createdAt ? format(board.createdAt.toDate(), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR }) : 'Data indisponível'}
              </div>
            </div>
            <div 
              className="px-6 py-3 bg-slate-950/50 border-t border-slate-800 flex items-center justify-between text-sm text-cyan-400 hover:text-cyan-300 cursor-pointer transition-colors"
              onClick={() => navigate(`/whiteboards/${board.id}`)}
            >
              <span className="font-medium">{isAdmin ? 'Editar Quadro' : 'Visualizar Quadro'}</span>
              <ChevronRight className="w-4 h-4" />
            </div>
          </div>
        ))}
        {whiteboards.length === 0 && !loading && (
          <div className="col-span-full text-center py-12 text-slate-500 bg-slate-900/50 rounded-xl border border-slate-800 border-dashed">
            Nenhum quadro branco criado ainda.
          </div>
        )}
      </div>
    </div>
  );
};
