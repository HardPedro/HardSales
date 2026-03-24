import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Megaphone, Plus, Trash2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  createdBy: string;
}

export const Announcements: React.FC = () => {
  const { userData } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Announcement[];
      setAnnouncements(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching announcements:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim() || !userData) return;

    setSubmitting(true);
    try {
      await addDoc(collection(db, 'announcements'), {
        title: newTitle.trim(),
        content: newContent.trim(),
        createdAt: new Date().toISOString(),
        createdBy: userData.name
      });
      setNewTitle('');
      setNewContent('');
      setIsAdding(false);
    } catch (error) {
      console.error("Error adding announcement:", error);
      alert("Erro ao adicionar anúncio.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Tem certeza que deseja excluir este anúncio?")) return;
    try {
      await deleteDoc(doc(db, 'announcements', id));
    } catch (error) {
      console.error("Error deleting announcement:", error);
      alert("Erro ao excluir anúncio.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
            <Megaphone className="w-6 h-6 text-cyan-400" />
            Mural de Anúncios
          </h1>
          <p className="text-slate-400 mt-1">Avisos e comunicados importantes da equipe.</p>
        </div>
        
        {isAdmin && !isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Novo Anúncio
          </button>
        )}
      </div>

      {isAdding && isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-slate-200 mb-4">Criar Novo Anúncio</h2>
          <form onSubmit={handleAddAnnouncement} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="Ex: Nova Meta Mensal"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Conteúdo</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                required
                rows={4}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                placeholder="Escreva a mensagem do anúncio..."
              />
            </div>
            <div className="flex justify-end gap-3">
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
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {submitting ? 'Publicando...' : 'Publicar Anúncio'}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center">
            <Megaphone className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">Nenhum anúncio publicado ainda.</p>
          </div>
        ) : (
          announcements.map((announcement) => (
            <div key={announcement.id} className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative group">
              {isAdmin && (
                <button
                  onClick={() => handleDelete(announcement.id)}
                  className="absolute top-4 right-4 p-2 text-slate-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  title="Excluir anúncio"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <h3 className="text-xl font-semibold text-slate-200 mb-2 pr-10">{announcement.title}</h3>
              <p className="text-slate-300 whitespace-pre-wrap mb-4">{announcement.content}</p>
              <div className="flex items-center text-sm text-slate-500 gap-4">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {format(new Date(announcement.createdAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                </span>
                <span>•</span>
                <span>Publicado por {announcement.createdBy}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
