import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Trophy, TrendingUp, Target, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const Dashboard: React.FC = () => {
  const { userData } = useAuth();
  const [topSellers, setTopSellers] = useState<any[]>([]);
  const [activeTeams, setActiveTeams] = useState<number>(0);
  const [goalsAchieved, setGoalsAchieved] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userData) return;

    // Fetch reports for top sellers
    const qReports = query(collection(db, 'reports'), orderBy('approaches', 'desc'), limit(10));
    const unsubscribeReports = onSnapshot(qReports, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const userSales: Record<string, { name: string, volume: number }> = {};
      reports.forEach((r: any) => {
        if (!userSales[r.userId]) {
          userSales[r.userId] = { name: r.userName || r.userId, volume: 0 };
        }
        userSales[r.userId].volume += (r.approaches || 0);
      });

      const sortedSellers = Object.values(userSales).sort((a, b) => b.volume - a.volume);
      setTopSellers(sortedSellers);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching metrics:", error);
      setLoading(false);
    });

    // Fetch teams count
    const qTeams = query(collection(db, 'teams'));
    const unsubscribeTeams = onSnapshot(qTeams, (snapshot) => {
      setActiveTeams(snapshot.docs.length);
    }, (error) => {
      console.error("Error fetching teams:", error);
    });

    // Fetch goals achieved
    const qGoals = query(collection(db, 'goals'));
    const unsubscribeGoals = onSnapshot(qGoals, (snapshot) => {
      const allGoals = snapshot.docs.map(doc => doc.data());
      const achieved = allGoals.filter(g => {
        const progress = Math.min(((g.currentValue || 0) / (g.targetValue || 1)) * 100, 100);
        return progress >= 100;
      }).length;
      setGoalsAchieved(achieved);
    }, (error) => {
      console.error("Error fetching goals:", error);
    });

    return () => {
      unsubscribeReports();
      unsubscribeTeams();
      unsubscribeGoals();
    };
  }, [userData]);

  if (loading) return <div className="text-slate-400">Carregando dashboard...</div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold text-slate-100 tracking-tight">Dashboard</h1>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center relative z-10">
            <div className="p-4 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-slate-400">Total de Abordagens</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">
                {topSellers.reduce((acc, s) => acc + s.volume, 0).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center relative z-10">
            <div className="p-4 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Target className="h-6 w-6" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-slate-400">Metas Atingidas</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{goalsAchieved}</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center relative z-10">
            <div className="p-4 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Trophy className="h-6 w-6" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-slate-400">Top Abordagens</p>
              <p className="text-lg font-bold text-slate-100 mt-1 truncate">
                {topSellers[0]?.name || 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="flex items-center relative z-10">
            <div className="p-4 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users className="h-6 w-6" />
            </div>
            <div className="ml-5">
              <p className="text-sm font-medium text-slate-400">Equipes Ativas</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{activeTeams}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center">
            <Trophy className="w-5 h-5 mr-2 text-yellow-500" />
            Ranking de Vendedores
          </h2>
          <div className="space-y-3 flex-1">
            {topSellers.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-8">Nenhum dado disponível.</p>
            ) : (
              topSellers.map((seller, index) => (
                <div key={seller.name} className="flex items-center justify-between p-4 bg-slate-950/50 rounded-xl border border-slate-800/50 hover:border-slate-700 transition-colors">
                  <div className="flex items-center">
                    <span className={`flex items-center justify-center w-10 h-10 rounded-full font-bold text-sm border ${
                      index === 0 ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.2)]' :
                      index === 1 ? 'bg-slate-300/10 text-slate-300 border-slate-300/20' :
                      index === 2 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                      'bg-blue-500/10 text-blue-400 border-blue-500/20'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="ml-4 font-medium text-slate-200">{seller.name}</span>
                  </div>
                  <span className="font-bold text-cyan-400">
                    {seller.volume.toLocaleString('pt-BR')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800">
          <h2 className="text-lg font-bold text-slate-100 mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-cyan-400" />
            Abordagens por Vendedor
          </h2>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSellers.slice(0, 5)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                <XAxis dataKey="name" stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis stroke="#64748b" tick={{ fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip 
                  formatter={(value) => `${value} abordagens`}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9', borderRadius: '0.5rem' }}
                  itemStyle={{ color: '#22d3ee' }}
                />
                <Bar dataKey="volume" fill="#22d3ee" radius={[6, 6, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
