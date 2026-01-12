
import React, { useState } from 'react';
import { AppState, Subject } from '../types';
import { Code, Save, Download, FileJson, Palette, Shield } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface Props {
  state: AppState;
  onUpdate: (updates: Partial<AppState>) => void;
}

const DevTools: React.FC<Props> = ({ state, onUpdate }) => {
  const { lang } = useAuth();
  const [jsonInput, setJsonInput] = useState(JSON.stringify(state, null, 2));
  const [activeTab, setActiveTab] = useState<'json' | 'subjects'>('json');

  const handleSave = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      onUpdate(parsed);
      alert('SUDO: Master state updated.');
    } catch (e) { alert('Syntax Error'); }
  };

  const updateSubject = (id: string, field: keyof Subject, value: any) => {
    const newSubjects = state.subjects.map(s => s.id === id ? { ...s, [field]: value } : s);
    onUpdate({ subjects: newSubjects });
  };

  return (
    <div className="space-y-8 animate-in zoom-in-95 duration-500 pb-24">
      <div className="flex justify-between items-center p-8 bg-slate-900 text-white rounded-[2.5rem]">
        <div className="flex items-center gap-5"><Code size={32} /> <h1 className="text-3xl font-black">Dev Console</h1></div>
        <button onClick={handleSave} className="bg-indigo-600 px-8 py-3 rounded-2xl font-black">Sync State</button>
      </div>
      <div className="flex gap-2"><button onClick={() => setActiveTab('json')} className="px-6 py-2.5 rounded-xl font-black bg-slate-900 text-white">JSON</button><button onClick={() => setActiveTab('subjects')} className="px-6 py-2.5 rounded-xl font-black bg-slate-200">Subjects</button></div>
      {activeTab === 'json' && <textarea className="w-full h-[600px] bg-slate-950 text-indigo-400 font-mono p-8 rounded-[2.5rem]" value={jsonInput} onChange={(e) => setJsonInput(e.target.value)} />}
      {activeTab === 'subjects' && <div className="grid grid-cols-1 md:grid-cols-2 gap-6">{state.subjects.map(s => <div key={s.id} className="bg-white p-6 rounded-[2rem] border"><input className="w-full font-black text-slate-900" value={s.name[lang]} onChange={(e) => updateSubject(s.id, 'name', { ...s.name, [lang]: e.target.value })} /></div>)}</div>}
    </div>
  );
};

export default DevTools;
