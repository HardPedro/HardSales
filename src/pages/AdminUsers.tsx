import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { auth, db, firebaseConfig } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Edit2, Trash2, User, Shield, AtSign } from 'lucide-react';

// Initialize a secondary app for user creation so the admin doesn't get logged out
const secondaryApp = getApps().find(app => app.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export const AdminUsers: React.FC = () => {
  const { userData } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [teams, setTeams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({ username: '', password: '', name: '', role: 'user', teamId: '' });
  const [error, setError] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (userData?.role !== 'admin') return;

    const q = query(collection(db, 'users'));
    const unsubscribeUsers = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, (snapshot) => {
      setTeams(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching teams:", error);
    });

    return () => {
      unsubscribeUsers();
      unsubscribeTeams();
    };
  }, [userData]);

  const handleOpenAdd = () => {
    setIsEditMode(false);
    setEditingUserId(null);
    setNewUser({ username: '', password: '', name: '', role: 'user', teamId: '' });
    setError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (user: any) => {
    setIsEditMode(true);
    setEditingUserId(user.id);
    setNewUser({ username: user.username, password: '', name: user.name, role: user.role, teamId: user.teamId || '' });
    setError(null);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userData?.role !== 'admin') return;

    try {
      if (isEditMode && editingUserId) {
        // Update existing user in Firestore
        await updateDoc(doc(db, 'users', editingUserId), {
          name: newUser.name,
          role: newUser.role,
          teamId: newUser.teamId || null,
        });
      } else {
        // Create user in Auth using secondary app to avoid logging out the admin
        const fakeEmail = `${newUser.username.trim()}@salesmanager.local`;
        let uid = '';
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, fakeEmail, newUser.password);
          uid = userCredential.user.uid;
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
             // If the user already exists in Auth (e.g., was deleted from Firestore but not Auth),
             // try to sign in to get their UID and recreate their Firestore document.
             try {
               const userCredential = await signInWithEmailAndPassword(secondaryAuth, fakeEmail, newUser.password);
               uid = userCredential.user.uid;
             } catch (signInError: any) {
               if (signInError.code === 'auth/wrong-password' || signInError.code === 'auth/invalid-credential') {
                 throw new Error('auth/email-already-in-use-wrong-password');
               }
               throw signInError;
             }
          } else {
            throw authError;
          }
        }

        // Sign out from the secondary app
        await secondaryAuth.signOut();

        // Create user document in Firestore
        await setDoc(doc(db, 'users', uid), {
          uid: uid,
          username: newUser.username.trim(),
          name: newUser.name,
          role: newUser.role,
          teamId: newUser.teamId || null,
          createdAt: new Date().toISOString()
        });
      }

      setIsModalOpen(false);
      setNewUser({ username: '', password: '', name: '', role: 'user', teamId: '' });
      setError(null);
    } catch (err: any) {
      console.error("Error saving user:", err);
      if (err.code === 'auth/email-already-in-use' || err.message === 'auth/email-already-in-use-wrong-password') {
        setError("Este nome de usuário já está em uso. Se você excluiu este usuário recentemente, a senha deve ser a mesma de antes para recriá-lo.");
      } else if (err.code === 'auth/weak-password') {
        setError("A senha deve ter pelo menos 6 caracteres.");
      } else {
        setError("Erro ao salvar usuário: " + err.message);
      }
    }
  };

  const handleDeleteUser = async () => {
    if (userToDelete) {
      try {
        await deleteDoc(doc(db, 'users', userToDelete));
        setUserToDelete(null);
      } catch (err) {
        console.error("Error deleting user:", err);
      }
    }
  };

  if (loading) return <div className="text-slate-400">Carregando usuários...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Gestão de Usuários</h1>
        <button
          onClick={handleOpenAdd}
          className="flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors shadow-[0_0_10px_rgba(8,145,178,0.3)] w-full sm:w-auto justify-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Novo Usuário
        </button>
      </div>

      <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-800 overflow-hidden overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Usuário</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Nível</th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Equipe</th>
              <th className="px-6 py-4 text-right text-xs font-semibold text-slate-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-10 w-10 bg-slate-800 rounded-full flex items-center justify-center border border-slate-700">
                      <User className="h-5 w-5 text-cyan-400" />
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-slate-200">{user.name}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-slate-400">
                    <AtSign className="flex-shrink-0 mr-1.5 h-4 w-4 text-slate-500" />
                    {user.username}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                    user.role === 'admin' 
                      ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' 
                      : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                  }`}>
                    {user.role === 'admin' && <Shield className="w-3 h-3 mr-1" />}
                    {user.role === 'admin' ? 'Administrador' : 'Vendedor'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-slate-300">
                    {user.teamId ? teams.find(t => t.id === user.teamId)?.name || 'Equipe não encontrada' : 'Sem equipe'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleOpenEdit(user)}
                    className="text-cyan-400 hover:text-cyan-300 mr-4 transition-colors p-2 hover:bg-cyan-400/10 rounded-lg"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setUserToDelete(user.id)}
                    className="text-red-400 hover:text-red-300 transition-colors p-2 hover:bg-red-400/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">{isEditMode ? 'Editar Usuário' : 'Novo Usuário'}</h2>
            
            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSaveUser} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newUser.name}
                  onChange={e => setNewUser({...newUser, name: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Usuário de Acesso</label>
                <input
                  type="text"
                  required
                  disabled={isEditMode}
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  value={newUser.username}
                  onChange={e => setNewUser({...newUser, username: e.target.value})}
                />
              </div>
              {!isEditMode && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Senha</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    value={newUser.password}
                    onChange={e => setNewUser({...newUser, password: e.target.value})}
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Nível de Acesso</label>
                <select
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newUser.role}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}
                >
                  <option value="user">Vendedor</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Equipe</label>
                <select
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newUser.teamId}
                  onChange={e => setNewUser({...newUser, teamId: e.target.value})}
                >
                  <option value="">Sem equipe</option>
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
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
                  {isEditMode ? 'Salvar Alterações' : 'Criar Usuário'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {userToDelete && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-sm border border-slate-800 shadow-2xl">
            <h2 className="text-xl font-bold mb-4 text-slate-100">Excluir Usuário</h2>
            <p className="text-slate-300 mb-6">Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setUserToDelete(null)}
                className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteUser}
                className="px-4 py-2 text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors shadow-[0_0_10px_rgba(239,68,68,0.3)]"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
