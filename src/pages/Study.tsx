import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, addDoc, updateDoc, deleteDoc, doc, arrayUnion, orderBy } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { Plus, BookOpen, CheckCircle, ExternalLink, FileText, Upload, Edit, Trash2, Link as LinkIcon } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const Study: React.FC = () => {
  const { userData } = useAuth();
  const [materials, setMaterials] = useState<any[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState({ title: '', description: '', link: '', deadline: '' });
  const [uploadType, setUploadType] = useState<'link' | 'file'>('link');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(null);
  
  // Summary Modal State
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [summaryText, setSummaryText] = useState('');

  // Admin View Summaries Modal State
  const [isViewSummariesModalOpen, setIsViewSummariesModalOpen] = useState(false);
  const [selectedMaterialConfirmations, setSelectedMaterialConfirmations] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'studyMaterials'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMaterials(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error fetching study materials:", error);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'studyConfirmations'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConfirmations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error fetching study confirmations:", error);
    });
    return unsubscribe;
  }, []);

  const handleAddOrEditMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userData?.role !== 'admin') return;

    if (uploadType === 'link' && !newMaterial.link && !editingMaterialId) {
      alert("Por favor, forneça um link para o material.");
      return;
    }

    if (uploadType === 'file' && !selectedFile && !editingMaterialId) {
      alert("Por favor, selecione um arquivo.");
      return;
    }

    try {
      setUploadingFile(true);
      let finalLink = newMaterial.link;

      if (uploadType === 'file' && selectedFile) {
        const fileRef = ref(storage, `studyMaterials/${Date.now()}_${selectedFile.name}`);
        await uploadBytes(fileRef, selectedFile);
        finalLink = await getDownloadURL(fileRef);
      }

      if (editingMaterialId) {
        const updateData: any = {
          title: newMaterial.title,
          description: newMaterial.description,
          deadline: new Date(newMaterial.deadline).toISOString(),
        };
        if (uploadType === 'link' && newMaterial.link) {
          updateData.link = newMaterial.link;
        } else if (uploadType === 'file' && selectedFile) {
          updateData.link = finalLink;
        }
        await updateDoc(doc(db, 'studyMaterials', editingMaterialId), updateData);
      } else {
        await addDoc(collection(db, 'studyMaterials'), {
          title: newMaterial.title,
          description: newMaterial.description,
          link: finalLink,
          deadline: new Date(newMaterial.deadline).toISOString(),
          createdAt: new Date().toISOString(),
          confirmedBy: []
        });
      }
      
      setIsModalOpen(false);
      setNewMaterial({ title: '', description: '', link: '', deadline: '' });
      setSelectedFile(null);
      setEditingMaterialId(null);
    } catch (error: any) {
      console.error("Error saving material:", error);
      alert("Erro ao salvar material: " + error.message);
    } finally {
      setUploadingFile(false);
    }
  };

  const handleEditClick = (material: any) => {
    setNewMaterial({ 
      title: material.title, 
      description: material.description, 
      link: material.link,
      deadline: material.deadline ? new Date(material.deadline).toISOString().split('T')[0] : '' 
    });
    setUploadType('link');
    setSelectedFile(null);
    setEditingMaterialId(material.id);
    setIsModalOpen(true);
  };

  const handleDeleteClick = async (materialId: string) => {
    if (window.confirm('Tem certeza que deseja excluir este material?')) {
      try {
        await deleteDoc(doc(db, 'studyMaterials', materialId));
      } catch (error) {
        console.error("Error deleting material:", error);
      }
    }
  };

  const openNewModal = () => {
    setNewMaterial({ title: '', description: '', link: '', deadline: '' });
    setUploadType('link');
    setSelectedFile(null);
    setEditingMaterialId(null);
    setIsModalOpen(true);
  };

  const openSummaryModal = (materialId: string) => {
    setSelectedMaterialId(materialId);
    setSummaryText('');
    setIsSummaryModalOpen(true);
  };

  const handleConfirmStudy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData || !selectedMaterialId) return;
    try {
      await addDoc(collection(db, 'studyConfirmations'), {
        materialId: selectedMaterialId,
        userId: userData.uid,
        username: userData.username,
        summary: summaryText,
        createdAt: new Date().toISOString()
      });
      
      // Update the material's confirmedBy array for quick counting
      await updateDoc(doc(db, 'studyMaterials', selectedMaterialId), {
        confirmedBy: arrayUnion(userData.username)
      });
      
      setIsSummaryModalOpen(false);
      setSelectedMaterialId(null);
      setSummaryText('');
    } catch (error) {
      console.error("Error confirming study:", error);
    }
  };

  const openViewSummariesModal = (materialId: string) => {
    const materialConfirmations = confirmations.filter(c => c.materialId === materialId);
    setSelectedMaterialConfirmations(materialConfirmations);
    setIsViewSummariesModalOpen(true);
  };

  if (loading) return <div className="text-slate-400">Carregando materiais...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-slate-100">Materiais de Estudo</h1>
        {userData?.role === 'admin' && (
          <button
            onClick={openNewModal}
            className="flex items-center px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-500 transition-colors shadow-[0_0_10px_rgba(8,145,178,0.3)] w-full sm:w-auto justify-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Novo Material
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {materials.map((material) => {
          const hasConfirmed = material.confirmedBy?.includes(userData?.username);
          
          return (
            <div key={material.id} className="bg-slate-900 p-6 rounded-2xl shadow-lg border border-slate-800 flex flex-col hover:border-slate-700 transition-colors group">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-xl group-hover:bg-blue-500/20 transition-colors">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="text-xs font-medium text-slate-400 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-full">
                    Prazo: {format(new Date(material.deadline), "dd/MM/yyyy")}
                  </span>
                  {userData?.role === 'admin' && (
                    <div className="flex gap-2">
                      <button onClick={() => handleEditClick(material)} className="text-slate-500 hover:text-cyan-400 transition-colors p-1">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDeleteClick(material.id)} className="text-slate-500 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              
              <h3 className="text-lg font-bold text-slate-100 mb-2">{material.title}</h3>
              <p className="text-slate-400 text-sm mb-4 flex-grow">{material.description}</p>
              
              {material.link && (
                <a 
                  href={material.link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-cyan-400 hover:text-cyan-300 mb-6 transition-colors"
                >
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  Acessar Material
                </a>
              )}

              <div className="mt-auto pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="text-sm text-slate-500">
                  {material.confirmedBy?.length || 0} confirmações
                </div>
                
                {userData?.role === 'admin' ? (
                  <button
                    onClick={() => openViewSummariesModal(material.id)}
                    className="flex items-center px-4 py-2 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 hover:bg-slate-700 transition-all"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver Resumos
                  </button>
                ) : (
                  <button
                    onClick={() => openSummaryModal(material.id)}
                    disabled={hasConfirmed}
                    className={`flex items-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      hasConfirmed 
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 cursor-not-allowed' 
                        : 'bg-cyan-600 text-white hover:bg-cyan-500 shadow-[0_0_10px_rgba(8,145,178,0.3)]'
                    }`}
                  >
                    {hasConfirmed ? (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmado
                      </>
                    ) : (
                      'Confirmar Leitura'
                    )}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {materials.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 bg-slate-900/50 rounded-2xl border border-dashed border-slate-700">
            Nenhum material de estudo disponível.
          </div>
        )}
      </div>

      {/* New Material Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">{editingMaterialId ? 'Editar Material' : 'Novo Material de Estudo'}</h2>
            <form onSubmit={handleAddOrEditMaterial} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Título</label>
                <input
                  type="text"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  value={newMaterial.title}
                  onChange={e => setNewMaterial({...newMaterial, title: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Descrição</label>
                <textarea
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  rows={3}
                  value={newMaterial.description}
                  onChange={e => setNewMaterial({...newMaterial, description: e.target.value})}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">Tipo de Anexo</label>
                <div className="flex gap-4 mb-4">
                  <button
                    type="button"
                    onClick={() => setUploadType('link')}
                    className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      uploadType === 'link' 
                        ? 'bg-cyan-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <LinkIcon className="w-4 h-4" />
                    Link URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setUploadType('file')}
                    className={`flex-1 py-2 px-4 rounded-lg flex items-center justify-center gap-2 transition-colors ${
                      uploadType === 'file' 
                        ? 'bg-cyan-600 text-white' 
                        : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    Arquivo
                  </button>
                </div>

                {uploadType === 'link' ? (
                  <input
                    type="url"
                    required={!editingMaterialId}
                    placeholder="https://..."
                    className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                    value={newMaterial.link}
                    onChange={e => setNewMaterial({...newMaterial, link: e.target.value})}
                  />
                ) : (
                  <div className="w-full">
                    <input
                      type="file"
                      required={!editingMaterialId}
                      onChange={e => setSelectedFile(e.target.files ? e.target.files[0] : null)}
                      className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/10 file:text-cyan-400 hover:file:bg-cyan-500/20"
                    />
                    {editingMaterialId && newMaterial.link && !selectedFile && (
                      <p className="text-xs text-slate-400 mt-2">
                        Arquivo atual: <a href={newMaterial.link} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">Ver anexo</a>
                      </p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Prazo para Leitura</label>
                <input
                  type="date"
                  required
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all [color-scheme:dark]"
                  value={newMaterial.deadline}
                  onChange={e => setNewMaterial({...newMaterial, deadline: e.target.value})}
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
                  disabled={uploadingFile}
                  className="px-4 py-2 text-slate-950 font-semibold bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)] w-full sm:w-auto order-1 sm:order-2 disabled:opacity-50"
                >
                  {uploadingFile ? 'Enviando...' : (editingMaterialId ? 'Salvar Alterações' : 'Salvar Material')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Summary Modal */}
      {isSummaryModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-md border border-slate-800 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6 text-slate-100">Confirmar Leitura</h2>
            <form onSubmit={handleConfirmStudy} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">Resumo do que foi aprendido</label>
                <p className="text-xs text-slate-500 mb-2">Escreva com suas próprias palavras os principais pontos que você absorveu deste material.</p>
                <textarea
                  required
                  minLength={20}
                  className="w-full px-4 py-2 border border-slate-700 bg-slate-950 text-slate-100 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent outline-none transition-all"
                  rows={5}
                  value={summaryText}
                  onChange={e => setSummaryText(e.target.value)}
                  placeholder="Eu aprendi que..."
                />
              </div>
              <div className="flex flex-col sm:flex-row justify-end gap-3 mt-8 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsSummaryModalOpen(false)}
                  className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full sm:w-auto order-2 sm:order-1"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-slate-950 font-semibold bg-cyan-400 hover:bg-cyan-300 rounded-lg transition-colors shadow-[0_0_10px_rgba(34,211,238,0.2)] w-full sm:w-auto order-1 sm:order-2"
                >
                  Enviar Resumo
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View Summaries Modal (Admin) */}
      {isViewSummariesModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl p-6 w-full max-w-2xl border border-slate-800 shadow-2xl max-h-[90vh] flex flex-col">
            <h2 className="text-xl font-bold mb-6 text-slate-100">Resumos Enviados</h2>
            <div className="overflow-y-auto flex-1 space-y-4 pr-2">
              {selectedMaterialConfirmations.length === 0 ? (
                <p className="text-slate-500 text-center py-8">Nenhum resumo enviado ainda.</p>
              ) : (
                selectedMaterialConfirmations.map((conf) => (
                  <div key={conf.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold text-cyan-400">@{conf.username}</span>
                      <span className="text-xs text-slate-500">
                        {format(new Date(conf.createdAt), "dd/MM/yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-slate-300 text-sm whitespace-pre-wrap">{conf.summary}</p>
                  </div>
                ))
              )}
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-slate-800">
              <button
                onClick={() => setIsViewSummariesModalOpen(false)}
                className="px-4 py-2 text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors w-full sm:w-auto"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

