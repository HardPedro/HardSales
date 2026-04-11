import React, { useState, useEffect, useRef } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../contexts/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';
import { ReactSketchCanvas, ReactSketchCanvasRef } from 'react-sketch-canvas';
import { ArrowLeft, Save, Undo, Redo, Eraser, PenTool, Trash2 } from 'lucide-react';

export const WhiteboardView: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [eraseMode, setEraseMode] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#06b6d4'); // cyan-500
  const [strokeWidth, setStrokeWidth] = useState(4);
  const [initialData, setInitialData] = useState<string | null>(null);
  
  const canvasRef = useRef<ReactSketchCanvasRef>(null);
  const isAdmin = userData?.role === 'admin';

  useEffect(() => {
    const fetchWhiteboard = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'whiteboards', id);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          const data = docSnap.data();
          setTitle(data.title);
          if (data.data) {
            setInitialData(data.data);
          }
        } else {
          alert("Quadro não encontrado.");
          navigate('/whiteboards');
        }
      } catch (error) {
        console.error("Error fetching whiteboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchWhiteboard();
  }, [id, navigate]);

  // Load paths after canvas is rendered
  useEffect(() => {
    if (!loading && initialData && canvasRef.current) {
      const timer = setTimeout(() => {
        try {
          canvasRef.current?.loadPaths(JSON.parse(initialData));
        } catch (e) {
          console.error("Error loading paths:", e);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [loading, initialData]);

  const handleSave = async () => {
    if (!id || !isAdmin || !canvasRef.current) return;
    
    setSaving(true);
    try {
      const paths = await canvasRef.current.exportPaths();
      await updateDoc(doc(db, 'whiteboards', id), {
        data: JSON.stringify(paths)
      });
      alert("Quadro salvo com sucesso!");
    } catch (error) {
      console.error("Error saving whiteboard:", error);
      alert("Erro ao salvar o quadro.");
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = () => canvasRef.current?.undo();
  const handleRedo = () => canvasRef.current?.redo();
  const handleClear = () => {
    if (window.confirm('Tem certeza que deseja limpar todo o quadro?')) {
      canvasRef.current?.clearCanvas();
    }
  };

  const handlePenMode = () => {
    setEraseMode(false);
    canvasRef.current?.eraseMode(false);
  };

  const handleEraserMode = () => {
    setEraseMode(true);
    canvasRef.current?.eraseMode(true);
  };

  if (loading) return <div className="text-slate-400 p-4">Carregando quadro...</div>;

  return (
    <div className="space-y-4 h-[calc(100vh-6rem)] sm:h-[calc(100vh-8rem)] flex flex-col">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 shrink-0 w-full">
        <div className="flex items-center w-full xl:w-auto">
          <button 
            onClick={() => navigate('/whiteboards')}
            className="p-2 mr-2 sm:mr-3 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight truncate">{title}</h1>
        </div>
        
        {isAdmin && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-900 p-2 rounded-lg border border-slate-800 w-full xl:w-auto">
            <div className="flex items-center gap-1 sm:gap-2 pr-2 sm:pr-4 border-r border-slate-800">
              <button
                onClick={handlePenMode}
                className={`p-2 rounded-lg transition-colors ${!eraseMode ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-800'}`}
                title="Caneta"
              >
                <PenTool className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={handleEraserMode}
                className={`p-2 rounded-lg transition-colors ${eraseMode ? 'bg-cyan-500/20 text-cyan-400' : 'text-slate-400 hover:bg-slate-800'}`}
                title="Borracha"
              >
                <Eraser className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <input 
                type="color" 
                value={strokeColor} 
                onChange={(e) => setStrokeColor(e.target.value)}
                className="w-6 h-6 sm:w-8 sm:h-8 rounded cursor-pointer bg-transparent border-0 p-0"
                disabled={eraseMode}
                title="Cor da Caneta"
              />
              <input 
                type="range" 
                min="1" 
                max="20" 
                value={strokeWidth} 
                onChange={(e) => setStrokeWidth(parseInt(e.target.value))}
                className="w-16 sm:w-24 accent-cyan-500"
                title="Espessura"
              />
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 pl-1 sm:pl-2">
              <button onClick={handleUndo} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors" title="Desfazer">
                <Undo className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button onClick={handleRedo} className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors" title="Refazer">
                <Redo className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button onClick={handleClear} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Limpar Tudo">
                <Trash2 className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button 
                onClick={handleSave} 
                disabled={saving}
                className="flex items-center px-2 sm:px-3 py-1.5 sm:py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors ml-1 sm:ml-2 disabled:opacity-50 text-sm sm:text-base"
              >
                <Save className="w-4 h-4 mr-1 sm:mr-2" />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 bg-white rounded-xl overflow-hidden border border-slate-800 shadow-lg relative min-h-[300px] touch-none">
        {!isAdmin && (
          <div className="absolute top-4 right-4 z-10 bg-slate-900/80 backdrop-blur text-slate-300 px-3 py-1.5 rounded-full text-sm font-medium border border-slate-700 flex items-center">
            <PenTool className="w-4 h-4 mr-2 text-cyan-400" />
            Modo de Visualização
          </div>
        )}
        <ReactSketchCanvas
          ref={canvasRef}
          strokeWidth={eraseMode ? strokeWidth * 2 : strokeWidth}
          strokeColor={strokeColor}
          eraserWidth={strokeWidth * 2}
          className="w-full h-full"
          canvasColor="#ffffff"
          style={{ border: 'none' }}
          readOnly={!isAdmin}
          withTimestamp={true}
        />
      </div>
    </div>
  );
};
