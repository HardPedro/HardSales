import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, setDoc, getDoc, collection, addDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, UserPlus, LogIn } from 'lucide-react';

export const Login: React.FC = () => {
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const email = `${username.trim()}@salesmanager.local`;

    if (isRequestingAccess) {
      try {
        // Create user in Auth
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        
        // Save request to access_requests collection
        await setDoc(doc(db, 'access_requests', userCredential.user.uid), {
          uid: userCredential.user.uid,
          name: name.trim(),
          username: username.trim(),
          status: 'pending',
          createdAt: new Date().toISOString()
        });

        // Sign out immediately so they don't enter the app
        await signOut(auth);

        setSuccess('Solicitação enviada com sucesso! Aguarde a aprovação do administrador.');
        setIsRequestingAccess(false);
        setName('');
        setPassword('');
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          setError('Este usuário já existe ou já solicitou acesso.');
        } else if (err.code === 'auth/weak-password') {
          setError('A senha deve ter pelo menos 6 caracteres.');
        } else {
          setError('Erro ao solicitar acesso. Tente novamente.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // If login succeeds, check if the user document exists
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      
      if (!userDoc.exists()) {
        // Check if it's the default admin
        if (username.trim() === 'harddisk') {
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            username: 'harddisk',
            name: 'Administrador',
            role: 'admin',
            createdAt: new Date().toISOString()
          });
        } else {
          // It's a regular user whose request hasn't been approved yet
          await signOut(auth);
          setError('Sua solicitação de acesso ainda está pendente de aprovação ou foi recusada.');
          setLoading(false);
          return;
        }
      }
      
      navigate(from, { replace: true });
    } catch (err: any) {
      // Auto-bootstrap default admin if it doesn't exist in Auth yet
      if (username.trim() === 'harddisk' && password === 'harddisk8inh' && err.code === 'auth/invalid-credential') {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          await setDoc(doc(db, 'users', userCredential.user.uid), {
            uid: userCredential.user.uid,
            username: 'harddisk',
            name: 'Administrador',
            role: 'admin',
            createdAt: new Date().toISOString()
          });
          navigate(from, { replace: true });
          return;
        } catch (createErr: any) {
          console.error("Erro ao criar admin padrão:", createErr);
          if (createErr.code === 'auth/email-already-in-use') {
            setError('Usuário ou senha incorretos.');
          } else {
            setError('Erro ao criar a conta de administrador padrão.');
          }
        }
      } else {
        setError('Usuário ou senha incorretos.');
        console.error(err);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-slate-900 p-10 rounded-2xl shadow-2xl border border-slate-800">
        <div className="flex flex-col items-center">
          <div className="p-4 bg-cyan-500/10 rounded-full mb-4">
            <Shield className="w-10 h-10 text-cyan-400" />
          </div>
          <h2 className="text-center text-3xl font-extrabold text-slate-100">
            HardSales
          </h2>
          <p className="mt-2 text-center text-sm text-slate-400">
            {isRequestingAccess ? 'Solicite acesso ao sistema' : 'Acesso restrito ao sistema'}
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-900/30 border border-red-800/50 text-red-400 px-4 py-3 rounded-lg text-sm text-center">
              {error}
            </div>
          )}
          {success && (
            <div className="bg-emerald-900/30 border border-emerald-800/50 text-emerald-400 px-4 py-3 rounded-lg text-sm text-center">
              {success}
            </div>
          )}
          <div className="space-y-4">
            {isRequestingAccess && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                  Nome Completo
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  className="appearance-none relative block w-full px-4 py-3 border border-slate-700 bg-slate-950 placeholder-slate-500 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors sm:text-sm"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
                Usuário
              </label>
              <input
                id="username"
                name="username"
                type="text"
                required
                className="appearance-none relative block w-full px-4 py-3 border border-slate-700 bg-slate-950 placeholder-slate-500 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors sm:text-sm"
                placeholder="Digite seu usuário"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                Senha
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="appearance-none relative block w-full px-4 py-3 border border-slate-700 bg-slate-950 placeholder-slate-500 text-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors sm:text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-bold rounded-lg text-slate-950 bg-cyan-400 hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-cyan-500 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:shadow-[0_0_25px_rgba(34,211,238,0.5)]"
            >
              {loading ? 'Aguarde...' : (isRequestingAccess ? 'Enviar Solicitação' : 'Entrar no Sistema')}
            </button>
            
            <button
              type="button"
              onClick={() => {
                setIsRequestingAccess(!isRequestingAccess);
                setError('');
                setSuccess('');
              }}
              className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors text-center flex items-center justify-center"
            >
              {isRequestingAccess ? (
                <>
                  <LogIn className="w-4 h-4 mr-2" />
                  Já tenho uma conta
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Solicitar acesso ao sistema
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
